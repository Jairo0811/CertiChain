import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";

type Tone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => undefined);

/** Polite live region so screen readers announce results of actions without stealing focus. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const push = useCallback(
    (message: string, tone: Tone = "success") => {
      counter.current += 1;
      const id = counter.current;
      setItems((current) => [...current.slice(-2), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 8000 : 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast toast-${item.tone}`}>
            <Icon name={item.tone === "success" ? "check" : item.tone === "error" ? "alert" : "info"} />
            <span>{item.message}</span>
            <button type="button" className="icon-button" aria-label="Descartar aviso" onClick={() => dismiss(item.id)}>
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
