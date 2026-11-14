import Merchant from "../models/Merchant.js";
import { sha256 } from "../utils/hash.js";

export async function requireMerchant(req, res, next) {
  try {
    const header = req.header("authorization") || "";
    const [scheme, key] = header.split(" ");
    if (scheme !== "Bearer" || !key) return res.status(401).json({ message: "Merchant API key required" });

    const merchant = await Merchant.findOne({ apiKeyHash: sha256(key), active: true });
    if (!merchant) return res.status(401).json({ message: "Invalid merchant API key" });
    req.merchant = merchant;
    next();
  } catch (error) { next(error); }
}
