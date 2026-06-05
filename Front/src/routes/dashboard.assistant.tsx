import { createFileRoute } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Sparkles, TrendingUp, Receipt, Lightbulb, Bot } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/assistant")({ component: Page });

type Msg = { who: "you" | "ai"; text: string };

const SUGGESTED = [
  { icon: TrendingUp, text: "What's my net profit this month?" },
  { icon: Receipt, text: "Show me my top 5 expenses" },
  { icon: Lightbulb, text: "How can I reduce costs?" },
  { icon: Sparkles, text: "Forecast my cashflow for July" },
];

function Page() {
  const { t } = useI18n();
  const [msgs, setMsgs] = useState<Msg[]>([
    { who: "ai", text: "Hi! I'm your AI finance assistant. Ask me anything about your books." },
  ]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();

  const send = async (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { who: "you", text }]);
    setInput("");
    try {
      const result = await api<{ sessionId: string; response: string }>("/tenant/chatbot", {
        method: "POST",
        body: JSON.stringify({ sessionId, question: text }),
      });
      setSessionId(result.sessionId);
      setMsgs((m) => [
        ...m,
        {
          who: "ai",
          text: result.response,
        },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Assistant request failed");
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col space-y-5">
      <Header title={t("astTitle")} desc={t("astDesc")} />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border-default rounded-2xl flex flex-col h-[600px] shadow-soft">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.who === "you" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  m.who === "you" ? "bg-gradient-primary text-primary-foreground" : "bg-surface-container text-on-surface"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border-default p-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder={t("askFinances")}
              className="bg-surface-subtle"
            />
            <Button onClick={() => send(input)} className="bg-gradient-primary"><Send className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border-default rounded-2xl p-5">
            <h3 className="text-sm font-semibold mb-3">{t("suggestedPrompts")}</h3>
            <div className="space-y-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s.text}
                  onClick={() => send(s.text)}
                  className="w-full text-start p-3 rounded-lg border border-border-default hover:border-primary/40 hover:bg-surface-subtle text-sm flex items-center gap-2"
                >
                  <s.icon className="h-4 w-4 text-primary shrink-0" /> {s.text}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-gradient-primary text-primary-foreground rounded-2xl p-5">
            <Sparkles className="h-5 w-5 mb-2" />
            <p className="text-sm font-medium">{t("proTip")}</p>
            <p className="text-xs opacity-90 mt-1">
              {t("proTipDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
