import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  MessageCircle, Plus, Trash2, Send, Bot, User, ExternalLink, Loader2
} from "lucide-react";

interface Conversation {
  id: number;
  sessionTitle: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string; section: string; chunkId: number }>;
  tokensUsed?: number;
  createdAt: string;
}

interface ConvDetail extends Conversation {
  messages: Message[];
}

export default function ChatPage() {
  const { t } = useLang();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: () => api.get("/chat/conversations"),
  });

  const { data: convDetail } = useQuery<ConvDetail>({
    queryKey: ["conversation", selectedConvId],
    queryFn: () => api.get(`/chat/conversations/${selectedConvId}`),
    enabled: !!selectedConvId,
  });

  const createConv = useMutation({
    mutationFn: () => api.post<Conversation>("/chat/conversations", { title: "محادثة جديدة" }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setSelectedConvId(data.id);
    },
  });

  const deleteConv = useMutation({
    mutationFn: (id: number) => api.delete(`/chat/conversations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (selectedConvId === confirmDelete) setSelectedConvId(null);
      setConfirmDelete(null);
    },
  });

  const sendMessage = useMutation({
    mutationFn: ({ convId, content }: { convId: number; content: string }) =>
      api.post<{ message: Message; sources: any[] }>(`/chat/conversations/${convId}/messages`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation", selectedConvId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setIsThinking(false);
    },
    onError: () => {
      setIsThinking(false);
      toast({ title: t("error"), variant: "destructive" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convDetail?.messages]);

  const handleSend = async () => {
    if (!input.trim() || !selectedConvId || isThinking) return;
    const content = input.trim();
    setInput("");
    setIsThinking(true);
    sendMessage.mutate({ convId: selectedConvId, content });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar: Conversations */}
      <aside className="w-56 border-e border-border bg-sidebar flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-border">
          <Button
            size="sm"
            className="w-full gap-2 bg-gradient-to-r from-primary to-blue-500 hover:opacity-90"
            onClick={() => createConv.mutate()}
            disabled={createConv.isPending}
          >
            <Plus size={15} />
            {t("newConversation")}
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">{t("noConversations")}</p>
            ) : conversations.map(conv => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer transition-colors",
                  selectedConvId === conv.id
                    ? "bg-primary/15 text-primary"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
                onClick={() => { setSelectedConvId(conv.id); setConfirmDelete(null); }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MessageCircle size={14} className="shrink-0" />
                  <span className="text-xs truncate">{conv.sessionTitle}</span>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-0.5"
                  onClick={e => { e.stopPropagation(); setConfirmDelete(conv.id); }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>

        {confirmDelete && (
          <div className="p-3 border-t border-border bg-destructive/10">
            <p className="text-xs text-foreground mb-2">{t("confirmDelete")}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" className="flex-1 h-7 text-xs" onClick={() => deleteConv.mutate(confirmDelete)}>
                {t("yes")}
              </Button>
              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setConfirmDelete(null)}>
                {t("no")}
              </Button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedConvId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bot size={32} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("chat")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t("aiChatDesc")}</p>
            </div>
            <Button
              size="sm"
              className="gap-2 bg-gradient-to-r from-primary to-blue-500 hover:opacity-90"
              onClick={() => createConv.mutate()}
            >
              <Plus size={14} />
              {t("startNewChat")}
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-2xl mx-auto space-y-4">
                {convDetail?.messages.map((msg) => (
                  <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      msg.role === "user" ? "bg-primary" : "bg-muted border border-border"
                    )}>
                      {msg.role === "user" ? <User size={14} className="text-white" /> : <Bot size={14} className="text-primary" />}
                    </div>
                    <div className={cn("flex flex-col gap-1 max-w-[80%]", msg.role === "user" ? "items-end" : "items-start")}>
                      <div className={cn(
                        "rounded-2xl px-4 py-2.5 text-sm leading-relaxed prose-chat",
                        msg.role === "user"
                          ? "bg-gradient-to-br from-primary to-blue-500 text-white rounded-ee-sm"
                          : "bg-card border border-border text-foreground rounded-es-sm"
                      )}>
                        {msg.content.split("\n").map((line, i) => (
                          <span key={i}>{line}{i < msg.content.split("\n").length - 1 && <br />}</span>
                        ))}
                      </div>
                      {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(msg.sources as any[]).map((src: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px] border-border/50 text-muted-foreground">
                              {src.title || src.section}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isThinking && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center">
                      <Bot size={14} className="text-primary" />
                    </div>
                    <div className="bg-card border border-border rounded-2xl rounded-es-sm px-4 py-3 flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">{t("thinking")}</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-border bg-background">
              <div className="max-w-2xl mx-auto flex gap-2">
                <Textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("typeMessage")}
                  rows={1}
                  className="resize-none min-h-[42px] max-h-32 bg-muted border-border"
                  disabled={isThinking}
                />
                <Button
                  className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90 h-auto px-4"
                  onClick={handleSend}
                  disabled={!input.trim() || isThinking}
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
