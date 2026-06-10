import { createFileRoute } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";
import { useState } from "react";
import { Upload, FileText, CheckCircle2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useI18n } from "@/lib/i18n";
import { getSession } from "@/lib/api";

export const Route = createFileRoute("/dashboard/ocr")({ component: Page });

function Page() {
  const { t } = useI18n();
  const [scanned, setScanned] = useState(false);
  const session = getSession();
  const tenant = session?.tenants.find((item) => item.organizationId === session.activeTenantId);
  if (!tenant?.subscription?.plan.features.invoiceAiExtraction) {
    return (
      <div className="space-y-5">
        <Header title={t("ocrTitle")} desc={t("ocrDesc")} />
        <div className="rounded-2xl border border-border-default bg-card p-8 text-center">
          <h3 className="font-semibold">AI Pro subscription required</h3>
          <p className="mt-2 text-sm text-on-surface-variant">Invoice AI extraction is available on the AI Pro plan.</p>
          <Button asChild className="mt-4"><a href="/dashboard/settings">View plans</a></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header title={t("ocrTitle")} desc={t("ocrDesc")} />
      <div className="grid lg:grid-cols-2 gap-4">
        <div
          className="border-2 border-dashed border-border-default rounded-2xl p-10 grid place-items-center bg-card hover:border-primary hover:bg-primary/5 transition cursor-pointer text-center"
          onClick={() => {
            setTimeout(() => setScanned(true), 1500);
          }}
        >
          <div className="text-center">
            <UploadCloud className="h-10 w-10 mx-auto text-primary mb-3" />
            <p className="font-medium text-sm">{t("dropFile")}</p>
            <p className="text-xs text-on-surface-variant mt-1">{t("upTo10MB")}</p>
            <Button variant="outline" size="sm" className="mt-4">{t("chooseFile")}</Button>
          </div>
        </div>

        <div className="bg-card border border-border-default rounded-2xl p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">{t("extractedFields")}</h3>
            {scanned && (
              <span className="text-xs text-status-success bg-status-success/10 px-2 py-1 rounded-full inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> 96% {t("confidence")}
              </span>
            )}
          </div>
          {!scanned ? (
            <div className="text-center py-16 text-on-surface-variant">
              <FileText className="h-10 w-10 mx-auto opacity-40" />
              <p className="mt-3 text-sm">{t("uploadToBegin")}</p>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <Field label="Vendor" value="AWS Inc." conf={98} />
              <Field label="Invoice number" value="AWS-2026-44210" conf={99} />
              <Field label="Date" value="May 15, 2026" conf={95} />
              <Field label="Total Amount" value="$128.50" conf={99} />

              <div className="flex gap-2 mt-6">
                <Button variant="outline" className="flex-1">{t("edit")}</Button>
                <Button className="flex-1 bg-gradient-primary">{t("reviewDocument")}</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, conf }: { label: string; value: string; conf: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className="text-on-surface-variant">{label}</span>
      </div>
      <div className="p-2 bg-surface-container rounded-lg font-medium border border-border-default">
        {value}
      </div>
    </div>
  );
}
