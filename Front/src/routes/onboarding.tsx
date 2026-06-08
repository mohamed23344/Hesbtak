import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import {
  Building2, Briefcase, Coins, Wallet, ArrowRight, ArrowLeft,
  Check, Info, ChevronRight, Folder, FileText, Plus, Trash2
} from "lucide-react";
import { BrandMark, LangToggle, ThemeToggle } from "@/components/Brand";
import { toast } from "sonner";
import { useCOA, DEFAULT_COA, COANode } from "@/lib/useCOA";
import { api, getSession, updateSession } from "@/lib/api";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

const INDUSTRIES = [
  "Retail", "Restaurant", "Consulting", "E-commerce", "Manufacturing",
  "Healthcare", "Real Estate", "Tech / SaaS",
];
const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "EGP", name: "Egyptian Pound", symbol: "ج.م" },
  { code: "SAR", name: "Saudi Riyal", symbol: "ر.س" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
];

type COAOption = COANode & { depth: number };

const cloneCOA = (nodes: COANode[]): COANode[] => JSON.parse(JSON.stringify(nodes));

const flattenCOA = (nodes: COANode[], depth = 0): COAOption[] =>
  nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenCOA(node.children ?? [], depth + 1),
  ]);

const findCOANode = (nodes: COANode[], id: string): COANode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findCOANode(node.children ?? [], id);
    if (child) return child;
  }
  return undefined;
};

const addCOANode = (nodes: COANode[], parentId: string, nodeToAdd: COANode): COANode[] =>
  nodes.map((node) => {
    if (node.id === parentId) {
      return { ...node, children: [...(node.children ?? []), nodeToAdd] };
    }
    return { ...node, children: node.children ? addCOANode(node.children, parentId, nodeToAdd) : node.children };
  });

const removeCOANode = (nodes: COANode[], id: string): COANode[] =>
  nodes
    .filter((node) => node.id !== id)
    .map((node) => ({ ...node, children: node.children ? removeCOANode(node.children, id) : node.children }));

