import { createFileRoute } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, FileText, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/accounts")({ component: Page });

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  parent_id?: string | null;
  is_active?: boolean;
};

function Page() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [accName, setAccName] = useState("");
  const [accCode, setAccCode] = useState("");
  const [accType, setAccType] = useState("Expense");

  const load = async () => {
    setLoading(true);
    try {
      setAccounts(await api<Account[]>("/tenant/accounts"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const grouped = useMemo(() => {
    return accounts.reduce<Record<string, Account[]>>((acc, item) => {
      acc[item.type] = [...(acc[item.type] ?? []), item];
      return acc;
    }, {});
  }, [accounts]);

  const openAdd = () => {
    setEditing(null);
    setAccName("");
    setAccCode("");
    setAccType("Expense");
    setDialogOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditing(account);
    setAccName(account.name);
    setAccCode(account.code);
    setAccType(account.type);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      await api("/tenant/accounts", {
        method: "POST",
        body: JSON.stringify({ code: accCode, name: accName, type: accType }),
      });
      toast.success(editing ? "Account updated" : "Account added");
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save account");
    }
  };

  return (
    <div className="space-y-5">
      <Header
        title={t("coaTitle")}
        desc={t("coaDesc")}
        action={<Button onClick={openAdd} className="bg-gradient-primary gap-1.5"><Plus className="h-4 w-4" /> {t("addAccount")}</Button>}
      />
      <div className="bg-card border border-border-default rounded-2xl p-4 shadow-soft">
        {loading ? (
          <p className="text-sm text-on-surface-variant">Loading accounts...</p>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([type, items]) => (
              <section key={type}>
                <h3 className="text-sm font-semibold mb-2">{type}</h3>
                <div className="space-y-1">
                  {items.map((account) => (
                    <div key={account.id} className="group flex items-center gap-2 p-2 rounded-lg hover:bg-surface-subtle transition">
                      <FileText className="h-4 w-4 text-on-surface-variant" />
                      <span className="text-xs text-on-surface-variant font-mono w-14">{account.code}</span>
                      <span className="text-sm font-medium">{account.name}</span>
                      <button
                        onClick={() => openEdit(account)}
                        className="ms-auto opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant transition"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("editAccount") : t("addAccount")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>{t("accountCode")}</Label>
              <Input value={accCode} onChange={(e) => setAccCode(e.target.value)} placeholder="e.g. 5800" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("accountName")}</Label>
              <Input value={accName} onChange={(e) => setAccName(e.target.value)} placeholder="e.g. Marketing" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select value={accType} onChange={(e) => setAccType(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                {["Asset", "Liability", "Equity", "Revenue", "Expense"].map((type) => <option key={type}>{type}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button className="bg-gradient-primary" onClick={handleSave}>{t("saveChanges")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
