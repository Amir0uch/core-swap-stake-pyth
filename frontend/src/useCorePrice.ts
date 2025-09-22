import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { PRICE_SOURCES } from "./pythConfig";

type PriceLike = number | string;

function toNum(x: PriceLike): number {
  return typeof x === "string" ? Number(x) : x;
}

function scale(raw: PriceLike, expo: number): number {
  // Pyth uses (price, expo), where value = price * 10^expo
  return toNum(raw) * Math.pow(10, expo);
}

type HermesParsedRow = {
  price: { price: PriceLike; conf: PriceLike; expo: number; publish_time: number };
  ema_price?: { price: PriceLike; conf: PriceLike; expo: number; publish_time: number };
};

type HermesResponse = {
  parsed?: HermesParsedRow[];
};

type PriceResult = {
  value: number;      // numeric quote (USD)
  conf?: number;      // pyth confidence (if from pyth)
  age: number;        // seconds since publish
  source: "pyth" | "api3";
};

async function fetchFromHermes(feedId: string, hermesUrl: string): Promise<PriceResult> {
  const url = `${hermesUrl}/v2/updates/price/latest?ids[]=${feedId}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Hermes HTTP ${res.status}`);
  const j: HermesResponse = await res.json();

  const row = j.parsed?.[0];
  if (!row) throw new Error("Hermes: no parsed row");
  const val = scale(row.price.price, row.price.expo);
  const conf = scale(row.price.conf, row.price.expo);
  const age = Math.max(0, Math.floor(Date.now() / 1000 - row.price.publish_time));
  return { value: val, conf, age, source: "pyth" };
}

async function fetchFromAPI3(proxy: string, rpcUrl: string, decimals: number) {
    // Minimal ABI for API3 proxy read
    const ABI = ["function read() view returns (int224 value, uint32 timestamp)"];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const api3 = new ethers.Contract(proxy, ABI, provider);
  
    // API3 returns BigInts (ethers v6). Never mix with numbers.
    const [raw, ts] = await api3.read(); // raw: bigint, ts: bigint|number
  
    // Format the fixed-point price safely, then to JS number for display
    const value = parseFloat(ethers.formatUnits(raw as bigint, decimals));
  
    // Force timestamp to a number before math
    const tsNum = typeof ts === "bigint" ? Number(ts) : Number(ts);
    const now = Math.floor(Date.now() / 1000);
    const age = Math.max(0, now - tsNum);
  
    return { value, age, source: "api3" as const };
  }

export function useCorePrice() {
  const [data, setData] = useState<PriceResult | undefined>();
  const [err, setErr] = useState<string | undefined>();
  const [tick, setTick] = useState(0);

  const reload = () => setTick((x) => x + 1);

  const cfg = PRICE_SOURCES;

  useEffect(() => {
    let killed = false;

    (async () => {
      setErr(undefined);

      // 1) Try Pyth Hermes endpoints (in order)
      for (const hermes of cfg.PYTH.hermes) {
        try {
          const r = await fetchFromHermes(cfg.PYTH.feedId, hermes);
          if (!killed) {
            setData(r);
            return;
          }
        } catch (e) {
          // try next hermes
        }
      }

      // 2) Fallback to API3 on-chain read
      try {
        const r = await fetchFromAPI3(cfg.API3.proxy, cfg.API3.rpcUrl, cfg.API3.decimals);
        if (!killed) {
          setData(r);
          return;
        }
      } catch (e: any) {
        if (!killed) setErr(e?.message || String(e));
      }
    })();

    return () => {
      killed = true;
    };
  }, [tick, cfg.API3.proxy, cfg.API3.rpcUrl, cfg.API3.decimals, cfg.PYTH.feedId, cfg.PYTH.hermes.join("|")]);

  return { data, err, reload };
}
