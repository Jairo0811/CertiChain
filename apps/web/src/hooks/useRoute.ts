import { useCallback, useEffect, useState } from "react";

/**
 * Minimal pathname router. The portal has four screens and no nested routes, so a dependency
 * like React Router would add weight without a tangible benefit; this still gives deep links,
 * back/forward support and refresh-safe URLs (nginx already falls back to index.html).
 */
export type PortalRoute = "dashboard" | "certificates" | "issue";

const PATHS: Record<PortalRoute, string> = {
  dashboard: "/",
  certificates: "/certificates",
  issue: "/certificates/new",
};

export function routeFromPath(pathname: string): PortalRoute {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === PATHS.issue) return "issue";
  if (normalized === PATHS.certificates) return "certificates";
  return "dashboard";
}

export function useRoute() {
  const [route, setRoute] = useState<PortalRoute>(() => routeFromPath(window.location.pathname));

  useEffect(() => {
    const onPop = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((next: PortalRoute) => {
    if (window.location.pathname !== PATHS[next]) window.history.pushState({}, "", PATHS[next]);
    setRoute(next);
    window.scrollTo?.({ top: 0 });
  }, []);

  return { route, navigate, href: (next: PortalRoute) => PATHS[next] };
}
