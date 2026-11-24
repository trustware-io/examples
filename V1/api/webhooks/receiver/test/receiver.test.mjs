import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Webhook } from "standardwebhooks";
import { createApp } from "../app.mjs";

// The v1 test vector from the Trustware docs (webhooks/v1/verify-signatures).
const VECTOR = {
  secret: "whsec_AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
  rotatedSecret: "whsec_ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8=",
  id: "5b1f0c2e-8d1a-4c3b-9e7f-2a6d4b8c0e11",
  timestamp: "1793880000",
  body: '{"type":"route_intent.expired","timestamp":"2026-11-05T12:00:00Z","apiVersion":"v1","sequence":1,"test":true,"data":{"intent_id":"00000000-0000-0000-0000-000000000000","status":"expired","intent_status":"expired","create_date":"2026-11-04T11:00:00Z","expiresAt":"2026-11-04T11:30:00Z"}}',
  signature: "v1,sbS7GSClJCsZ7SSApW5El8T5YQX8iAw6MbNqsC8I1L4=",
  rotationSignature:
    "v1,sbS7GSClJCsZ7SSApW5El8T5YQX8iAw6MbNqsC8I1L4= v1,7UkMaBGrsLRtlYA83JdeAm4quCwy4DPbFInDwHGtwac=",
};

// The v2 test vector from the Trustware docs (webhooks/verify-signatures).
// Same secret, id and timestamp; data is camelCase.
const V2_VECTOR = {
  body: '{"type":"route_intent.expired","timestamp":"2026-11-05T12:00:00Z","apiVersion":"v2","sequence":1,"test":true,"data":{"intentId":"00000000-0000-0000-0000-000000000000","status":"expired","intentStatus":"expired","createDate":"2026-11-04T11:00:00Z","expiresAt":"2026-11-04T11:30:00Z"}}',
  signature: "v1,Xw4ur+aCyIs/FsncrClPBK8ikC1UdhdN3sEbNP+IkRU=",
};

let server;
let baseURL;
let logPath;
let lines;
const realNow = Date.now;

async function start(secret) {
  logPath = join(mkdtempSync(join(tmpdir(), "wh-")), "events.jsonl");
  lines = [];
  const app = createApp({ secret, logPath, log: (l) => lines.push(l) });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseURL = `http://127.0.0.1:${server.address().port}`;
}

function deliver({ id = VECTOR.id, timestamp = VECTOR.timestamp, body = VECTOR.body, signature = VECTOR.signature } = {}) {
  return fetch(`${baseURL}/webhooks`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Trustware-Webhooks/1",
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature,
    },
    body,
  });
}

function recorded() {
  if (!existsSync(logPath)) return [];
  return readFileSync(logPath, "utf8").trim().split("\n").map((l) => JSON.parse(l));
}

