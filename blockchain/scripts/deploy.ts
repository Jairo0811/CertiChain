import { ethers, network } from "hardhat";
import type { CertificateRegistry } from "../typechain-types/index.js";

/**
 * Deploys CertificateRegistry and authorizes the API issuer signer.
 *
 * The constructor only grants DEFAULT_ADMIN_ROLE and ISSUER_ADMIN_ROLE. Issuing requires
 * ISSUER_ROLE, so without this step every issuance sent by the API reverts.
 *
 * ISSUER_ADDRESS selects the account the API signs with (BLOCKCHAIN_PRIVATE_KEY). On the local
 * hardhat/localhost networks it defaults to the deployer for convenience; on public networks it
 * must be set explicitly so a production issuer is never authorized by accident.
 */
async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  if (!deployer) throw new Error("No deployer signer is available");

  const isLocal = network.name === "hardhat" || network.name === "localhost";
  const issuer = process.env.ISSUER_ADDRESS?.trim() || (isLocal ? deployer.address : "");
  if (issuer && !ethers.isAddress(issuer)) throw new Error("ISSUER_ADDRESS is not a valid EVM address");

  const Registry = await ethers.getContractFactory("CertificateRegistry");
  const registry = (await Registry.deploy(deployer.address)) as unknown as CertificateRegistry;
  await registry.waitForDeployment();
  const address = await registry.getAddress();

  console.log("Network:", network.name);
  console.log("CertificateRegistry deployed to:", address);
  console.log("Initial admin:", deployer.address);

  if (issuer) {
    const tx = await registry.authorizeIssuer(issuer);
    await tx.wait();
    console.log("Authorized issuer:", issuer);
  } else {
    console.log("No ISSUER_ADDRESS provided: authorize the API signer with authorizeIssuer() before issuing.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
