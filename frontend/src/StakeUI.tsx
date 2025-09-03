import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import deployed from "../deployed.json";

declare global { interface Window { ethereum?: any } }

const CORE_TESTNET2 = 1114;
const CHAIN_HEX = "0x45a";

const USDT_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function decimals() view returns (uint8)",
];
const STAKING_ABI = [
  "function stake(uint256 amount) external",
  "function unstake(uint256 amount) external",
  "function claimReward() external",
  "function getStakedAmount(address user) external view returns (uint256)",
  "function getRewardAmount(address user) external view returns (uint256)"
];

export default function StakeUI() {
  const [addr, setAddr] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [amount, setAmount] = useState("10");
  const [usdtBal, setUsdtBal] = useState("0");
  const [staked, setStaked] = useState("0");
  const [pending, setPending] = useState("0");
  const [allow, setAllow] = useState("0");
  const [decimals, setDecimals] = useState<number>(18);

  const provider = useMemo(
    () => window.ethereum ? new ethers.BrowserProvider(window.ethereum) : undefined,
    []
  );

  // Auto network check on mount
  useEffect(() => {
    (async () => {
      if (!provider) return;
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== CORE_TESTNET2) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: CHAIN_HEX }],
          });
        } catch (e: any) {
          if (e?.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: CHAIN_HEX,
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

  const connect = async () => {
    if (!provider) return;
    const [a] = await provider.send("eth_requestAccounts", []);
    setAddr(a);
    await refresh(a);
  };

  const refresh = async (a?: string) => {
    if (!provider) return;
    const signer = await provider.getSigner();
    const user = a || await signer.getAddress();

    console.log("🔄 Refreshing balances for:", user);
    console.log("📌 FE deployed.json:", deployed);

    const usdt = new ethers.Contract(deployed.usdt, USDT_ABI, provider);
    const staking = new ethers.Contract(deployed.staking, STAKING_ABI, provider);

    const [bal, alw, st, pend, dec] = await Promise.all([
      usdt.balanceOf(user),
      usdt.allowance(user, deployed.staking),
      staking.getStakedAmount(user),
      staking.getRewardAmount(user),
      usdt.decimals(),
    ]);

    console.log("✅ Raw on-chain data:", {
      bal: bal.toString(),
      allowance: alw.toString(),
      staked: st.toString(),
      pending: pend.toString(),
      decimals: dec,
    });

    setDecimals(dec);
    setUsdtBal(ethers.formatUnits(bal, dec));
    setAllow(ethers.formatUnits(alw, dec));
    setStaked(ethers.formatUnits(st, dec));
    setPending(ethers.formatUnits(pend, dec));
  };

  // ✅ Auto-refresh when wallet address changes
  useEffect(() => {
    if (addr) refresh(addr);
  }, [addr]);

  const approve = async () => {
    if (!provider || !addr) return;
    const signer = await provider.getSigner();
    const usdt = new ethers.Contract(deployed.usdt, USDT_ABI, signer);
    const value = ethers.parseUnits(amount || "0", decimals);
    setStatus("Approving...");
    const tx = await usdt.approve(deployed.staking, value);
    await tx.wait();
    setStatus("Approved");
    await refresh(addr);
  };

  const stake = async () => {
    if (!provider || !addr) return;
    const signer = await provider.getSigner();
    const staking = new ethers.Contract(deployed.staking, STAKING_ABI, signer);
    const value = ethers.parseUnits(amount || "0", decimals);
    setStatus("Staking...");
    const tx = await staking.stake(value);
    await tx.wait();
    setStatus("Staked");
    await refresh(addr);
  };

  const unstake = async () => {
    if (!provider || !addr) return;
    const signer = await provider.getSigner();
    const staking = new ethers.Contract(deployed.staking, STAKING_ABI, signer);
    const value = ethers.parseUnits(amount || "0", decimals);
    setStatus("Unstaking...");
    const tx = await staking.unstake(value);
    await tx.wait();
    setStatus("Unstaked");
    await refresh(addr);
  };

  const claim = async () => {
    if (!provider || !addr) return;
    const signer = await provider.getSigner();
    const staking = new ethers.Contract(deployed.staking, STAKING_ABI, signer);
    setStatus("Claiming...");
    const tx = await staking.claimReward();
    await tx.wait();
    setStatus("Claimed");
    await refresh(addr);
  };

  return (
    <div style={{maxWidth:640, margin:"24px auto", fontFamily:"Inter, system-ui"}}>
      <h2>Stake USDT (Core Testnet 2)</h2>

      {!addr
        ? <button onClick={connect}>Connect Wallet</button>
        : <div>Connected: {addr.slice(0,6)}…{addr.slice(-4)}</div>}

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12}}>
        <div style={{padding:8, border:"1px solid #eee", borderRadius:8}}><b>Your USDT:</b> {usdtBal}</div>
        <div style={{padding:8, border:"1px solid #eee", borderRadius:8}}><b>Pending Reward:</b> {pending}</div>
        <div style={{padding:8, border:"1px solid #eee", borderRadius:8}}><b>Staked:</b> {staked}</div>
        <div style={{padding:8, border:"1px solid #eee", borderRadius:8}}><b>Allowance:</b> {allow}</div>
      </div>

      <div style={{display:"flex", gap:8, marginTop:12}}>
        <input type="number" min="0" step="0.0001" value={amount} onChange={e=>setAmount(e.target.value)} style={{flex:1, padding:8}} />
        <button onClick={approve} disabled={!addr}>Approve</button>
        <button onClick={stake} disabled={!addr}>Stake</button>
      </div>

      <div style={{display:"flex", gap:8, marginTop:8}}>
        <button onClick={unstake} disabled={!addr}>Unstake</button>
        <button onClick={claim} disabled={!addr}>Claim Reward</button>
        <button onClick={() => addr && refresh(addr)} disabled={!addr}>🔄 Refresh</button>
      </div>

      {status && <div style={{marginTop:8}}>Status: {status}</div>}
    </div>
  );
}
