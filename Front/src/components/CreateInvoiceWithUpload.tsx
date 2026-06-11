import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter, Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UploadCloud, CheckCircle2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { api, money } from "@/lib/api";

type Props = {
  title: string;
  type: "sales" | "purchases" | "expenses";
  onDone?: () => void;
};

type Party = { id: string; name: string; email?: string; phone?: string };
type Line = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxRate: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const newLine = (): Line => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: "1",
  unitPrice: "",
  discountAmount: "0",
  taxRate: "0",
});

export default function CreateInvoiceWithUpload({ title, type, onDone }: Props) {
  const { t } = useI18n();
  const isSales = type === "sales";
  const partyKind = isSales ? "customer" : "vendor";
  const partyLabel = isSales ? "Customer" : "Vendor";
  const partyEndpoint = isSales ? "/tenant/customers" : "/tenant/vendors";
  const invoiceEndpoint = isSales ? "/tenant/invoices" : "/tenant/vendor-bills";

  const [tab, setTab] = useState("manual");
  const [uploaded, setUploaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [parties, setParties] = useState<Party[]>([]);
  const [partyId, setPartyId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPartyDialog, setShowPartyDialog] = useState(false);
  const [creatingParty, setCreatingParty] = useState(false);
  const [newParty, setNewParty] = useState({ name: "", email: "", phone: "", address: "" });
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [status, setStatus] = useState<"draft" | "open" | "paid">("open");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [lines, setLines] = useState<Line[]>([newLine()]);

  const loadParties = async () => {
    try {
      setParties(await api<Party[]>(partyEndpoint));
    } catch {
      setParties([]);
    }
  };

  useEffect(() => {
    void loadParties();
  }, [partyEndpoint]);

  const selectedParty = parties.find((party) => party.id === partyId);
  const filteredParties = parties.filter((party) => {
    const query = searchQuery.toLowerCase();
    return party.name.toLowerCase().includes(query) || party.email?.toLowerCase().includes(query);
  });

  const totals = useMemo(() => lines.reduce(
    (sum, line) => {
      const base = Math.max(0, Number(line.quantity || 0) * Number(line.unitPrice || 0) - Number(line.discountAmount || 0));
      const tax = base * (Number(line.taxRate || 0) / 100);
      return { subtotal: sum.subtotal + base, tax: sum.tax + tax, total: sum.total + base + tax };
    },
    { subtotal: 0, tax: 0, total: 0 },
  ), [lines]);

  const updateLine = (id: string, field: keyof Omit<Line, "id">, value: string) => {
    setLines((current) => current.map((line) => line.id === id ? { ...line, [field]: value } : line));
  };

  const createParty = async () => {
    if (!newParty.name.trim()) {
      toast.error(`${partyLabel} name is required`);
      return;
    }
    setCreatingParty(true);
    try {
      const created = await api<{ id: string }>(partyEndpoint, {
        method: "POST",
        body: JSON.stringify({
          name: newParty.name.trim(),
          email: newParty.email || undefined,
          phone: newParty.phone || undefined,
          address: newParty.address || undefined,
        }),
      });
      const party = { id: created.id, name: newParty.name.trim(), email: newParty.email || undefined, phone: newParty.phone || undefined };
      setParties((current) => [party, ...current]);
      setPartyId(created.id);
      setNewParty({ name: "", email: "", phone: "", address: "" });
      setShowPartyDialog(false);
      setSearchQuery("");
      toast.success(`${partyLabel} created and selected`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not create ${partyKind}`);
    } finally {
      setCreatingParty(false);
    }
  };

  const submitManual = async () => {
    const validLines = lines.filter((line) => line.description.trim() && Number(line.quantity) > 0 && Number(line.unitPrice) >= 0);
    if (!partyId) {
      toast.error(`Select a ${partyKind}`);
      return;
    }
    if (!validLines.length || validLines.length !== lines.length) {
      toast.error("Complete every invoice line with a description, quantity, and price");
      return;
    }
    if (dueDate < issueDate) {
      toast.error("Due date cannot be before the issue date");
      return;
    }

    setSubmitting(true);
    try {
      const apiStatus = status === "open" ? (isSales ? "unpaid" : "received") : status;
      await api(invoiceEndpoint, {
        method: "POST",
        body: JSON.stringify({
          [isSales ? "customerId" : "vendorId"]: partyId,
          issueDate,
          dueDate,
          status: apiStatus,
          paymentMethod: status === "paid" ? paymentMethod : undefined,
          lines: validLines.map((line) => ({
            description: line.description.trim(),
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
            discountAmount: Number(line.discountAmount || 0),
            taxRate: Number(line.taxRate || 0),
          })),
        }),
      });
      toast.success(`${title} created${status === "paid" ? " with payment and voucher journal" : ""}`);
      onDone?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not create ${title}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="manual">{t("manualEntry")}</TabsTrigger>
          <TabsTrigger value="upload">{t("uploadDocument")}</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-5 space-y-5">
          <section className="rounded-xl border border-border-default bg-surface-container/30 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>{partyLabel}</Label>
                <p className="text-xs text-on-surface-variant mt-1">
                  {isSales ? "The customer will own this sales invoice." : "The vendor will own this bill or expense."}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowPartyDialog(true)} className="gap-1">
                <Plus className="h-4 w-4" /> New {partyLabel}
              </Button>
            </div>
            {selectedParty ? (
              <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold">{selectedParty.name}</p>
                  {selectedParty.email && <p className="text-xs text-on-surface-variant">{selectedParty.email}</p>}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPartyId("")}>Change</Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <Input className="ps-9" placeholder={`Search ${partyLabel.toLowerCase()} by name or email`} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
                </div>
                <div className="max-h-44 overflow-y-auto rounded-lg border border-border-default divide-y divide-border-default">
                  {filteredParties.length ? filteredParties.map((party) => (
                    <button type="button" key={party.id} className="w-full p-3 text-start hover:bg-surface-subtle" onClick={() => { setPartyId(party.id); setSearchQuery(""); }}>
                      <span className="text-sm font-medium">{party.name}</span>
                      {party.email && <span className="ms-2 text-xs text-on-surface-variant">{party.email}</span>}
                    </button>
                  )) : (
                    <div className="p-4 text-center text-sm text-on-surface-variant">
                      No {partyKind} found. <button type="button" className="text-primary underline" onClick={() => setShowPartyDialog(true)}>Create one</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{t("issueDate")}</Label>
              <Input value={issueDate} onChange={(event) => setIssueDate(event.target.value)} type="date" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("dueDate")}</Label>
              <Input value={dueDate} onChange={(event) => setDueDate(event.target.value)} type="date" />
            </div>
            <div className="space-y-1.5">
              <Label>Document status</Label>
              <select value={status} onChange={(event) => setStatus(event.target.value as "draft" | "open" | "paid")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="draft">Draft - no journal posting</option>
                <option value="open">{isSales ? "Unpaid" : "Received"} - post balance</option>
                <option value="paid">Paid - post and settle</option>
              </select>
            </div>
          </div>

          {status === "paid" && (
            <div className="rounded-xl border border-status-success/30 bg-status-success/5 p-4 grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold text-status-success">Automatic settlement</p>
                <p className="text-xs text-on-surface-variant mt-1">A payment record and linked receipt/expense voucher journal will be created automatically.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Payment method</Label>
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="card">Card</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
            </div>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Invoice lines</Label>
                <p className="text-xs text-on-surface-variant mt-1">Enter tax and discount for each line.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((current) => [...current, newLine()])} className="gap-1">
                <Plus className="h-4 w-4" /> Add line
              </Button>
            </div>
            <div className="space-y-3">
              {lines.map((line, index) => {
                const base = Math.max(0, Number(line.quantity || 0) * Number(line.unitPrice || 0) - Number(line.discountAmount || 0));
                const total = base * (1 + Number(line.taxRate || 0) / 100);
                return (
                  <div key={line.id} className="rounded-xl border border-border-default p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-on-surface-variant">LINE {index + 1}</span>
                      <button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} className="text-on-surface-variant hover:text-status-error disabled:opacity-30">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <Input value={line.description} onChange={(event) => updateLine(line.id, "description", event.target.value)} placeholder="Item or service description" />
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Quantity</Label><Input min="0.0001" step="0.01" type="number" value={line.quantity} onChange={(event) => updateLine(line.id, "quantity", event.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs">Unit price</Label><Input min="0" step="0.01" type="number" value={line.unitPrice} onChange={(event) => updateLine(line.id, "unitPrice", event.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs">Discount</Label><Input min="0" step="0.01" type="number" value={line.discountAmount} onChange={(event) => updateLine(line.id, "discountAmount", event.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs">Tax rate %</Label><Input min="0" step="0.01" type="number" value={line.taxRate} onChange={(event) => updateLine(line.id, "taxRate", event.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs">Line total</Label><div className="h-10 flex items-center justify-end rounded-md bg-surface-container px-3 text-sm font-semibold">{money(total)}</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="ms-auto w-full sm:w-80 rounded-xl bg-surface-container p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-on-surface-variant">Subtotal</span><span>{money(totals.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">Tax</span><span>{money(totals.tax)}</span></div>
            <div className="flex justify-between border-t border-border-default pt-2 text-base font-bold"><span>Total</span><span>{money(totals.total)}</span></div>
          </div>

          <DialogFooter>
            <Button className="bg-gradient-primary min-w-40" onClick={submitManual} disabled={submitting || !partyId || totals.total <= 0}>
              {submitting ? "Creating..." : status === "draft" ? "Save Draft" : status === "paid" ? "Create & Record Payment" : `Create ${isSales ? "Invoice" : "Bill"}`}
            </Button>
          </DialogFooter>
        </TabsContent>

        <TabsContent value="upload" className="mt-5">
          <div className="border-2 border-dashed border-border-default rounded-2xl p-10 grid place-items-center bg-card hover:border-primary hover:bg-primary/5 transition cursor-pointer text-center" onClick={() => setTimeout(() => setUploaded(true), 400)}>
            <div>
              <UploadCloud className="h-10 w-10 mx-auto text-primary mb-3" />
              <p className="font-medium text-sm">{t("dropInvoiceHere")}</p>
              <p className="text-xs text-on-surface-variant mt-1">{t("uploadInvoiceHint")}</p>
              <Button variant="outline" size="sm" className="mt-4">{t("chooseFile")}</Button>
            </div>
          </div>
          {uploaded && (
            <div className="mt-4 bg-card border border-border-default rounded-2xl p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{t("extractedFields")}</h3>
                <span className="text-xs text-status-success bg-status-success/10 px-2 py-1 rounded-full inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Ready for review</span>
              </div>
              <p className="mt-3 text-sm text-on-surface-variant">Document extraction is ready. Review the extracted party, lines, taxes, and status before posting.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showPartyDialog} onOpenChange={setShowPartyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create New {partyLabel}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1.5"><Label>Name *</Label><Input value={newParty.name} onChange={(event) => setNewParty((current) => ({ ...current, name: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={newParty.email} onChange={(event) => setNewParty((current) => ({ ...current, email: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={newParty.phone} onChange={(event) => setNewParty((current) => ({ ...current, phone: event.target.value }))} /></div>
            <div className="sm:col-span-2 space-y-1.5"><Label>Address</Label><Input value={newParty.address} onChange={(event) => setNewParty((current) => ({ ...current, address: event.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPartyDialog(false)}>{t("cancel")}</Button>
            <Button className="bg-gradient-primary" onClick={createParty} disabled={creatingParty}>{creatingParty ? "Creating..." : `Create ${partyLabel}`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
