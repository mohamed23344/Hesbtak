import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter, Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UploadCloud, FileText, CheckCircle2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";

type Props = {
  title: string;
  type: "sales" | "purchases" | "expenses";
  onDone?: () => void;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

type Party = { id: string; name: string; email?: string };

export default function CreateInvoiceWithUpload({ title, type, onDone }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState("manual");
  const [uploaded, setUploaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [parties, setParties] = useState<Party[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPartyDialog, setShowPartyDialog] = useState(false);
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyEmail, setNewPartyEmail] = useState("");

  const [form, setForm] = useState({
    partyId: "",
    partyName: "",
    email: "",
    issueDate: today(),
    dueDate: today(),
    description: "",
    quantity: "1",
    unitPrice: "",
    status: "unpaid" as "unpaid" | "paid" | "draft",
    newPartyInfo: null as { name: string; email?: string } | null,
  });

  const isPartySelected = !!form.partyId || !!form.newPartyInfo;
  const partyEndpoint = type === "sales" ? "/tenant/customers" : "/tenant/vendors";
  const invoiceEndpoint = type === "sales" ? "/tenant/invoices" : "/tenant/vendor-bills";

  useEffect(() => {
    void loadParties();
  }, []);

  const loadParties = async () => {
    try {
      setParties(await api<Party[]>(partyEndpoint));
    } catch {
      setParties([]);
    }
  };

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const filteredParties = parties.filter(
    (p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const createPartyAndSubmit = () => {
    if (!newPartyName.trim()) {
      toast.error("Please enter a name");
      return;
    }
    setForm((prev) => ({
      ...prev,
      partyName: newPartyName.trim(),
      email: newPartyEmail || "",
      newPartyInfo: { name: newPartyName.trim(), email: newPartyEmail || undefined },
    }));
    setShowPartyDialog(false);
    setNewPartyName("");
    setNewPartyEmail("");
  };

  const canSubmit = () => isPartySelected && form.description && form.unitPrice && Number(form.unitPrice) > 0;

  const submitManual = async () => {
    if (!canSubmit()) {
      toast.error("Please select a party and add line items");
      return;
    }
    setSubmitting(true);
    try {
      const isSales = type === "sales";
      const body: Record<string, unknown> = {
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        status: form.status,
        lines: [
          {
            description: form.description || "Service",
            quantity: Number(form.quantity || 1),
            unitPrice: Number(form.unitPrice || 0),
          },
        ],
      };
      if (form.newPartyInfo) {
        body[isSales ? "customerInfo" : "vendorInfo"] = form.newPartyInfo;
      } else {
        body[isSales ? "customerId" : "vendorId"] = form.partyId;
      }

      const result = await api(invoiceEndpoint, { method: "POST", body: JSON.stringify(body) });
      toast.success(`${title} created${form.status === "paid" ? " and marked as paid" : ""}`);
      onDone?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not create ${title}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpload = () => {
    setTimeout(() => setUploaded(true), 500);
  };

  const label = type === "sales" ? t("customers") : t("vendors");

  return (
    <div className="space-y-5">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="manual">{t("manualEntry")}</TabsTrigger>
          <TabsTrigger value="upload">{t("uploadDocument")}</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-5 space-y-4">
          {/* Party selection */}
          <div className="space-y-1.5">
            <Label>{label}</Label>
            {isPartySelected ? (
              <div className="flex items-center gap-2 p-2 bg-surface-container rounded-lg border border-border-default">
                <span className="flex-1 text-sm font-medium">{form.partyName}</span>
                <Button variant="ghost" size="sm" onClick={() => setForm((prev) => ({ ...prev, partyId: "", partyName: "", newPartyInfo: null }))}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <Input
                    className="ps-9"
                    placeholder={`Search ${label.toLowerCase()}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={() => setShowPartyDialog(true)} className="gap-1">
                  <Plus className="h-4 w-4" /> New
                </Button>
              </div>
            )}
            {!isPartySelected && searchQuery && (
              <div className="mt-1 max-h-40 overflow-y-auto border border-border-default rounded-lg divide-y divide-border-default">
                {filteredParties.length === 0 ? (
                  <div className="p-3 text-sm text-center text-on-surface-variant">
                    Not found.{' '}
                    <button onClick={() => setShowPartyDialog(true)} className="text-primary underline">
                      Add new {type === "sales" ? "customer" : "vendor"}
                    </button>
                  </div>
                ) : (
                  filteredParties.map((p) => (
                    <button
                      key={p.id}
                      className="w-full text-start p-3 text-sm hover:bg-surface-subtle transition"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, partyId: p.id, partyName: p.name }));
                        setSearchQuery("");
                      }}
                    >
                      <span className="font-medium">{p.name}</span>
                      {p.email && <span className="text-on-surface-variant ms-2 text-xs">{p.email}</span>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("issueDate")}</Label>
              <Input value={form.issueDate} onChange={update("issueDate")} type="date" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("dueDate")}</Label>
              <Input value={form.dueDate} onChange={update("dueDate")} type="date" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("itemDescription")}</Label>
            <div className="flex gap-2 flex-wrap">
              <Input value={form.description} onChange={update("description")} placeholder="Service" className="flex-1 min-w-[120px]" />
              <Input value={form.quantity} onChange={update("quantity")} type="number" placeholder="Qty" className="w-24" />
              <Input value={form.unitPrice} onChange={update("unitPrice")} type="number" placeholder="Price" className="w-32" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <select
              value={form.status}
              onChange={update("status")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="draft">Draft</option>
            </select>
            {form.status === "paid" && (
              <p className="text-xs text-status-success">A payment record will be automatically created.</p>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button className="bg-gradient-primary" onClick={submitManual} disabled={submitting || !canSubmit()}>
              {submitting ? "Creating..." : t("createInvoice")}
            </Button>
          </DialogFooter>
        </TabsContent>

        <TabsContent value="upload" className="mt-5">
          <div
            className="border-2 border-dashed border-border-default rounded-2xl p-10 grid place-items-center bg-card hover:border-primary hover:bg-primary/5 transition cursor-pointer text-center"
            onClick={handleUpload}
          >
            <div className="text-center">
              <UploadCloud className="h-10 w-10 mx-auto text-primary mb-3" />
              <p className="font-medium text-sm">{t("dropInvoiceHere")}</p>
              <p className="text-xs text-on-surface-variant mt-1">{t("uploadInvoiceHint")}</p>
              <Button variant="outline" size="sm" className="mt-4">{t("chooseFile")}</Button>
            </div>
          </div>

          {uploaded && (
            <div className="mt-4 bg-card border border-border-default rounded-2xl p-5 shadow-soft">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{t("extractedFields")}</h3>
                <span className="text-xs text-status-success bg-status-success/10 px-2 py-1 rounded-full inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> 96% {t("confidence")}
                </span>
              </div>
              <div className="space-y-3 text-sm">
                <Field label="Vendor" value="Sample Corp." />
                <Field label="Invoice number" value="INV-2026-001" />
                <Field label="Date" value={today()} />
                <Field label="Total Amount" value="$1,280.00" />
              </div>
              <div className="flex gap-2 mt-6">
                <Button variant="outline" className="flex-1">{t("edit")}</Button>
                <Button className="flex-1 bg-gradient-primary">{t("reviewDocument")}</Button>
              </div>
            </div>
          )}

          <p className="text-xs text-center text-on-surface-variant mt-4">
            {t("orCreateManually")}
          </p>
        </TabsContent>
      </Tabs>

      {/* New Party Dialog */}
      <Dialog open={showPartyDialog} onOpenChange={setShowPartyDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New {type === "sales" ? "Customer" : "Vendor"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("fullName")}</Label>
              <Input value={newPartyName} onChange={(e) => setNewPartyName(e.target.value)} placeholder="Name" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("email")}</Label>
              <Input value={newPartyEmail} onChange={(e) => setNewPartyEmail(e.target.value)} type="email" placeholder="email@example.com" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowPartyDialog(false)}>{t("cancel")}</Button>
            <Button className="bg-gradient-primary" onClick={createPartyAndSubmit}>Add & Select</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <span className="text-on-surface-variant text-xs">{label}</span>
      <div className="p-2 bg-surface-container rounded-lg font-medium border border-border-default text-sm">
        {value}
      </div>
    </div>
  );
}
