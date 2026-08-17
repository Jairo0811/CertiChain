import { expect } from "chai";
import { ethers } from "hardhat";

describe("CertificateRegistry", () => {
  async function deployFixture() {
    const [admin, issuer, student, outsider] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("CertificateRegistry");
    const registry = await Registry.deploy(admin.address);
    await registry.waitForDeployment();
    await registry.connect(admin).authorizeIssuer(issuer.address);
    return { registry, admin, issuer, student, outsider };
  }

  it("allows an authorized institution to issue and verify a certificate", async () => {
    const { registry, issuer, student } = await deployFixture();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("certificate-pdf"));

    const tx = await registry.connect(issuer).issueCertificate(student.address, hash, "ipfs://metadata");
    const receipt = await tx.wait();
    const event = receipt?.logs
      .map((log) => {
        try {
          return registry.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((log) => log?.name === "CertificateIssued");

    const certificateId = event?.args.certificateId;
    expect(certificateId).to.not.equal(undefined);

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
    const tx = await registry.connect(issuer).issueCertificate(student.address, hash, "ipfs://metadata");
    const receipt = await tx.wait();
    const event = receipt?.logs
      .map((log) => {
        try {
          return registry.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((log) => log?.name === "CertificateIssued");
    const certificateId = event!.args.certificateId;

    await registry.connect(issuer).revokeCertificate(certificateId);
    const result = await registry.verifyCertificate(certificateId, hash);
    expect(result.active).to.equal(false);
  });

  it("detects a document hash mismatch", async () => {
    const { registry, issuer, student } = await deployFixture();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("certificate-pdf"));
    const otherHash = ethers.keccak256(ethers.toUtf8Bytes("tampered-pdf"));
    const tx = await registry.connect(issuer).issueCertificate(student.address, hash, "ipfs://metadata");
    const receipt = await tx.wait();
    const event = receipt?.logs
      .map((log) => {
        try {
          return registry.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((log) => log?.name === "CertificateIssued");

    const result = await registry.verifyCertificate(event!.args.certificateId, otherHash);
    expect(result.hashMatches).to.equal(false);
  });
});
