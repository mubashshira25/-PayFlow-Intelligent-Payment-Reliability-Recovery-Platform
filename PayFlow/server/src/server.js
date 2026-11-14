import "dotenv/config";
import { connectDB } from "./config/db.js";
import app from "./app.js";
import { startWebhookWorker } from "./services/webhookService.js";
import { redisConnection } from "./config/redis.js";

const port = process.env.PORT || 5001;
await connectDB();
const worker = startWebhookWorker();
const server = app.listen(port, () => console.log(`PayFlow API listening at http://localhost:${port}`));

async function shutdown() {
  console.log("Shutting down PayFlow...");
  await new Promise(resolve => server.close(resolve));
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
