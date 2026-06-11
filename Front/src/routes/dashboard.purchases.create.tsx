import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";
import { useI18n } from "@/lib/i18n";
import CreateInvoiceWithUpload from "@/components/CreateInvoiceWithUpload";

export const Route = createFileRoute("/dashboard/purchases/create")({ component: CreatePurchaseBill });

function CreatePurchaseBill() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      <Header title={t("createPurchaseBill")} desc={t("purchasesDesc")} />
      <div className="bg-card border border-border-default rounded-2xl p-6 shadow-soft">
        <CreateInvoiceWithUpload title={t("purchaseBill")} type="purchases" onDone={() => navigate({ to: "/dashboard/purchases" })} />
      </div>
    </div>
  );
}
