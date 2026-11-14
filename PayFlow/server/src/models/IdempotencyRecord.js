import mongoose from "mongoose";

const schema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true },
  key: { type: String, required: true },
  requestHash: { type: String, required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true }
}, { timestamps: true });

schema.index({ merchantId: 1, key: 1 }, { unique: true });
export default mongoose.model("IdempotencyRecord", schema);
