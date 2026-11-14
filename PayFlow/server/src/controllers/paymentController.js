import crypto from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import Payment from "../models/Payment.js";
import IdempotencyRecord from "../models/IdempotencyRecord.js";
import PaymentEvent from "../models/PaymentEvent.js";
import LedgerEntry from "../models/LedgerEntry.js";
import WebhookDelivery from "../models/WebhookDelivery.js";
import { postJournal } from "../services/ledgerService.js";
import { providerSimulator } from "../services/providerSimulator.js";
import { queuePaymentEvent } from "../services/webhookService.js";

const createSchema = z.object({
  amount: z.number().int().positive().max(100000000),
  currency: z.string().length(3).default("INR"),
  description: z.string().max(240).optional().default(""),
  customerReference: z.string().max(120).optional().default("")
});

export async function createPayment(req, res, next) {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid payment payload", errors: parsed.error.flatten() });

    const key = req.header("idempotency-key");
    if (!key || key.length < 8 || key.length > 128) {
      return res.status(400).json({ message: "Idempotency-Key header must be 8-128 characters" });
    }

    const normalized = JSON.stringify(parsed.data);
    const requestHash = crypto.createHash("sha256").update(normalized).digest("hex");
    const existing = await IdempotencyRecord.findOne({ merchantId: req.merchant._id, key }).populate("paymentId");
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return res.status(409).json({ message: "Idempotency key reused with a different payload" });
      }
      return res.status(200).json({ payment: existing.paymentId, idempotentReplay: true });
    }

    const session = await mongoose.startSession();
    let payment;
    try {
      await session.withTransaction(async () => {
        [payment] = await Payment.create([{
          merchantId: req.merchant._id,
          ...parsed.data,
          currency: parsed.data.currency.toUpperCase()
        }], { session });

        await PaymentEvent.create([{
          merchantId: req.merchant._id,
          paymentId: payment._id,
          type: "PAYMENT_CREATED",
          toStatus: "CREATED"
        }], { session });

        await IdempotencyRecord.create([{
          merchantId: req.merchant._id, key, requestHash, paymentId: payment._id
        }], { session });
      });
    } finally {
      await session.endSession();
    }
    await queuePaymentEvent({ merchantId: req.merchant._id, payment, type: "payment.created" });
    res.status(201).json({ payment, idempotentReplay: false });
  } catch (error) { next(error); }
}

export async function listPayments(req, res, next) {
  try {
    const payments = await Payment.find({ merchantId: req.merchant._id }).sort({ createdAt: -1 }).limit(100);
    res.json(payments);
  } catch (error) { next(error); }
}

export async function getPayment(req, res, next) {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, merchantId: req.merchant._id });
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    res.json(payment);
  } catch (error) { next(error); }
}

async function updateState({ req, nextStatus, allowedStatuses, eventType, providerAction, ledgerConfig }) {
  const session = await mongoose.startSession();
  let updated;
  try {
    await session.withTransaction(async () => {
      const payment = await Payment.findOne({
        _id: req.params.id, merchantId: req.merchant._id
      }).session(session);

      if (!payment) throw Object.assign(new Error("Payment not found"), { statusCode: 404 });
      if (!allowedStatuses.includes(payment.status)) {
        throw Object.assign(new Error(`Invalid transition from ${payment.status} to ${nextStatus}`), { statusCode: 409 });
      }

      const providerResult = await providerAction(payment);
      if (!providerResult.approved && !providerResult.captured && !providerResult.refunded) {
        throw Object.assign(new Error("Provider operation was not approved"), { statusCode: 502 });
      }

      const previous = payment.status;
      payment.status = nextStatus;
      payment.providerReference = providerResult.reference;
      if (nextStatus === "CAPTURED") payment.capturedAmount = payment.amount;
      if (nextStatus === "REFUNDED") payment.refundedAmount = payment.amount;
      await payment.save({ session });

      await PaymentEvent.create([{
        merchantId: req.merchant._id,
        paymentId: payment._id,
        type: eventType,
        fromStatus: previous,
        toStatus: nextStatus,
        metadata: { providerReference: providerResult.reference }
      }], { session });

      if (ledgerConfig) {
        await postJournal({
          journalId: `${ledgerConfig.prefix}-${payment._id}`,
          merchantId: req.merchant._id,
          paymentId: payment._id,
          amount: payment.amount,
          currency: payment.currency,
          debitAccount: ledgerConfig.debitAccount,
          creditAccount: ledgerConfig.creditAccount,
          memo: ledgerConfig.memo
        }, session);
      }
      updated = payment;
    });
  } finally {
    await session.endSession();
  }

  await queuePaymentEvent({ merchantId: req.merchant._id, payment: updated, type: eventType.toLowerCase().replaceAll("_", ".") });
  return updated;
}

export async function authorizePayment(req, res, next) {
  try {
    const payment = await updateState({
      req, nextStatus: "AUTHORIZED", allowedStatuses: ["CREATED"],
      eventType: "PAYMENT_AUTHORIZED", providerAction: providerSimulator.authorize
    });
    res.json({ payment, provider: "SIMULATOR" });
  } catch (error) { next(error); }
}

export async function capturePayment(req, res, next) {
  try {
    const payment = await updateState({
      req, nextStatus: "CAPTURED", allowedStatuses: ["AUTHORIZED"],
      eventType: "PAYMENT_CAPTURED", providerAction: providerSimulator.capture,
      ledgerConfig: {
        prefix: "capture", debitAccount: "CUSTOMER_CLEARING",
        creditAccount: "MERCHANT_PAYABLE", memo: "Simulated payment capture"
      }
    });
    res.json({ payment, provider: "SIMULATOR" });
  } catch (error) { next(error); }
}

export async function refundPayment(req, res, next) {
  try {
    const payment = await updateState({
      req, nextStatus: "REFUNDED", allowedStatuses: ["CAPTURED"],
      eventType: "PAYMENT_REFUNDED", providerAction: providerSimulator.refund,
      ledgerConfig: {
        prefix: "refund", debitAccount: "MERCHANT_PAYABLE",
        creditAccount: "REFUND_CLEARING", memo: "Simulated full refund"
      }
    });
    res.json({ payment, provider: "SIMULATOR" });
  } catch (error) { next(error); }
}

export async function paymentEvents(req, res, next) {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, merchantId: req.merchant._id });
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    res.json(await PaymentEvent.find({ paymentId: payment._id }).sort({ createdAt: 1 }));
  } catch (error) { next(error); }
}

export async function listLedger(req, res, next) {
  try {
    res.json(await LedgerEntry.find({ merchantId: req.merchant._id }).sort({ createdAt: -1 }).limit(200));
  } catch (error) { next(error); }
}

export async function listWebhookDeliveries(req, res, next) {
  try {
    res.json(await WebhookDelivery.find({ merchantId: req.merchant._id }).sort({ createdAt: -1 }).limit(100));
  } catch (error) { next(error); }
}
