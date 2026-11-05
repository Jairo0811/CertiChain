import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { config } from "./config.js";

const registryAbi = [
  "function issueCertificate(address student, bytes32 documentHash, string metadataURI) returns (bytes32)",
  "function revokeCertificate(bytes32 certificateId)",
  "function verifyCertificate(bytes32 certificateId, bytes32 expectedDocumentHash) view returns (bool exists, bool active, bool hashMatches, address issuer, address student, uint64 issuedAt, uint64 revokedAt)",
  "event CertificateIssued(bytes32 indexed certificateId, address indexed student, address indexed issuer, bytes32 documentHash, string metadataURI, uint64 issuedAt)",
];

const RPC_READ_TIMEOUT_MS = 6_000;
const RPC_CONFIRMATION_TIMEOUT_MS = 90_000;
/** Bounded log search window for recovery lookups; public RPCs reject unbounded ranges. */
const RECOVERY_BLOCK_WINDOW = 10_000;

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

/** Result of looking up a previously submitted issuance transaction. */
export type IssueReceiptLookup =
  { state: "confirmed"; certificateId: string } | { state: "pending" } | { state: "reverted" } | { state: "not_found" };

export interface SubmittedTransaction {
  transactionHash: string;
  /** Resolves when the transaction is mined; rejects on revert or timeout. */
  confirmation: Promise<BlockchainIssueResult>;
}

export interface CertificateRegistryClient {
  configured: boolean;
  /** Sends the issuance transaction and returns as soon as the RPC accepted it. */
  submitIssue(studentWallet: string, documentHash: string, metadataURI: string): Promise<SubmittedTransaction>;
  /** Looks up an already-submitted issuance by tx hash. Never re-sends a transaction. */
  findIssueReceipt(transactionHash: string): Promise<IssueReceiptLookup>;
  /**
   * Recovery path for records whose tx hash was never persisted: searches recent
   * CertificateIssued events for this student/document pair issued by our signer.
   */
  findIssuedByEvidence(studentWallet: string, documentHash: string): Promise<string | undefined>;
  revoke(certificateId: string): Promise<string>;
  verify(certificateId: string, documentHash: string): Promise<BlockchainVerificationResult>;
}

export class BlockchainUnavailableError extends Error {
  constructor(message = "Blockchain RPC is unavailable") {
    super(message);
    this.name = "BlockchainUnavailableError";
  }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new BlockchainUnavailableError(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

class EthersCertificateRegistryClient implements CertificateRegistryClient {
  readonly configured: boolean;
  private readonly contract?: Contract;
  private readonly provider?: JsonRpcProvider;

  constructor() {
    this.configured = Boolean(config.BLOCKCHAIN_RPC_URL && config.CERTIFICATE_REGISTRY_ADDRESS && config.BLOCKCHAIN_PRIVATE_KEY);

    if (!this.configured) return;

    this.provider = new JsonRpcProvider(config.BLOCKCHAIN_RPC_URL);
    const signer = new Wallet(config.BLOCKCHAIN_PRIVATE_KEY!, this.provider);
    this.contract = new Contract(config.CERTIFICATE_REGISTRY_ADDRESS!, registryAbi, signer);
  }

  async submitIssue(studentWallet: string, documentHash: string, metadataURI: string): Promise<SubmittedTransaction> {
    const contract = this.requireContract();
    const issueCertificate = contract.getFunction("issueCertificate");
    const tx = await withTimeout(
      issueCertificate(studentWallet, documentHash, metadataURI),
      RPC_READ_TIMEOUT_MS * 3,
      "Blockchain RPC did not accept the issuance transaction in time",
    );

    const confirmation = withTimeout(
      tx.wait(),
      RPC_CONFIRMATION_TIMEOUT_MS,
      "Blockchain confirmation is taking longer than expected",
    ).then((receipt: unknown) => {
      const certificateId = this.extractCertificateId(receipt);
      if (!certificateId) throw new Error("CertificateIssued event was not found");
      return { certificateId, transactionHash: tx.hash as string };
    });

    return { transactionHash: tx.hash as string, confirmation };
  }

  async findIssueReceipt(transactionHash: string): Promise<IssueReceiptLookup> {
    const provider = this.requireProvider();
    const receipt = await withTimeout(
      provider.getTransactionReceipt(transactionHash),
      RPC_READ_TIMEOUT_MS,
      "Blockchain RPC did not answer in time",
    );

    if (!receipt) {
      const transaction = await withTimeout(
        provider.getTransaction(transactionHash),
        RPC_READ_TIMEOUT_MS,
        "Blockchain RPC did not answer in time",
      );
      return transaction ? { state: "pending" } : { state: "not_found" };
    }

    if (receipt.status === 0) return { state: "reverted" };
    const certificateId = this.extractCertificateId(receipt);
    return certificateId ? { state: "confirmed", certificateId } : { state: "reverted" };
  }

  async findIssuedByEvidence(studentWallet: string, documentHash: string): Promise<string | undefined> {
    const contract = this.requireContract();
    const provider = this.requireProvider();
    const signer = contract.runner as Wallet;
    const latest = await withTimeout(provider.getBlockNumber(), RPC_READ_TIMEOUT_MS, "Blockchain RPC did not answer in time");
    const filter = contract.filters.CertificateIssued!(null, studentWallet, signer.address);
    const events = await withTimeout(
      contract.queryFilter(filter, Math.max(latest - RECOVERY_BLOCK_WINDOW, 0), latest),
      RPC_READ_TIMEOUT_MS * 2,
      "Blockchain RPC did not answer in time",
    );
    const match = events
      .map((event) => ("args" in event ? event.args : undefined))
      .find((args) => String(args?.documentHash).toLowerCase() === documentHash.toLowerCase());
    return match ? String(match.certificateId) : undefined;
  }

  async revoke(certificateId: string): Promise<string> {
    const contract = this.requireContract();
    const revokeCertificate = contract.getFunction("revokeCertificate");
    const tx = await withTimeout(
      revokeCertificate(certificateId),
      RPC_READ_TIMEOUT_MS * 3,
      "Blockchain RPC did not accept the revocation transaction in time",
    );
    await withTimeout(tx.wait(), RPC_CONFIRMATION_TIMEOUT_MS, "Blockchain revocation confirmation timed out");
    return tx.hash as string;
  }

  async verify(certificateId: string, documentHash: string): Promise<BlockchainVerificationResult> {
    const contract = this.requireContract();
    const verifyCertificate = contract.getFunction("verifyCertificate");
    const result = await withTimeout(
      verifyCertificate.staticCall(certificateId, documentHash),
      RPC_READ_TIMEOUT_MS,
      "Blockchain RPC did not answer in time",
    );

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

  private extractCertificateId(receipt: unknown): string | undefined {
    const contract = this.requireContract();
    const logs = (receipt as { logs?: unknown[] } | null)?.logs ?? [];
    const parsed = logs
      .map((log) => {
        try {
          return contract.interface.parseLog(log as never);
        } catch {
          return null;
        }
      })
      .find((log) => log?.name === "CertificateIssued");
    return parsed?.args?.certificateId as string | undefined;
  }

  private requireContract(): Contract {
    if (!this.contract) throw new Error("Blockchain integration is not configured");
    return this.contract;
  }

  private requireProvider(): JsonRpcProvider {
    if (!this.provider) throw new Error("Blockchain integration is not configured");
    return this.provider;
  }
}

export const certificateRegistry: CertificateRegistryClient = new EthersCertificateRegistryClient();
