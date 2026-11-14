import mongoose from "mongoose";

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  apiKeyHash: { type: String, required: true, unique: true, select: false },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("Merchant", schema);
