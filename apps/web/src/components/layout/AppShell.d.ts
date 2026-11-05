import { ReactNode } from "react";
import type { PortalRoute } from "../../hooks/useRoute";
import type { SessionUser } from "../../types";
export declare function AppShell({ route, title, user, href, onNavigate, onLogout, modeLabel, children, }: {
    route: PortalRoute;
    title: string;
    user: SessionUser;
    href: (route: PortalRoute) => string;
    onNavigate: (route: PortalRoute) => void;
    onLogout: () => void;
    modeLabel?: string;
    children: ReactNode;
}): import("react").JSX.Element;
