// Server-only transport. Never imported by a client component.
const BASE = 'https://api.trustware.io/api/v1';
export async function upstream(path, body) {
  const key = process.env.TRUSTWARE_API_KEY;
  if (!key) throw new Error('Set server-only TRUSTWARE_API_KEY');
  const res = await fetch(BASE + path, {method: body ? 'POST' : 'GET', cache: 'no-store',
    signal: AbortSignal.timeout(15000), headers: {'X-API-Key': key, 'Content-Type': 'application/json'},
    ...(body ? {body: JSON.stringify(body)} : {})});
  if (!res.ok) {const e = new Error(`Trustware returned HTTP ${res.status}`); e.status = res.status; throw e;}
  return res.json();
}
export const transport = {
  build: body => upstream('/routes/route', body),
  balances: account => upstream('/data/balances/' + account),
  receipt: (id, hash) => upstream('/route-intent/' + id + '/receipt', {txHash: hash}),
  status: async id => {const r = await upstream('/route-intent/' + id + '/status'); return r.data ?? r;},
};
