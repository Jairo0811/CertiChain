/**
 * Minimal pathname router. The portal has four screens and no nested routes, so a dependency
 * like React Router would add weight without a tangible benefit; this still gives deep links,
 * back/forward support and refresh-safe URLs (nginx already falls back to index.html).
 */
export type PortalRoute = "dashboard" | "certificates" | "issue";
export declare function routeFromPath(pathname: string): PortalRoute;
export declare function useRoute(): {
  route: PortalRoute;
  navigate: (next: PortalRoute) => void;
  href: (next: PortalRoute) => string;
};
