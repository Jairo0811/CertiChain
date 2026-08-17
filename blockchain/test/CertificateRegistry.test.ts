import { expect } from "chai";
import { ethers } from "hardhat";
import type { CertificateRegistry } from "../typechain-types/index.js";

function requireCertificateId(event: ReturnType<CertificateRegistry["interface"]["parseLog"]>): string {
  const certificateId = event?.args?.certificateId as string | undefined;
  if (!certificateId) throw new Error("CertificateIssued event was not found");
  return certificateId;
}

describe("CertificateRegistry", () => {
  async function deployFixture() {
    const signers = await ethers.getSigners();
    const admin = signers[0];
    const issuer = signers[1];
    const student = signers[2];
    const outsider = signers[3];

    if (!admin || !issuer || !student || !outsider) {
      throw new Error("Hardhat did not provide the expected test signers");
    }

    const Registry = await ethers.getContractFactory("CertificateRegistry");
    const registry = (await Registry.deploy(admin.address)) as unknown as CertificateRegistry;
    await registry.waitForDeployment();
    await registry.connect(admin).authorizeIssuer(issuer.address);

    return { registry, admin, issuer, student, outsider };
  }

  async function issueCertificate(registry: CertificateRegistry, issuer: Awaited<ReturnType<typeof ethers.getSigners>>[number], studentAddress: string, hash: string) {
    const tx = await registry.connect(issuer).issueCertificate(studentAddress, hash, "ipfs://metadata");
    const receipt = await tx.wait();
    const event = receipt?.logs
      .map((log) => {
        try {
          return registry.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((log) => log?.name === "CertificateIssued") ?? null;

    return requireCertificateId(event);
  }

  it("allows an authorized institution to issue and verify a certificate", async () => {
    const { registry, issuer, student } = await deployFixture();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("certificate-pdf"));
    const certificateId = await issueCertificate(registry, issuer, student.address, hash);

    const result = await registry.verifyCertificate(certificateId, hash);
    expect(result.exists).to.equal(true);
    expect(result.active).to.equal(true);
    expect(result.hashMatches).to.equal(true);
    expect(result.issuer).to.equal(issuer.address);
    expect(result.student).to.equal(student.address);
  });

  it("rejects issuance from an unauthorized wallet", async () => {
    const { registry, outsider, student } = await deployFixture();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("certificate-pdf"));

    await expect(
      registry.connect(outsider).issueCertificate(student.address, hash, "ipfs://metadata"),
    ).to.be.reverted;
  });

  it("marks a certificate as inactive after revocation", async () => {
    const { registry, issuer, student } = await deployFixture();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("certificate-pdf"));
    const certificateId = await issueCertificate(registry, issuer, student.address, hash);

    await registry.connect(issuer).revokeCertificate(certificateId);
    const result = await registry.verifyCertificate(certificateId, hash);
    expect(result.active).to.equal(false);
  });

  it("detects a document hash mismatch", async () => {
    const { registry, issuer, student } = await deployFixture();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("certificate-pdf"));
    const otherHash = ethers.keccak256(ethers.toUtf8Bytes("tampered-pdf"));
    const certificateId = await issueCertificate(registry, issuer, student.address, hash);

    const result = await registry.verifyCertificate(certificateId, otherHash);
    expect(result.hashMatches).to.equal(false);
  });
});
