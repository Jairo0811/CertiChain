import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { config } from "./config.js";

const registryAbi = [
  "function issueCertificate(address student, bytes32 documentHash, string metadataURI) returns (bytes32)",
  "function revokeCertificate(bytes32 certificateId)",
  "function verifyCertificate(bytes32 certificateId, bytes32 expectedDocumentHash) view returns (bool exists, bool active, bool hashMatches, address issuer, address student, uint64 issuedAt, uint64 revokedAt)",
  "event CertificateIssued(bytes32 indexed certificateId, address indexed student, address indexed issuer, bytes32 documentHash, string metadataURI, uint64 issuedAt)",
];

export interface BlockchainIssueResult {
  certificateId: string;
  transactionHash: string;
}

export interface BlockchainVerificationResult {
  exists: boolean;
  active: boolean;
  hashMatches: boolean;
  issuer: string;
  student: string;
  issuedAt: number;
  revokedAt: number;
}

export interface CertificateRegistryClient {
  configured: boolean;
  issue(studentWallet: string, documentHash: string, metadataURI: string): Promise<BlockchainIssueResult>;
  revoke(certificateId: string): Promise<string>;
  verify(certificateId: string, documentHash: string): Promise<BlockchainVerificationResult>;
}

class EthersCertificateRegistryClient implements CertificateRegistryClient {
  readonly configured: boolean;
  private readonly contract?: Contract;

  constructor() {
    this.configured = Boolean(
      config.BLOCKCHAIN_RPC_URL &&
        config.CERTIFICATE_REGISTRY_ADDRESS &&
        config.BLOCKCHAIN_PRIVATE_KEY,
    );

    if (!this.configured) return;

    const provider = new JsonRpcProvider(config.BLOCKCHAIN_RPC_URL);
    const signer = new Wallet(config.BLOCKCHAIN_PRIVATE_KEY!, provider);
    this.contract = new Contract(config.CERTIFICATE_REGISTRY_ADDRESS!, registryAbi, signer);
  }

  async issue(studentWallet: string, documentHash: string, metadataURI: string): Promise<BlockchainIssueResult> {
    const contract = this.requireContract();
    const issueCertificate = contract.getFunction("issueCertificate");
    const tx = await issueCertificate(studentWallet, documentHash, metadataURI);
    const receipt = await tx.wait();

    const parsed = receipt?.logs
      .map((log: unknown) => {
        try {
          return contract.interface.parseLog(log as never);
        } catch {
          return null;
        }
      })
      .find((log: { name?: string } | null) => log?.name === "CertificateIssued");

    const certificateId = parsed?.args?.certificateId as string | undefined;
    if (!certificateId) throw new Error("CertificateIssued event was not found");

    return { certificateId, transactionHash: tx.hash };
  }

  async revoke(certificateId: string): Promise<string> {
    const contract = this.requireContract();
    const revokeCertificate = contract.getFunction("revokeCertificate");
    const tx = await revokeCertificate(certificateId);
    await tx.wait();
    return tx.hash;
  }

  async verify(certificateId: string, documentHash: string): Promise<BlockchainVerificationResult> {
    const contract = this.requireContract();
    const verifyCertificate = contract.getFunction("verifyCertificate");
    const result = await verifyCertificate.staticCall(certificateId, documentHash);

    return {
      exists: Boolean(result.exists),
      active: Boolean(result.active),
      hashMatches: Boolean(result.hashMatches),
      issuer: String(result.issuer),
      student: String(result.student),
      issuedAt: Number(result.issuedAt),
      revokedAt: Number(result.revokedAt),
    };
  }

  private requireContract(): Contract {
    if (!this.contract) throw new Error("Blockchain integration is not configured");
    return this.contract;
  }
}

export const certificateRegistry = new EthersCertificateRegistryClient();
