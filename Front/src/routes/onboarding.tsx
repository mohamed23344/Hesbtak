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
import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import {
  Building2, Briefcase, Coins, Wallet, ArrowRight, ArrowLeft,
  Check, Info, ChevronRight, Folder, FileText, Plus, Trash2
} from "lucide-react";
import { BrandMark, LangToggle, ThemeToggle } from "@/components/Brand";
import { toast } from "sonner";
import { useCOA, DEFAULT_COA, COANode } from "@/lib/useCOA";
import { api, getSession, updateSession } from "@/lib/api";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

type IndustryCategory = "Commercial" | "Industrial" | "Services" | "Others";
type COAOption = COANode & { depth: number };
type COAAddition = COANode & { parentId: string };

const INDUSTRY_GROUPS: Record<IndustryCategory, string[]> = {
  Commercial: ["Retail", "E-commerce", "Wholesale", "Distribution", "Restaurant / Food & Beverage", "Import / Export"],
  Industrial: ["Manufacturing", "Construction / Contracting", "Agriculture", "Energy", "Workshop / Fabrication", "Mining"],
  Services: ["Professional Services", "Tech / SaaS", "Healthcare", "Education / Training", "Logistics / Transportation", "Real Estate", "Hospitality"],
  Others: [],
};

const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "EUR" },
  { code: "EGP", name: "Egyptian Pound", symbol: "EGP" },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR" },
  { code: "AED", name: "UAE Dirham", symbol: "AED" },
  { code: "GBP", name: "British Pound", symbol: "GBP" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KWD" },
];

const TEAM_SIZES = ["1-5", "6-20", "21-50", "51-200", "200+"];

