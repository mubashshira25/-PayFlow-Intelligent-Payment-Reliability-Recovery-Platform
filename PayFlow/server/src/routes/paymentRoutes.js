import { Router } from "express";
import {
  createPayment, listPayments, getPayment, authorizePayment,
  capturePayment, refundPayment, paymentEvents, listLedger, listWebhookDeliveries
} from "../controllers/paymentController.js";

const router = Router();
router.post("/payments", createPayment);
router.get("/payments", listPayments);
router.get("/payments/:id", getPayment);
router.post("/payments/:id/authorize", authorizePayment);
router.post("/payments/:id/capture", capturePayment);
router.post("/payments/:id/refund", refundPayment);
router.get("/payments/:id/events", paymentEvents);
router.get("/ledger", listLedger);
router.get("/webhook-deliveries", listWebhookDeliveries);
export default router;
