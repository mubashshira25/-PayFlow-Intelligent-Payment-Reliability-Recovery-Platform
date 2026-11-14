import "dotenv/config";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Merchant from "../models/Merchant.js";
import { sha256 } from "../utils/hash.js";

await connectDB();
const apiKey = `pf_test_${crypto.randomBytes(24).toString("hex")}`;
const merchant = await Merchant.create({
  name: process.env.DEMO_MERCHANT_NAME || "PayFlow Demo Merchant",
  apiKeyHash: sha256(apiKey)
});
console.log("\nDemo merchant created.");
console.log(`Merchant ID: ${merchant._id}`);
console.log(`API KEY (copy now; it is not stored in plaintext): ${apiKey}\n`);
await mongoose.disconnect();
process.exit(0);
