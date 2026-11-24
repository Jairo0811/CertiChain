import { useCallback, useEffect, useState } from "react";
import { API_URL, checkApiConnection } from "../lib/api";
import type { ConnectionState } from "../types";

/** API reachability and whether the server reports a configured blockchain integration. */
export function useConnection() {
  const [connection, setConnection] = useState<ConnectionState>(API_URL ? "checking" : "unconfigured");
  const [blockchainConfigured, setBlockchainConfigured] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    setConnection(API_URL ? "checking" : "unconfigured");
    const result = await checkApiConnection();
    setConnection(result.state);
    setBlockchainConfigured(result.blockchainConfigured);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { connection, setConnection, blockchainConfigured, refresh };
}
