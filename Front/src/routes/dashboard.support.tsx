import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "./dashboard.transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api, getSession } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/support")({ component: SupportPage });

type Ticket = {
  id: string;
  subject: string;
  category: string;
  message: string;
  status: string;
  adminReply?: string | null;
  createdAt: string;
};

function SupportPage() {
  const session = getSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "technical", message: "" });

  const load = () => api<Ticket[]>("/support/tickets")
    .then(setTickets)
    .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load support tickets"));

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    setSending(true);
    try {
      await api("/support/tickets", {
        method: "POST",
        body: JSON.stringify({ ...form, organizationId: session?.activeTenantId }),
      });
      setForm({ subject: "", category: "technical", message: "" });
      await load();
      toast.success("Support ticket submitted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit support ticket");
    } finally {
      setSending(false);
    }
  };

  return <div className="space-y-5">
    <Header title="Support" desc="Contact the Hesbtk.AI support team and track their replies." />
    <section className="bg-card border border-border-default rounded-2xl p-5 shadow-soft">
      <h2 className="font-semibold">Contact us</h2>
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div className="space-y-1.5"><Label>Subject</Label><Input value={form.subject} maxLength={160} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="technical">Technical issue</option>
            <option value="account">Account and access</option>
            <option value="billing">Billing</option>
            <option value="feature_request">Feature request</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="md:col-span-2 space-y-1.5"><Label>How can we help?</Label><Textarea value={form.message} maxLength={5000} onChange={(event) => setForm({ ...form, message: event.target.value })} className="min-h-36" /></div>
      </div>
      <Button className="mt-4" onClick={() => void submit()} disabled={sending}>{sending ? "Sending..." : "Submit ticket"}</Button>
    </section>

    <section className="bg-card border border-border-default rounded-2xl shadow-soft overflow-hidden">
      <div className="p-5 border-b border-border-default"><h2 className="font-semibold">Your tickets</h2></div>
      <div className="divide-y divide-border-default">
        {tickets.length ? tickets.map((ticket) => <article key={ticket.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-medium">{ticket.subject}</h3><p className="text-xs text-on-surface-variant mt-1 capitalize">{ticket.category.replace("_", " ")} · {String(ticket.createdAt).slice(0, 10)}</p></div>
            <Badge variant={ticket.status === "resolved" || ticket.status === "closed" ? "secondary" : "default"} className="capitalize">{ticket.status.replace("_", " ")}</Badge>
          </div>
          <p className="text-sm mt-3 whitespace-pre-wrap">{ticket.message}</p>
          {ticket.adminReply && <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-xs font-semibold text-primary">SUPPORT REPLY</p><p className="text-sm mt-2 whitespace-pre-wrap">{ticket.adminReply}</p></div>}
        </article>) : <p className="p-8 text-center text-sm text-on-surface-variant">No support tickets yet.</p>}
      </div>
    </section>
  </div>;
}
