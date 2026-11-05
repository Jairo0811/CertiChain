import { ReactNode } from "react";
export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}
/**
 * Form field with an explicit <label for>. Hints and errors live outside the label and are linked
 * with aria-describedby, so the control's accessible name stays exactly the label text.
 */
export declare function Field({
  label,
  optional,
  hint,
  error,
  children,
}: {
  label: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  children: (props: FieldControlProps) => ReactNode;
}): import("react").JSX.Element;
