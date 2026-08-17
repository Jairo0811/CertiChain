import { ethers } from "hardhat";

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  if (!deployer) throw new Error("No deployer signer is available");

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
