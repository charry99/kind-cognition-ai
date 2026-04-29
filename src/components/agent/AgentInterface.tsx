import { FormEvent, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUp, Bot, BrainCircuit, Command, Sparkles, UserRound, WandSparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const starterPrompts = [
  "Turn this rough idea into an execution plan",
  "Draft a product launch checklist",
  "Analyze tradeoffs for a technical decision",
];

const capabilities = [
  { icon: BrainCircuit, label: "Reasoning", value: "Plans, decisions, tradeoffs" },
  { icon: WandSparkles, label: "Creation", value: "Drafts, briefs, concepts" },
  { icon: Zap, label: "Execution", value: "Clear next actions" },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`;

async function streamAgentResponse({
  messages,
  onDelta,
}: {
  messages: Array<Pick<AgentMessage, "role" | "content">>;
  onDelta: (chunk: string) => void;
}) {
  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok || !response.body) {
    const fallback = "The AI agent could not respond right now.";
    try {
      const data = await response.json();
      throw new Error(data.error || fallback);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(fallback);
    }
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  while (!finished) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let newlineIndex: number;

    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;

      const json = line.slice(6).trim();
      if (json === "[DONE]") {
        finished = true;
        break;
      }

      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        buffer = `${line}\n${buffer}`;
        break;
      }
    }
  }
}

export function AgentInterface() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi — I’m **Orbit**, your AI agent. Give me a goal, messy notes, or a decision you’re weighing, and I’ll help turn it into a clear path forward.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const visibleMessages = useMemo(() => messages.map(({ role, content }) => ({ role, content })), [messages]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMessage: AgentMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const assistantId = crypto.randomUUID();

    setInput("");
    setIsLoading(true);
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "" }]);

    let assistantText = "";

    try {
      await streamAgentResponse({
        messages: [...visibleMessages, userMessage].filter((message) => message.content),
        onDelta: (chunk) => {
          assistantText += chunk;
          setMessages((current) =>
            current.map((message) => (message.id === assistantId ? { ...message, content: assistantText } : message)),
          );
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setMessages((current) => current.filter((item) => item.id !== assistantId));
      toast({ title: "Agent paused", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="relative isolate flex min-h-screen flex-col px-4 py-5 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_var(--x,50%)_var(--y,20%),hsl(var(--agent-aura)/0.28),transparent_28rem)]" />
        <div className="absolute inset-x-0 top-0 -z-20 h-80 bg-hero-grid opacity-80" />

        <header className="mx-auto flex w-full max-w-7xl items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-agent">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">AI Agent</p>
              <h1 className="text-xl font-semibold tracking-normal">Orbit Command</h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm text-muted-foreground shadow-glass backdrop-blur md:flex">
            <span className="size-2 rounded-full bg-agent-live shadow-live" />
            Live reasoning workspace
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-5 py-6 lg:grid-cols-[0.78fr_1.22fr]">
          <aside className="flex flex-col justify-between rounded-2xl border border-border bg-card/70 p-6 shadow-glass backdrop-blur-xl lg:min-h-[calc(100vh-8rem)]">
            <div className="space-y-8">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-sm text-secondary-foreground">
                  <Command className="size-4" />
                  Autonomous thinking, guided by you
                </div>
                <div className="space-y-4">
                  <h2 className="max-w-xl text-4xl font-semibold leading-tight tracking-normal sm:text-5xl lg:text-6xl">
                    Ask. Refine. Ship the next move.
                  </h2>
                  <p className="max-w-lg text-base leading-7 text-muted-foreground">
                    A focused agent for turning open-ended goals into crisp strategy, structured drafts, and practical execution steps.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {capabilities.map((item) => (
                  <div key={item.label} className="group rounded-xl border border-border bg-secondary/60 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-accent hover:shadow-agent-soft">
                    <item.icon className="mb-3 size-5 text-primary" />
                    <p className="font-medium">{item.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-border bg-agent-panel p-4">
              <p className="text-sm font-medium">Try a starter prompt</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="rounded-full border border-border bg-card px-3 py-2 text-left text-xs text-card-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="flex min-h-[680px] flex-col rounded-2xl border border-border bg-card/75 shadow-glass backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="font-medium">Agent thread</p>
                <p className="text-sm text-muted-foreground">Markdown responses, streamed from Lovable AI</p>
              </div>
              <Bot className="size-5 text-primary" />
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
              {messages.map((message) => (
                <article key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "assistant" && (
                    <div className="mt-1 grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                      <Bot className="size-4" />
                    </div>
                  )}
                  <div className={`max-w-[88%] rounded-2xl border px-4 py-3 shadow-agent-soft ${message.role === "user" ? "border-primary/40 bg-primary text-primary-foreground" : "border-border bg-secondary/70 text-secondary-foreground"}`}>
                    {message.content ? (
                      <div className="prose prose-sm max-w-none text-current prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-strong:text-current prose-headings:text-current prose-code:text-current">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                        <span className="size-2 animate-pulse rounded-full bg-primary" />
                        Orbit is thinking…
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="mt-1 grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                      <UserRound className="size-4" />
                    </div>
                  )}
                </article>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-border p-4">
              <div className="flex gap-3 rounded-2xl border border-border bg-background/80 p-2 shadow-inner-glow focus-within:ring-2 focus-within:ring-ring">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage(input);
                    }
                  }}
                  placeholder="Give Orbit a task, question, or messy notes…"
                  className="min-h-14 resize-none border-0 bg-transparent px-3 py-3 shadow-none focus-visible:ring-0"
                />
                <Button type="submit" size="icon" variant="agent" disabled={isLoading || !input.trim()} className="mt-auto shrink-0">
                  <ArrowUp className="size-5" />
                </Button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
