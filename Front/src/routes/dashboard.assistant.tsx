import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Send, Sparkles, TrendingUp, Receipt, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useI18n } from "@/lib/i18n";
import { api, apiBlob, getSession } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/assistant")({ component: Page });

type Attachment = {
  id: string;
  title: string;
  fileName: string;
  url: string;
};

type Msg = {
  who: "you" | "ai";
  text: string;
  attachment?: Attachment | null;
};

type ChatResponse = {
  sessionId: string;
  response: string;
  attachment?: Attachment | null;
};

type HistoryRow = {
  session_id: string;
  question: string;
  response: string;
};

const SUGGESTED = [
  { icon: TrendingUp, text: "What's my net profit this month?" },
  { icon: Receipt, text: "Show me my top 5 expenses" },
  { icon: Lightbulb, text: "How can I reduce costs?" },
  { icon: Sparkles, text: "Forecast my cashflow for July" },
];

function Page() {
  const { t } = useI18n();
  const session = getSession();
  const tenant = session?.tenants.find((item) => item.organizationId === session.activeTenantId);
  const [msgs, setMsgs] = useState<Msg[]>([
    { who: "ai", text: "Hi! I'm your AI finance assistant. Ask me anything about your books." },
  ]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tenant?.subscription?.plan.features.chatbot) return;
    const loadHistory = async () => {
      try {
        const history = await api<HistoryRow[]>("/tenant/chatbot/history");
        if (!history.length) return;
        setSessionId(history.at(-1)?.session_id);
        setMsgs(
          history.flatMap((item) => [
            { who: "you" as const, text: item.question },
            { who: "ai" as const, text: item.response },
          ]),
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load assistant history");
      }
    };
    void loadHistory();
  }, [tenant?.subscription?.plan.features.chatbot]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  if (!tenant?.subscription?.plan.features.chatbot) {
    return (
      <div className="space-y-5">
        <Header title={t("astTitle")} desc={t("astDesc")} />
        <div className="rounded-2xl border border-border-default bg-card p-8 text-center">
          <h3 className="font-semibold">AI Pro subscription required</h3>
          <p className="mt-2 text-sm text-on-surface-variant">The AI financial chatbot is available on the AI Pro plan.</p>
          <Button asChild className="mt-4"><Link to="/dashboard/settings" search={{}}>View plans</Link></Button>
        </div>
      </div>
    );
  }

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || loading) return;
    setMsgs((m) => [...m, { who: "you", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const result = await api<ChatResponse>("/tenant/chatbot", {
        method: "POST",
        body: JSON.stringify({ sessionId, question }),
      });
      setSessionId(result.sessionId);
      setMsgs((m) => [
        ...m,
        {
          who: "ai",
          text: result.response,
          attachment: result.attachment,
        },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Assistant request failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async (attachment: Attachment) => {
    try {
      const blob = await apiBlob(attachment.url);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download report");
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
                  {m.who === "ai" ? (
                    <MarkdownMessage text={m.text} />
                  ) : (
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  )}
                  {m.attachment && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => downloadReport(m.attachment!)}
                    >
                      <Download className="h-4 w-4" />
                      {m.attachment.title}
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-surface-container rounded-2xl px-4 py-3 text-sm inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-border-default p-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void send(input)}
              placeholder={t("askFinances")}
              className="bg-surface-subtle"
              disabled={loading}
            />
            <Button disabled={loading || !input.trim()} onClick={() => void send(input)} className="bg-gradient-primary">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border-default rounded-2xl p-5">
            <h3 className="text-sm font-semibold mb-3">{t("suggestedPrompts")}</h3>
            <div className="space-y-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s.text}
                  onClick={() => void send(s.text)}
                  disabled={loading}
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

function MarkdownMessage({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        h1: ({ children }) => <h1 className="text-base font-bold mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1.5">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1">{children}</h3>,
        p: ({ children }) => <p className="leading-6 mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc space-y-1 ps-5 my-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal space-y-1 ps-5 my-2">{children}</ol>,
        li: ({ children }) => <li className="ps-1">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-s-2 border-primary/40 ps-3 my-2 text-on-surface-variant">
            {children}
          </blockquote>
        ),
        code: ({ children }) => (
          <code className="rounded bg-background/70 px-1 py-0.5 font-mono text-xs">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="overflow-x-auto rounded-lg bg-background/80 p-3 my-2 text-xs">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="w-full border-collapse text-xs">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border-default bg-background/60 px-2 py-1.5 text-start font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border-default px-2 py-1.5 align-top">{children}</td>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {children}
          </a>
        ),
        hr: () => <hr className="my-3 border-border-default" />,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
