// Central config for price sources

export const PRICE_SOURCES = {
    PYTH: {
      // Primary Pyth (mainnet) settings
      // CORE / USD
      feedId:
        "0x9b4503710cc8c53f75c30e6e4fda1a7064680ef2e0ee97acd2e3a7c37b3c830c",
      hermes: [
        "https://hermes.pyth.network",
      ],
  
      // Pyth freshness limit in seconds for UI display (frontend only)
      maxAgeSec: 90,
    },
  
    API3: {
      proxy: "0xedcC1A9d285d6aB43f409c3265F4d67056B3f966",
  
      // A public read-only Core MAINNET RPC URL
      rpcUrl: "https://rpc.ankr.com/core",
  
      decimals: 18,
  
      // Reject if timestamp older than this (seconds)
      maxAgeSec: 120,
    },
  } as const;
  