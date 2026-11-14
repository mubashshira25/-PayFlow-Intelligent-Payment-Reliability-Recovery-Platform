import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import paymentRoutes from "./routes/paymentRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import { requireMerchant } from "./middleware/auth.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(rateLimit({ windowMs: 60_000, limit: 150 }));

// Preserve exact raw bytes for HMAC verification. JSON parsing is done after rawBody capture.
app.use(express.json({
  limit: "100kb",
  verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); }
}));

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "payflow-api" }));
app.use("/api/webhooks", webhookRoutes);
app.use("/api/v1", requireMerchant, paymentRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