describe("webhook receiver", () => {
  beforeEach(() => {
    // Pin "now" to the vector's timestamp, so the 5 minute tolerance passes.
    Date.now = () => Number(VECTOR.timestamp) * 1000;
  });
  afterEach(async () => {
    Date.now = realNow;
    await new Promise((resolve) => server.close(resolve));
  });

  it("accepts the docs test vector and records the envelope", async () => {
    await start(VECTOR.secret);
    const res = await deliver();
    assert.equal(res.status, 204);

    const [record] = recorded();
    assert.equal(record.webhook_id, VECTOR.id);
    assert.equal(record.duplicate, false);
    assert.equal(record.known_type, true);
    assert.equal(record.user_agent, "Trustware-Webhooks/1");
    assert.deepEqual(record.envelope, JSON.parse(VECTOR.body));
    assert.deepEqual(lines, [
      "VERIFIED route_intent.expired seq=1 test=true intent=00000000-0000-0000-0000-000000000000 status=expired",
    ]);

    const listed = await (await fetch(`${baseURL}/events`)).json();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].webhook_id, VECTOR.id);
  });

  it("accepts the v2 docs test vector and logs its camelCase intentId", async () => {
    await start(VECTOR.secret);
    const res = await deliver({ body: V2_VECTOR.body, signature: V2_VECTOR.signature });
    assert.equal(res.status, 204);
    assert.deepEqual(recorded()[0].envelope, JSON.parse(V2_VECTOR.body));
    assert.deepEqual(lines, [
      "VERIFIED route_intent.expired seq=1 test=true intent=00000000-0000-0000-0000-000000000000 status=expired",
    ]);
  });

  it("accepts a rotation delivery with the new secret", async () => {
    await start(VECTOR.rotatedSecret);
    const res = await deliver({ signature: VECTOR.rotationSignature });
    assert.equal(res.status, 204);
    assert.equal(recorded().length, 1);
  });

  it("rejects a tampered body and records nothing", async () => {
    await start(VECTOR.secret);
    const res = await deliver({ body: VECTOR.body.replace('"sequence":1', '"sequence":2') });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "No matching signature found" });
    assert.deepEqual(recorded(), []);
    assert.deepEqual(lines, [`REJECTED ${VECTOR.id}: No matching signature found`]);

    const rejections = await (await fetch(`${baseURL}/rejections`)).json();
    assert.equal(rejections.length, 1);
    assert.equal(rejections[0].webhook_id, VECTOR.id);
    assert.equal(rejections[0].reason, "No matching signature found");
    assert.deepEqual(await (await fetch(`${baseURL}/events`)).json(), []);
  });

  it("serves the live page at /", async () => {
    await start(VECTOR.secret);
    const res = await fetch(`${baseURL}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /^text\/html/);
    assert.match(await res.text(), /<title>Webhook receiver<\/title>/);
  });

  it("starts with no rejections", async () => {
    await start(VECTOR.secret);
    assert.deepEqual(await (await fetch(`${baseURL}/rejections`)).json(), []);
  });

  it("rejects the right signature under the wrong secret", async () => {
    await start(VECTOR.rotatedSecret);
    const res = await deliver();
    assert.equal(res.status, 400);
    assert.deepEqual(recorded(), []);
  });

  it("rejects a delivery outside the 5 minute tolerance", async () => {
    await start(VECTOR.secret);
    Date.now = () => (Number(VECTOR.timestamp) + 301) * 1000;
    const res = await deliver();
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "Message timestamp too old" });
    assert.deepEqual(recorded(), []);
  });

  it("marks a redelivery of the same webhook-id as a duplicate", async () => {
    await start(VECTOR.secret);
    assert.equal((await deliver()).status, 204);
    assert.equal((await deliver()).status, 204);
    assert.deepEqual(
      recorded().map((r) => r.duplicate),
      [false, true],
    );
    assert.match(lines[1], /^DUPLICATE route_intent\.expired /);
  });

  it("records a type outside the contract with known_type false", async () => {
    await start(VECTOR.secret);
    const body = JSON.stringify({ type: "route_intent.teleported", timestamp: "2026-11-05T12:00:00Z", apiVersion: "v1", sequence: 7, test: false, data: {} });
    const id = "msg_unknown_type";
    const signature = new Webhook(VECTOR.secret).sign(id, new Date(Number(VECTOR.timestamp) * 1000), body);
    const res = await deliver({ id, body, signature });
    assert.equal(res.status, 204);
    assert.equal(recorded()[0].known_type, false);
    assert.deepEqual(lines, ["VERIFIED route_intent.teleported seq=7 UNKNOWN-TYPE"]);
  });
});

describe("createApp", () => {
  it("refuses to start without a secret", () => {
    assert.throws(() => createApp({ secret: "", logPath: "x" }), {
      message: "createApp: secret is required (WEBHOOK_SECRET, whsec_...)",
    });
  });
  it("refuses to start without a log path", () => {
    assert.throws(() => createApp({ secret: VECTOR.secret }), {
      message: "createApp: logPath is required",
    });
  });
});
