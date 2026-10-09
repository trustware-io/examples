import { boundedJson } from '../../../lib/request.mjs';
import { config } from '../../../lib/config.mjs';
import { buildBody, address, assert, validateRoute, deadline } from '../../../lib/core.mjs';
import { transport } from '../../../lib/transport.mjs';
export const runtime = 'nodejs';
// Local learning server only. No generic URL/path/body forwarding. Browser callers
// cannot choose vault target, calldata, funding or upstream host.
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    assert(['localhost','127.0.0.1'].includes(url.hostname), 'Localhost only; add authentication before deployment');
    assert(req.headers.get('origin') === url.origin, 'Same-origin request required');
    assert(req.headers.get('content-type')?.startsWith('application/json'), 'JSON required');
    const {action, input} = await boundedJson(req);
    if (action === 'balances') {
      address(input.account);
      return Response.json(await deadline(transport.balances(input.account)));
    }
    if (action === 'route') {
      const body = buildBody(config, input);
      const raw = await deadline(transport.build(body));
      return Response.json(validateRoute(config, input, raw));
    }
    assert(/^[a-zA-Z0-9-]{1,128}$/.test(input.intentId), 'Invalid intent');
    if (action === 'receipt') {
      assert(/^0x[a-fA-F0-9]{64}$/.test(input.hash), 'Invalid hash');
      await deadline(transport.receipt(input.intentId, input.hash)); return Response.json({ok: true});
    }
    if (action === 'status') return Response.json(await deadline(transport.status(input.intentId)));
    return Response.json({error: 'Unsupported action'}, {status: 400});
  } catch (e: unknown) {
    const status = e && typeof e === 'object' && 'status' in e && e.status === 404 ? 404 : 400;
    return Response.json({error: e instanceof Error ? e.message : 'Request rejected'}, {status});
  }
}
