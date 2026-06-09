import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ar";

const dict = {
  en: {
    // Brand & General
    appName: "Hesbetak.AI",
    search: "Search…",
    logout: "Log out",
    continue: "Continue",
    back: "Back",
    finish: "Finish",

    // Landing
    tagline: "AI-powered accounting for SMBs",
    heroTitle: "Smart accounting that runs itself.",
    heroSubtitle: "Hesbetak.AI is your bilingual finance copilot — automated bookkeeping, instant insights, and beginner-friendly tools built for small businesses.",
    getStarted: "Get started free",
    seeDemo: "See live demo",
    featuresTitle: "Everything your books need, automated.",
    featuresSubtitle: "Built for non-accountants. Looks like a dashboard, thinks like a CFO.",
    aiAssistantLabel: "Ask your books anything.",
    aiAssistantDesc: "\"What was my biggest expense last month?\" — the assistant reads your ledger and answers in plain English or Arabic.",
    ctaTitle: "Start your books in 2 minutes.",
    ctaSubtitle: "Free for your first 50 transactions. No card required.",

    // Auth
    signIn: "Sign in",
    goToDashboard: "Go to Dashboard",
    signUp: "Sign up",
    email: "Email",
    password: "Password",
    fullName: "Full name",
    forgot: "Forgot password?",
    continueGoogle: "Continue with Google",
    continueFacebook: "Continue with Facebook",
    orContinueWith: "or continue with",
    
    // Auth - Register/Forgot
    createAccount: "Create account",
    alreadyHaveAccount: "Already have an account?",
    rememberIt: "Remember it?",
    sendCode: "Send code",
    verifyEmailTitle: "Verify your email",
    verifyEmailDesc: "Enter the 6-digit code we just sent.",
    verifyAndContinue: "Verify & continue",
    didntGetIt: "Didn't get it?",
    resend: "Resend",
    welcomeBackSubtitle: "Welcome back. Let's check your books.",
    signUpSubtitle: "Create your free Hesbetak.AI workspace.",
    forgotSubtitle: "We'll send a code to your email.",

    // Onboarding
    stepCompany: "Company",
    stepIndustry: "Industry",
    stepCurrency: "Currency",
    stepAccounts: "Accounts",
    createCompanyTitle: "Create your company",
    createCompanyDesc: "Tell us about your business.",
    companyNameLabel: "Company name",
    teamSizeLabel: "Team size",
    selectIndustryTitle: "Select your industry",
    selectIndustryDesc: "We tailor the chart of accounts.",
    chooseCurrencyTitle: "Choose your currency",
    chooseCurrencyDesc: "You can add more later.",
    setupAccountsTitle: "Setup chart of accounts",
    // Onboarding COA Setup
    setupAccountsDesc: "Answer a few simple questions and we'll build your chart of accounts automatically.",
    qPhysicalProducts: "Do you sell physical products?",
    qPhysicalProductsHint: "We'll add 'Inventory' and 'Cost of Goods Sold' accounts to track your merchandise.",
    qEmployees: "Do you have employees?",
    qEmployeesHint: "We'll add 'Payroll' and 'Payroll Taxes' expense accounts.",
    qLoans: "Do you have business loans?",
    qLoansHint: "We'll add 'Loans Payable' and 'Interest Expense' accounts.",
    qServices: "Do you provide services?",
    qServicesHint: "We'll add 'Service Revenue' account to track your consulting or service income.",
    skipCOA: "Skip and use default",
    skipCOAMsg: "Default chart of accounts created. You can customize it later.",
    customAccountsPreview: "Your Chart of Accounts",
    addCustomAccount: "Add Account Manually",

    // Dashboard Accounts Modals
    editAccount: "Edit Account",
    accountName: "Account Name",
    accountCode: "Account Code",
    saveChanges: "Save Changes",
    cancel: "Cancel",

    uploadPDFs: "Upload PDF statements",
    dropBankPDFs: "Drop bank or invoice PDFs",
    recordVideo: "Record a 30s video",
    describeBusiness: "Describe your business out loud",

    // Dashboard Layout
    dashboard: "Dashboard",
    transactions: "Transactions",
    expenses: "Expenses",
    invoices: "Invoices",
    accounts: "Chart of Accounts",
    journal: "Journal Entries",
    assistant: "AI Assistant",
    forecasting: "Forecasting",
    reports: "Reports",
    ocr: "OCR Upload",
    notifications: "Notifications",
    settings: "Settings",

    // Dashboard Home
    welcomeBack: "Welcome back, Ahmad ",
    dashboardDesc: "Here's how your business is doing today.",
    revenue: "Revenue",
    netProfit: "Net Profit",
    cashOnHand: "Cash on hand",
    last7Months: "Last 7 months",
    monthly: "Monthly",
    weekly: "Weekly",
    topExpenseCategories: "Top expense categories",
    thisMonth: "this month",
    aiInsights: "AI Insights",
    thingsToKnow: "3 things to know this week",
    alerts: "Alerts",
    thingsAttention: "Things needing your attention",
    cashflow: "Cashflow",

    // Transactions
    txTitle: "Transactions",
    txDesc: "All your financial movements in one place.",
    searchTransactions: "Search transactions…",
    filter: "Filter",
    export: "Export",
    date: "Date",
    description: "Description",
    category: "Category",
    status: "Status",
    amount: "Amount",
    dateFrom: "From date",
    dateTo: "To date",
    refType: "Type",
    allTypes: "All types",
    allAccounts: "All accounts",

    vendor: "Vendor",
    notes: "Notes",
    optional: "Optional",
    totalThisMonth: "Total this month",
    pendingApproval: "Pending approval",
    avgPerWeek: "Avg per week",

    // Invoices
    invTitle: "Invoices",
    invDesc: "Create, send, and track invoices.",
    newInvoice: "New invoice",
    createInvoice: "Create invoice",
    client: "Client",
    issueDate: "Issue date",
    dueDate: "Due date",
    itemDescription: "Item description",
    saveDraft: "Save draft",
    sendInvoice: "Send invoice",
    outstanding: "Outstanding",
    paid30d: "Paid (30d)",
    overdue: "Overdue",
    drafts: "Drafts",
    number: "Number",
    issued: "Issued",

    // Chart of Accounts
    coaTitle: "Chart of Accounts",
    coaDesc: "Your accounting structure, organized hierarchically.",
    addAccount: "Add account",

    // Journal
    jeTitle: "Journal Entries",
    jeDesc: "Every transaction shown as double-entry bookkeeping.",
    account: "Account",
    debit: "Debit",
    credit: "Credit",
    addJournalEntry: "New Journal Entry",
    newManualInvoice: "New Manual Invoice",
    deleteEntry: "Delete entry",
    confirmDelete: "Are you sure you want to delete this entry? This cannot be undone.",
    addLine: "Add line",
    removeLine: "Remove",
    notBalanced: "Debits and credits must be equal",
    balanced: "Balanced ✓",
    searchAccount: "Search accounts…",
    noAccountFound: "No account found",
    quickAddAccount: "Quick add account",
    selectCustomer: "Select customer",
    searchCustomer: "Search customers…",
    noCustomerFound: "No customer found. Type to add new.",
    quickAddCustomer: "Add customer",
    taxRate: "Tax rate (%)",
    subtotal: "Subtotal",
    lineItems: "Line items",
    newCustomer: "New customer name",

    // Assistant
    astTitle: "AI Assistant",
    astDesc: "Your finance copilot. Ask anything about your business.",
    askFinances: "Ask about your finances…",
    suggestedPrompts: "Suggested prompts",
    proTip: "Pro tip",
    proTipDesc: "Ask in Arabic or English — the assistant understands both and answers in your active language.",

    // Forecasting
    fcTitle: "Forecasting",
    fcDesc: "AI-powered predictions for the next 5 months.",
    predictedRevenue: "Predicted revenue (next 30d)",
    predictedExpenses: "Predicted expenses (next 30d)",
    predictedCash: "Predicted cash (90d)",
    forecastActualVsForecast: "Revenue: actual vs forecast",
    forecastDashedLine: "Dashed line = AI prediction",

    // OCR
    ocrTitle: "OCR Upload",
    ocrDesc: "Drop an invoice or receipt — AI extracts the data.",
    dropFile: "Drop your file here",
    upTo10MB: "PDF, JPG, PNG — up to 10MB",
    chooseFile: "Choose file",
    extractedFields: "Extracted fields",
    uploadToBegin: "Upload a document to begin.",
    confidence: "confidence",
    edit: "Edit",
    reviewDocument: "Review document",

    // Notifications
    notifTitle: "Notifications",
    notifDesc: "Financial alerts and risk warnings.",

    // Settings
    settingsDesc: "Workspace, language, theme, and team.",
    companyTitle: "Company",
    companyName: "Company name",
    taxId: "Tax ID",
    address: "Address",
    defaultCurrency: "Default currency",
    languageTitle: "Language",
    themeTitle: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    teamMembers: "Team members",
    roleOwner: "Owner",
    roleAccountant: "Accountant",
    roleViewer: "Viewer",
    inviteMember: "Invite member",

    // Admin Dashboard
    adminDashboard: "Admin Dashboard",
    organizations: "Organizations",
    manageOrgs: "Manage system tenants, plans, and users.",
    plan: "Plan",
    users: "Users",
    deleteOrg: "Delete",
    confirmDeleteOrg: "Delete Organization?",
    deleteOrgWarning: "This action cannot be undone. All users, data, and active subscriptions associated with this organization will be permanently deleted.",
    deleteConfirm: "Yes, Delete Organization",
    orgDeleted: "Organization deleted successfully",
  },
  ar: {
    // Brand & General
    appName: "حسبتك.AI",
    search: "بحث…",
    logout: "تسجيل الخروج",
    continue: "متابعة",
    back: "رجوع",
    finish: "إنهاء",

    // Landing
    tagline: "محاسبة ذكية للشركات الصغيرة",
    heroTitle: "محاسبة ذكية تعمل من تلقاء نفسها.",
    heroSubtitle: "حسبتك.AI هو مساعدك المالي ثنائي اللغة — قيود تلقائية، تحليلات فورية، وأدوات سهلة لأصحاب المشاريع.",
    getStarted: "ابدأ مجاناً",
    seeDemo: "شاهد التجربة",
    featuresTitle: "كل ما تحتاجه حساباتك.",
    featuresSubtitle: "مصمم لغير المحاسبين. يبدو كلوحة تحكم، ويفكر كمدير مالي.",
    aiAssistantLabel: "اسأل حساباتك أي شيء.",
    aiAssistantDesc: "\"ما هو أكبر مصروفاتي الشهر الماضي؟\" — المساعد يقرأ دفتر يوميتك ويجيب بالعربية أو الإنجليزية بوضوح.",
    ctaTitle: "ابدأ حساباتك في دقيقتين.",
    ctaSubtitle: "مجاناً لأول 50 معاملة. لا تحتاج لبطاقة ائتمان.",

    // Auth
    signIn: "تسجيل الدخول",
    goToDashboard: "الذهاب إلى لوحة التحكم",
    signUp: "إنشاء حساب",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    fullName: "الاسم الكامل",
    forgot: "نسيت كلمة المرور؟",
    continueGoogle: "المتابعة عبر Google",
    continueFacebook: "المتابعة عبر Facebook",
    orContinueWith: "أو تابع عبر",
    
    // Auth - Register/Forgot
    createAccount: "إنشاء حساب",
    alreadyHaveAccount: "لديك حساب بالفعل؟",
    rememberIt: "تذكرتها؟",
    sendCode: "إرسال الرمز",
    verifyEmailTitle: "تأكيد بريدك الإلكتروني",
    verifyEmailDesc: "أدخل الرمز المكون من 6 أرقام الذي أرسلناه للتو.",
    verifyAndContinue: "تأكيد ومتابعة",
    didntGetIt: "لم يصلك؟",
    resend: "إعادة إرسال",
    welcomeBackSubtitle: "مرحباً بعودتك. دعنا نتفقد حساباتك.",
    signUpSubtitle: "أنشئ مساحة عملك المجانية في حسبتك.AI.",
    forgotSubtitle: "سنرسل رمزاً إلى بريدك الإلكتروني.",

    // Onboarding
    stepCompany: "الشركة",
    stepIndustry: "المجال",
    stepCurrency: "العملة",
    stepAccounts: "الحسابات",
    createCompanyTitle: "إنشاء شركتك",
    createCompanyDesc: "أخبرنا عن عملك.",
    companyNameLabel: "اسم الشركة",
    teamSizeLabel: "حجم الفريق",
    selectIndustryTitle: "اختر مجالك",
    selectIndustryDesc: "سنقوم بتخصيص شجرة الحسابات لك.",
    chooseCurrencyTitle: "اختر عملتك",
    chooseCurrencyDesc: "يمكنك إضافة المزيد لاحقاً.",
    setupAccountsTitle: "إعداد شجرة الحسابات",
    // Onboarding COA Setup
    setupAccountsDesc: "أجب عن بعض الأسئلة البسيطة وسنقوم بإنشاء دليل الحسابات الخاص بك تلقائياً.",
    qPhysicalProducts: "هل تبيع منتجات مادية؟",
    qPhysicalProductsHint: "سنضيف حسابات 'المخزون' و'تكلفة البضائع المباعة' لتتبع بضاعتك.",
    qEmployees: "هل لديك موظفون؟",
    qEmployeesHint: "سنضيف حسابات مصروفات 'الرواتب' و'ضرائب الرواتب'.",
    qLoans: "هل لديك قروض تجارية؟",
    qLoansHint: "سنضيف حسابات 'القروض المستحقة' و'مصروفات الفوائد'.",
    qServices: "هل تقدم خدمات؟",
    qServicesHint: "سنضيف حساب 'إيرادات الخدمات' لتتبع دخلك من الاستشارات أو الخدمات.",
    skipCOA: "تخطي واستخدام الافتراضي",
    skipCOAMsg: "تم إنشاء دليل الحسابات الافتراضي. يمكنك تخصيصه لاحقاً.",
    customAccountsPreview: "دليل الحسابات الخاص بك",
    addCustomAccount: "إضافة حساب يدوياً",

    // Dashboard Accounts Modals
    editAccount: "تعديل الحساب",
    accountName: "اسم الحساب",
    accountCode: "رمز الحساب",
    saveChanges: "حفظ التغييرات",
    cancel: "إلغاء",

    uploadPDFs: "رفع كشوفات PDF",
    dropBankPDFs: "أسقط كشوفات البنك أو الفواتير",
    recordVideo: "سجل فيديو 30 ثانية",
    describeBusiness: "صف طبيعة عملك بصوتك",

    // Dashboard Layout
    dashboard: "الرئيسية",
    transactions: "المعاملات",
    expenses: "المصروفات",
    invoices: "الفواتير",
    accounts: "شجرة الحسابات",
    journal: "قيود اليومية",
    assistant: "المساعد الذكي",
    forecasting: "التوقعات",
    reports: "التقارير",
    ocr: "رفع المستندات",
    notifications: "التنبيهات",
    settings: "الإعدادات",

    // Dashboard Home
    welcomeBack: "مرحباً بعودتك، أحمد ",
    dashboardDesc: "إليك كيف يسير عملك اليوم.",
    revenue: "الإيرادات",
    netProfit: "صافي الربح",
    cashOnHand: "النقد المتاح",
    last7Months: "آخر 7 أشهر",
    monthly: "شهرياً",
    weekly: "أسبوعياً",
    topExpenseCategories: "أعلى فئات المصروفات",
    thisMonth: "هذا الشهر",
    aiInsights: "تحليلات الذكاء الاصطناعي",
    thingsToKnow: "3 أشياء يجب أن تعرفها هذا الأسبوع",
    alerts: "التنبيهات",
    thingsAttention: "أشياء تحتاج لاهتمامك",
    cashflow: "التدفق النقدي",

    // Transactions
    txTitle: "المعاملات",
    txDesc: "كل حركاتك المالية في مكان واحد.",
    searchTransactions: "البحث في المعاملات…",
    filter: "تصفية",
    export: "تصدير",
    date: "التاريخ",
    description: "الوصف",
    category: "الفئة",
    status: "الحالة",
    amount: "المبلغ",
    dateFrom: "من تاريخ",
    dateTo: "إلى تاريخ",
    refType: "النوع",
    allTypes: "جميع الأنواع",
    allAccounts: "جميع الحسابات",

    vendor: "المورد",
    notes: "ملاحظات",
    optional: "اختياري",
    totalThisMonth: "الإجمالي هذا الشهر",
    pendingApproval: "في انتظار الموافقة",
    avgPerWeek: "المتوسط الأسبوعي",

    // Invoices
    invTitle: "الفواتير",
    invDesc: "إنشاء، إرسال وتتبع الفواتير.",
    newInvoice: "فاتورة جديدة",
    createInvoice: "إنشاء فاتورة",
    client: "العميل",
    issueDate: "تاريخ الإصدار",
    dueDate: "تاريخ الاستحقاق",
    itemDescription: "وصف العنصر",
    saveDraft: "حفظ كمسودة",
    sendInvoice: "إرسال الفاتورة",
    outstanding: "معلقة",
    paid30d: "مدفوعة (30يوم)",
    overdue: "متأخرة",
    drafts: "مسودات",
    number: "الرقم",
    issued: "الإصدار",

    // Chart of Accounts
    coaTitle: "شجرة الحسابات",
    coaDesc: "هيكلك المحاسبي، منظم بشكل هرمي.",
    addAccount: "إضافة حساب",

    // Journal
    jeTitle: "قيود اليومية",
    jeDesc: "كل معاملة معروضة كقيد مزدوج.",
    account: "الحساب",
    debit: "مدين",
    credit: "دائن",
    addJournalEntry: "قيد يومية جديد",
    newManualInvoice: "فاتورة يدوية جديدة",
    deleteEntry: "حذف القيد",
    confirmDelete: "هل أنت متأكد من حذف هذا القيد؟ لا يمكن التراجع.",
    addLine: "إضافة سطر",
    removeLine: "حذف",
    notBalanced: "يجب أن يتساوى إجمالي المدين والدائن",
    balanced: "متوازن ✓",
    searchAccount: "البحث في الحسابات…",
    noAccountFound: "لم يُعثر على حساب",
    quickAddAccount: "إضافة حساب سريع",
    selectCustomer: "اختر العميل",
    searchCustomer: "البحث في العملاء…",
    noCustomerFound: "لم يُعثر على عميل. اكتب لإضافة جديد.",
    quickAddCustomer: "إضافة عميل",
    taxRate: "نسبة الضريبة (%)",
    subtotal: "المجموع قبل الضريبة",
    lineItems: "بنود الفاتورة",
    newCustomer: "اسم العميل الجديد",

    // Assistant
    astTitle: "المساعد الذكي",
    astDesc: "مساعدك المالي. اسأل أي شيء عن عملك.",
    askFinances: "اسأل عن أموالك…",
    suggestedPrompts: "أسئلة مقترحة",
    proTip: "نصيحة للمحترفين",
    proTipDesc: "اسأل بالعربية أو الإنجليزية — المساعد يفهم كلتيهما ويجيب بلغتك المفضلة.",

    // Forecasting
    fcTitle: "التوقعات",
    fcDesc: "تنبؤات مدعومة بالذكاء الاصطناعي للأشهر الخمسة القادمة.",
    predictedRevenue: "الإيرادات المتوقعة (30يوم)",
    predictedExpenses: "المصروفات المتوقعة (30يوم)",
    predictedCash: "النقد المتوقع (90يوم)",
    forecastActualVsForecast: "الإيرادات: الفعلي مقابل المتوقع",
    forecastDashedLine: "الخط المتقطع = توقع الذكاء الاصطناعي",

    // OCR
    ocrTitle: "رفع المستندات",
    ocrDesc: "أسقط فاتورة أو إيصال — وسيستخرج الذكاء الاصطناعي البيانات.",
    dropFile: "أسقط ملفك هنا",
    upTo10MB: "PDF، JPG، PNG — حتى 10 ميجابايت",
    chooseFile: "اختر ملفاً",
    extractedFields: "الحقول المستخرجة",
    uploadToBegin: "ارفع مستنداً للبدء.",
    confidence: "دقة",
    edit: "تعديل",
    reviewDocument: "مراجعة المستند",

    // Notifications
    notifTitle: "التنبيهات",
    notifDesc: "التنبيهات المالية وتحذيرات المخاطر.",

    // Settings
    settingsDesc: "مساحة العمل، اللغة، المظهر، وفريق العمل.",
    companyTitle: "الشركة",
    companyName: "اسم الشركة",
    taxId: "الرقم الضريبي",
    address: "العنوان",
    defaultCurrency: "العملة الافتراضية",
    languageTitle: "اللغة",
    themeTitle: "المظهر",
    themeLight: "فاتح",
    themeDark: "داكن",
    themeSystem: "النظام",
    teamMembers: "فريق العمل",
    roleOwner: "المالك",
    roleAccountant: "محاسب",
    roleViewer: "مشاهد",
    inviteMember: "دعوة عضو",

    // Admin Dashboard
    adminDashboard: "لوحة تحكم المسؤول",
    organizations: "المؤسسات",
    manageOrgs: "إدارة المؤسسات، الباقات، والمستخدمين.",
    plan: "باقة",
    users: "المستخدمين",
    deleteOrg: "حذف",
    confirmDeleteOrg: "حذف المؤسسة؟",
    deleteOrgWarning: "لا يمكن التراجع عن هذا الإجراء. سيتم حذف جميع المستخدمين والبيانات والاشتراكات النشطة المرتبطة بهذه المؤسسة بشكل دائم.",
    deleteConfirm: "نعم، احذف المؤسسة",
    orgDeleted: "تم حذف المؤسسة بنجاح",
  },
} as const;

type Key = keyof typeof dict.en;

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && (localStorage.getItem("lang") as Lang)) || "en";
    setLangState(saved);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };

  const t = (k: Key) => dict[lang][k] ?? k;
  return (
    <I18nContext.Provider value={{ lang, setLang, t, dir: lang === "ar" ? "rtl" : "ltr" }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
