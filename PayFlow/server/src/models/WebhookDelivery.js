import mongoose from "mongoose";

const schema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true },
  targetUrl: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ["PENDING", "DELIVERED", "FAILED"], default: "PENDING" },
  attempts: { type: Number, default: 0 },
  lastError: String,
  deliveredAt: Date
}, { timestamps: true });

export default mongoose.model("WebhookDelivery", schema);
