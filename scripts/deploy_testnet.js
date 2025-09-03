const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const net = await ethers.provider.getNetwork();
  console.log("⛓  Network:", net.name || "unknown", Number(net.chainId));

  const signers = await ethers.getSigners();
  if (!signers.length) throw new Error("No signers. Is PRIVATE_KEY set in .env?");
  const deployer = signers[0];

  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("👤 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(bal), "tCORE");

  const Token = await ethers.getContractFactory("Token");
  console.log("🚀 Deploying USDT...");
  const usdt = await Token.deploy("Tether USD", "USDT");
  await usdt.waitForDeployment();
  const usdtAddr = await usdt.getAddress();
  console.log("✅ USDT:", usdtAddr);

  console.log("🚀 Deploying USDC...");
  const usdc = await Token.deploy("USD Coin", "USDC");
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();
  console.log("✅ USDC:", usdcAddr);

  const feeBps = 10; // 0.1%
  console.log("🚀 Deploying Swap (fee =", feeBps, "bps)...");
  const Swap = await ethers.getContractFactory("Swap");
  const swap = await Swap.deploy(feeBps);
  await swap.waitForDeployment();
  const swapAddr = await swap.getAddress();
  console.log("✅ Swap:", swapAddr);

  const seed = ethers.parseEther("100");
  console.log("💦 Seeding liquidity (100 USDT + 100 USDC) to Swap...");
  await (await usdt.transfer(swapAddr, seed)).wait();
  await (await usdc.transfer(swapAddr, seed)).wait();
  console.log("✅ Liquidity seeded.");

  const out = {
    network: `core_testnet2(${Number(net.chainId)})`,
    swap: swapAddr,
    usdt: usdtAddr,
    usdc: usdcAddr
  };
  fs.writeFileSync("deployed.json", JSON.stringify(out, null, 2));
  console.log("📝 written to deployed.json\n", out);
}

main().catch((e) => { console.error("❌ Deploy failed:", e); process.exit(1); });
