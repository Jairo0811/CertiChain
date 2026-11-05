import type { Verification } from "../../types";
type CheckState = "ok" | "fail" | "skip" | "warn";
interface Check {
    key: string;
    title: string;
    detail: string;
    state: CheckState;
    stateText?: string;
}
/** Turns the API result into separate, honest rows: what was checked and what was not. */
export type HashSource = {
    kind: "file";
    name: string;
} | {
    kind: "link";
};
export declare function buildChecks(result: Verification, source?: HashSource): Check[];
export declare function VerificationResult({ result, source }: {
    result: Verification;
    source?: HashSource;
}): import("react").JSX.Element;
export {};
