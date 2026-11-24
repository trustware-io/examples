# Webhook receiver

A local test endpoint for [Trustware webhooks](https://docs.trustware.io/webhooks/overview). It verifies each delivery's [Standard Webhooks v1 signature](https://docs.trustware.io/webhooks/verify-signatures) over the raw request body with the official `standardwebhooks` library, then:

- answers `204` to a verified delivery and `400` with the reason when verification fails,
- labels a second delivery of the same `webhook-id` as a duplicate (retries and redeliveries reuse the id),
- labels any `type` outside the eight [documented event types](https://docs.trustware.io/webhooks/event-types) as unknown, and still answers `204`,
- appends each verified delivery to `events.jsonl` and lists them at `GET /events`,
- keeps verification failures in memory at `GET /rejections`,
- shows both live at http://127.0.0.1:8787/.

It is for watching what Trustware sends, not a production handler. See [Limitations](#limitations).

## Run

Use Node 20 or later. From this directory:

```sh
npm ci --ignore-scripts
WEBHOOK_SECRET='whsec_...' npm start
```

`WEBHOOK_SECRET` is your project's signing secret. The receiver refuses to start without it and listens on `127.0.0.1:8787` only. Never commit the secret.

## Receive real deliveries (optional)

Trustware delivers only to a public `https` URL on port 443 ([URL requirements](https://docs.trustware.io/webhooks/delivery#webhook-url-requirements)), so a local receiver needs a tunnel. `npm run tunnel` runs `ngrok http 127.0.0.1:8787` and needs your own ngrok install and account.

> **Exposure:** a tunnel publishes the whole server, not just `/webhooks`. Anyone with the URL can read `/`, `/events` and `/rejections`, which show delivery payloads. Use a test project, and stop the tunnel when you're done.

1. Start the tunnel and copy its `https` URL.
2. In the [Client Dashboard](https://dashboard.trustware.io), open **Projects**, select a project, and in its **Webhooks** panel register `<tunnel URL>/webhooks`. A project has one webhook URL, so don't use a project whose URL serves production.
3. Copy the `whsec_...` secret. The dashboard shows it once.
4. Start the receiver with that secret, as above.
5. Under **Send a test event**, pick a type and click **Send test event**. The receiver prints `VERIFIED <type> seq=<n> test=true ...` and the event appears on the page.

Real route intents then produce events such as `route_intent.submitted`, `route_intent.bridging`, and `route_intent.success` or `route_intent.failed`. If the tunnel URL changes when it restarts, update it with **Change URL**; the secret stays the same. [Dashboard setup](https://docs.trustware.io/webhooks/dashboard-setup) covers the delivery log, redelivery and secret rotation.

## Limitations

This receiver does not implement the [minimal handler](https://docs.trustware.io/webhooks/overview#what-you-need-to-handle) a production integration needs:

- **Duplicates are labeled, not dropped.** A repeated `webhook-id` still gets `204` and is still logged. Seen ids are kept in memory and reset on restart, so this is not deduplication for business actions.
- **`sequence` is displayed, not enforced.** Events are listed in arrival order. Nothing ignores an older `sequence` for the same `data.intent_id`.
- **Test events are recorded like real ones**, labeled `test event`. A production handler must not act on `test: true`.
- **`events.jsonl` is a local log, not processing state.** It grows without limit and holds full payloads, including wallet addresses and transaction hashes. It is git-ignored; don't share it. `/events` and `/rejections` are in memory and reset on restart.
- **The viewer has no authentication.**
- **No resource-exhaustion protection.** This diagnostic receiver has no rate limiting or caps on its in-memory event/rejection history or local log. Requests can consume CPU and memory; accepted signed deliveries, including replays within the timestamp tolerance, also grow the log. Keep the default loopback binding. If you use a tunnel, use a test project, keep the session short-lived, and stop it when finished. Do not expose this example as an unattended public service.

A production handler verifies, durably drops seen `webhook-id`s, ignores an equal or lower `sequence` per route intent, returns `2xx` within 15 seconds, and treats [`/status`](https://docs.trustware.io/api-reference/status) as the source of truth. See [Delivery and retries](https://docs.trustware.io/webhooks/delivery).

## Test

```sh
npm test
```

The tests use the [docs test vector](https://docs.trustware.io/webhooks/verify-signatures#test-vector) with a pinned clock: a valid signature, a two-signature rotation, a tampered body, the wrong secret, a timestamp outside the 5 minute tolerance, a duplicate id and an unknown type, plus the viewer page and startup checks. No live delivery is made.