const COA_QUESTIONS: Array<{
  key: string;
  label: string;
  hint: string;
  defaultOn?: boolean;
  additions: COAAddition[];
}> = [
  {
    key: "physical_products",
    label: "Do you buy, stock, or sell physical products?",
    hint: "Adds inventory, stock adjustments, freight, and cost of goods sold accounts.",
    additions: [
      { parentId: "1", id: "15", code: "1500", name: "Inventory", type: "Asset", children: [
        { id: "151", code: "1510", name: "Merchandise Inventory", type: "Asset" },
        { id: "152", code: "1520", name: "Inventory in Transit", type: "Asset" },
      ] },
      { parentId: "51", id: "515", code: "5150", name: "Cost of Goods Sold", type: "Expense" },
      { parentId: "51", id: "516", code: "5160", name: "Freight and Customs", type: "Expense" },
      { parentId: "51", id: "517", code: "5170", name: "Inventory Shrinkage", type: "Expense" },
    ],
  },
  {
    key: "manufacturing",
    label: "Do you manufacture or assemble products?",
    hint: "Adds raw materials, work in progress, finished goods, and factory overhead.",
    additions: [
      { parentId: "1", id: "15", code: "1500", name: "Inventory", type: "Asset", children: [
        { id: "151", code: "1510", name: "Merchandise Inventory", type: "Asset" },
        { id: "152", code: "1520", name: "Inventory in Transit", type: "Asset" },
      ] },
      { parentId: "15", id: "153", code: "1530", name: "Raw Materials", type: "Asset" },
      { parentId: "15", id: "154", code: "1540", name: "Work in Progress", type: "Asset" },
      { parentId: "15", id: "155", code: "1550", name: "Finished Goods", type: "Asset" },
      { parentId: "51", id: "518", code: "5180", name: "Factory Overhead", type: "Expense" },
      { parentId: "51", id: "519", code: "5190", name: "Production Supplies", type: "Expense" },
    ],
  },
  {
    key: "projects",
    label: "Do you run jobs, contracts, or long projects?",
    hint: "Adds project revenue, project costs, customer advances, and work in progress tracking.",
    additions: [
      { parentId: "41", id: "414", code: "4140", name: "Contract Revenue", type: "Income" },
      { parentId: "13", id: "135", code: "1350", name: "Contract Assets / WIP", type: "Asset" },
      { parentId: "21", id: "217", code: "2170", name: "Customer Retentions", type: "Liability" },
      { parentId: "51", id: "5105", code: "5105", name: "Project Direct Costs", type: "Expense" },
    ],
  },
  {
    key: "services",
    label: "Do you sell services, subscriptions, or professional work?",
    hint: "Adds service revenue, subscriptions, subcontractors, and professional delivery costs.",
    defaultOn: true,
    additions: [
      { parentId: "41", id: "415", code: "4150", name: "Subscription Revenue", type: "Income" },
      { parentId: "41", id: "416", code: "4160", name: "Professional Service Revenue", type: "Income" },
      { parentId: "51", id: "5106", code: "5106", name: "Subcontractor Costs", type: "Expense" },
      { parentId: "52", id: "5206", code: "5206", name: "Professional Tools and Licenses", type: "Expense" },
    ],
  },
  {
    key: "employees",
    label: "Do you have employees or regular payroll?",
    hint: "Adds payroll clearing, benefits, insurance, recruiting, and training accounts.",
    additions: [
      { parentId: "21", id: "218", code: "2180", name: "Payroll Payable", type: "Liability" },
      { parentId: "52", id: "5207", code: "5207", name: "Employee Benefits", type: "Expense" },
      { parentId: "52", id: "5208", code: "5208", name: "Recruiting and Training", type: "Expense" },
    ],
  },
  {
    key: "loans",
    label: "Do you use loans, leases, or financing?",
    hint: "Adds loan principal, current portion, lease liability, and interest expense.",
    additions: [
      { parentId: "21", id: "219", code: "2190", name: "Current Portion of Loans", type: "Liability" },
      { parentId: "22", id: "223", code: "2230", name: "Finance Lease Liability", type: "Liability" },
      { parentId: "53", id: "534", code: "5340", name: "Interest Expense", type: "Expense" },
    ],
  },
  {
    key: "fixed_assets",
    label: "Do you own equipment, computers, furniture, or buildings?",
    hint: "Uses the workbook fixed asset categories and matching depreciation accounts.",
    defaultOn: true,
    additions: [
      { parentId: "14", id: "147", code: "1470", name: "Buildings and Improvements", type: "Asset" },
      { parentId: "14", id: "148", code: "1480", name: "Tools and Small Equipment", type: "Asset" },
      { parentId: "54", id: "546", code: "5460", name: "Tools and Small Equipment Depreciation", type: "Expense" },
    ],
  },
  {
    key: "vehicles",
    label: "Do you operate vehicles or transport assets?",
    hint: "Adds vehicle running costs, fuel, maintenance, and registration accounts.",
    additions: [
      { parentId: "52", id: "5209", code: "5209", name: "Fuel and Transportation", type: "Expense" },
      { parentId: "52", id: "5215", code: "5215", name: "Vehicle Maintenance", type: "Expense" },
      { parentId: "55", id: "554", code: "5540", name: "Licenses and Registration", type: "Expense" },
    ],
  },
  {
    key: "taxes",
    label: "Do you collect VAT/sales tax or withhold tax?",
    hint: "Adds tax receivable/payable accounts and government tax expense branches.",
    defaultOn: true,
    additions: [
      { parentId: "13", id: "136", code: "1360", name: "Sales Tax Receivable", type: "Asset" },
      { parentId: "21", id: "2108", code: "2108", name: "Withholding Tax Payable", type: "Liability" },
      { parentId: "55", id: "555", code: "5550", name: "Tax Advisory and Filing Fees", type: "Expense" },
    ],
  },
  {
    key: "multi_currency",
    label: "Do you receive or pay in more than one currency?",
    hint: "Adds foreign currency bank, receivable/payable revaluation, and exchange difference accounts.",
    additions: [
      { parentId: "12", id: "124", code: "1240", name: "Foreign Currency Bank Accounts", type: "Asset" },
      { parentId: "11", id: "113", code: "1130", name: "Foreign Currency Receivables", type: "Asset" },
      { parentId: "21", id: "2109", code: "2109", name: "Foreign Currency Payables", type: "Liability" },
    ],
  },
  {
    key: "online_payments",
    label: "Do customers pay through cards, wallets, or online gateways?",
    hint: "Adds payment processor clearing and gateway fee accounts.",
    additions: [
      { parentId: "12", id: "125", code: "1250", name: "Card and Wallet Clearing", type: "Asset" },
      { parentId: "52", id: "5216", code: "5216", name: "Payment Gateway Fees", type: "Expense" },
    ],
  },
  {
    key: "rent_utilities",
    label: "Do you rent premises or pay utilities?",
    hint: "Adds rent, utilities, maintenance, and office running costs.",
    additions: [
      { parentId: "52", id: "5217", code: "5217", name: "Rent Expense", type: "Expense" },
      { parentId: "52", id: "5218", code: "5218", name: "Utilities", type: "Expense" },
      { parentId: "52", id: "5219", code: "5219", name: "Repairs and Maintenance", type: "Expense" },
      { parentId: "52", id: "5221", code: "5221", name: "Office Supplies", type: "Expense" },
    ],
  },
];

