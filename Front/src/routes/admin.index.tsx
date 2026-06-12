import { createFileRoute } from "@tanstack/react-router";
import { api, money } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  BarChart3,
  Building,
  CheckCircle2,
  Edit3,
  Eye,
  Layers3,
  LifeBuoy,
  Plus,
  Power,
  Search,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

type Tab = "users" | "organizations" | "insights" | "plans" | "tickets";

type AdminStats = {
  organizations: number;
  activeOrganizations: number;
  inactiveOrganizations: number;
  users: number;
  activeUsers: number;
  inactiveUsers: number;
  pendingInvitations: number;
  plans: number;
  activePlans: number;
  recentUsers: number;
  recentOrganizations: number;
  subscriptionsByStatus: Array<{ status: string; count: number }>;
};

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  globalRole: "user" | "admin";
  isActive: boolean;
  emailVerifiedAt?: string | null;
  createdAt: string;
  _count?: { memberships: number; invitations: number };
};

type OrganizationRow = {
  id: string;
  name: string;
  industry: string;
  currency: string;
  schemaName: string;
  isActive: boolean;
  createdAt: string;
  _count?: { members: number; invitations: number; subscriptions: number };
  subscriptions?: Array<{ status: string; plan?: PlanRow }>;
};

type UserDetail = UserRow & {
  memberships?: Array<{ role: string; isActive: boolean; organization: OrganizationRow }>;
  invitations?: Array<{ email: string; role: string; createdAt: string; organization: OrganizationRow }>;
};

type OrganizationDetail = OrganizationRow & {
  members?: Array<{ role: string; isActive: boolean; user: UserRow }>;
  invitations?: Array<{ email: string; role: string; createdAt: string }>;
};

type PlanRow = {
  id: string;
  name: string;
  price: string | number;
  billingCycle: string;
  features: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  _count?: { subscriptions: number };
};

type SupportTicket = {
  id: string;
  subject: string;
  category: string;
  message: string;
  status: string;
  adminReply?: string | null;
  createdAt: string;
  user: { id: string; fullName: string; email: string };
};

const emptyStats: AdminStats = {
  organizations: 0,
  activeOrganizations: 0,
  inactiveOrganizations: 0,
  users: 0,
  activeUsers: 0,
  inactiveUsers: 0,
  pendingInvitations: 0,
  plans: 0,
  activePlans: 0,
  recentUsers: 0,
  recentOrganizations: 0,
  subscriptionsByStatus: [],
};

