import mongoose from "mongoose";

const schema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true, default: "INR", uppercase: true },
  description: { type: String, trim: true, maxlength: 240, default: "" },
  customerReference: { type: String, trim: true, maxlength: 120, default: "" },
  status: {
    type: String,
    enum: ["CREATED", "AUTHORIZED", "CAPTURED", "FAILED", "VOIDED", "REFUNDED"],
    default: "CREATED",
    index: true
  },
  provider: { type: String, default: "SIMULATOR" },
  providerReference: { type: String, default: "" },
  capturedAmount: { type: Number, default: 0 },
  refundedAmount: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model("Payment", schema);
