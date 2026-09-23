import type { TrustwareConfigOptions } from '@trustware/sdk';

export function widgetSetup(apiKey:string,toChain:string,toToken:string,enable:string) {
  const valid=['1','8453','42161','10','137'].includes(toChain) && /^0x[0-9a-fA-F]{40}$/.test(toToken) && !/^0x0{40}$/.test(toToken);
  const ready=Boolean(apiKey.trim()) && valid && enable==='true';
  const config={
    apiKey,
    routes:{toChain,toToken,defaultSlippage:1},
    autoDetectProvider:true,
    features:{swapMode:true,swapDefaultDestToken:{chainId:Number(toChain),address:toToken}},
    messages:{title:'Swap or bridge',description:'Swap on one chain or bridge from another supported source chain.'},
  } satisfies TrustwareConfigOptions;
  return {ready,config,message:!valid?'Invalid EVM destination.':!apiKey.trim()?'Set a browser-safe Trustware API key.':enable!=='true'?'Execution is disabled. Review the configuration before enabling it.':''};
}
