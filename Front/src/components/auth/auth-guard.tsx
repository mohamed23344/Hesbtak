import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";

import { getSession } from "@/lib/api";
import { GlobalLoader } from "@/components/common/global-loader";

export function AuthGuard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [checking, setChecking] = useState(true);

  // Show loader on every route change
  useEffect(() => {
    setChecking(true);
  }, [location.pathname]);

  useEffect(() => {
    const session = getSession();
    const path = location.pathname;

    // Landing page is public for everyone
    if (path === "/") {
      setChecking(false);
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

    // Guest user
    if (!session && !isPublic) {
      navigate({
        to: "/login",
        replace: true,
      });
      return;
    }

    // Protect admin routes
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

    // Admin bypasses tenant checks
    if (session && isAdmin) {
      if (["/login", "/register"].includes(path)) {
        navigate({
          to: "/admin/dashboard",
          replace: true,
        });
        return;
      }

      setChecking(false);
      return;
    }

    const hasOrganization =
      !!session?.activeTenantId &&
      session.tenants.length > 0;

    // User authenticated but has no organization
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

    // User authenticated and already has organization
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

    setChecking(false);
  }, [navigate, location.pathname]);

  if (checking) {
    return <GlobalLoader />;
  }

  return null;
}