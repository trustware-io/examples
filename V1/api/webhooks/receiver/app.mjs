import { appendFileSync } from "node:fs";
import express from "express";
import { fileURLToPath } from "node:url";
import { Webhook, WebhookVerificationError } from "standardwebhooks";

// The eight documented types: https://docs.trustware.io/webhooks/event-types
// Trustware may add types, so anything else is acknowledged and recorded with
// known_type: false, not dropped.
export const EVENT_TYPES = new Set([
  "route_intent.submitted",
  "route_intent.bridging",
  "route_intent.success",
  "route_intent.failed",
  "route_intent.expired",
  "route_intent.source_tx_replaced",
  "route_intent.approve_confirmed",
  "route_intent.destination_tx_seen",
]);

// Trustware never sends a body over 256 KiB.
const BODY_LIMIT = "256kb";

const PUBLIC_DIR = fileURLToPath(new URL("./public/", import.meta.url));

export function createApp({ secret, logPath, log = console.log }) {
  if (!secret) throw new Error("createApp: secret is required (WEBHOOK_SECRET, whsec_...)");
  if (!logPath) throw new Error("createApp: logPath is required");

  const verifier = new Webhook(secret);
  // Retries reuse webhook-id, so a second delivery of one id is a duplicate.
  const seenIds = new Set();
  const events = [];
  // Rejected deliveries stay in memory only: they are for watching a forged
  // or misconfigured request fail, not for replay.
  const rejections = [];

  const app = express();
  app.use(express.static(PUBLIC_DIR));

  app.post(
    "/webhooks",
    // Raw bytes: the signature covers the exact body, so it must not be
    // parsed and re-serialized before verification.
    express.raw({ type: "application/json", limit: BODY_LIMIT }),
    (req, res) => {
      const body = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
      let envelope;
      try {
        envelope = verifier.verify(body, {
          "webhook-id": req.get("webhook-id") ?? "",
          "webhook-timestamp": req.get("webhook-timestamp") ?? "",
          "webhook-signature": req.get("webhook-signature") ?? "",
        });
      } catch (err) {
        if (!(err instanceof WebhookVerificationError)) throw err;
        rejections.push({
          received_at: new Date().toISOString(),
          webhook_id: req.get("webhook-id") ?? null,
          reason: err.message,
        });
        log(`REJECTED ${req.get("webhook-id") ?? "(no webhook-id)"}: ${err.message}`);
        return res.status(400).json({ error: err.message });
      }

      const id = req.get("webhook-id");
      const duplicate = seenIds.has(id);
      seenIds.add(id);

      const record = {
        received_at: new Date().toISOString(),
        webhook_id: id,
        duplicate,
        known_type: EVENT_TYPES.has(envelope.type),
        user_agent: req.get("user-agent") ?? null,
        envelope,
      };
      events.push(record);
      appendFileSync(logPath, JSON.stringify(record) + "\n");

      const data = envelope.data ?? {};
      log(
        [
          duplicate ? "DUPLICATE" : "VERIFIED",
          envelope.type,
          `seq=${envelope.sequence}`,
          envelope.test ? "test=true" : null,
          data.intent_id ? `intent=${data.intent_id}` : null,
          data.status ? `status=${data.status}` : null,
          record.known_type ? null : "UNKNOWN-TYPE",
        ]
          .filter(Boolean)
          .join(" "),
      );
      return res.status(204).end();
    },
  );

  app.get("/events", (_req, res) => res.json(events));
  app.get("/rejections", (_req, res) => res.json(rejections));

  return app;
}
