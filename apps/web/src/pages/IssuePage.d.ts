type Fields = "studentName" | "studentWallet" | "title" | "institution" | "issuedAt";
type Values = Record<Fields, string>;
export declare function validateIssue(values: Values, walletRequired: boolean): Partial<Record<Fields, string>>;
export declare function IssuePage({
  onOpenCertificate,
}: {
  onOpenCertificate: (id: string) => void;
}): import("react").JSX.Element;
export {};
