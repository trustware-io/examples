// Public reference metadata, NOT an authorization to execute a live corridor.
export const config = {
  transport: 'rest',
  name: 'Spice · spcUSDC',
  description: 'Route wallet-held USDC into the Spice Ethereum synchronous vault.',
  vault: {
    chainId: '1', address: '0xb37cC5e891d87c5a3eF750e1bdf59C960575593c',
    asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6,
    symbol: 'USDC', rpc: 'https://eth.drpc.org', fundAmount: '50000000',
    minAssets: '50000000', estimatedGas: '350000',
    // Historical ABI matches; execution needs current proxy/corridor/eligibility review.
    verifiedSynchronousPullDeposit: false,
  },
  sources: [
    {chainId:'1',name:'Ethereum',rpc:'https://eth.drpc.org',tokens:[{address:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',symbol:'USDC',decimals:6}],routers:[],spenders:[]},
    {chainId:'10',name:'Optimism',rpc:'https://mainnet.optimism.io',tokens:[{address:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',symbol:'USDC',decimals:6}],routers:[],spenders:[]},
    {chainId:'42161',name:'Arbitrum',rpc:'https://arb1.arbitrum.io/rpc',tokens:[{address:'0xaf88d065e77c8cC2239327C5EDb3A432268e5831',symbol:'USDC',decimals:6}],routers:[],spenders:[]},
  ],
};