const INDUSTRY_DEFAULT_QUESTIONS: Record<IndustryCategory, string[]> = {
  Commercial: ["physical_products", "online_payments", "taxes", "rent_utilities"],
  Industrial: ["physical_products", "manufacturing", "fixed_assets", "employees", "taxes"],
  Services: ["services", "projects", "employees", "online_payments", "taxes"],
  Others: ["services", "taxes"],
};

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

const hasCode = (nodes: COANode[], code: string): boolean =>
  nodes.some((node) => node.code === code || hasCode(node.children ?? [], code));

const addCOANode = (nodes: COANode[], parentId: string, nodeToAdd: COANode): COANode[] =>
  nodes.map((node) => {
    if (node.id === parentId) {
      if ((node.children ?? []).some((child) => child.code === nodeToAdd.code)) return node;
      return { ...node, children: [...(node.children ?? []), nodeToAdd] };
    }
    return { ...node, children: node.children ? addCOANode(node.children, parentId, nodeToAdd) : node.children };
  });

const removeCOANode = (nodes: COANode[], id: string): COANode[] =>
  nodes
    .filter((node) => node.id !== id)
    .map((node) => ({ ...node, children: node.children ? removeCOANode(node.children, id) : node.children }));

const buildCOA = (enabledQuestionKeys: Set<string>) => {
  let next = cloneCOA(DEFAULT_COA);

  for (const question of COA_QUESTIONS) {
    if (!enabledQuestionKeys.has(question.key)) continue;
    for (const addition of question.additions) {
      const { parentId, ...node } = addition;
      if (!hasCode(next, node.code)) {
        next = addCOANode(next, parentId, node);
      }
    }
  }

  return next;
};

