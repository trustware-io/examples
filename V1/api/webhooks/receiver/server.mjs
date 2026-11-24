import { fileURLToPath } from "node:url";
import { createApp } from "./app.mjs";

const PORT = 8787;
const HOST = "127.0.0.1";
const secret = process.env.WEBHOOK_SECRET;
if (!secret) {
  console.error("WEBHOOK_SECRET is not set. Copy the whsec_... signing secret from your project's Webhooks panel in the Client Dashboard.");
  process.exit(1);
}

const app = createApp({ secret, logPath: fileURLToPath(new URL("./events.jsonl", import.meta.url)) });
app.listen(PORT, HOST, () => {
  console.log(`Listening on http://${HOST}:${PORT}/webhooks (events at /events, log in events.jsonl)`);
});
