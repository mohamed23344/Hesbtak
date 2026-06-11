import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";

import { useI18n } from "@/lib/i18n";
import CreateInvoiceWithUpload from "@/components/CreateInvoiceWithUpload";

export const Route = createFileRoute("/dashboard/sales/create")({ component: CreateSalesInvoice });

function CreateSalesInvoice() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      <Header title={t("createSalesInvoice")} desc={t("salesDesc")} />
      <div className="bg-card border border-border-default rounded-2xl p-6 shadow-soft">
        <CreateInvoiceWithUpload title={t("salesInvoice")} type="sales" onDone={() => navigate({ to: "/dashboard/sales" })} />
      </div>
    </div>
  );
}
