import crypto from "node:crypto";

// Deterministic educational provider adapter. It never contacts a bank or moves money.
export const providerSimulator = {
  async authorize(payment) {
    return { approved: true, reference: `SIM-AUTH-${crypto.randomUUID()}` };
  },
  async capture(payment) {
    return { captured: true, reference: `SIM-CAP-${crypto.randomUUID()}` };
  },
  async refund(payment) {
    return { refunded: true, reference: `SIM-REF-${crypto.randomUUID()}` };
  }
};