function Onboarding() {
  const { dir, t } = useI18n();
  const nav = useNavigate();
  const { saveCOA } = useCOA();
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [currency, setCurrency] = useState("USD");
  
  // COA specific state
  const [qProducts, setQProducts] = useState(false);
  const [qEmployees, setQEmployees] = useState(false);
  const [qLoans, setQLoans] = useState(false);
  const [qServices, setQServices] = useState(false);
  const [customCOA, setCustomCOA] = useState<COANode[]>(DEFAULT_COA);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newAccName, setNewAccName] = useState("");
  const [newAccCode, setNewAccCode] = useState("");
  const [newAccParent, setNewAccParent] = useState("5"); // default to Expenses
  const [saving, setSaving] = useState(false);

  const STEPS = [t("stepCompany"), t("stepIndustry"), t("stepCurrency"), t("stepAccounts")];

  const generateCOA = () => {
    // Deep clone default COA to avoid mutating standard
    let newCoa: COANode[] = cloneCOA(DEFAULT_COA);
    
    const addNode = (parentId: string, node: COANode) => {
      newCoa = addCOANode(newCoa, parentId, node);
    };

    if (qProducts) {
      addNode("1", { id: "14", code: "1400", name: "Inventory", type: "Asset" });
      addNode("5", { id: "54", code: "5400", name: "Cost of Goods Sold", type: "Expense" });
    }
    if (qEmployees) {
      addNode("5", { id: "55", code: "5500", name: "Payroll", type: "Expense" });
      addNode("5", { id: "56", code: "5600", name: "Payroll Taxes", type: "Expense" });
    }
    if (qLoans) {
      addNode("2", { id: "23", code: "2300", name: "Loans Payable", type: "Liability" });
      addNode("5", { id: "57", code: "5700", name: "Interest Expense", type: "Expense" });
    }
    if (qServices) {
      addNode("4", { id: "43", code: "4300", name: "Service Revenue", type: "Income" });
    }

    setCustomCOA(newCoa);
  };

  useEffect(() => {
    generateCOA();
  }, [qProducts, qEmployees, qLoans, qServices]);

  const finishOnboarding = async (coaToSave: COANode[]) => {
    const session = getSession();
    if (!session) {
      throw new Error("Please login before onboarding");
    }
    const endpoint = session.activeTenantId
      ? `/onboarding/${session.activeTenantId}/complete`
      : "/onboarding/complete";
    const result = await api<{
      tenant?: {
        organizationId: string;
        schemaName?: string;
        organizationName?: string;
        industry?: string;
        currency?: string;
        role: string;
      };
      organization?: { id: string; name: string; industry: string; currency: string; schemaName?: string };
    }>(endpoint, {
      method: "POST",
      body: JSON.stringify({
        organizationName: company,
        industry,
        currency,
        answers: [
          { questionKey: "company_name", answer: company || session.tenants[0]?.organizationName || "Company" },
          { questionKey: "industry", answer: industry || "Retail" },
          { questionKey: "currency", answer: currency },
          {
            questionKey: "chart_preferences",
            answer: JSON.stringify({ qProducts, qEmployees, qLoans, qServices }),
          },
        ],
      }),
    });

    const createdTenant = result.tenant ?? (result.organization ? {
      organizationId: result.organization.id,
      schemaName: result.organization.schemaName,
      organizationName: result.organization.name,
      industry: result.organization.industry,
      currency: result.organization.currency,
      role: "owner",
    } : undefined);
    if (createdTenant && !session.activeTenantId) {
      updateSession({
        tenants: [{
          ...createdTenant,
          organizationName: createdTenant.organizationName ?? company,
        }],
        activeTenantId: createdTenant.organizationId,
      });
    }

    const flatten = (nodes: COANode[], parentId?: string): Array<COANode & { parentId?: string }> =>
      nodes.flatMap((node) => [
        { ...node, parentId },
        ...flatten(node.children ?? [], node.id),
      ]);

    const createdIds = new Map<string, string>();
    for (const account of flatten(coaToSave)) {
      const created = await api<{ id: string }>("/tenant/accounts", {
        method: "POST",
        body: JSON.stringify({
          code: account.code,
          name: account.name,
          type: account.type === "Income" ? "Revenue" : account.type,
          parentId: account.parentId ? createdIds.get(account.parentId) : undefined,
        }),
      });
      createdIds.set(account.id, created.id);
    }
  };

  const handleNext = async () => {
    if (step === 2) {
      generateCOA(); // generate before entering step 3
      setStep(step + 1);
    } else if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setSaving(true);
      try {
        await finishOnboarding(customCOA);
        saveCOA(customCOA);
        toast.success("Workspace created!");
        nav({ to: "/dashboard" });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not complete onboarding");
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSkipCOA = async () => {
    setSaving(true);
    try {
      await finishOnboarding(DEFAULT_COA);
      saveCOA(DEFAULT_COA);
      toast.success(t("skipCOAMsg"));
      nav({ to: "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete onboarding");
    } finally {
      setSaving(false);
    }
  };

  const back = () => setStep(Math.max(0, step - 1));

  const handleAddCustomAccount = () => {
    const parent = findCOANode(customCOA, newAccParent);
    const parentType = parent ? parent.type : "Asset";
    const newNode: COANode = {
      id: Math.random().toString(36).substring(7),
      code: newAccCode,
      name: newAccName,
      type: parentType,
    };
    
    setCustomCOA((prev) => addCOANode(prev, newAccParent, newNode));
    
    setAddDialogOpen(false);
    setNewAccName("");
    setNewAccCode("");
  };

  const handleRemoveAccount = (id: string) => {
    setCustomCOA((prev) => removeCOANode(prev, id));
  };

  const parentOptions = flattenCOA(customCOA).filter((node) => node.depth < 3);

  return (
    <div dir={dir} className="min-h-screen bg-gradient-hero">
      <header className="flex items-center justify-between p-4 md:px-8 border-b border-border-default bg-card/70 backdrop-blur">
        <BrandMark />
        <div className="flex items-center gap-2">
          <LangToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        {/* Steps indicator */}
        <ol className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1 flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full grid place-items-center text-xs font-semibold border-2 ${
                  i < step
                    ? "bg-status-success border-status-success text-white"
                    : i === step
                    ? "bg-gradient-primary border-transparent text-primary-foreground"
                    : "bg-card border-border-default text-on-surface-variant"
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-sm hidden sm:inline ${
                  i === step ? "font-medium text-on-surface" : "text-on-surface-variant"
                }`}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border-default" />}
            </li>
          ))}
        </ol>

        <div className="bg-card border border-border-default rounded-2xl shadow-card p-8">
          {step === 0 && (
            <StepWrap icon={Building2} title={t("createCompanyTitle")} desc={t("createCompanyDesc")}>
              <div className="space-y-1.5">
                <Label htmlFor="company">{t("companyNameLabel")}</Label>
                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme LLC" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="size">{t("teamSizeLabel")}</Label>
                <select id="size" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option>1–5</option><option>6–20</option><option>21–50</option><option>50+</option>
                </select>
              </div>
            </StepWrap>
          )}

          {step === 1 && (
            <StepWrap icon={Briefcase} title={t("selectIndustryTitle")} desc={t("selectIndustryDesc")}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {INDUSTRIES.map((i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setIndustry(i)}
                    className={`p-3 rounded-lg border text-sm transition ${
                      industry === i
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border-default hover:border-primary/40"
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </StepWrap>
          )}

          {step === 2 && (
            <StepWrap icon={Coins} title={t("chooseCurrencyTitle")} desc={t("chooseCurrencyDesc")}>
              <div className="space-y-2">
                {CURRENCIES.map((c) => (
                  <button
                    type="button"
                    key={c.code}
                    onClick={() => setCurrency(c.code)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-sm transition ${
                      currency === c.code
                        ? "border-primary bg-primary/5"
                        : "border-border-default hover:border-primary/40"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="h-8 w-8 rounded-md bg-surface-container grid place-items-center font-semibold text-primary">
                        {c.symbol}
                      </span>
                      <span><strong>{c.code}</strong> · {c.name}</span>
                    </span>
                    {currency === c.code && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            </StepWrap>
          )}

          {step === 3 && (
            <StepWrap icon={Wallet} title={t("setupAccountsTitle")} desc={t("setupAccountsDesc")}>
              <div className="space-y-4">
                <TooltipProvider>
                  {[
                    { state: qProducts, set: setQProducts, label: t("qPhysicalProducts"), hint: t("qPhysicalProductsHint") },
                    { state: qEmployees, set: setQEmployees, label: t("qEmployees"), hint: t("qEmployeesHint") },
                    { state: qLoans, set: setQLoans, label: t("qLoans"), hint: t("qLoansHint") },
                    { state: qServices, set: setQServices, label: t("qServices"), hint: t("qServicesHint") },
                  ].map((q, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border border-border-default rounded-lg">
                      <div className="flex items-center gap-2">
                        <Label className="text-base cursor-pointer" onClick={() => {
                          q.set(!q.state);
                          generateCOA();
                        }}>
                          {q.label}
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-on-surface-variant hover:text-primary cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-sm">
                            <p>{q.hint}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Switch checked={q.state} onCheckedChange={(v) => {
                        q.set(v);
                        setTimeout(generateCOA, 0); // Allow state to update
                      }} />
                    </div>
                  ))}
                </TooltipProvider>

                <div className="mt-8 border-t border-border-default pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">{t("customAccountsPreview")}</h3>
                    <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)} className="gap-1">
                      <Plus className="h-4 w-4" /> {t("addCustomAccount")}
                    </Button>
                  </div>
                  <div className="bg-surface-container rounded-xl p-3 max-h-60 overflow-y-auto space-y-1">
                    {customCOA.map((n) => (
                      <TreeRow
                        key={n.id}
                        node={n}
                        depth={0}
                        onAdd={(id) => {
                          setNewAccParent(id);
                          setAddDialogOpen(true);
                        }}
                        onRemove={handleRemoveAccount}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </StepWrap>
          )}

          <div className="mt-8 flex items-center justify-between">
            {step === 3 ? (
              <Button variant="ghost" onClick={handleSkipCOA} className="text-on-surface-variant">
                {t("skipCOA")}
              </Button>
            ) : (
              <Button variant="ghost" onClick={back} disabled={step === 0} className="gap-1.5">
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t("back")}
              </Button>
            )}

            <Button onClick={handleNext} disabled={saving} className="bg-gradient-primary gap-1.5">
              {saving ? "..." : step === STEPS.length - 1 ? t("finish") : t("continue")}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </main>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addCustomAccount")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Parent account</Label>
              <select 
                value={newAccParent} 
                onChange={(e) => setNewAccParent(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {parentOptions.map((n) => (
                  <option key={n.id} value={n.id}>
                    {"--".repeat(n.depth)} {n.code} - {n.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-on-surface-variant">Choose a level 2 or level 3 parent to create level 3 or level 4 accounts.</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("accountCode")}</Label>
              <Input value={newAccCode} onChange={(e) => setNewAccCode(e.target.value)} placeholder="e.g. 5800" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("accountName")}</Label>
              <Input value={newAccName} onChange={(e) => setNewAccName(e.target.value)} placeholder="e.g. Marketing" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>{t("cancel")}</Button>
            <Button className="bg-gradient-primary" onClick={handleAddCustomAccount}>{t("saveChanges")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StepWrap({
  icon: Icon, title, desc, children,
}: { icon: React.ElementType; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-primary text-primary-foreground grid place-items-center">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-on-surface-variant">{desc}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function TreeRow({
  node,
  depth,
  onAdd,
  onRemove,
}: {
  node: COANode;
  depth: number;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = !!node.children?.length;
  return (
    <>
      <div
        className="group flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-subtle"
        style={{ paddingInlineStart: depth * 20 + 4 }}
      >
        <button
          type="button"
          className="h-5 w-5 grid place-items-center rounded hover:bg-surface-container"
          onClick={() => hasChildren && setOpen(!open)}
        >
          {hasChildren ? (
            <ChevronRight className={`h-4 w-4 text-on-surface-variant transition-transform ${open ? "rotate-90" : ""}`} />
          ) : <span className="w-4" />}
        </button>
        {hasChildren ? <Folder className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-on-surface-variant" />}
        <span className="text-xs text-on-surface-variant font-mono w-10">{node.code}</span>
        <span className={`text-sm min-w-0 flex-1 ${hasChildren ? "font-semibold" : ""}`}>{node.name}</span>
        {depth < 3 && (
          <button
            type="button"
            title="Add child account"
            onClick={() => onAdd(node.id)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant transition"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          title="Remove account"
          onClick={() => onRemove(node.id)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 text-on-surface-variant hover:text-destructive transition"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && node.children?.map((c) => (
        <TreeRow key={c.id} node={c} depth={depth + 1} onAdd={onAdd} onRemove={onRemove} />
      ))}
    </>
  );
}
