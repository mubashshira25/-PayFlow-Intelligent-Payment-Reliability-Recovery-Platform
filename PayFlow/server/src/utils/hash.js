import crypto from "node:crypto";

export const sha256 = value =>
  crypto.createHash("sha256").update(value).digest("hex");

export const safeEqualHex = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
};
