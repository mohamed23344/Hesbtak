import { createFileRoute } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";
import { useI18n } from "@/lib/i18n";
import { api, money } from "@/lib/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/journal")({ component: Page });

type JournalLine = {
  id: string;
  account_id: string;
  debit: string;
  credit: string;
  description?: string;
};

type JournalEntry = {
  id: string;
  date: string;
  description: string;
  reference_type?: string;
  lines: JournalLine[];
};

function Page() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    api<JournalEntry[]>("/tenant/journal-entries")
      .then(setEntries)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load journal"));
  }, []);

  return (
    <div className="space-y-5">
      <Header title={t("jeTitle")} desc={t("jeDesc")} />
      <div className="space-y-4">
        {entries.map((entry) => {
          const total = entry.lines.reduce((sum, line) => sum + Number(line.debit), 0);
          return (
            <div key={entry.id} className="bg-card border border-border-default rounded-2xl overflow-hidden shadow-soft">
              <div className="flex items-center justify-between p-4 border-b border-border-default">
                <div>
                  <p className="font-semibold">{entry.description}</p>
                  <p className="text-xs text-on-surface-variant">{String(entry.date).slice(0, 10)} - {entry.reference_type ?? "manual"}</p>
                </div>
                <span className="text-sm font-mono font-semibold">{money(total)}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-surface-container text-xs uppercase text-on-surface-variant">
                  <tr>
                    <th className="text-start p-2 font-medium">{t("account")}</th>
                    <th className="text-end p-2 font-medium">{t("debit")}</th>
                    <th className="text-end p-2 font-medium">{t("credit")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {entry.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="p-3 font-mono text-xs">{line.account_id}</td>
                      <td className="p-3 text-end font-semibold text-status-success">
                        {Number(line.debit) ? money(line.debit) : "-"}
                      </td>
                      <td className="p-3 text-end font-semibold text-primary">
                        {Number(line.credit) ? money(line.credit) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
