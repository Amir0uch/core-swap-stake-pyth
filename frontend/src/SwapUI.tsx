import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import deployed from "../deployed.json";
import { useCorePrice } from "./useCorePrice";

declare global { interface Window { ethereum?: any } }

const CORE_TESTNET2_ID = 1114;
const CORE_TESTNET2_HEX = "0x45a";

// Lightweight ABIs
const SWAP_ABI = [
  "function fee() view returns (uint256)",
];
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

export default function SwapUI() {
  // Price hook (PYTH → API3 fallback)
  const { data: price, err: priceErr, reload: reloadPrice } = useCorePrice();

  // Wallet & tx state
  const [addr, setAddr] = useState<string>();
  const [amount, setAmount] = useState("0.1"); // CORE input
  const [status, setStatus] = useState<string>();
  const [txHash, setTxHash] = useState<string>();

  // Pool & quote state
  const [feeBps, setFeeBps] = useState<number>(10);
  const [usdtLiquidity, setUsdtLiquidity] = useState<string>("");
  const [usdtSym, setUsdtSym] = useState<string>("USDT");
  const [usdtDecimals, setUsdtDecimals] = useState<number>(18);
  const [quoteUSDT, setQuoteUSDT] = useState<string>("");

  const provider = useMemo(
    () => (window.ethereum ? new ethers.BrowserProvider(window.ethereum) : undefined),
    []
  );

  // Ensure we're on Core Testnet 2
  useEffect(() => {
    (async () => {
      if (!provider) return;
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== CORE_TESTNET2_ID) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: CORE_TESTNET2_HEX }],
          });
        } catch (e: any) {
          if (e?.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: CORE_TESTNET2_HEX,
                chainName: "Core Testnet 2",
                rpcUrls: ["https://rpc.test2.btcs.network"],
                nativeCurrency: { name: "tCORE", symbol: "tCORE", decimals: 18 },
                blockExplorerUrls: ["https://scan.test.btcs.network/"],
              }],
            });
          }
        }
      }
    })();
  }, [provider]);

  // Load fee + pool liquidity (USDT held by Swap)
  useEffect(() => {
    (async () => {
      if (!provider) return;
      const swap = new ethers.Contract(deployed.swap, SWAP_ABI, provider);
      const usdt = new ethers.Contract(deployed.usdt, ERC20_ABI, provider);

      const [f, bal, sym, dec] = await Promise.all([
        swap.fee(),                           // bps
        usdt.balanceOf(deployed.swap),        // liquidity inside Swap
        usdt.symbol(),
        usdt.decimals(),
      ]);

      setFeeBps(Number(f));
      setUsdtDecimals(Number(dec));
      setUsdtLiquidity(ethers.formatUnits(bal, dec));
      setUsdtSym(sym);
    })().catch(console.error);
  }, [provider]);

  // Compute quote whenever amount or fee changes
  useEffect(() => {
    const x = Number(amount || "0");
    if (Number.isFinite(x)) {
      // Your contract swaps 1:1 CORE → USDT minus fee (no price impact logic here)
      const out = x * (1 - feeBps / 10000);
      setQuoteUSDT(out.toString());
    } else {
      setQuoteUSDT("");
    }
  }, [amount, feeBps]);

  const connect = async () => {
    if (!provider) return;
    const accounts = await provider.send("eth_requestAccounts", []);
    setAddr(accounts[0]);
  };

  const doSwap = async () => {
    if (!provider) return;
    try {
      setStatus("Preparing...");
      const signer = await provider.getSigner();
      const swap = new ethers.Contract(
        deployed.swap,
        ["function swapCoreToToken(address tokenOut) external payable"],
        signer
      );
      const value = ethers.parseEther(amount || "0.1");
      const tx = await swap.swapCoreToToken(deployed.usdt, { value });
      setStatus("Waiting for confirmation...");
      const rec = await tx.wait();
      setTxHash(rec.hash);
      setStatus("Done");
    } catch (e: any) {
      setStatus(e?.message || String(e));
    }
  };

  // Optional: USD helper (so users see approx $ value of their CORE input)
  const coreUsd = (() => {
    const x = Number(amount || "0");
    if (!price || !Number.isFinite(x)) return undefined;
    return x * price.value; // price.value is USD per CORE
  })();

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", fontFamily: "Inter, system-ui" }}>
      <h2>Swap (Core Testnet 2) + Reference Price (Pyth → API3)</h2>

      {/* Price panel (informational) */}
      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12, marginBottom: 12 }}>
        <div><strong>CORE / USD (reference):</strong></div>
        {price ? (
          <div>
            ${price.value.toFixed(4)}{" "}
            <small>
              {price.conf !== undefined ? <>±{price.conf.toFixed(4)} • </> : null}
              {price.age}s ago • source: <b>{price.source.toUpperCase()}</b>
            </small>
          </div>
        ) : (
          <div>
            Loading… {priceErr && <small>({priceErr})</small>}{" "}
            <button onClick={reloadPrice} style={{ marginLeft: 6 }}>Reload</button>
          </div>
        )}
      </div>

      {/* Wallet connect */}
      {!addr ? (
        <button onClick={connect}>Connect Wallet</button>
      ) : (
        <div>Connected: {addr.slice(0, 6)}…{addr.slice(-4)}</div>
      )}

      {/* Input + estimated output */}
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        <label>CORE Amount</label>
        <input
          type="number"
          min="0"
          step="0.0001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ padding: 8 }}
        />
        <div>
          Estimated receive: <b>{quoteUSDT || "0"} {usdtSym}</b>{" "}
          <small>(fee {(feeBps / 100).toFixed(2)}%)</small>
        </div>
        {coreUsd !== undefined && (
          <div style={{ color: "#666" }}>
            ≈ ${coreUsd.toFixed(2)} (informational)
          </div>
        )}
        <div>Pool liquidity: {usdtLiquidity} {usdtSym}</div>

        <button onClick={doSwap} disabled={!addr}>
          Swap CORE → {usdtSym}
        </button>
      </div>

      {status && <div style={{ marginTop: 8 }}>Status: {status}</div>}
      {txHash && (
        <div>
          Tx:&nbsp;
          <a
            href={`https://scan.test.btcs.network/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            {txHash.slice(0, 10)}…
          </a>
        </div>
      )}
    </div>
  );
}
