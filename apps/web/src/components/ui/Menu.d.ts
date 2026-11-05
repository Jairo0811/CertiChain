import { IconName } from "./Icon";
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
export declare function ActionMenu({ label, actions }: { label: string; actions: MenuAction[] }): import("react").JSX.Element;
