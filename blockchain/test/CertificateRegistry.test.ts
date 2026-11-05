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

  async function issueCertificate(
    registry: CertificateRegistry,
    issuer: Awaited<ReturnType<typeof ethers.getSigners>>[number],
    studentAddress: string,
    hash: string,
  ) {
    const tx = await registry.connect(issuer).issueCertificate(studentAddress, hash, "ipfs://metadata");
    const receipt = await tx.wait();
    const event =
      receipt?.logs
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

    await expect(registry.connect(outsider).issueCertificate(student.address, hash, "ipfs://metadata")).to.be.reverted;
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

  it("rejects a second revocation, which the API treats as an already-synced state", async () => {
    const { registry, issuer, student } = await deployFixture();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("certificate-pdf"));
    const certificateId = await issueCertificate(registry, issuer, student.address, hash);

    await registry.connect(issuer).revokeCertificate(certificateId);
    await expect(registry.connect(issuer).revokeCertificate(certificateId))
      .to.be.revertedWithCustomError(registry, "CertificateAlreadyRevoked")
      .withArgs(certificateId);
  });

  it("only lets the issuer or an issuer admin revoke", async () => {
    const { registry, admin, issuer, student, outsider } = await deployFixture();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("certificate-pdf"));
    const certificateId = await issueCertificate(registry, issuer, student.address, hash);

    await expect(registry.connect(outsider).revokeCertificate(certificateId)).to.be.revertedWithCustomError(
      registry,
      "UnauthorizedRevocation",
    );
    await registry.connect(admin).revokeCertificate(certificateId);
    expect((await registry.verifyCertificate(certificateId, hash)).active).to.equal(false);
  });

  it("assigns distinct ids to repeated issuances, which is why the API never re-sends a submitted tx", async () => {
    const { registry, issuer, student } = await deployFixture();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("certificate-pdf"));
    const first = await issueCertificate(registry, issuer, student.address, hash);
    const second = await issueCertificate(registry, issuer, student.address, hash);
    expect(first).to.not.equal(second);
  });

  it("blocks issuance and revocation while paused", async () => {
    const { registry, admin, issuer, student } = await deployFixture();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("certificate-pdf"));
    const certificateId = await issueCertificate(registry, issuer, student.address, hash);

    await registry.connect(admin).pause();
    await expect(registry.connect(issuer).issueCertificate(student.address, hash, "ipfs://metadata")).to.be.reverted;
    await expect(registry.connect(issuer).revokeCertificate(certificateId)).to.be.reverted;
    await registry.connect(admin).unpause();
    await registry.connect(issuer).revokeCertificate(certificateId);
  });

  it("reports unknown certificates as non-existent instead of reverting", async () => {
    const { registry } = await deployFixture();
    const result = await registry.verifyCertificate(ethers.ZeroHash, ethers.ZeroHash);
    expect(result.exists).to.equal(false);
    expect(result.active).to.equal(false);
  });
});
