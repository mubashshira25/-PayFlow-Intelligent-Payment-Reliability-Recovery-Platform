import mongoose from "mongoose";

const schema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true, index: true },
  type: { type: String, required: true },
  fromStatus: String,
  toStatus: String,
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export default mongoose.model("PaymentEvent", schema);
