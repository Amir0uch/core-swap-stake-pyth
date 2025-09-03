import { useEffect, useState } from "react";
import { PYTH } from "./pythConfig";

type PriceLike = number | string;

function toNum(x: PriceLike): number {
  return typeof x === "string" ? Number(x) : x;
}

function scale(raw: PriceLike, expo: number): number {
  return toNum(raw) * Math.pow(10, expo);
}

type Row = {
  price: { price: PriceLike; conf: PriceLike; expo: number; publish_time: number };
};

async function fetchLatest(hermes: string, feedId: string) {
  const url = `${hermes}/v2/updates/price/latest?ids[]=${feedId}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Hermes HTTP ${res.status}`);
  const j = await res.json();

  const row = j.parsed?.[0] as Row | undefined;
  if (!row) throw new Error("No parsed row in Hermes response");

  const value = scale(row.price.price, row.price.expo);
  const conf = scale(row.price.conf, row.price.expo);
  const age = Math.max(0, Math.floor(Date.now() / 1000 - row.price.publish_time));

  return { value, conf, age };
}

export function useCorePrice() {
  const [data, setData] = useState<{ value: number; conf: number; age: number }>();
  const [err, setErr] = useState<string>();

  useEffect(() => {
    let stop = false;

    async function run() {
      try {
        const latest = await fetchLatest(PYTH.mainnet.hermes, PYTH.mainnet.feedId);
        if (!stop) {
          setData(latest);
          // ✅ Debug log goes here:
          console.log(
            "CORE/USD:",
            latest.value,
            "±",
            latest.conf,
            "age",
            latest.age,
            "s"
          );
        }
      } catch (e: any) {
        if (!stop) setErr(e.message || String(e));
      }
    }

    run();
    const id = setInterval(run, 5000); // refresh every 5s

    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  return { data, err };
}