function AdminDashboard() {
  const [tab, setTab] = useState<Tab>(() => sectionFromHash());
  const [stats, setStats] = useState<AdminStats>(emptyStats);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [selectedOrganization, setSelectedOrganization] = useState<OrganizationDetail | null>(null);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editingOrganization, setEditingOrganization] = useState<OrganizationRow | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlanRow | "new" | null>(null);
  const [replyingTicket, setReplyingTicket] = useState<SupportTicket | null>(null);

  const load = async () => {
    try {
      const [nextStats, nextUsers, nextOrganizations, nextPlans, nextTickets] = await Promise.all([
        api<AdminStats>("/admin/dashboard"),
        api<UserRow[]>("/admin/users"),
        api<OrganizationRow[]>("/admin/organizations"),
        api<PlanRow[]>("/admin/plans"),
        api<SupportTicket[]>("/admin/support/tickets"),
      ]);
      setStats(nextStats);
      setUsers(nextUsers);
      setOrganizations(nextOrganizations);
      setPlans(nextPlans);
      setTickets(nextTickets);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load admin data");
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const syncSection = () => setTab(sectionFromHash());
    syncSection();
    window.addEventListener("hashchange", syncSection);
    return () => window.removeEventListener("hashchange", syncSection);
  }, []);

  const filteredUsers = useMemo(() => users.filter((user) =>
    `${user.fullName} ${user.email} ${user.globalRole}`.toLowerCase().includes(query.toLowerCase())
  ), [users, query]);

  const filteredOrganizations = useMemo(() => organizations.filter((org) =>
    `${org.name} ${org.industry} ${org.currency}`.toLowerCase().includes(query.toLowerCase())
  ), [organizations, query]);

  const subscriptionData = stats.subscriptionsByStatus.length
    ? stats.subscriptionsByStatus
    : [{ status: "none", count: 0 }];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers3 className="h-6 w-6 text-primary" /> Admin Operations
          </h1>
          <p className="text-on-surface-variant mt-1">Manage platform users, tenants, plans, and system health.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Metric label="Users" value={stats.users} icon={Users} />
          <Metric label="Organizations" value={stats.organizations} icon={Building} />
          <Metric label="Plans" value={stats.plans} icon={BadgeCheck} />
          <Metric label="Invites" value={stats.pendingInvitations} icon={Power} />
        </div>
      </div>

      {(tab === "users" || tab === "organizations") && (
        <div className="relative max-w-md">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} className="ps-9" placeholder={`Search ${tab}`} />
        </div>
      )}

      {tab === "users" && (
        <div className="grid xl:grid-cols-[1fr_380px] gap-4">
          <DataPanel title="Users" icon={Users}>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-on-surface-variant bg-surface-container">
                <tr>
                  <th className="p-2 text-start">User</th>
                  <th className="p-2 text-start">Role</th>
                  <th className="p-2 text-start">Status</th>
                  <th className="p-2 text-end">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {filteredUsers.map((user) => (
                  <tr key={user.id} onClick={() => openUser(user.id, setSelectedUser)} className="hover:bg-surface-subtle cursor-pointer">
                    <td className="p-2">
                      <p className="font-medium">{user.fullName}</p>
                      <p className="text-xs text-on-surface-variant">{user.email}</p>
                    </td>
                    <td className="p-2 capitalize">{user.globalRole}</td>
                    <td className="p-2"><Status active={user.isActive} /></td>
                    <td className="p-2">
                      <RowActions
                        onView={() => openUser(user.id, setSelectedUser)}
                        onEdit={() => setEditingUser(user)}
                        onToggle={() => updateUser(user.id, { isActive: !user.isActive }, load)}
                        onDelete={() => deleteItem(`/admin/users/${user.id}`, load)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataPanel>
          <DetailPanel
            title={selectedUser?.fullName ?? "Select a user"}
            subtitle={selectedUser?.email ?? "Open a row to inspect memberships and verification state."}
            rows={selectedUser ? [
              ["Role", selectedUser.globalRole],
              ["Status", selectedUser.isActive ? "Active" : "Inactive"],
              ["Verified", selectedUser.emailVerifiedAt ? date(selectedUser.emailVerifiedAt) : "No"],
              ["Created", date(selectedUser.createdAt)],
              ["Memberships", String(selectedUser.memberships?.length ?? selectedUser._count?.memberships ?? 0)],
              ["Invited orgs", String(selectedUser.invitations?.length ?? selectedUser._count?.invitations ?? 0)],
              ["Organizations", selectedUser.memberships?.map((item) => item.organization.name).join(", ") || "None"],
            ] : []}
          />
        </div>
      )}

      {tab === "organizations" && (
        <div className="grid xl:grid-cols-[1fr_380px] gap-4">
          <DataPanel title="Organizations" icon={Building}>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-on-surface-variant bg-surface-container">
                <tr>
                  <th className="p-2 text-start">Organization</th>
                  <th className="p-2 text-start">Plan</th>
                  <th className="p-2 text-start">Status</th>
                  <th className="p-2 text-end">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {filteredOrganizations.map((org) => (
                  <tr key={org.id} onClick={() => openOrganization(org.id, setSelectedOrganization)} className="hover:bg-surface-subtle cursor-pointer">
                    <td className="p-2">
                      <p className="font-medium">{org.name}</p>
                      <p className="text-xs text-on-surface-variant">{org.industry} · {org.currency}</p>
                    </td>
                    <td className="p-2">{org.subscriptions?.[0]?.plan?.name ?? "No plan"}</td>
                    <td className="p-2"><Status active={org.isActive} /></td>
                    <td className="p-2">
                      <RowActions
                        onView={() => openOrganization(org.id, setSelectedOrganization)}
                        onEdit={() => setEditingOrganization(org)}
                        onToggle={() => updateOrganization(org.id, { isActive: !org.isActive }, load)}
                        onDelete={() => deleteItem(`/admin/organizations/${org.id}`, load)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataPanel>
          <DetailPanel
            title={selectedOrganization?.name ?? "Select an organization"}
            subtitle={selectedOrganization?.schemaName ?? "Open a row to inspect tenant details and counts."}
            rows={selectedOrganization ? [
              ["Industry", selectedOrganization.industry],
              ["Currency", selectedOrganization.currency],
              ["Status", selectedOrganization.isActive ? "Active" : "Inactive"],
              ["Members", String(selectedOrganization._count?.members ?? 0)],
              ["Subscriptions", String(selectedOrganization._count?.subscriptions ?? 0)],
              ["Created", date(selectedOrganization.createdAt)],
              ["Users", selectedOrganization.members?.map((item) => item.user.fullName).join(", ") || "None"],
              ["Invitations", String(selectedOrganization.invitations?.length ?? 0)],
            ] : []}
          />
        </div>
      )}

      {tab === "insights" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <DataPanel title="Activation mix" icon={Power}>
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie dataKey="value" nameKey="name" data={[
                    { name: "Active users", value: stats.activeUsers },
                    { name: "Inactive users", value: stats.inactiveUsers },
                    { name: "Active orgs", value: stats.activeOrganizations },
                    { name: "Inactive orgs", value: stats.inactiveOrganizations },
                  ]}>
                    {["#2563eb", "#dc2626", "#16a34a", "#f59e0b"].map((fill) => <Cell key={fill} fill={fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </DataPanel>
          <DataPanel title="Subscription status" icon={BadgeCheck}>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={subscriptionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DataPanel>
          <DataPanel title="Last 30 days" icon={BarChart3}>
            <div className="grid sm:grid-cols-2 gap-3">
              <BigNumber label="New users" value={stats.recentUsers} />
              <BigNumber label="New organizations" value={stats.recentOrganizations} />
            </div>
          </DataPanel>
        </div>
      )}

      {tab === "plans" && (
        <DataPanel title="Plans shown to users" icon={BadgeCheck} action={
          <Button size="sm" onClick={() => setEditingPlan("new")}><Plus className="h-4 w-4 me-1" /> Add plan</Button>
        }>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {plans.map((plan) => (
              <div key={plan.id} className="border border-border-default rounded-lg p-4 bg-surface-subtle">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{plan.name}</p>
                    <p className="text-sm text-on-surface-variant">{money(plan.price)} / {plan.billingCycle}</p>
                  </div>
                  <Status active={plan.isActive} />
                </div>
                <p className="text-xs text-on-surface-variant mt-3 line-clamp-2">{JSON.stringify(plan.features ?? {})}</p>
                <div className="mt-4 flex justify-end gap-1">
                  <IconButton title="Edit" onClick={() => setEditingPlan(plan)} icon={Edit3} />
                  <IconButton title="Toggle" onClick={() => updatePlan(plan.id, { isActive: !plan.isActive }, load)} icon={Power} />
                  <IconButton title="Delete" onClick={() => deleteItem(`/admin/plans/${plan.id}`, load)} icon={Trash2} danger />
                </div>
              </div>
            ))}
          </div>
        </DataPanel>
      )}

      {tab === "tickets" && (
        <DataPanel title="Support tickets" icon={LifeBuoy}>
          <div className="space-y-3">
            {tickets.length ? tickets.map((ticket) => (
              <article key={ticket.id} className="rounded-lg border border-border-default p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{ticket.subject}</p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {ticket.user.fullName} · {ticket.user.email} · {String(ticket.createdAt).slice(0, 10)}
                    </p>
                  </div>
                  <span className="rounded-md bg-surface-container px-2 py-1 text-xs capitalize">{ticket.status.replace("_", " ")}</span>
                </div>
                <p className="text-sm mt-3 whitespace-pre-wrap">{ticket.message}</p>
                {ticket.adminReply && <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm whitespace-pre-wrap">{ticket.adminReply}</div>}
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={() => setReplyingTicket(ticket)}>{ticket.adminReply ? "Update reply" : "Reply"}</Button>
                </div>
              </article>
            )) : <p className="py-8 text-center text-sm text-on-surface-variant">No support tickets.</p>}
          </div>
        </DataPanel>
      )}

      <UserDialog user={editingUser} onClose={() => setEditingUser(null)} onSaved={load} />
      <OrganizationDialog organization={editingOrganization} onClose={() => setEditingOrganization(null)} onSaved={load} />
      <PlanDialog plan={editingPlan} onClose={() => setEditingPlan(null)} onSaved={load} />
      <SupportReplyDialog ticket={replyingTicket} onClose={() => setReplyingTicket(null)} onSaved={load} />
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="bg-card border border-border-default rounded-lg p-3 min-w-32">
      <div className="flex items-center gap-2 text-xs text-on-surface-variant"><Icon className="h-4 w-4" /> {label}</div>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function DataPanel({ title, icon: Icon, children, action }: { title: string; icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="bg-card border border-border-default rounded-lg shadow-soft overflow-hidden">
      <div className="h-12 px-4 border-b border-border-default flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /> {title}</h2>
        {action}
      </div>
      <div className="p-4 overflow-x-auto">{children}</div>
    </section>
  );
}

function DetailPanel({ title, subtitle, rows }: { title: string; subtitle: string; rows: Array<[string, string]> }) {
  return (
    <DataPanel title="Details" icon={Eye}>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-on-surface-variant break-all mt-1">{subtitle}</p>
      <div className="mt-4 divide-y divide-border-default">
        {rows.map(([label, value]) => (
          <div key={label} className="py-2 flex justify-between gap-4 text-sm">
            <span className="text-on-surface-variant">{label}</span>
            <span className="font-medium text-end">{value}</span>
          </div>
        ))}
      </div>
    </DataPanel>
  );
}

function Status({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
      active ? "bg-status-success/10 text-status-success" : "bg-status-error/10 text-status-error"
    }`}>
      {active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function RowActions(props: { onView: () => void; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-1">
      <IconButton title="View" icon={Eye} onClick={props.onView} />
      <IconButton title="Edit" icon={Edit3} onClick={props.onEdit} />
      <IconButton title="Toggle active" icon={Power} onClick={props.onToggle} />
      <IconButton title="Delete" icon={Trash2} onClick={props.onDelete} danger />
    </div>
  );
}

function IconButton({ icon: Icon, title, onClick, danger }: { icon: React.ElementType; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      title={title}
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      className={`h-8 w-8 rounded-md grid place-items-center transition ${
        danger ? "text-status-error hover:bg-status-error/10" : "text-on-surface-variant hover:bg-surface-container"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

async function openUser(id: string, setSelectedUser: (user: UserDetail) => void) {
  try {
    setSelectedUser(await api<UserDetail>(`/admin/users/${id}`));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not load user details");
  }
}

async function openOrganization(id: string, setSelectedOrganization: (organization: OrganizationDetail) => void) {
  try {
    setSelectedOrganization(await api<OrganizationDetail>(`/admin/organizations/${id}`));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not load organization details");
  }
}

function BigNumber({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-subtle border border-border-default rounded-lg p-5">
      <p className="text-sm text-on-surface-variant">{label}</p>
      <p className="text-4xl font-bold mt-2">{value}</p>
    </div>
  );
}

function UserDialog({ user, onClose, onSaved }: { user: UserRow | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ fullName: "", email: "", globalRole: "user", isActive: true });
  useEffect(() => {
    if (user) setForm({ fullName: user.fullName, email: user.email, globalRole: user.globalRole, isActive: user.isActive });
  }, [user]);
  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit user</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <Field label="Full name" value={form.fullName} onChange={(fullName) => setForm({ ...form, fullName })} />
          <Field label="Email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
          <Label>Role</Label>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.globalRole} onChange={(e) => setForm({ ...form, globalRole: e.target.value })}>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <ToggleLine label="Active" active={form.isActive} onClick={() => setForm({ ...form, isActive: !form.isActive })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => user && save(`/admin/users/${user.id}`, form, onSaved, onClose)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrganizationDialog({ organization, onClose, onSaved }: { organization: OrganizationRow | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", industry: "", currency: "", isActive: true });
  useEffect(() => {
    if (organization) setForm({ name: organization.name, industry: organization.industry, currency: organization.currency, isActive: organization.isActive });
  }, [organization]);
  return (
    <Dialog open={!!organization} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit organization</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <Field label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <Field label="Industry" value={form.industry} onChange={(industry) => setForm({ ...form, industry })} />
          <Field label="Currency" value={form.currency} onChange={(currency) => setForm({ ...form, currency })} />
          <ToggleLine label="Active" active={form.isActive} onClick={() => setForm({ ...form, isActive: !form.isActive })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => organization && save(`/admin/organizations/${organization.id}`, form, onSaved, onClose)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanDialog({ plan, onClose, onSaved }: { plan: PlanRow | "new" | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", price: "0", billingCycle: "monthly", features: "{}", isActive: true });
  useEffect(() => {
    if (!plan) return;
    if (plan === "new") setForm({ name: "", price: "0", billingCycle: "monthly", features: "{}", isActive: true });
    else setForm({ name: plan.name, price: String(plan.price), billingCycle: plan.billingCycle, features: JSON.stringify(plan.features ?? {}, null, 2), isActive: plan.isActive });
  }, [plan]);

  const submit = async () => {
    try {
      const payload = { ...form, price: Number(form.price), features: JSON.parse(form.features || "{}") };
      if (plan === "new") await api("/admin/plans", { method: "POST", body: JSON.stringify(payload) });
      else if (plan) await api(`/admin/plans/${plan.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      toast.success("Plan saved");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save plan");
    }
  };

  return (
    <Dialog open={!!plan} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{plan === "new" ? "Add plan" : "Edit plan"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <Field label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <Field label="Price" value={form.price} onChange={(price) => setForm({ ...form, price })} type="number" />
          <Field label="Billing cycle" value={form.billingCycle} onChange={(billingCycle) => setForm({ ...form, billingCycle })} />
          <Label>Features JSON</Label>
          <Textarea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} className="font-mono text-xs min-h-32" />
          <ToggleLine label="Shown to users" active={form.isActive} onClick={() => setForm({ ...form, isActive: !form.isActive })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupportReplyDialog({ ticket, onClose, onSaved }: { ticket: SupportTicket | null; onClose: () => void; onSaved: () => void }) {
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("resolved");
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (ticket) {
      setReply(ticket.adminReply ?? "");
      setStatus(ticket.status === "open" ? "resolved" : ticket.status);
    }
  }, [ticket]);

  const submit = async () => {
    if (!ticket || !reply.trim()) return;
    setSending(true);
    try {
      await api(`/admin/support/tickets/${ticket.id}/reply`, {
        method: "PATCH",
        body: JSON.stringify({ reply, status }),
      });
      toast.success("Reply emailed to the user");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reply to ticket");
    } finally {
      setSending(false);
    }
  };

  return <Dialog open={Boolean(ticket)} onOpenChange={(open) => !open && onClose()}>
    <DialogContent>
      <DialogHeader><DialogTitle>Reply to support ticket</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="rounded-lg bg-surface-container p-3"><p className="font-medium">{ticket?.subject}</p><p className="text-sm text-on-surface-variant mt-1">{ticket?.message}</p></div>
        <div className="space-y-1.5"><Label>Reply</Label><Textarea className="min-h-36" value={reply} onChange={(event) => setReply(event.target.value)} /></div>
        <div className="space-y-1.5"><Label>Status</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={sending || !reply.trim()} onClick={() => void submit()}>{sending ? "Sending..." : "Send reply"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ToggleLine({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="h-10 rounded-md border border-border-default px-3 flex items-center justify-between text-sm">
      <span>{label}</span>
      <Status active={active} />
    </button>
  );
}

async function save(path: string, body: unknown, onSaved: () => void, onClose: () => void) {
  try {
    await api(path, { method: "PATCH", body: JSON.stringify(body) });
    toast.success("Saved");
    onSaved();
    onClose();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not save");
  }
}

async function updateUser(id: string, body: Partial<UserRow>, onSaved: () => void) {
  await save(`/admin/users/${id}`, body, onSaved, () => {});
}

async function updateOrganization(id: string, body: Partial<OrganizationRow>, onSaved: () => void) {
  await save(`/admin/organizations/${id}`, body, onSaved, () => {});
}

async function updatePlan(id: string, body: Partial<PlanRow>, onSaved: () => void) {
  await save(`/admin/plans/${id}`, body, onSaved, () => {});
}

async function deleteItem(path: string, onSaved: () => void) {
  if (!window.confirm("Delete this record? This cannot be undone.")) return;
  try {
    await api(path, { method: "DELETE" });
    toast.success("Deleted");
    onSaved();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not delete");
  }
}

function sectionFromHash(): Tab {
  if (typeof window === "undefined") return "users";
  const section = window.location.hash.replace("#", "");
  return ["users", "organizations", "insights", "plans", "tickets"].includes(section)
    ? (section as Tab)
    : "users";
}

function date(value: string) {
  return new Date(value).toLocaleDateString();
}
