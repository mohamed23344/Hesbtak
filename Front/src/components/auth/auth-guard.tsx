import { useEffect } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";

import { getSession } from "@/lib/api";

export function AuthGuard() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const session = getSession();
    const path = location.pathname;

    // Landing page is public for everyone
    if (path === "/") {
      return;
    }

    const publicRoutes = [
      "/login",
      "/register",
      "/forgot-password",
      "/verify-otp",
      "/accept-invitation",
    ];

    const isPublic = publicRoutes.includes(path);

    // Guest user – redirect to login
    if (!session && !isPublic) {
      navigate({
        to: "/login",
        replace: true,
      });
      return;
    }

    // Protect admin routes from non-admins
    if (
      path.startsWith("/admin") &&
      session?.user?.globalRole !== "admin"
    ) {
      navigate({
        to: "/dashboard",
        replace: true,
      });
      return;
    }

    const isAdmin = session?.user?.globalRole === "admin";

    // Admin: redirect away from login/register to the admin panel
    if (session && isAdmin) {
      if (["/login", "/register"].includes(path)) {
        navigate({
          to: "/admin",
          replace: true,
        });
        return;
      }
      // Admin is allowed everywhere else – no further checks
      return;
    }

    const hasOrganization =
      !!session?.activeTenantId &&
      session.tenants.length > 0;

    // User authenticated but has no organization yet
    if (
      session &&
      !hasOrganization &&
      path !== "/select-organization" &&
      !path.startsWith("/onboarding")
    ) {
      navigate({
        to: "/select-organization",
        replace: true,
      });
      return;
    }

    // Authenticated user with org trying to visit login/register
    if (
      session &&
      hasOrganization &&
      ["/login", "/register"].includes(path)
    ) {
      navigate({
        to: "/dashboard",
        replace: true,
      });
      return;
    }
  }, [navigate, location.pathname]);

  // Never blocks rendering – redirects happen imperatively above
  return null;
}