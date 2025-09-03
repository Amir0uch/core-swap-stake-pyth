const { ethers } = require("hardhat");
const deployed = require("../deployed.json");

async function main() {
  const [user] = await ethers.getSigners();
  const swap = await ethers.getContractAt("Swap", deployed.swap, user);
  const tokenOut = deployed.usdt; // or deployed.usdc
  const coreIn = ethers.parseEther("0.1");
  console.log("Swapping 0.1 tCORE → USDT...");
  const tx = await swap.swapCoreToToken(tokenOut, { value: coreIn });
  const rec = await tx.wait();
  console.log("Swap tx:", rec.hash);
}
main().catch((e)=>{ console.error(e); process.exit(1); });
