import type { SVGProps } from "react";

/**
 * Inline SVG icon set (24×24, 1.75 stroke). Replaces the Font Awesome CDN stylesheet and the
 * Unicode glyph icons that rendered inconsistently across platforms. Decorative by default;
 * pass `label` to expose the icon to assistive technologies.
 */
const PATHS = {
  dashboard: "M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z",
  certificates: "M7 3h7l5 5v13H7V3Zm7 0v5h5M10 13h6M10 17h6",
  issue: "M12 5v14M5 12h14",
  verify: "M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Zm-3.5 9 2.5 2.5 4.5-5",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  logout: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4.3-4.3",
  more: "M12 6h.01M12 12h.01M12 18h.01",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeOff:
    "M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7c1.8 0 3.4-.5 4.8-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  file: "M7 3h7l5 5v13H7V3Zm7 0v5h5",
  revoke: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5.6 5.6l12.8 12.8",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  check: "M5 12.5 10 17l9-10",
  cross: "M7 7l10 10M17 7 7 17",
  minus: "M6 12h12",
  alert: "M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5v-5M12 8h.01",
  refresh: "M20 11a8 8 0 0 0-14.8-4M4 4v4h4M4 13a8 8 0 0 0 14.8 4M20 20v-4h-4",
  chain: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  database:
    "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  fingerprint:
    "M12 11v3c0 2.5-.7 4.8-2 6.7M8 9.5A4 4 0 0 1 16 11v1.5M16 15.5c-.2 2-.8 3.8-1.7 5.5M5 15.5c.6-1.4 1-3 1-4.5a6 6 0 0 1 9.5-4.9M18.6 8A8.2 8.2 0 0 1 20 11c0 1-.1 2-.3 3",
  upload: "M12 20V9M7 14l5-5 5 5M5 4h14",
  copy: "M9 9h11v11H9V9ZM5 15H4V4h11v1",
  sortAsc: "M8 17V7M4 11l4-4 4 4M14 8h6M14 12h4M14 16h2",
  sortDesc: "M8 7v10M4 13l4 4 4-4M14 8h2M14 12h4M14 16h6",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronRight: "M9 6l6 6-6 6",
  lock: "M6 11h12v10H6V11Zm2 0V8a4 4 0 1 1 8 0v3",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2",
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  label?: string;
}

export function Icon({ name, size = 18, label, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "more" ? 3 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