function Onboarding() {
  const { dir, t } = useI18n();
  const nav = useNavigate();
  const { saveCOA } = useCOA();
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState("");
  const [teamSize, setTeamSize] = useState(TEAM_SIZES[0]);
  const [industryCategory, setIndustryCategory] = useState<IndustryCategory>("Commercial");
  const [businessType, setBusinessType] = useState(INDUSTRY_GROUPS.Commercial[0]);
  const [otherBusiness, setOtherBusiness] = useState("");
  const [primaryCurrency, setPrimaryCurrency] = useState("USD");
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>(["USD"]);
  const [questionState, setQuestionState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(COA_QUESTIONS.map((question) => [question.key, !!question.defaultOn])),
  );
  const [customCOA, setCustomCOA] = useState<COANode[]>(DEFAULT_COA);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newAccName, setNewAccName] = useState("");
  const [newAccCode, setNewAccCode] = useState("");
  const [newAccParent, setNewAccParent] = useState("5");
  const [saving, setSaving] = useState(false);

  const STEPS = [t("stepCompany"), t("stepIndustry"), t("stepCurrency"), t("stepAccounts")];

  const industry = industryCategory === "Others"
    ? otherBusiness.trim()
    : `${industryCategory} - ${businessType}`;

  const enabledQuestionKeys = useMemo(() => {
    const defaults = INDUSTRY_DEFAULT_QUESTIONS[industryCategory] ?? [];
    return new Set([
      ...defaults,
      ...Object.entries(questionState).filter(([, enabled]) => enabled).map(([key]) => key),
      ...(selectedCurrencies.length > 1 ? ["multi_currency"] : []),
    ]);
  }, [industryCategory, questionState, selectedCurrencies]);

  useEffect(() => {
    setCustomCOA(buildCOA(enabledQuestionKeys));
  }, [enabledQuestionKeys]);

  const toggleCurrency = (code: string) => {
    setSelectedCurrencies((prev) => {
      if (prev.includes(code)) {
        const next = prev.filter((item) => item !== code);
        if (!next.length) return prev;
        if (primaryCurrency === code) setPrimaryCurrency(next[0]);
        return next;
      }
      return [...prev, code];
    });
  };

  const finishOnboarding = async (coaToSave: COANode[]) => {
    const session = getSession();
    if (!session) {
      throw new Error("Please login before onboarding");
    }
    const createNew = new URLSearchParams(window.location.search).get("new") === "1";
    const endpoint = session.activeTenantId && !createNew
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
        industry: industry || "Other",
        currency: primaryCurrency,
        answers: [
          { questionKey: "company_name", answer: company || session.tenants[0]?.organizationName || "Company" },
          { questionKey: "team_size", answer: teamSize },
          { questionKey: "industry_category", answer: industryCategory },
          { questionKey: "business_type", answer: industry || "Other" },
          { questionKey: "primary_currency", answer: primaryCurrency },
          { questionKey: "currencies", answer: JSON.stringify(selectedCurrencies) },
          { questionKey: "chart_preferences", answer: JSON.stringify(questionState) },
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
    if (createdTenant && (!session.activeTenantId || createNew)) {
      updateSession({
        tenants: [
          ...session.tenants.filter((item) => item.organizationId !== createdTenant.organizationId),
          {
            ...createdTenant,
            organizationName: createdTenant.organizationName ?? company,
          },
        ],
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
    if (step === 0 && !company.trim()) {
      toast.error("Organization name is required");
      return;
    }
    if (step === 1 && !industry.trim()) {
      toast.error("Business type is required");
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }

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
    if (!newAccName.trim() || !newAccCode.trim()) {
      toast.error("Account code and name are required");
      return;
    }
    if (hasCode(customCOA, newAccCode.trim())) {
      toast.error("Account code already exists");
      return;
    }

    const parent = findCOANode(customCOA, newAccParent);
    const parentType = parent ? parent.type : "Asset";
    const newNode: COANode = {
      id: `custom-${Date.now()}`,
      code: newAccCode.trim(),
      name: newAccName.trim(),
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
      <header className="flex items-center justify-between p-4 md:px-8 border-b border-border-default bg-card/75 backdrop-blur-md sticky top-0 z-50">
        <BrandMark />
        <div className="flex items-center gap-2">
          <LangToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <ol className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1 flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full grid place-items-center text-xs font-bold border-2 transition-all duration-200 ${
                  i < step
                    ? "bg-status-success border-status-success text-white"
                    : i === step
                    ? "bg-gradient-primary border-transparent text-primary-foreground shadow-soft"
                    : "bg-card border-border-default text-on-surface-variant"
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-sm hidden sm:inline ${
                  i === step ? "font-semibold text-on-surface" : "text-on-surface-variant font-medium"
                }`}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border-default/60" />}
            </li>
          ))}
        </ol>

        <div className="bg-card/80 glass-panel shadow-card p-8 hover-glow rounded-2xl">
          {step === 0 && (
            <StepWrap icon={Building2} title="Organization basics" desc="Only the essentials for now.">
              <div className="space-y-1.5">
                <Label htmlFor="company" className="font-semibold">{t("companyNameLabel")}</Label>
                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme LLC" className="bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="size" className="font-semibold">{t("teamSizeLabel")}</Label>
                <select
                  id="size"
                  value={teamSize}
                  onChange={(event) => setTeamSize(event.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background/50 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {TEAM_SIZES.map((size) => <option key={size} className="bg-card">{size}</option>)}
                </select>
              </div>
            </StepWrap>
          )}

          {step === 1 && (
            <StepWrap icon={Briefcase} title={t("selectIndustryTitle")} desc="Choose a main category, then the closest business type.">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(Object.keys(INDUSTRY_GROUPS) as IndustryCategory[]).map((category) => (
                  <button
                    type="button"
                    key={category}
                    onClick={() => {
                      setIndustryCategory(category);
                      setBusinessType(INDUSTRY_GROUPS[category][0] ?? "");
                    }}
                    className={`p-3.5 rounded-xl border text-sm font-medium transition-all duration-200 cursor-pointer shadow-soft ${
                      industryCategory === category
                        ? "border-primary bg-primary/8 text-primary ring-1 ring-primary/20"
                        : "border-border-default bg-background/30 hover:border-primary/40 hover:bg-background/60"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {industryCategory !== "Others" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  {INDUSTRY_GROUPS[industryCategory].map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => setBusinessType(item)}
                      className={`p-3.5 rounded-xl border text-sm text-start font-medium transition-all duration-200 cursor-pointer shadow-soft ${
                        businessType === item
                          ? "border-primary bg-primary/8 text-primary ring-1 ring-primary/20"
                          : "border-border-default bg-background/30 hover:border-primary/40 hover:bg-background/60"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5 mt-4">
                  <Label htmlFor="otherBusiness" className="font-semibold">Your business</Label>
                  <Input id="otherBusiness" value={otherBusiness} onChange={(e) => setOtherBusiness(e.target.value)} placeholder="Describe your business" className="bg-background/50" />
                </div>
              )}
            </StepWrap>
          )}

          {step === 2 && (
            <StepWrap icon={Coins} title="Choose currencies" desc="Select every currency you use, then choose the main reporting currency.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CURRENCIES.map((c) => {
                  const selected = selectedCurrencies.includes(c.code);
                  return (
                    <button
                      type="button"
                      key={c.code}
                      onClick={() => toggleCurrency(c.code)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-sm font-medium transition-all duration-200 cursor-pointer shadow-soft ${
                        selected
                          ? "border-primary bg-primary/8 text-primary ring-1 ring-primary/20"
                          : "border-border-default bg-background/30 hover:border-primary/40 hover:bg-background/60"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span className="h-8 w-12 rounded-lg bg-primary/10 grid place-items-center font-bold text-primary text-xs">
                          {c.symbol}
                        </span>
                        <span><strong>{c.code}</strong> - {c.name}</span>
                      </span>
                      {selected && <Check className="h-4.5 w-4.5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1.5 mt-4">
                <Label htmlFor="primaryCurrency" className="font-semibold">Main reporting currency</Label>
                <select
                  id="primaryCurrency"
                  value={primaryCurrency}
                  onChange={(event) => setPrimaryCurrency(event.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background/50 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {selectedCurrencies.map((code) => <option key={code} className="bg-card">{code}</option>)}
                </select>
              </div>
            </StepWrap>
          )}

          {step === 3 && (
            <StepWrap icon={Wallet} title={t("setupAccountsTitle")} desc="Toggle the accounts your business needs. You can still add and remove accounts manually.">
              <div className="space-y-4">
                <TooltipProvider>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {COA_QUESTIONS.map((q) => {
                      const checked = enabledQuestionKeys.has(q.key);
                      const lockedByContext = (INDUSTRY_DEFAULT_QUESTIONS[industryCategory] ?? []).includes(q.key)
                        || (q.key === "multi_currency" && selectedCurrencies.length > 1);
                      return (
                        <div key={q.key} className="flex items-center justify-between gap-3 p-3.5 border border-border-default/60 rounded-xl bg-background/30 shadow-soft">
                          <div className="flex items-center gap-2 min-w-0">
                            <Label htmlFor={`coa-${q.key}`} className="text-sm cursor-pointer leading-snug font-medium truncate">
                              {q.label}
                            </Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 shrink-0 text-on-surface-variant hover:text-primary cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-sm">
                                <p>{q.hint}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <Switch
                            id={`coa-${q.key}`}
                            checked={checked}
                            disabled={lockedByContext}
                            onCheckedChange={(value) => setQuestionState((prev) => ({ ...prev, [q.key]: value }))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </TooltipProvider>

                <div className="mt-8 border-t border-border-default/60 pt-6">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="font-semibold text-lg">{t("customAccountsPreview")}</h3>
                    <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)} className="gap-1 cursor-pointer">
                      <Plus className="h-4 w-4" /> {t("addCustomAccount")}
                    </Button>
                  </div>
                  <div className="bg-surface-container/60 border border-border-default/40 rounded-2xl p-4 max-h-72 overflow-y-auto space-y-1">
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
              <Button variant="ghost" onClick={handleSkipCOA} className="text-on-surface-variant cursor-pointer hover:bg-surface-container" disabled={saving}>
                {t("skipCOA")}
              </Button>
            ) : (
              <Button variant="ghost" onClick={back} disabled={step === 0 || saving} className="gap-1.5 cursor-pointer hover:bg-surface-container">
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t("back")}
              </Button>
            )}

            <Button onClick={handleNext} disabled={saving} className="bg-gradient-primary gap-1.5 cursor-pointer shadow-soft hover-glow">
              {saving ? "..." : step === STEPS.length - 1 ? t("finish") : t("continue")}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </main>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{t("addCustomAccount")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="font-semibold">Parent account</Label>
              <select
                value={newAccParent}
                onChange={(e) => setNewAccParent(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {parentOptions.map((n) => (
                  <option key={n.id} value={n.id}>
                    {"--".repeat(n.depth)} {n.code} - {n.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-on-surface-variant">Choose a level 1, 2, or 3 parent to create a child account.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">{t("accountCode")}</Label>
              <Input value={newAccCode} onChange={(e) => setNewAccCode(e.target.value)} placeholder="e.g. 5800" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">{t("accountName")}</Label>
              <Input value={newAccName} onChange={(e) => setNewAccName(e.target.value)} placeholder="e.g. Marketing" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>{t("cancel")}</Button>
            <Button className="bg-gradient-primary shadow-soft" onClick={handleAddCustomAccount}>{t("saveChanges")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type StepWrapProps = { icon: ElementType; title: string; desc: string; children: ReactNode };

function StepWrap({ icon: Icon, title, desc, children }: StepWrapProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-primary text-primary-foreground grid place-items-center shadow-soft">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-on-surface leading-snug">{title}</h2>
          <p className="text-sm text-on-surface-variant">{desc}</p>
        </div>
      </div>
      <div className="space-y-4 mt-2">{children}</div>
    </div>
  );
}

type TreeRowProps = {
  node: COANode;
  depth: number;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
};

function TreeRow({ node, depth, onAdd, onRemove }: TreeRowProps) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = !!node.children?.length;
  return (
    <>
      <div
        className="group flex items-center gap-2 p-1.5 rounded-xl hover:bg-surface-subtle transition-colors duration-200"
        style={{ paddingInlineStart: depth * 20 + 4 }}
      >
        <button
          type="button"
          className="h-5 w-5 grid place-items-center rounded hover:bg-surface-container"
          onClick={() => hasChildren && setOpen(!open)}
          aria-label={hasChildren ? "Toggle account branch" : "Account leaf"}
        >
          {hasChildren ? (
            open ? (
              <ChevronRight className="h-4 w-4 text-on-surface-variant transition-transform rotate-90" />
            ) : (
              <ChevronRight className="h-4 w-4 text-on-surface-variant transition-transform rtl:rotate-180" />
            )
          ) : <span className="w-4" />}
        </button>
        {hasChildren ? <Folder className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-on-surface-variant" />}
        <span className="text-xs text-on-surface-variant font-mono w-12 shrink-0">{node.code}</span>
        <span className={`text-sm min-w-0 flex-1 truncate ${hasChildren ? "font-bold text-on-surface" : ""}`}>{node.name}</span>
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
