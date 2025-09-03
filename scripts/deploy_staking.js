const { ethers } = require("hardhat");
const fs = require("fs");

// 1e18-scaled per-second rate from APR percent (e.g. 10 => 10%)
function ratePerSecondFromAPR(aprPct) {
  const ONE = 10n ** 18n;
  const SECONDS_PER_YEAR = 31_536_000n;
  // (aprPct/100)*1e18  → careful with integer math
  const aprScaled = (BigInt(Math.round(aprPct * 1e6)) * (ONE / 1_000_000n)) / 100n;
  return aprScaled / SECONDS_PER_YEAR;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const d = require("../deployed.json");

  const apr = Number(process.env.APR || 10);        // default 10% APR
  const rate = ratePerSecondFromAPR(apr);

  const net = await ethers.provider.getNetwork();
  console.log("⛓ Network:", String(net.chainId));
  console.log("👤 Deployer:", deployer.address);
  console.log("📈 APR:", apr + "%  → ratePerSecond =", rate.toString());

  // Deploy StakingDapp with USDT + rate
  const Staking = await ethers.getContractFactory("StakingDapp");
  const staking = await Staking.deploy(d.usdt, rate);
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  console.log("✅ StakingDapp:", stakingAddr);

  // Seed rewards pool (mint if owner; else just transfer what you have)
  const USDT = await ethers.getContractFactory("Token"); // your mock token
  const usdt = await USDT.attach(d.usdt);

  const seed = ethers.parseUnits(process.env.SEED || "2000", 18);
  try {
    await (await usdt.mint(deployer.address, seed)).wait();
    console.log("🪙 Minted", ethers.formatUnits(seed, 18), "USDT");
  } catch {
    console.log("ℹ️ mint() not available or not owner; skipping mint");
  }
  await (await usdt.transfer(stakingAddr, seed)).wait();
  console.log("💦 Seeded", ethers.formatUnits(seed, 18), "USDT to staking");

  // Save address
  const updated = { ...d, staking: stakingAddr };
  fs.writeFileSync("deployed.json", JSON.stringify(updated, null, 2));
  console.log("📝 updated deployed.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
