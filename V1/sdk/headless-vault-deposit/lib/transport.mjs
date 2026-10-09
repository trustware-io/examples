// Headless SDK runs server-side: no widget, no API key in the browser.
import { Trustware } from '@trustware/sdk/core';
let ready;
async function sdk() {
  if (!ready) {
    const apiKey = process.env.TRUSTWARE_API_KEY;
    if (!apiKey) throw new Error('Set server-only TRUSTWARE_API_KEY');
    ready = Trustware.init({apiKey, mode:'swap', autoDetectProvider:false, features:{shouldAllowGA4:false}}).catch(e => {ready=undefined;throw e;});
  }
  await ready; return Trustware;
}
export const transport = {
  build: async body => (await sdk()).buildRoute(body),
  balances: async account => ({results:await (await sdk()).getBalancesByAddress(account)}),
  receipt: async (id, hash) => (await sdk()).submitReceipt(id, hash),
  // The outer recovery loop owns the absolute request deadline and retries.
  // A short SDK poll performs status-only work, never transaction broadcasting.
  status: async id => (await sdk()).pollStatus(id, {intervalMs:2000,timeoutMs:5000}),
};
