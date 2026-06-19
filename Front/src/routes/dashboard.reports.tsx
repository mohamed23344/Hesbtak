import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CalendarClock,
  Download,
  FileBarChart,
  FilePlus2,
  History,
  Loader2,
  Pause,
  Play,
  Save,
  Trash2,
} from "lucide-react";
import { Header } from "./dashboard.transactions";
import { api, apiBlob, getSession, money } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/reports")({ component: Page });

type ReportType =
  | "profit_loss" | "balance_sheet" | "cash_flow" | "revenue" | "expense"
  | "accounts_receivable" | "accounts_payable" | "sales" | "tax"
  | "vendor_payments" | "customer_invoices" | "custom";

type Template = { type: ReportType; name: string; description: string };
type Field = { key: string; label: string };
type Configuration = {
  datePreset?: string;
  dateFrom?: string;
  dateTo?: string;
  source?: string;
  filters?: Record<string, string>;
  fields?: Field[];
  groupBy?: string;
  aggregation?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
};
type Builder = { name: string; reportType: ReportType; configuration: Configuration };
type Generated = {
  title: string;
  reportType: ReportType;
  generatedAt: string;
  filters: Record<string, unknown>;
  columns: Field[];
  rows: Record<string, unknown>[];
  totals: Record<string, number>;
};
type SavedReport = {
  id: string;
  name: string;
  report_type: ReportType;
  configuration_json: Configuration;
  updated_at: string;
};
type Schedule = {
  id: string;
  report_id: string;
  report_name: string;
  frequency: string;
  next_run_at: string;
  status: string;
  export_format: string;
  recipients_json: string[];
};
type Dashboard = {
  totalGenerated: number;
  scheduledCount: number;
  savedCount: number;
  recent: Array<{ id: string; name: string; status: string; completed_at: string }>;
  mostUsedTemplates: Array<{ report_type: string; count: number }>;
  upcoming: Array<{ id: string; name: string; frequency: string; next_run_at: string }>;
};
type Execution = {
  id: string;
  report_name: string;
  status: string;
  started_at: string;
  completed_at?: string;
  export_format: string;
  file_name?: string;
  file_url?: string;
  email_status?: string;
  emailed_at?: string;
  recipients_json?: string[];
  error_message?: string;
};

const emptyBuilder: Builder = {
  name: "Monthly Profit & Loss",
  reportType: "profit_loss",
  configuration: {
    datePreset: "this_month",
    source: "invoices",
    fields: [],
    aggregation: "sum",
    sortDirection: "asc",
    filters: {},
  },
};

const SORT_FIELDS: Partial<Record<ReportType, Field[]>> = {
  profit_loss: [{ key: "code", label: "Code" }, { key: "account", label: "Account" }, { key: "type", label: "Type" }, { key: "amount", label: "Amount" }],
  balance_sheet: [{ key: "code", label: "Code" }, { key: "account", label: "Account" }, { key: "balance", label: "Balance" }],
  cash_flow: [{ key: "month", label: "Month" }, { key: "activity", label: "Activity" }, { key: "net_cash_flow", label: "Net Cash Flow" }],
  expense: [{ key: "bill_number", label: "Bill Number" }, { key: "bill_type", label: "Bill Type" }, { key: "description", label: "Description" }, { key: "vendor_name", label: "Vendor" }, { key: "account_name", label: "Expense Account" }, { key: "issue_date", label: "Issue Date" }, { key: "total", label: "Total" }, { key: "status", label: "Status" }],
  accounts_receivable: [{ key: "invoice_number", label: "Invoice Number" }, { key: "customer_name", label: "Customer" }, { key: "due_date", label: "Due Date" }, { key: "balance", label: "Balance" }, { key: "status", label: "Status" }],
  accounts_payable: [{ key: "bill_number", label: "Bill Number" }, { key: "vendor_name", label: "Vendor" }, { key: "due_date", label: "Due Date" }, { key: "balance", label: "Balance" }, { key: "status", label: "Status" }],
  vendor_payments: [{ key: "reference", label: "Reference" }, { key: "vendor_name", label: "Vendor" }, { key: "amount", label: "Amount" }, { key: "payment_date", label: "Payment Date" }, { key: "payment_method", label: "Payment Method" }],
  tax: [{ key: "tax_type", label: "Tax Type" }, { key: "reference", label: "Reference" }, { key: "party", label: "Party" }, { key: "date", label: "Date" }, { key: "tax_amount", label: "Tax Amount" }, { key: "total", label: "Total" }],
};

