const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3000/api/v1";

export type TenantContext = {
  organizationId: string;
  schemaName?: string;
  organizationName: string;
  industry?: string;
  currency?: string;
  role: string;
};

export type Session = {
  accessToken: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    globalRole: string;
    emailVerifiedAt?: string | null;
  };
  tenants: TenantContext[];
  activeTenantId?: string;
};

const SESSION_KEY = "hesbtak-session";
const PENDING_EMAIL_KEY = "hesbtak-pending-email";

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
}

export function saveSession(data: {
  accessToken: string;
  user: Session["user"];
  tenants?: TenantContext[];
  organization?: { id: string; name: string; schemaName?: string };
}) {
  const tenants =
    data.tenants ??
    (data.organization
      ? [
          {
            organizationId: data.organization.id,
            schemaName: data.organization.schemaName,
            organizationName: data.organization.name,
            industry: (data.organization as any).industry,
            currency: (data.organization as any).currency,
            role: "owner",
          },
        ]
      : []);
  const session: Session = {
    accessToken: data.accessToken,
    user: data.user,
    tenants,
    activeTenantId:
      data.user.globalRole === "admin" ? undefined : tenants[0]?.organizationId,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function updateSession(patch: Partial<Session>) {
  const current = getSession();
  if (!current) return null;
  const session = { ...current, ...patch };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function setPendingEmail(email: string) {
  localStorage.setItem(PENDING_EMAIL_KEY, email);
}

export function getPendingEmail() {
  return localStorage.getItem(PENDING_EMAIL_KEY) ?? "";
}

export function setPendingOtpPurpose(purpose: "signup" | "password_reset") {
  localStorage.setItem("hesbtak-pending-otp-purpose", purpose);
}

export function getPendingOtpPurpose() {
  return (localStorage.getItem("hesbtak-pending-otp-purpose") as "signup" | "password_reset" | null) ?? "signup";
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getSession();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }
  if (session?.activeTenantId) {
    headers.set("x-tenant-id", session.activeTenantId);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.message
      ? Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message
      : "Request failed";
    throw new Error(message);
  }
  return data as T;
}

export const money = (value: number | string | null | undefined) =>
  Number(value ?? 0).toLocaleString(undefined, {
    style: "currency",
    currency: getSession()?.tenants[0]?.organizationName ? "USD" : "USD",
    maximumFractionDigits: 0,
  });
