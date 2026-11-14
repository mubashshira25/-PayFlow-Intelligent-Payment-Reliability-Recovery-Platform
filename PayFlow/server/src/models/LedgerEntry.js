import mongoose from "mongoose";

const schema = new mongoose.Schema({
  journalId: { type: String, required: true },
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true },
  account: { type: String, enum: ["CUSTOMER_CLEARING", "MERCHANT_PAYABLE", "REFUND_CLEARING"], required: true },
  side: { type: String, enum: ["DEBIT", "CREDIT"], required: true },
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true },
  memo: String
}, { timestamps: true });

schema.index({ journalId: 1, account: 1, side: 1 });
export default mongoose.model("LedgerEntry", schema);
