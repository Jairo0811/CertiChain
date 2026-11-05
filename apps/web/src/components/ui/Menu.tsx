import { useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";

export interface MenuAction {
  label: string;
  icon: IconName;
  onSelect: () => void;
  tone?: "danger";
  disabled?: boolean;
  hint?: string;
}

/**
 * Row-level overflow menu (WAI-ARIA menu button pattern): keeps table rows compact instead of
 * rendering five buttons per row. Arrow keys move between items; Escape returns focus.
 */
export function ActionMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not([disabled])")?.focus();
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent) {
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not([disabled])") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Escape" || event.key === "Tab") {
      setOpen(false);
      if (event.key === "Escape") buttonRef.current?.focus();
    }
  }

  return (
    <div className="menu">
      <button
        ref={buttonRef}
        type="button"
        className="icon-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="more" />
      </button>
      {open && (
        <div ref={menuRef} id={menuId} role="menu" className="menu-list" onKeyDown={onKeyDown}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              className={`menu-item ${action.tone ?? ""}`}
              disabled={action.disabled}
              title={action.hint}
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
            >
              <Icon name={action.icon} size={16} />
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
