import { createFileRoute } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronRight, FileText, Folder, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  level?: number;
  is_active?: boolean;
};

type AccountNode = Account & { children: AccountNode[] };
type AccountOption = Account & { depth: number };

const accountTypes = ["Asset", "Liability", "Equity", "Revenue", "Expense"];

function buildAccountTree(accounts: Account[]) {
  const nodes = new Map<string, AccountNode>();
  accounts.forEach((account) => nodes.set(account.id, { ...account, children: [] }));

  const roots: AccountNode[] = [];
  nodes.forEach((node) => {
    if (node.parent_id && nodes.has(node.parent_id)) {
      nodes.get(node.parent_id)?.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (items: AccountNode[]) => {
    items.sort((a, b) => a.code.localeCompare(b.code));
    items.forEach((item) => sortNodes(item.children));
  };
  sortNodes(roots);
  return roots;
}

function flattenTree(nodes: AccountNode[], depth = 0): AccountOption[] {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenTree(node.children, depth + 1),
  ]);
}

function suggestChildAccountCode(parentCode: string, usedCodes: string[]) {
  const numeric = Number(parentCode);
  if (!Number.isFinite(numeric)) return "";
  const trailingZeros = parentCode.match(/0+$/)?.[0].length ?? 0;
  const step = trailingZeros >= 3 ? 100 : trailingZeros >= 2 ? 10 : 1;
  const used = new Set(usedCodes);
  const max = numeric + step * 9;
  for (let candidate = numeric + step; candidate <= max; candidate += step) {
    const code = String(candidate).padStart(parentCode.length, "0");
    if (!used.has(code)) return code;
  }
  for (let candidate = max + step; candidate <= 9999; candidate += step) {
    const code = String(candidate).padStart(parentCode.length, "0");
    if (!used.has(code)) return code;
  }
  return "";
}

function Page() {
  const { t, l } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accName, setAccName] = useState("");
  const [accCode, setAccCode] = useState("");
  const [accType, setAccType] = useState("Expense");
  const [parentId, setParentId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

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

  const accountTree = useMemo(() => buildAccountTree(accounts), [accounts]);
  const parentOptions = useMemo(
    () => flattenTree(accountTree).filter((account) => account.id !== editing?.id && (account.level ?? account.depth + 1) < 4),
    [accountTree, editing],
  );

  const openAdd = () => {
    setEditing(null);
    setAccName("");
    setAccCode("");
    setAccType("Expense");
    setParentId("");
    setDialogOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditing(account);
    setAccName(account.name);
    setAccCode(account.code);
    setAccType(account.type);
    setParentId(account.parent_id ?? "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const selectedParent = accounts.find((account) => account.id === parentId);
    setSavingAccount(true);
    try {
      await api(editing ? `/tenant/accounts/${editing.id}` : "/tenant/accounts", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          code: accCode,
          name: accName,
          type: selectedParent?.type ?? accType,
          parentId: parentId || undefined,
        }),
      });
      toast.success(editing ? "Account updated" : "Account added");
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save account");
    } finally {
      setSavingAccount(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/tenant/accounts/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Account removed");
      setDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove account");
    }
  };

  const openAddChild = (account: Account) => {
    setEditing(null);
    setAccName("");
    setAccCode(suggestChildAccountCode(account.code, accounts.map((item) => item.code)));
    setAccType(account.type);
    setParentId(account.id);
    setDialogOpen(true);
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
          <p className="text-sm text-on-surface-variant">{l("Loading accounts...")}</p>
        ) : (
          <div className="space-y-5">
            {accountTree.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                depth={0}
                onAddChild={openAddChild}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !savingAccount && setDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("editAccount") : t("addAccount")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>{l("Parent account")}</Label>
              <select
                value={parentId}
                onChange={(e) => {
                  const nextParentId = e.target.value;
                  setParentId(nextParentId);
                  const nextParent = accounts.find((account) => account.id === nextParentId);
                  if (nextParent) {
                    setAccType(nextParent.type);
                    if (!editing) {
                      setAccCode(suggestChildAccountCode(nextParent.code, accounts.map((account) => account.code)));
                    }
                  }
                }}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{l("No parent (Level 1)")}</option>
                {parentOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {"--".repeat(account.depth)} {account.code} - {l(account.name)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-on-surface-variant">{l("Pick a level 2 or 3 parent when you need a level 3 or 4 account.")}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("accountCode")}</Label>
              <Input value={accCode} onChange={(e) => setAccCode(e.target.value)} placeholder="e.g. 5800" />
              {!editing && parentId && (
                <p className="text-xs text-on-surface-variant">
                  {l("Suggested from the parent account. You can change it.")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t("accountName")}</Label>
              <Input value={accName} onChange={(e) => setAccName(e.target.value)} placeholder="e.g. Marketing" />
            </div>
            <div className="space-y-1.5">
              <Label>{l("Type")}</Label>
              <select
                value={accType}
                onChange={(e) => setAccType(e.target.value)}
                disabled={!!parentId}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-70"
              >
                {accountTypes.map((type) => <option key={type}>{l(type)}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={savingAccount}>{t("cancel")}</Button>
            <Button className="bg-gradient-primary gap-1.5" onClick={handleSave} disabled={savingAccount}>
              {savingAccount && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {savingAccount ? l("Saving...") : t("saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{l("Delete account?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {l("This account cannot be deleted if it has child accounts or existing records.")} {deleteTarget?.code} - {deleteTarget ? l(deleteTarget.name) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {l("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AccountRow({
  account,
  depth,
  onAddChild,
  onEdit,
  onDelete,
}: {
  account: AccountNode;
  depth: number;
  onAddChild: (account: Account) => void;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}) {
  const { l } = useI18n();
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = account.children.length > 0;
  const level = account.level ?? depth + 1;

  return (
    <div className="space-y-1">
      <div
        className="group flex items-center gap-2 p-2 rounded-lg hover:bg-surface-subtle transition"
        style={{ paddingInlineStart: depth * 20 + 8 }}
      >
        <button
          type="button"
          className="h-5 w-5 grid place-items-center rounded hover:bg-surface-container"
          onClick={() => hasChildren && setOpen(!open)}
        >
          {hasChildren ? (
            <ChevronRight className={`h-4 w-4 text-on-surface-variant transition-transform ${open ? "rotate-90" : ""}`} />
          ) : (
            <span className="w-4" />
          )}
        </button>
        {hasChildren ? <Folder className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-on-surface-variant" />}
        <span className="text-xs text-on-surface-variant font-mono w-14">{account.code}</span>
        <span className="text-sm font-medium min-w-0 flex-1">{l(account.name)}</span>
        <span className="text-xs text-on-surface-variant hidden sm:inline">{l(account.type)}</span>
        {level < 4 && (
          <button
            type="button"
            title="Add child account"
            onClick={() => onAddChild(account)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant transition"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          title="Edit account"
          onClick={() => onEdit(account)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant transition"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Delete account"
          onClick={() => onDelete(account)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 text-on-surface-variant hover:text-destructive transition"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && account.children.map((child) => (
        <AccountRow
          key={child.id}
          account={child}
          depth={depth + 1}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
