/**
 * Public verifier. Supports:
 * - /verify?id=<id or blockchain id>&autoverify=1  (current QR codes)
 * - /verify?id=<id>&hash=<sha256>                  (legacy links; hash labelled as coming from the link)
 * An optional local PDF is hashed in the browser and only its SHA-256 is sent.
 */
export declare function PublicVerifyPage(): import("react").JSX.Element;
