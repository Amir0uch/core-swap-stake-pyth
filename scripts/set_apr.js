const { ethers } = require("hardhat");

function ratePerSecondFromAPR(aprPct) {
  const ONE = 10n ** 18n;
  const SECONDS_PER_YEAR = 31_536_000n;
  const aprScaled = (BigInt(Math.round(aprPct * 1e6)) * (ONE / 1_000_000n)) / 100n;
  return aprScaled / SECONDS_PER_YEAR;
}

async function main() {
  const apr = Number(process.env.APR);
  if (!Number.isFinite(apr)) throw new Error("Set APR env var, e.g. APR=10");
  const rate = ratePerSecondFromAPR(apr);

  const d = require("../deployed.json");
  const staking = await ethers.getContractAt("StakingDapp", d.staking);

  console.log("🔧 Setting APR to", apr + "% →", rate.toString(), "per-second");
  await (await staking.setRewardRatePerSecond(rate)).wait();
  console.log("✅ New ratePerSecond:", (await staking.rewardRatePerSecond()).toString());
}

main().catch((e)=>{ console.error(e); process.exit(1); });
