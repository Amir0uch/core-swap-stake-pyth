const { ethers } = require("hardhat");

async function main() {
  const d = require("../deployed.json");
  const USDT = await ethers.getContractFactory("Token");
  const usdt = await USDT.attach(d.usdt);

  const amount = process.env.AMOUNT || "500";
  const value = ethers.parseUnits(amount, 18);

  try {
    await (await usdt.mint((await ethers.getSigners())[0].address, value)).wait();
    console.log("🪙 Minted", amount, "USDT to deployer");
  } catch {
    console.log("ℹ️ mint() not available or not owner; skipping mint");
  }
  await (await usdt.transfer(d.staking, value)).wait();
  console.log("💦 Topped up", amount, "USDT to", d.staking);
}

main().catch((e)=>{ console.error(e); process.exit(1); });
