import crypto from "node:crypto";
import { Queue, Worker } from "bullmq";
import WebhookDelivery from "../models/WebhookDelivery.js";
import { redisConnection } from "../config/redis.js";

export const webhookQueue = new Queue("payflow-webhook-delivery", { connection: redisConnection });

export function signPayload(rawBody) {
  return crypto.createHmac("sha256", process.env.WEBHOOK_SECRET).update(rawBody).digest("hex");
}

export function verifySignature(rawBody, signature) {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signPayload(rawBody), "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export async function queuePaymentEvent({ merchantId, payment, type }) {
  const eventId = crypto.randomUUID();
  const payload = {
    id: eventId,
    type,
    createdAt: new Date().toISOString(),
    data: { payment: {
      id: String(payment._id), amount: payment.amount,
      currency: payment.currency, status: payment.status
    }}
  };
  const targetUrl = "http://127.0.0.1:5001/api/webhooks/demo-receiver";
  await WebhookDelivery.create({ eventId, merchantId, paymentId: payment._id, targetUrl, payload });
  await webhookQueue.add("deliver", { eventId }, {
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 100
  });
}

export function startWebhookWorker() {
  return new Worker("payflow-webhook-delivery", async job => {
    const record = await WebhookDelivery.findOne({ eventId: job.data.eventId });
    if (!record || record.status === "DELIVERED") return;

    const rawBody = JSON.stringify(record.payload);
    const signature = signPayload(rawBody);
    const response = await fetch(record.targetUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-payflow-signature": signature,
        "x-payflow-event-id": record.eventId
      },
      body: rawBody,
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) throw new Error(`Webhook receiver returned ${response.status}`);
    record.status = "DELIVERED";
    record.attempts = job.attemptsMade + 1;
    record.deliveredAt = new Date();
    record.lastError = undefined;
    await record.save();
  }, { connection: redisConnection });
}
