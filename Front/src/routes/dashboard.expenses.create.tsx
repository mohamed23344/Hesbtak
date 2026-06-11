import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";
import { useI18n } from "@/lib/i18n";
import CreateInvoiceWithUpload from "@/components/CreateInvoiceWithUpload";

export const Route = createFileRoute("/dashboard/expenses/create")({ component: CreateExpense });

function CreateExpense() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      <Header title={t("createExpense")} desc={t("expensesDesc")} />
      <div className="bg-card border border-border-default rounded-2xl p-6 shadow-soft">
        <CreateInvoiceWithUpload title={t("expenseEntry")} type="expenses" onDone={() => navigate({ to: "/dashboard/expenses" })} />
      </div>
    </div>
  );
}
