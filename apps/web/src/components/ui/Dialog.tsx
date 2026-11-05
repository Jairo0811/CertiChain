import { ReactNode, useEffect, useId, useRef } from "react";
import { Icon } from "./Icon";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open dialogs, innermost last. Only the top-most one reacts to Escape and traps Tab. */
const stack: symbol[] = [];

/**
 * Accessible modal surface used by both centered dialogs and side drawers:
 * focus moves inside on open, Tab is trapped, Escape closes, focus returns to the trigger.
 */
export function Dialog({
  title,
  description,
  onClose,
  children,
  variant = "dialog",
  size = "md",
  footer,
  closeLabel = "Cerrar",
  dismissible = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  variant?: "dialog" | "drawer";
  size?: "sm" | "md" | "lg";
  footer?: ReactNode;
  closeLabel?: string;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useEffect(() => {
    const token = Symbol("dialog");
    stack.push(token);
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>("[data-autofocus]") ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (stack[stack.length - 1] !== token) return;
      if (event.key === "Escape" && dismissibleRef.current) {
        event.stopPropagation();
        onCloseRef.current();
      }
      if (event.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.offsetParent !== null || item === document.activeElement);
      if (items.length === 0) return;
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(token), 1);
      if (stack.length === 0) document.body.style.overflow = originalOverflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <div className={`overlay overlay-${variant}`} onMouseDown={(event) => event.target === event.currentTarget && dismissible && onClose()}>
      <div
        ref={ref}
        className={`surface-${variant} size-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && (
              <p id={descriptionId} className="dialog-description">
                {description}
              </p>
            )}
          </div>
          {dismissible && (
            <button type="button" className="icon-button" onClick={onClose} aria-label={closeLabel}>
              <Icon name="close" />
            </button>
          )}
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-footer">{footer}</footer>}
      </div>
    </div>
  );
}
