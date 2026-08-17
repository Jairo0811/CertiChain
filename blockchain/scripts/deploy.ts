import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory("CertificateRegistry");
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();

  console.log("CertificateRegistry deployed to:", await registry.getAddress());
  console.log("Initial admin:", deployer.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