const INVOICE_SORT_FIELDS: Field[] = [
  { key: "invoice_number", label: "Invoice Number" },
  { key: "customer_name", label: "Customer" },
  { key: "issue_date", label: "Issue Date" },
  { key: "due_date", label: "Due Date" },
  { key: "subtotal", label: "Subtotal" },
  { key: "tax_amount", label: "Tax" },
  { key: "total", label: "Total" },
  { key: "status", label: "Status" },
];

function Page() {
  const { t, l } = useI18n();
  const session = getSession();
  const activeTenant = session?.tenants.find((tenant) => tenant.organizationId === session.activeTenantId);
  const canSchedule = activeTenant?.subscription?.plan.features.scheduledReports === true;
  const [templates, setTemplates] = useState<Template[]>([]);
  const [customFields, setCustomFields] = useState<Record<string, Field[]>>({});
  const [groupFields, setGroupFields] = useState<Partial<Record<ReportType, string[]>>>({});
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [builder, setBuilder] = useState<Builder>(emptyBuilder);
  const [preview, setPreview] = useState<Generated | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [scheduleForm, setScheduleForm] = useState({
    reportId: "",
    frequency: "monthly",
    startDate: new Date().toISOString().slice(0, 10),
    timeOfDay: "09:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    recipients: getSession()?.user.email ?? "",
    exportFormat: "pdf",
  });

  const load = async () => {
    try {
      const [templateData, dashboardData, savedData, scheduleData, executionData] = await Promise.all([
        api<{
          templates: Template[];
          customFields: Record<string, Field[]>;
          groupFields: Partial<Record<ReportType, string[]>>;
        }>("/tenant/reports/templates"),
        api<Dashboard>("/tenant/reports/dashboard"),
        api<SavedReport[]>("/tenant/reports"),
        canSchedule ? api<Schedule[]>("/tenant/reports/schedules/list") : Promise.resolve([] as Schedule[]),
        canSchedule ? api<Execution[]>("/tenant/reports/executions/list") : Promise.resolve([] as Execution[]),
      ]);
      setTemplates(templateData.templates);
      setCustomFields(templateData.customFields);
      setGroupFields(templateData.groupFields);
      setDashboard(dashboardData);
      setSaved(savedData);
      setSchedules(scheduleData);
      setExecutions(executionData);
      setScheduleForm((current) => ({ ...current, reportId: current.reportId || savedData[0]?.id || "" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load reports");
    }
  };

  useEffect(() => { void load(); }, []);

  const request = () => ({
    name: builder.name,
    reportType: builder.reportType,
    configuration: builder.configuration,
  });

  const generate = async () => {
    setBusy(true);
    try {
      setPreview(await api<Generated>("/tenant/reports/preview", {
        method: "POST",
        body: JSON.stringify(request()),
      }));
      toast.success("Report preview generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate report");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await api("/tenant/reports", { method: "POST", body: JSON.stringify(request()) });
      toast.success("Report configuration saved");
      await load();
      setActiveTab("saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save report");
    } finally {
      setBusy(false);
    }
  };

  const downloadPreview = async (format: "pdf" | "xlsx" | "csv") => {
    try {
      const blob = await apiBlob(`/tenant/reports/export?format=${format}`, {
        method: "POST",
        body: JSON.stringify(request()),
      });
      downloadBlob(blob, `${slug(builder.name)}.${format}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  };

  const downloadSaved = async (report: SavedReport, format: "pdf" | "xlsx" | "csv") => {
    try {
      downloadBlob(
        await apiBlob(`/tenant/reports/${report.id}/export?format=${format}`),
        `${slug(report.name)}.${format}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  };

  const downloadExecution = async (execution: Execution) => {
    try {
      const format = execution.export_format || "pdf";
      downloadBlob(
        await apiBlob(`/tenant/reports/executions/${execution.id}/download`),
        execution.file_name || `${slug(execution.report_name || "scheduled-report")}.${format}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download generated report");
    }
  };

  const editReport = (report: SavedReport) => {
    const { chartType: _chartType, ...configuration } = report.configuration_json as Configuration & { chartType?: string };
    setBuilder({
      name: report.name,
      reportType: report.report_type,
      configuration,
    });
    setPreview(null);
    setActiveTab("create");
  };

  const deleteReport = async (id: string) => {
    try {
      await api(`/tenant/reports/${id}`, { method: "DELETE" });
      toast.success("Report deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete report");
    }
  };

  const createSchedule = async () => {
    if (!scheduleForm.reportId) return toast.error("Save a report before scheduling it");
    try {
      await api("/tenant/reports/schedules", {
        method: "POST",
        body: JSON.stringify({
          ...scheduleForm,
          recipients: scheduleForm.recipients.split(",").map((value) => value.trim()).filter(Boolean),
          deliveryMethods: ["in_app", ...(scheduleForm.recipients ? ["email"] : [])],
        }),
      });
      toast.success("Schedule created");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create schedule");
    }
  };

  const setScheduleStatus = async (schedule: Schedule) => {
    await api(`/tenant/reports/schedules/${schedule.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: schedule.status === "active" ? "paused" : "active" }),
    });
    await load();
  };

  const runSchedule = async (id: string) => {
    try {
      await api(`/tenant/reports/schedules/${id}/run`, { method: "POST" });
      toast.success("Report generated");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Scheduled run failed");
    }
  };

  const sortOptions = builder.reportType === "custom"
    ? (builder.configuration.fields?.length
        ? builder.configuration.fields
        : customFields[builder.configuration.source ?? "invoices"] ?? [])
    : (preview?.reportType === builder.reportType && preview.columns.length
        ? preview.columns
        : SORT_FIELDS[builder.reportType] ?? (
          ["revenue", "sales", "customer_invoices"].includes(builder.reportType)
            ? INVOICE_SORT_FIELDS
            : []
        ));
  const directFields = new Set(sortOptions.map((field) => field.key));
  const groupOptions = (groupFields[builder.reportType] ?? []).filter(
    (field) => ["month", "quarter", "year"].includes(field) || directFields.has(field),
  );

  return (
    <div className="space-y-5">
      <Header title={t("reports")} desc={l("Generate, customize, export, save, and schedule financial reports.")} />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="dashboard">{t("dashboard")}</TabsTrigger>
          <TabsTrigger value="create">{l("Create Report")}</TabsTrigger>
          <TabsTrigger value="saved">{l("Saved Reports")}</TabsTrigger>
          {canSchedule && <TabsTrigger value="scheduled">{l("Scheduled Reports")}</TabsTrigger>}
          {canSchedule && <TabsTrigger value="generated">{l("Generated Scheduled Reports")}</TabsTrigger>}
          <TabsTrigger value="templates">{l("Templates")}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <Metric title={l("Reports generated")} value={dashboard?.totalGenerated ?? 0} icon={FileBarChart} />
            <Metric title={l("Saved reports")} value={dashboard?.savedCount ?? 0} icon={Save} />
            {canSchedule && <Metric title={l("Active schedules")} value={dashboard?.scheduledCount ?? 0} icon={CalendarClock} />}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Panel title={l("Recently generated")}>
              <SimpleList items={(dashboard?.recent ?? []).map((item) => ({
                title: item.name || "Generated report",
                detail: `${l(item.status)} · ${formatDate(item.completed_at, l)}`,
              }))} />
            </Panel>
            {canSchedule && <Panel title={l("Upcoming scheduled reports")}>
              <SimpleList items={(dashboard?.upcoming ?? []).map((item) => ({
                title: item.name,
                detail: `${l(item.frequency)} · ${formatDate(item.next_run_at, l)}`,
              }))} />
            </Panel>}
            <Panel title={l("Most used templates")}>
              <SimpleList items={(dashboard?.mostUsedTemplates ?? []).map((item) => ({
                title: item.report_type,
                detail: `${item.count} saved configuration${item.count === 1 ? "" : "s"}`,
              }))} />
            </Panel>
            <Panel title={l("Execution history")}>
              <SimpleList items={executions.slice(0, 6).map((item) => ({
                title: item.report_name || "Report",
                detail: `${l(item.status)} · ${l(item.export_format ?? "preview")} · ${formatDate(item.started_at, l)}`,
              }))} />
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <div className="grid xl:grid-cols-[380px_1fr] gap-4">
            <div className="bg-card border border-border-default rounded-2xl p-5 space-y-4 h-fit">
              <h3 className="font-semibold">{l("Report configuration")}</h3>
              <FieldLabel label={l("Report name")}>
                <Input value={builder.name} onChange={(event) => setBuilder({ ...builder, name: event.target.value })} />
              </FieldLabel>
              <FieldLabel label={l("Report type")}>
                <NativeSelect value={builder.reportType} onChange={(value) => {
                  const template = templates.find((item) => item.type === value);
                  setBuilder({
                    ...builder,
                    reportType: value as ReportType,
                    name: template?.name ?? builder.name,
                    configuration: {
                      ...builder.configuration,
                      groupBy: undefined,
                      sortBy: undefined,
                    },
                  });
                  setPreview(null);
                }}>
                  {templates.map((template) => <option key={template.type} value={template.type}>{l(template.name)}</option>)}
                </NativeSelect>
              </FieldLabel>
              <FieldLabel label={l("Date filter")}>
                <NativeSelect value={builder.configuration.datePreset ?? "this_month"} onChange={(value) => updateConfig(setBuilder, builder, "datePreset", value)}>
                  <option value="today">{l("Today")}</option><option value="yesterday">{l("Yesterday")}</option>
                  <option value="this_week">{l("This week")}</option><option value="this_month">{l("This month")}</option>
                  <option value="this_quarter">{l("This quarter")}</option><option value="this_year">{l("This year")}</option>
                  <option value="custom">{l("Custom range")}</option>
                </NativeSelect>
              </FieldLabel>
              {builder.configuration.datePreset === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={builder.configuration.dateFrom ?? ""} onChange={(event) => updateConfig(setBuilder, builder, "dateFrom", event.target.value)} />
                  <Input type="date" value={builder.configuration.dateTo ?? ""} onChange={(event) => updateConfig(setBuilder, builder, "dateTo", event.target.value)} />
                </div>
              )}
              {builder.reportType === "custom" && (
                <CustomFields builder={builder} setBuilder={setBuilder} fields={customFields} />
              )}
              {groupOptions.length > 0 && <div className="grid grid-cols-2 gap-2">
                  <FieldLabel label={l("Group by")}>
                    <NativeSelect value={builder.configuration.groupBy ?? ""} onChange={(value) => updateConfig(setBuilder, builder, "groupBy", value)}>
                      <option value="">{l("No grouping")}</option>
                      {groupOptions.map((field) => <option key={field} value={field}>{l(groupLabel(field))}</option>)}
                    </NativeSelect>
                  </FieldLabel>
                  <FieldLabel label={l("Aggregation")}>
                    <NativeSelect value={builder.configuration.aggregation ?? "sum"} onChange={(value) => updateConfig(setBuilder, builder, "aggregation", value)}>
                      {["sum", "average", "count", "min", "max"].map((value) => <option key={value}>{l(value)}</option>)}
                    </NativeSelect>
                  </FieldLabel>
                </div>}
              <div className="grid grid-cols-2 gap-2">
                <FieldLabel label={l("Sort by")}>
                  <NativeSelect value={builder.configuration.sortBy ?? ""} onChange={(value) => updateConfig(setBuilder, builder, "sortBy", value)}>
                    <option value="">{l("Default order")}</option>
                    {sortOptions.map((field) => <option key={field.key} value={field.key}>{l(field.label)}</option>)}
                  </NativeSelect>
                </FieldLabel>
                <FieldLabel label={l("Sort direction")}>
                  <NativeSelect value={builder.configuration.sortDirection ?? "asc"} onChange={(value) => updateConfig(setBuilder, builder, "sortDirection", value)}>
                    <option value="asc">{l("Ascending")}</option><option value="desc">{l("Descending")}</option>
                  </NativeSelect>
                </FieldLabel>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={generate} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <FilePlus2 />} {l("Preview")}
                </Button>
                <Button variant="outline" onClick={save}><Save /> {l("Save")}</Button>
              </div>
            </div>
            <ReportPreview report={preview} onExport={downloadPreview} />
          </div>
        </TabsContent>

        <TabsContent value="saved">
          <div className="bg-card border border-border-default rounded-2xl overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>{l("Name")}</TableHead><TableHead>{l("Type")}</TableHead><TableHead>{l("Updated")}</TableHead><TableHead>{l("Actions")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {saved.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.name}</TableCell>
                    <TableCell>{l(label(report.report_type))}</TableCell>
                    <TableCell>{formatDate(report.updated_at, l)}</TableCell>
                    <TableCell><div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" onClick={() => editReport(report)}>{l("Open")}</Button>
                      {(["pdf", "xlsx", "csv"] as const).map((format) => <Button key={format} size="sm" variant="ghost" onClick={() => downloadSaved(report, format)}>{format.toUpperCase()}</Button>)}
                      <Button size="icon" variant="ghost" onClick={() => deleteReport(report.id)}><Trash2 /></Button>
                    </div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          <div className="bg-card border border-border-default rounded-2xl p-5">
            <h3 className="font-semibold mb-4">{l("Create schedule")}</h3>
            <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-3">
              <FieldLabel label={l("Saved report")}><NativeSelect value={scheduleForm.reportId} onChange={(value) => setScheduleForm({ ...scheduleForm, reportId: value })}>{saved.map((report) => <option key={report.id} value={report.id}>{l(report.name)}</option>)}</NativeSelect></FieldLabel>
              <FieldLabel label={l("Frequency")}><NativeSelect value={scheduleForm.frequency} onChange={(value) => setScheduleForm({ ...scheduleForm, frequency: value })}>{["daily", "weekly", "monthly", "quarterly", "yearly"].map((value) => <option key={value}>{l(value)}</option>)}</NativeSelect></FieldLabel>
              <FieldLabel label={l("Start date")}><Input type="date" value={scheduleForm.startDate} onChange={(event) => setScheduleForm({ ...scheduleForm, startDate: event.target.value })} /></FieldLabel>
              <FieldLabel label={l("Time")}><Input type="time" value={scheduleForm.timeOfDay} onChange={(event) => setScheduleForm({ ...scheduleForm, timeOfDay: event.target.value })} /></FieldLabel>
              <FieldLabel label={l("Format")}><NativeSelect value={scheduleForm.exportFormat} onChange={(value) => setScheduleForm({ ...scheduleForm, exportFormat: value })}>{["pdf", "xlsx", "csv"].map((value) => <option key={value}>{value.toUpperCase()}</option>)}</NativeSelect></FieldLabel>
              <div className="flex items-end"><Button className="w-full" onClick={createSchedule}><CalendarClock /> {l("Schedule")}</Button></div>
            </div>
            <FieldLabel label={l("Email recipients (comma-separated)")}>
              <Input value={scheduleForm.recipients} onChange={(event) => setScheduleForm({ ...scheduleForm, recipients: event.target.value })} />
            </FieldLabel>
          </div>
          <div className="bg-card border border-border-default rounded-2xl overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>{l("Report")}</TableHead><TableHead>{l("Frequency")}</TableHead><TableHead>{l("Next run")}</TableHead><TableHead>{l("Status")}</TableHead><TableHead>{l("Actions")}</TableHead></TableRow></TableHeader>
              <TableBody>{schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell className="font-medium">{schedule.report_name}</TableCell>
                  <TableCell>{l(schedule.frequency)}</TableCell>
                  <TableCell>{formatDate(schedule.next_run_at, l)}</TableCell>
                  <TableCell><Badge variant={schedule.status === "active" ? "default" : "secondary"}>{l(schedule.status)}</Badge></TableCell>
                  <TableCell><div className="flex gap-1">
                    <Button size="icon" variant="outline" onClick={() => setScheduleStatus(schedule)}>{schedule.status === "active" ? <Pause /> : <Play />}</Button>
                    <Button size="sm" variant="outline" onClick={() => runSchedule(schedule.id)}><History /> {l("Run now")}</Button>
                    <Button size="icon" variant="ghost" onClick={async () => { await api(`/tenant/reports/schedules/${schedule.id}`, { method: "DELETE" }); await load(); }}><Trash2 /></Button>
                  </div></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="generated">
          <div className="bg-card border border-border-default rounded-2xl overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{l("Report")}</TableHead>
                <TableHead>{l("Generated")}</TableHead>
                <TableHead>{l("Format")}</TableHead>
                <TableHead>{l("Email delivery")}</TableHead>
                <TableHead>{l("Recipients")}</TableHead>
                <TableHead>{l("Action")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {executions.map((execution) => (
                  <TableRow key={execution.id}>
                    <TableCell>
                      <p className="font-medium">{l(execution.report_name || "Scheduled report")}</p>
                      {execution.status === "failed" && execution.error_message && (
                        <p className="text-xs text-destructive mt-1">{execution.error_message}</p>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(execution.completed_at || execution.started_at, l)}</TableCell>
                    <TableCell>{(execution.export_format || "pdf").toUpperCase()}</TableCell>
                    <TableCell>
                      <Badge variant={execution.email_status === "sent" ? "default" : execution.email_status === "failed" ? "destructive" : "secondary"}>
                        {l(execution.email_status || "not requested")}
                      </Badge>
                      {execution.emailed_at && <p className="text-xs text-on-surface-variant mt-1">{formatDate(execution.emailed_at, l)}</p>}
                    </TableCell>
                    <TableCell className="max-w-64 truncate">{(execution.recipients_json ?? []).join(", ") || l("In-app only")}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!execution.file_url}
                        onClick={() => downloadExecution(execution)}
                      >
                        <Download /> {l("Download")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!executions.length && <p className="p-8 text-center text-sm text-on-surface-variant">{l("No scheduled reports have been generated yet.")}</p>}
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {templates.map((template) => (
              <button key={template.type} className="text-start bg-card border border-border-default rounded-2xl p-5 hover:border-primary transition" onClick={() => {
                setBuilder({ ...emptyBuilder, name: template.name, reportType: template.type });
                setActiveTab("create");
              }}>
                <FileBarChart className="h-5 w-5 text-primary mb-3" />
                <h3 className="font-semibold">{l(template.name)}</h3>
                <p className="text-sm text-on-surface-variant mt-1">{l(template.description)}</p>
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CustomFields({ builder, setBuilder, fields }: { builder: Builder; setBuilder: (value: Builder) => void; fields: Record<string, Field[]> }) {
  const { l } = useI18n();
  const source = builder.configuration.source ?? "invoices";
  const selected = builder.configuration.fields ?? [];
  const available = fields[source] ?? [];
  const toggle = (field: Field) => {
    const exists = selected.some((item) => item.key === field.key);
    updateConfig(setBuilder, builder, "fields", exists ? selected.filter((item) => item.key !== field.key) : [...selected, field]);
  };
  const reorder = (from: number, to: number) => {
    const next = [...selected];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    updateConfig(setBuilder, builder, "fields", next);
  };
  return <div className="space-y-3">
    <FieldLabel label={l("Data source")}><NativeSelect value={source} onChange={(value) => {
      setBuilder({ ...builder, configuration: { ...builder.configuration, source: value, fields: [] } });
    }}>{Object.keys(fields).map((value) => <option key={value}>{l(label(value))}</option>)}</NativeSelect></FieldLabel>
    <div>
      <Label>{l("Fields")}</Label>
      <div className="grid grid-cols-2 gap-2 mt-2">{available.map((field) => (
        <label key={field.key} className="flex gap-2 items-center text-sm"><Checkbox checked={selected.some((item) => item.key === field.key)} onCheckedChange={() => toggle(field)} />{l(field.label)}</label>
      ))}</div>
    </div>
    {selected.length > 0 && <div className="space-y-2"><Label>{l("Column order and labels")}</Label>{selected.map((field, index) => (
      <div key={field.key} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => reorder(Number(event.dataTransfer.getData("text/plain")), index)} className="flex items-center gap-2 cursor-move">
        <span className="text-xs text-on-surface-variant w-5">{index + 1}</span>
        <Input value={field.label} onChange={(event) => updateConfig(setBuilder, builder, "fields", selected.map((item) => item.key === field.key ? { ...item, label: event.target.value } : item))} />
      </div>
    ))}</div>}
  </div>;
}

function ReportPreview({ report, onExport }: { report: Generated | null; onExport: (format: "pdf" | "xlsx" | "csv") => void }) {
  const { l } = useI18n();
  if (!report) return <div className="bg-card border border-dashed border-border-default rounded-2xl min-h-[520px] grid place-items-center text-center p-8"><div><FileBarChart className="h-12 w-12 mx-auto text-primary/40" /><h3 className="font-semibold mt-3">{l("Report preview")}</h3><p className="text-sm text-on-surface-variant">{l("Configure your report and select Preview.")}</p></div></div>;
  return <div className="space-y-4 min-w-0">
    <div className="bg-card border border-border-default rounded-2xl p-5">
      <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold">{l(report.title)}</h2><p className="text-xs text-on-surface-variant">{l("Generated")} {formatDate(report.generatedAt, l)}</p></div><div className="flex gap-2">{(["pdf", "xlsx", "csv"] as const).map((format) => <Button key={format} size="sm" variant="outline" onClick={() => onExport(format)}><Download />{format.toUpperCase()}</Button>)}</div></div>
    </div>
    {report.reportType === "balance_sheet"
      ? <BalanceSheetPreview report={report} />
      : <div className="bg-card border border-border-default rounded-2xl overflow-hidden">
      <Table><TableHeader><TableRow>{report.columns.map((column) => <TableHead key={column.key}>{l(column.label)}</TableHead>)}</TableRow></TableHeader><TableBody>{report.rows.map((row, index) => <TableRow key={index}>{report.columns.map((column) => <TableCell key={column.key}>{display(row[column.key], l)}</TableCell>)}</TableRow>)}</TableBody></Table>
      {!report.rows.length && <p className="p-8 text-center text-sm text-on-surface-variant">{l("No records match the selected filters.")}</p>}
    </div>}
  </div>;
}

function BalanceSheetPreview({ report }: { report: Generated }) {
  const { l } = useI18n();
  const sections = [
    { type: "Asset", title: "Assets" },
    { type: "Liability", title: "Liabilities" },
    { type: "Equity", title: "Owner's Equity" },
  ];
  return <div className="grid xl:grid-cols-3 gap-4">
    {sections.map((section) => {
      const rows = report.rows.filter((row) => row.type === section.type);
      const total = rows
        .filter((row) => Number(row.level ?? 1) === 1)
        .reduce((sum, row) => sum + Number(row.balance ?? 0), 0);
      return <div key={section.type} className="bg-card border border-border-default rounded-2xl overflow-hidden">
        <div className="bg-sky-200 text-slate-950 px-5 py-3 font-bold uppercase">{l(section.title)}</div>
        <div className="divide-y divide-border-default">
          {rows.map((row, index) => {
            const level = Math.max(1, Number(row.level ?? 1));
            const isParent = row.is_leaf === false;
            return <div key={`${row.code}-${index}`} className={`grid grid-cols-[1fr_auto] gap-4 px-4 py-3 ${isParent ? "font-semibold" : ""}`}>
              <span style={{ paddingInlineStart: `${(level - 1) * 18}px` }}>{l(String(row.account ?? ""))}</span>
              <span className="tabular-nums">{money(row.balance)}</span>
            </div>;
          })}
          {!rows.length && <p className="p-6 text-sm text-on-surface-variant">{l("No accounts in this section.")}</p>}
        </div>
        <div className="bg-sky-200 text-slate-950 px-4 py-3 flex justify-between font-bold">
          <span>{l("Total")} {l(section.title)}</span><span>{money(total)}</span>
        </div>
      </div>;
    })}
  </div>;
}

function Metric({ title, value, icon: Icon }: { title: string; value: number; icon: typeof FileBarChart }) {
  return <div className="bg-card border border-border-default rounded-2xl p-5"><div className="flex justify-between"><div><p className="text-sm text-on-surface-variant">{title}</p><p className="text-3xl font-bold mt-2">{value}</p></div><Icon className="h-6 w-6 text-primary" /></div></div>;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="bg-card border border-border-default rounded-2xl p-5"><h3 className="font-semibold mb-3">{title}</h3>{children}</div>; }
function SimpleList({ items }: { items: { title: string; detail: string }[] }) { const { l } = useI18n(); return <div className="space-y-3">{items.length ? items.map((item, index) => <div key={index} className="flex justify-between gap-3 text-sm border-b border-border-default pb-2 last:border-0"><span className="font-medium">{l(item.title)}</span><span className="text-on-surface-variant text-end">{item.detail}</span></div>) : <p className="text-sm text-on-surface-variant">{l("No data yet.")}</p>}</div>; }
function FieldLabel({ label: text, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{text}</Label>{children}</div>; }
function NativeSelect({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{children}</select>; }
function updateConfig(setBuilder: (value: Builder) => void, builder: Builder, key: keyof Configuration, value: unknown) { setBuilder({ ...builder, configuration: { ...builder.configuration, [key]: value } }); }
function display(value: unknown, localize: (text: string) => string) { if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 2 }); return localize(String(value ?? "")); }
function groupLabel(value: string) { return ({ customer_name: "Customer", vendor_name: "Vendor", bill_type: "Bill Type", account_name: "Expense Account", month: "Month", quarter: "Quarter", year: "Year", department: "Department" } as Record<string, string>)[value] ?? label(value); }
function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function formatDate(value?: string, localize: (text: string) => string = (text) => text) { return value ? new Date(value).toLocaleString() : localize("Not run"); }
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report"; }
function downloadBlob(blob: Blob, fileName: string) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = fileName; link.click(); URL.revokeObjectURL(url); }
