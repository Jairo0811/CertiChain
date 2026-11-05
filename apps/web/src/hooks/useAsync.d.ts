export interface AsyncState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
}
/**
 * Runs an abortable loader whenever its dependencies change. Stale responses are discarded, so a
 * fast filter change can never be overwritten by a slower previous request.
 */
export declare function useAsync<T>(loader: (signal: AbortSignal) => Promise<T>, deps: unknown[]): AsyncState<T>;
export declare function useDebouncedValue<T>(value: T, delayMs?: number): T;
