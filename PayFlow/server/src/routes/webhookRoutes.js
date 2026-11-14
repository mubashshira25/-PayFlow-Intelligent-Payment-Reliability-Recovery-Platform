import { Router } from "express";
import { verifySignature } from "../services/webhookService.js";

const router = Router();

router.post("/demo-receiver", (req, res) => {
  const signature = req.header("x-payflow-signature");
  if (!verifySignature(req.rawBody, signature)) {
    return res.status(401).json({ message: "Invalid webhook signature" });
  }
  res.status(200).json({
    received: true,
    eventId: req.header("x-payflow-event-id"),
    type: req.body.type
  });
});

export default router;
