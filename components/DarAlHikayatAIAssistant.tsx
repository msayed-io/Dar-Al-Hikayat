import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowUp,
  ChevronRight,
  MessageCirclePlus,
  PanelLeftOpen,
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  Pencil,
  ThumbsUp,
  ThumbsDown,
  MoreVertical,
  Pin,
  Share2,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  streamLiteraryAssistantResponse,
  type StoryContext,
} from "../lib/ai-assistant-service";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isNew?: boolean;
  isStreaming?: boolean;
};

export type StoredConversation = {
  id: string;
  title: string;
  lastMessageAt: Date;
  pinnedAt?: Date | null;
  messages: Message[];
};

type DarAlHikayatAIAssistantProps = {
  onClose: () => void;
  storyContext: StoryContext;
  theme?: {
    bg: string;
    text: string;
    accent: string;
    secondary: string;
    border: string;
    glass: string;
    mode?: string;
    isDark?: boolean;
  };
};

type WelcomeLine = {
  title: string;
  subtitle: string;
};

const welcomeLines: WelcomeLine[] = [
  {
    title: "ما الذي نكتبه معًا اليوم؟",
    subtitle: "اسألي بهدوء عن الحبكة، الشخصيات، الصياغة، أو تطور الأحداث.",
  },
  {
    title: "كيف نطور الحكاية اليوم؟",
    subtitle: "أنا هنا لمعاونتكِ خطوة بخطوة في صقل السرد وبناء المشاهد.",
  },
  {
    title: "في أي تفصيل سردي نبدأ معًا؟",
    subtitle: "مساحة هادئة لمراجعة النص وتدقيق الأسلوب باحترافية وتوازن.",
  },
];

const getInitialWelcomeLineIndex = () => {
  try {
    const previous = Number.parseInt(
      localStorage.getItem("dar_alhikayat_ai_welcome_line_index") ?? "-1",
      10
    );
    return Number.isInteger(previous) && previous >= 0
      ? (previous + 1) % welcomeLines.length
      : 0;
  } catch {
    return 0;
  }
};

const CodeBlock = ({ children }: { children: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="my-3 overflow-hidden border border-[#e6dccf] bg-[#fdfcfb] rounded-[22px] shadow-sm text-left"
      style={{ direction: "ltr" }}
    >
      <div className="flex items-center justify-between px-4 py-2 bg-[#f5ebd9] border-b border-[#e6dccf] text-[#7f6a55] select-none">
        <span className="text-[10px] font-mono font-bold tracking-wider">
          CODE / TEXT
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[#7f6a55] hover:text-[#b88a4f] transition-colors p-1 rounded-md cursor-pointer"
        >
          {copied ? (
            <Check size={12} className="text-[#b88a4f]" />
          ) : (
            <Copy size={12} />
          )}
          <span className="text-[10px] font-bold">
            {copied ? "تم النسخ!" : "نسخ"}
          </span>
        </button>
      </div>
      <pre className="p-4 overflow-x-auto font-mono text-[12.5px] text-[#2b1a10] leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
};

const ListContext = React.createContext(false);
const GHOST_LINE = /^[ \t\u00A0\u200B\u200C\u200D\uFEFF]+$/gm;
const TRAILING_SPACES = /[ \t]+$/gm;

const normalizeMarkdownSpacing = (raw: string): string => {
  if (!raw) return raw;
  const segments = raw.split(/(```[\s\S]*?```)/g);
  return segments
    .map((segment) => {
      if (segment.startsWith("```")) return segment;
      return segment
        .replace(/\r\n?/g, "\n")
        .replace(TRAILING_SPACES, "")
        .replace(GHOST_LINE, "")
        .replace(/\n{3,}/g, "\n\n");
    })
    .join("")
    .trim();
};

const markdownComponents = {
  h1: ({ children }: any) => (
    <h1 className="text-[17px] font-display font-black text-[#2b1a10] mt-4 mb-2 text-right">
      {children}
    </h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-[16px] font-display font-black text-[#2b1a10] mt-4 mb-2 text-right">
      {children}
    </h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-[16px] font-display font-black text-[#2b1a10] mt-4 mb-2 text-right">
      {children}
    </h3>
  ),
  h4: ({ children }: any) => (
    <h4 className="text-[15px] font-display font-black text-[#2b1a10] mt-3 mb-1 text-right">
      {children}
    </h4>
  ),
  h5: ({ children }: any) => (
    <h5 className="text-[14px] font-display font-black text-[#2b1a10] mt-3 mb-1.5 text-right">
      {children}
    </h5>
  ),
  h6: ({ children }: any) => (
    <h6 className="text-[14px] font-display font-black text-[#2b1a10]/90 mt-3 mb-1.5 text-right">
      {children}
    </h6>
  ),
  p: ({ children }: any) => (
    <p
      className="text-[14px] font-sans leading-relaxed text-[#2b1a10] mb-2 text-right break-words whitespace-pre-wrap"
      dir="auto"
      style={{ unicodeBidi: "plaintext" }}
    >
      {children}
    </p>
  ),
  strong: ({ children }: any) => (
    <strong className="font-display font-black text-[#2b1a10]">
      {children}
    </strong>
  ),
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      referrerPolicy="no-referrer"
      className="text-[#b88a4f] underline font-bold hover:text-[#deab65] transition-colors inline"
    >
      {children}
    </a>
  ),
  ul: ({ children }: any) => (
    <ListContext.Provider value={false}>
      <ul className="space-y-1.5 mb-3 list-none pr-1">{children}</ul>
    </ListContext.Provider>
  ),
  ol: ({ children }: any) => (
    <ListContext.Provider value={true}>
      <ol className="list-decimal list-inside space-y-1.5 mb-3 pr-2 text-right">
        {children}
      </ol>
    </ListContext.Provider>
  ),
  li: ({ children, ordered: orderedProp }: any) => {
    const orderedFromContext = React.useContext(ListContext);
    const ordered = orderedProp ?? orderedFromContext;
    const compact = Array.isArray(children)
      ? children.filter(
          (child: any) => typeof child !== "string" || child.trim() !== ""
        )
      : children;
    if (ordered) {
      return (
        <li
          className="block w-full text-[14px] font-sans leading-relaxed text-[#2b1a10] text-right"
          dir="auto"
          style={{ unicodeBidi: "plaintext" }}
        >
          <span className="block whitespace-pre-wrap">{compact}</span>
        </li>
      );
    }
    return (
      <li
        className="flex items-start gap-2 text-[14px] font-sans leading-relaxed text-[#2b1a10]"
        dir="auto"
        style={{ unicodeBidi: "plaintext" }}
      >
        <span className="text-[#b88a4f] mt-1.5 shrink-0 select-none text-[8px]">
          ●
        </span>
        <span className="flex-1 text-right whitespace-pre-wrap">{compact}</span>
      </li>
    );
  },
  code: ({ className, children }: any) => {
    const isBlock = typeof children === "string" && children.includes("\n");
    if (isBlock) {
      return <CodeBlock>{children}</CodeBlock>;
    }
    return (
      <code className="bg-[#f5ebd9] border border-[#e6dccf] rounded-lg px-1.5 py-0.5 mx-0.5 font-mono text-[12.5px] text-[#2b1a10]">
        {children}
      </code>
    );
  },
  blockquote: ({ children }: any) => (
    <blockquote className="border-r-4 border-[#b88a4f] pr-3 my-3 italic text-[#7f6a55] text-right bg-[#f7f2ea]/40 py-1 rounded-l-md">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 h-px border-0 bg-[#e6dccf]" />,
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-3 border border-[#e6dccf] rounded-xl">
      <table className="w-full text-right border-collapse text-[13px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: any) => (
    <thead className="bg-[#f7f2ea] text-[#2b1a10] font-display font-black">
      {children}
    </thead>
  ),
  tbody: ({ children }: any) => (
    <tbody className="divide-y divide-[#e6dccf]/60">{children}</tbody>
  ),
  tr: ({ children }: any) => (
    <tr className="hover:bg-white/40 transition-colors">{children}</tr>
  ),
  th: ({ children }: any) => (
    <th className="p-2.5 font-display font-black border-b border-[#e6dccf]">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="p-2.5 font-sans text-[#2b1a10]/90">{children}</td>
  ),
};

const remarkPlugins = [remarkGfm];

const MarkdownRenderer = ({
  content,
  animate = false,
  onComplete,
}: {
  content: string;
  animate?: boolean;
  onComplete?: () => void;
}) => {
  const normalizedContent = useMemo(
    () => normalizeMarkdownSpacing(content),
    [content]
  );
  const [displayedText, setDisplayedText] = useState(
    animate ? "" : normalizedContent
  );
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!animate) {
      setDisplayedText(normalizedContent);
      return;
    }

    const words = normalizedContent.split(" ");
    let currentIdx = 0;

    setDisplayedText(words.slice(0, 1).join(" "));

    const interval = setInterval(() => {
      currentIdx++;
      if (currentIdx < words.length) {
        setDisplayedText(words.slice(0, currentIdx + 1).join(" "));
      } else {
        clearInterval(interval);
        onCompleteRef.current?.();
      }
    }, 35);

    return () => clearInterval(interval);
  }, [normalizedContent, animate]);

  return (
    <div className="sakeenah-md-flow [&_li_p]:mb-0 [&_blockquote_p]:mb-1 [&_td_p]:mb-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={markdownComponents as any}
      >
        {displayedText}
      </ReactMarkdown>
    </div>
  );
};

const CONVERSATIONS_STORAGE_KEY = "dar_alhikayat_ai_saved_conversations";

export const DarAlHikayatAIAssistant = React.memo(function DarAlHikayatAIAssistant({
  onClose,
  storyContext,
  theme,
}: DarAlHikayatAIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, "like" | "dislike">>({});
  const [copiedResponseId, setCopiedResponseId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMultiline, setIsMultiline] = useState(false);
  const [longMsgs, setLongMsgs] = useState<Set<string>>(new Set());
  const [expandedMsgs, setExpandedMsgs] = useState<Set<string>>(new Set());
  const [welcomeLineIndex] = useState(getInitialWelcomeLineIndex);
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isConversationsLoading, setIsConversationsLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [openConversationMenuId, setOpenConversationMenuId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<StoredConversation | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StoredConversation | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [shareResult, setShareResult] = useState<{ conversation: StoredConversation; url: string } | null>(null);

  // Load saved conversations from localStorage
  const loadStoredConversations = useCallback((): StoredConversation[] => {
    try {
      const raw = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          ...item,
          lastMessageAt: new Date(item.lastMessageAt),
          pinnedAt: item.pinnedAt ? new Date(item.pinnedAt) : null,
          messages: (item.messages || []).map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        }));
      }
    } catch (e) {
      console.error("Failed to parse stored conversations", e);
    }
    return [];
  }, []);

  const saveStoredConversations = useCallback((list: StoredConversation[]) => {
    try {
      localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error("Failed to save conversations to storage", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "dar_alhikayat_ai_welcome_line_index",
      String(welcomeLineIndex)
    );
  }, [welcomeLineIndex]);

  // Initial load of conversations
  useEffect(() => {
    setIsConversationsLoading(true);
    const loaded = loadStoredConversations();
    setConversations(loaded);
    setIsConversationsLoading(false);
  }, [loadStoredConversations]);

  // Auto-sync active conversation messages to storage
  useEffect(() => {
    if (!activeConversationId || messages.length === 0) return;
    setConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.id === activeConversationId) {
          const firstUserMsg = messages.find((m) => m.role === "user");
          const title = firstUserMsg
            ? firstUserMsg.content.slice(0, 48)
            : c.title;
          return {
            ...c,
            title: title || c.title,
            messages,
            lastMessageAt: new Date(),
          };
        }
        return c;
      });
      saveStoredConversations(updated);
      return updated;
    });
  }, [messages, activeConversationId, saveStoredConversations]);

  // Adjust textarea height
  const adjustTextareaHeight = useCallback(() => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    el.style.height = "auto";
    const scrollH = el.scrollHeight;
    const newH = Math.max(38, Math.min(scrollH, 130));
    el.style.height = `${newH}px`;
    setIsMultiline(scrollH > 38 || inputValue.includes("\n"));
  }, [inputValue]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [adjustTextareaHeight]);

  // Identify long messages
  useEffect(() => {
    const newLongMsgs = new Set<string>();
    messages.forEach((m) => {
      if (
        m.role === "user" &&
        (m.content.length > 110 || m.content.split("\n").length > 3)
      ) {
        newLongMsgs.add(m.id);
      }
    });
    setLongMsgs(newLongMsgs);
  }, [messages]);

  const toggleExpand = useCallback((msgId: string) => {
    setExpandedMsgs((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  const lastAssistantMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  }, [messages]);

  const lastUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].id;
    }
    return null;
  }, [messages]);

  const hasStreamingAssistantMessage = useMemo(
    () => messages.some((msg) => msg.role === "assistant" && msg.isStreaming),
    [messages]
  );

  const handleCopyMsgContent = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedResponseId(msgId);
    setTimeout(() => setCopiedResponseId(null), 2000);
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInputValue("");
    setIsDrawerOpen(false);
    setEditingMessageId(null);
  };

  const openConversation = (conversationId: string) => {
    if (isLoading) return;
    const target = conversations.find((c) => c.id === conversationId);
    if (target) {
      setActiveConversationId(target.id);
      setMessages(target.messages || []);
      setIsDrawerOpen(false);
      setEditingMessageId(null);
    }
  };

  const handlePinConversation = (conv: StoredConversation) => {
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === conv.id
          ? { ...c, pinnedAt: c.pinnedAt ? null : new Date() }
          : c
      );
      // Sort pinned first
      updated.sort((a, b) => {
        if (a.pinnedAt && !b.pinnedAt) return -1;
        if (!a.pinnedAt && b.pinnedAt) return 1;
        return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
      });
      saveStoredConversations(updated);
      return updated;
    });
    setOpenConversationMenuId(null);
  };

  const openRenameConversation = (conv: StoredConversation) => {
    setRenameTarget(conv);
    setRenameValue(conv.title);
    setOpenConversationMenuId(null);
  };

  const handleRenameConversation = () => {
    if (!renameTarget || !renameValue.trim()) return;
    setActionLoading(true);
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === renameTarget.id ? { ...c, title: renameValue.trim() } : c
      );
      saveStoredConversations(updated);
      return updated;
    });
    setRenameTarget(null);
    setRenameValue("");
    setActionLoading(false);
  };

  const handleDeleteConversation = (convId: string) => {
    setActionLoading(true);
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== convId);
      saveStoredConversations(updated);
      return updated;
    });
    if (activeConversationId === convId) {
      startNewConversation();
    }
    setDeleteTarget(null);
    setActionLoading(false);
    setOpenConversationMenuId(null);
  };

  const handleShareConversation = (conv: StoredConversation) => {
    const textSnapshot = (conv.messages || [])
      .map(
        (m) =>
          `${m.role === "user" ? "الكاتبة رحمة:" : "المحرر الأدبي:"}\n${m.content}`
      )
      .join("\n\n---\n\n");
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(
      `حوار أدبي في دار الحكايات: "${conv.title}"\n\n${textSnapshot}`
    );
    setShareResult({
      conversation: conv,
      url: shareUrl,
    });
    setOpenConversationMenuId(null);
  };

  // Auto scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (text: string, replaceUserMessageId?: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const replaceIndex = replaceUserMessageId
      ? messages.findIndex(
          (m) => m.id === replaceUserMessageId && m.role === "user"
        )
      : -1;

    if (replaceUserMessageId && replaceIndex === -1) return;

    const userMsg: Message = {
      id: replaceUserMessageId || Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    const historyMessages = replaceUserMessageId
      ? [...messages.slice(0, replaceIndex), userMsg]
      : [...messages, userMsg];

    setMessages((prev) => {
      if (!replaceUserMessageId) return [...prev, userMsg];
      const currentIndex = prev.findIndex(
        (m) => m.id === replaceUserMessageId && m.role === "user"
      );
      return currentIndex === -1
        ? prev
        : [...prev.slice(0, currentIndex), userMsg];
    });

    setInputValue("");
    setIsLoading(true);

    let currentConvId = activeConversationId;
    if (!currentConvId) {
      const newId = "conv-" + Date.now();
      const newConv: StoredConversation = {
        id: newId,
        title: trimmed.slice(0, 48),
        lastMessageAt: new Date(),
        pinnedAt: null,
        messages: [userMsg],
      };
      currentConvId = newId;
      setActiveConversationId(newId);
      setConversations((prev) => [newConv, ...prev]);
    }

    const aiMsgId = (Date.now() + 1).toString();
    const aiMsg: Message = {
      id: aiMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isNew: false,
      isStreaming: true,
    };

    setMessages((prev) => [...prev, aiMsg]);
    setIsLoading(false);

    try {
      let accumulated = "";
      await streamLiteraryAssistantResponse(
        historyMessages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        trimmed,
        storyContext,
        (chunk) => {
          accumulated += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId
                ? { ...msg, content: accumulated, isStreaming: true }
                : msg
            )
          );
        }
      );

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg
        )
      );
      setStorageError(null);
    } catch (error) {
      console.error("Dar Al-Hikayat AI assistant error:", error);
      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === aiMsgId);
        if (index !== -1 && prev[index].content.trim()) {
          return prev.map((msg) =>
            msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg
          );
        }
        const cleaned = prev.filter((m) => m.id !== aiMsgId);
        const errorMsg: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content:
            "عذرًا يا أستاذة رحمة، حدث تعذر مؤقت في الاتصال بالمحرر الأدبي. يُرجى المحاولة مرة أخرى.",
          timestamp: new Date(),
        };
        return [...cleaned, errorMsg];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startEditingUserMessage = (message: Message) => {
    if (isLoading || message.id !== lastUserMessageId) return;
    setEditingMessageId(message.id);
    setEditingContent(message.content);
  };

  const cancelEditingUserMessage = () => {
    setEditingMessageId(null);
    setEditingContent("");
  };

  const confirmEditingUserMessage = () => {
    if (!editingMessageId) return;
    const originalMessage = messages.find(
      (m) => m.id === editingMessageId && m.role === "user"
    );
    if (
      !originalMessage ||
      editingContent === originalMessage.content ||
      !editingContent.trim()
    )
      return;

    const messageId = editingMessageId;
    cancelEditingUserMessage();
    void handleSendMessage(editingContent, messageId);
  };

  const userName = "أستاذة رحمة";

  return (
    <div
      dir="rtl"
      className="w-full h-full relative flex flex-col overflow-hidden bg-[#ece7de] text-[#2b1a10] font-sans"
      style={{ backgroundColor: "#ece7de", color: "#2b1a10" }}
    >
      {/* Background soft ambient shapes */}
      <div
        className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] rounded-full pointer-events-none bg-[#b88a4f]/5 blur-[120px]"
        style={{
          backgroundColor: "rgba(184, 138, 79, 0.05)",
          filter: "blur(120px)",
        }}
      />
      <div
        className="absolute bottom-[-10%] left-[-10%] w-[250px] h-[250px] rounded-full pointer-events-none bg-[#deab65]/5 blur-[100px]"
        style={{
          backgroundColor: "rgba(222, 171, 101, 0.05)",
          filter: "blur(100px)",
        }}
      />
      {messages.length === 0 && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[38vh] bg-gradient-to-t from-[#d8b27b]/55 via-[#d8b27b]/20 to-transparent"
          style={{
            background:
              "linear-gradient(to top, rgba(216, 178, 123, 0.55) 0%, rgba(216, 178, 123, 0.20) 40%, transparent 100%)",
          }}
          aria-hidden="true"
        />
      )}

      {/* ── FLOATING TOP HEADER ── */}
      <div className="absolute top-6 left-5 right-5 flex items-center justify-between z-[45] pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="w-10 h-10 cut-crystal-capsule rounded-full shadow-md text-[#2b1a10] hover:text-[#b88a4f] hover:border-[#b88a4f]/40 hover:bg-white flex items-center justify-center active:scale-[0.95] transition-all duration-300 cursor-pointer"
            aria-label="فتح المحادثات المحفوظة"
            title="المحادثات المحفوظة"
          >
            <PanelLeftOpen size={17} strokeWidth={2.2} />
          </button>
          <div className="cut-crystal-capsule px-5 h-10 rounded-full shadow-md flex items-center justify-center gap-1.5 transition-all duration-300">
            <span className="text-[14.5px] font-display font-black whitespace-nowrap pt-0.5 text-[#2b1a10]">
              دار الحكايات AI
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={startNewConversation}
              className="w-10 h-10 cut-crystal-capsule rounded-full shadow-md text-[#7f6a55] hover:text-[#b88a4f] hover:border-[#b88a4f]/40 hover:bg-white flex items-center justify-center active:scale-[0.95] transition-all duration-300 cursor-pointer"
              aria-label="بدء محادثة جديدة"
              title="محادثة جديدة"
            >
              <MessageCirclePlus size={17} strokeWidth={2.1} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 cut-crystal-capsule rounded-full shadow-md text-[#2b1a10] hover:text-[#b88a4f] hover:border-[#b88a4f]/40 hover:bg-white flex items-center justify-center active:scale-[0.95] transition-all duration-300 cursor-pointer"
            aria-label="رجوع"
            title="رجوع"
          >
            <ChevronRight size={18} className="mr-0.5" />
          </button>
        </div>
      </div>

      {/* ── CONVERSATIONS DRAWER ── */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.button
              type="button"
              aria-label="إغلاق قائمة المحادثات"
              className="fixed inset-0 z-[55] bg-[#2b1a10]/18 backdrop-blur-[2px] cursor-default"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
            />
            <motion.aside
              dir="rtl"
              className="fixed inset-y-0 right-0 left-auto z-[60] flex w-[min(286px,calc(100vw-16px))] flex-col overflow-hidden rounded-l-[30px] rounded-r-none border border-r-0 border-white/45 shadow-[0_24px_70px_-20px_rgba(43,26,16,0.42)]"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.78), rgba(184,138,79,0.22))",
                backdropFilter: "blur(28px) saturate(165%)",
                WebkitBackdropFilter: "blur(28px) saturate(165%)",
              }}
              initial={{ opacity: 0, x: 18, scale: 0.995 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 18, scale: 0.995 }}
              transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#b88a4f]/15 px-4">
                <p className="text-[14px] font-display font-black text-[#2b1a10]">
                  دار الحكايات AI
                </p>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#7f6a55] transition-colors hover:bg-white hover:text-[#2b1a10] active:scale-95 cursor-pointer"
                  aria-label="إغلاق قائمة المحادثات"
                >
                  <X size={16} />
                </button>
              </div>

              <button
                type="button"
                onClick={startNewConversation}
                className="mx-3 mt-3 flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#b88a4f] px-4 text-[12px] font-display font-black text-[#fff9f1] shadow-sm transition-all hover:bg-[#a0753e] active:scale-[0.98] cursor-pointer"
              >
                <MessageCirclePlus size={16} />
                <span>محادثة جديدة</span>
              </button>

              <div className="flex-1 overflow-y-auto px-3 pb-4 pt-4 hide-scrollbar">
                {isConversationsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-[12px] font-bold text-[#7f6a55]">
                    <span className="w-4 h-4 border-2 border-[#b88a4f] border-t-transparent rounded-full animate-spin" />
                    <span>جارٍ تحميل المحادثات</span>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="px-5 py-10 text-center text-[12px] font-bold leading-6 text-[#7f6a55]">
                    لا توجد محادثات محفوظة بعد.
                    <br />
                    ابدأي سؤالًا جديدًا وستظهر هنا.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={`group relative flex items-center gap-1 rounded-[22px] border px-3 py-2 transition-all ${
                          conversation.id === activeConversationId
                            ? "border-[#b88a4f]/40 bg-[#f7f2ea] shadow-sm"
                            : "border-transparent hover:border-[#b88a4f]/20 hover:bg-[#f7f2ea]/70"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => openConversation(conversation.id)}
                          className="min-w-0 flex-1 text-right cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5 truncate text-[12px] font-display font-black text-[#2b1a10]">
                            {conversation.pinnedAt && (
                              <Pin
                                size={11}
                                className="shrink-0 text-[#b88a4f]"
                                aria-label="مثبتة"
                              />
                            )}
                            <span className="truncate">
                              {conversation.title}
                            </span>
                          </span>
                          <span className="mt-1 block text-[10px] font-bold text-[#7f6a55]">
                            {conversation.lastMessageAt.toLocaleDateString(
                              "ar-EG",
                              { day: "numeric", month: "short" }
                            )}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenConversationMenuId((current) =>
                              current === conversation.id
                                ? null
                                : conversation.id
                            );
                          }}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all hover:bg-[#f5ebd9]/75 cursor-pointer ${
                            conversation.pinnedAt
                              ? "text-[#b88a4f]"
                              : "text-[#7f6a55]/70 hover:text-[#2b1a10]"
                          }`}
                          aria-label={`إجراءات ${conversation.title}`}
                          title="إجراءات المحادثة"
                        >
                          {conversation.pinnedAt ? (
                            <Pin size={15} fill="currentColor" />
                          ) : (
                            <MoreVertical size={16} />
                          )}
                        </button>
                        <AnimatePresence>
                          {openConversationMenuId === conversation.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.96, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.96, y: -4 }}
                              transition={{ duration: 0.12 }}
                              className="!absolute left-2 top-10 z-[70] w-[184px] cut-crystal-panel rounded-[20px] shadow-2xl overflow-hidden p-1.5"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  handleShareConversation(conversation)
                                }
                                className="flex h-9 w-full items-center gap-2 rounded-[14px] px-3 text-right text-[11px] font-bold text-[#2b1a10] transition hover:bg-[#f5ebd9] cursor-pointer"
                              >
                                <Share2 size={14} className="text-[#b88a4f]" />
                                <span>مشاركة المحادثة</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handlePinConversation(conversation)
                                }
                                className="flex h-9 w-full items-center gap-2 rounded-[14px] px-3 text-right text-[11px] font-bold text-[#2b1a10] transition hover:bg-[#f5ebd9] cursor-pointer"
                              >
                                <Pin
                                  size={14}
                                  className={
                                    conversation.pinnedAt
                                      ? "fill-[#b88a4f] text-[#b88a4f]"
                                      : "text-[#b88a4f]"
                                  }
                                />
                                <span>
                                  {conversation.pinnedAt
                                    ? "إلغاء التثبيت"
                                    : "تثبيت"}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  openRenameConversation(conversation)
                                }
                                className="flex h-9 w-full items-center gap-2 rounded-[14px] px-3 text-right text-[11px] font-bold text-[#2b1a10] transition hover:bg-[#f5ebd9] cursor-pointer"
                              >
                                <Pencil size={14} className="text-[#b88a4f]" />
                                <span>إعادة التسمية</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenConversationMenuId(null);
                                  setDeleteTarget(conversation);
                                }}
                                className="flex h-9 w-full items-center gap-2 rounded-[14px] px-3 text-right text-[11px] font-bold text-[#2b1a10] transition hover:bg-[#f5ebd9] cursor-pointer"
                              >
                                <Trash2 size={14} className="text-[#b88a4f]" />
                                <span>حذف</span>
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── MODALS (SHARE, RENAME, DELETE) ── */}
      <AnimatePresence>
        {shareResult && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-[#2b1a10]/20 px-5 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              dir="rtl"
              className="cut-crystal-panel w-full max-w-[360px] rounded-[28px] p-5"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-display font-black text-[#2b1a10]">
                    تم نسخ نص المحادثة
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-[#7f6a55]">
                    تم نسخ كامل مجريات الحوار الأدبي للحافظة بنجاح.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShareResult(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#7f6a55] hover:bg-[#f5ebd9] cursor-pointer"
                  aria-label="إغلاق"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShareResult(null)}
                  className="h-10 flex-1 rounded-full bg-[#b88a4f] text-[12px] font-black text-white hover:bg-[#a0753e] cursor-pointer"
                >
                  تم
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {renameTarget && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-[#2b1a10]/20 px-5 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.form
              dir="rtl"
              onSubmit={(event) => {
                event.preventDefault();
                handleRenameConversation();
              }}
              className="cut-crystal-panel w-full max-w-[360px] rounded-[28px] p-5"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
            >
              <p className="text-[16px] font-display font-black text-[#2b1a10]">
                إعادة تسمية المحادثة
              </p>
              <input
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                maxLength={160}
                className="cut-crystal-input mt-4 h-11 w-full rounded-[18px] px-4 text-right text-[13px] font-bold text-[#2b1a10] outline-none focus:border-[#b88a4f]"
                aria-label="اسم المحادثة الجديد"
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRenameTarget(null)}
                  className="h-10 flex-1 rounded-full border border-[#d8c9b8] text-[12px] font-black text-[#7f6a55] hover:bg-[#f5ebd9] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!renameValue.trim() || actionLoading}
                  className="h-10 flex-1 rounded-full bg-[#b88a4f] text-[12px] font-black text-white disabled:opacity-50 cursor-pointer"
                >
                  حفظ
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}

        {deleteTarget && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-[#2b1a10]/25 px-5 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              dir="rtl"
              className="cut-crystal-panel w-full max-w-[360px] rounded-[28px] p-5"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8f3c35] to-[#6f2d29] text-white shadow-sm">
                  <Trash2 size={18} />
                </div>
                <div>
                  <p className="text-[16px] font-display font-black text-[#2b1a10]">
                    حذف المحادثة نهائيًا؟
                  </p>
                  <p className="mt-2 text-[12px] font-bold leading-6 text-[#7f6a55]">
                    سيتم حذف المحادثة وجميع رسائلها نهائيًا. لا يمكن التراجع عن
                    هذا الإجراء.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={actionLoading}
                  className="h-10 flex-1 rounded-full border border-[#d8c9b8] text-[12px] font-black text-[#7f6a55] hover:bg-[#f5ebd9] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteConversation(deleteTarget.id)}
                  disabled={actionLoading}
                  className="h-10 flex-1 rounded-full border border-[#8f3c35]/35 bg-gradient-to-br from-[#8f3c35] to-[#6f2d29] text-[12px] font-black text-white shadow-[0_10px_22px_-12px_rgba(111,45,41,0.9)] transition-[transform,filter] duration-150 hover:brightness-110 active:scale-[0.97] disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? "جارٍ الحذف..." : "حذف نهائي"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {storageError && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="fixed bottom-6 left-5 right-5 z-[120] mx-auto max-w-[360px] rounded-[20px] border border-white/45 bg-[#ece7de]/55 px-4 py-3 text-center text-[11px] font-black text-[#2b1a10] shadow-[0_18px_42px_rgba(43,26,16,0.24)] backdrop-blur-2xl"
          >
            {storageError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN CHAT AREA / EMPTY STATE ── */}
      <div className="flex-1 flex flex-col justify-between relative z-10 overflow-hidden">
        {messages.length === 0 ? (
          <div className="flex-1 overflow-hidden pt-24 pb-28">
            <AnimatePresence mode="wait">
              <motion.div
                key={welcomeLineIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="flex h-full flex-col items-center justify-center px-4 text-center"
              >
                <p className="text-[13px] font-bold text-[#8a6a3d]">
                  أهلًا بكِ، {userName}
                </p>
                <h1 className="mt-3 max-w-[330px] font-display text-[29px] font-black leading-[1.25] text-[#2b1a10]">
                  {welcomeLines[welcomeLineIndex].title}
                </h1>
                <p className="mt-3 max-w-[285px] text-[13px] font-bold leading-7 text-[#7f6a55]">
                  {welcomeLines[welcomeLineIndex].subtitle}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          /* Active Chat Thread */
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto px-1 pt-24 pb-36 space-y-4 scrollbar-thin hide-scrollbar"
          >
            {messages.map((m, idx) => {
              const isUser = m.role === "user";
              const isEditingThisMessage = isUser && editingMessageId === m.id;
              const canEditThisMessage =
                isUser &&
                m.id === lastUserMessageId &&
                !isLoading &&
                !hasStreamingAssistantMessage;
              const hasEditedContent =
                isEditingThisMessage && editingContent !== m.content;
              const isEditingLongMessage =
                isEditingThisMessage &&
                (longMsgs.has(m.id) ||
                  editingContent.length > 110 ||
                  editingContent.split("\n").length > 3);
              const isLastAI =
                !isUser &&
                idx === lastAssistantMessageIndex &&
                m.isNew !== true &&
                m.isStreaming !== true;

              return (
                <div key={m.id} className="w-full">
                  <div className={isUser ? "mr-auto max-w-[85%]" : "w-full"}>
                    {!isUser && (
                      <div className="flex items-center gap-1.5 mb-2 text-[11px] font-display font-black text-[#b88a4f] select-none">
                        <span>دار الحكايات AI</span>
                      </div>
                    )}

                    {isUser ? (
                      <>
                        <div className="relative text-right bg-gradient-to-br from-[#2b1a10] to-[#3f281a] text-[#fff9f1] border border-[#2b1a10]/20 rounded-[28px] shadow-md transition-all duration-300 overflow-hidden">
                          {isEditingThisMessage ? (
                            <textarea
                              autoFocus
                              rows={isEditingLongMessage ? 7 : 3}
                              value={editingContent}
                              onChange={(event) =>
                                setEditingContent(event.target.value)
                              }
                              aria-label="تعديل رسالة المستخدم"
                              className={`w-full resize-none bg-transparent p-4 text-right text-[14px] font-sans font-bold leading-relaxed text-[#fff9f1] outline-none placeholder:text-white/50 ${
                                isEditingLongMessage
                                  ? "min-h-[156px] max-h-[180px] overflow-y-auto overscroll-contain scroll-smooth"
                                  : "min-h-[92px] max-h-[130px] overflow-y-auto"
                              }`}
                            />
                          ) : (
                            <>
                              <div
                                className={`p-4 transition-all duration-300 ease-in-out ${
                                  longMsgs.has(m.id) && !expandedMsgs.has(m.id)
                                    ? "max-h-[105px] overflow-hidden relative"
                                    : "max-h-none"
                                }`}
                              >
                                <p className="font-sans text-[14px] leading-relaxed font-bold whitespace-pre-wrap break-words">
                                  {m.content}
                                </p>
                                {longMsgs.has(m.id) &&
                                  !expandedMsgs.has(m.id) && (
                                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#2b1a10] via-[#2b1a10]/85 to-transparent pointer-events-none rounded-b-[28px]" />
                                  )}
                              </div>
                              {longMsgs.has(m.id) && (
                                <div
                                  className={`flex items-center justify-start ${
                                    !expandedMsgs.has(m.id)
                                      ? "absolute bottom-2.5 left-2.5 z-10"
                                      : "px-4 pb-3 pt-0"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(m.id)}
                                    className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 border border-white/25 flex items-center justify-center text-white cursor-pointer transition-all active:scale-90 shadow-md backdrop-blur-xs"
                                    title={
                                      expandedMsgs.has(m.id)
                                        ? "طي النص"
                                        : "توسيع النص"
                                    }
                                  >
                                    {expandedMsgs.has(m.id) ? (
                                      <ChevronUp size={15} />
                                    ) : (
                                      <ChevronDown size={15} />
                                    )}
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {isEditingThisMessage ? (
                          <div
                            dir="ltr"
                            className="mt-2 flex items-center justify-start gap-3 px-1 text-[12px] font-bold"
                          >
                            <button
                              type="button"
                              disabled={
                                !hasEditedContent || !editingContent.trim()
                              }
                              onClick={confirmEditingUserMessage}
                              className={`inline-flex h-7 items-center justify-center rounded-full px-3 text-[12px] font-bold transition-all ${
                                hasEditedContent && editingContent.trim()
                                  ? "bg-[#b88a4f] text-[#fff9f1] shadow-sm hover:bg-[#a0753e] active:scale-95 cursor-pointer"
                                  : "bg-[#e6dccf]/60 text-[#7f6a55]/40 cursor-not-allowed"
                              }`}
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingUserMessage}
                              className="text-[#7f6a55] transition-colors hover:text-[#2b1a10] cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <div
                            dir="ltr"
                            className="mt-2 flex items-center justify-start gap-1"
                          >
                            {canEditThisMessage && (
                              <button
                                type="button"
                                onClick={() => startEditingUserMessage(m)}
                                className="inline-flex h-7 w-7 items-center justify-center text-[#7f6a55] transition-colors hover:text-[#b88a4f] active:scale-90 cursor-pointer"
                                title="تعديل الرسالة"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyMsgContent(m.id, m.content)
                              }
                              className={`inline-flex h-7 w-7 items-center justify-center text-[#7f6a55] transition-colors hover:text-[#b88a4f] active:scale-90 cursor-pointer ${
                                copiedResponseId === m.id
                                  ? "text-emerald-600"
                                  : ""
                              }`}
                              title="نسخ الرسالة"
                            >
                              {copiedResponseId === m.id ? (
                                <Check size={13} />
                              ) : (
                                <Copy size={13} />
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full text-right bg-transparent border-none shadow-none px-0 py-2 text-[#2b1a10]">
                        <div>
                          {m.content.trim() === "" && m.isStreaming ? (
                            <div className="flex items-center gap-1.5 py-3 justify-start">
                              <span className="w-2 h-2 rounded-full bg-[#b88a4f] animate-bounce [animation-delay:-0.3s]"></span>
                              <span className="w-2 h-2 rounded-full bg-[#b88a4f] animate-bounce [animation-delay:-0.15s]"></span>
                              <span className="w-2 h-2 rounded-full bg-[#b88a4f] animate-bounce"></span>
                            </div>
                          ) : (
                            <MarkdownRenderer
                              content={m.content}
                              animate={m.isNew && !m.isStreaming}
                              onComplete={() => {
                                setMessages((prev) =>
                                  prev.map((msg) =>
                                    msg.id === m.id
                                      ? { ...msg, isNew: false }
                                      : msg
                                  )
                                );
                              }}
                            />
                          )}
                        </div>
                        {isLastAI && (
                          <div
                            dir="ltr"
                            className="mt-4 flex w-full items-center justify-end gap-2 border-t border-[#e6dccf]/40 pt-3 text-[#7f6a55] select-none"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setFeedback((prev) => ({
                                  ...prev,
                                  [m.id]:
                                    prev[m.id] === "dislike"
                                      ? undefined
                                      : "dislike",
                                }))
                              }
                              className={`inline-flex h-7 w-7 items-center justify-center text-[#7f6a55] transition-all hover:text-red-500 active:scale-90 cursor-pointer ${
                                feedback[m.id] === "dislike"
                                  ? "text-red-600"
                                  : ""
                              }`}
                              title="لم يعجبني"
                            >
                              <ThumbsDown
                                size={14}
                                fill={
                                  feedback[m.id] === "dislike"
                                    ? "currentColor"
                                    : "none"
                                }
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setFeedback((prev) => ({
                                  ...prev,
                                  [m.id]:
                                    prev[m.id] === "like" ? undefined : "like",
                                }))
                              }
                              className={`inline-flex h-7 w-7 items-center justify-center text-[#7f6a55] transition-all hover:text-[#b88a4f] active:scale-90 cursor-pointer ${
                                feedback[m.id] === "like"
                                  ? "text-[#b88a4f]"
                                  : ""
                              }`}
                              title="أعجبني"
                            >
                              <ThumbsUp
                                size={14}
                                fill={
                                  feedback[m.id] === "like"
                                    ? "currentColor"
                                    : "none"
                                }
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleCopyMsgContent(m.id, m.content)
                              }
                              className={`inline-flex h-7 w-7 items-center justify-center text-[#7f6a55] transition-all hover:text-[#b88a4f] active:scale-90 cursor-pointer ${
                                copiedResponseId === m.id
                                  ? "text-emerald-600"
                                  : ""
                              }`}
                              title="نسخ الإجابة"
                            >
                              {copiedResponseId === m.id ? (
                                <Check size={14} className="text-emerald-600" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start w-full pr-1 py-2 pl-12">
                <div className="relative inline-flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#b88a4f]/20 border border-[#b88a4f]/40 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-[#b88a4f] animate-pulse" />
                  </div>
                  <span
                    dir="ltr"
                    className="text-[14px] font-display font-bold select-none thinking-shimmer"
                  >
                    Thinking
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* ── BACKGROUND UNDER INPUT BAR ── */}
        <div
          className={`absolute inset-x-0 bottom-0 z-10 pointer-events-none h-28 ${
            messages.length === 0
              ? "bg-gradient-to-t from-[#d8b27b]/55 via-[#d8b27b]/20 to-transparent"
              : "bg-gradient-to-t from-[#ece7de] via-[#ece7de]/80 to-transparent"
          }`}
          style={{
            background:
              messages.length === 0
                ? "linear-gradient(to top, rgba(216, 178, 123, 0.55) 0%, rgba(216, 178, 123, 0.20) 40%, transparent 100%)"
                : "linear-gradient(to top, #ece7de 0%, rgba(236, 231, 222, 0.85) 60%, transparent 100%)",
          }}
        />

        {/* ── FLOATING INPUT FIELD BAR ── */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center pointer-events-none px-4 pb-4">
          <div className="w-full max-w-[390px] pointer-events-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputValue);
              }}
              className="flex items-end gap-2 p-2 transition-shadow duration-300"
              style={{
                borderRadius: isMultiline ? "22px" : "9999px",
                overflow: "hidden",
                background:
                  "linear-gradient(180deg, rgba(253,252,251,0.75) 0%, rgba(244,240,234,0.60) 100%)",
                backdropFilter:
                  "blur(26px) saturate(210%) contrast(99%) brightness(102%)",
                WebkitBackdropFilter:
                  "blur(26px) saturate(210%) contrast(99%) brightness(102%)",
                border: "1px solid rgba(43,26,16,0.09)",
                boxShadow:
                  "0 16px 36px -12px rgba(43,26,16,0.14), 0 4px 10px -2px rgba(43,26,16,0.06), inset 0 1px 0 0 rgba(255,255,255,0.90), inset 0 -1px 0 0 rgba(43,26,16,0.05)",
                transition: "border-radius 0.3s ease",
              }}
            >
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="اسأل المساعد الأدبي عن أي فكرة أو صياغة أو حبكة..."
                disabled={isLoading || editingMessageId !== null}
                rows={1}
                className="flex-1 min-h-[38px] text-right bg-transparent border-none outline-none px-3 py-2 text-[13.5px] font-sans font-bold text-[#2b1a10] placeholder-[#7f6a55]/60 disabled:opacity-50 resize-none max-h-[130px] overflow-y-auto leading-relaxed break-words"
                style={{ color: "#2b1a10" }}
              />

              <motion.button
                whileTap={{ scale: 0.9 }}
                type="submit"
                disabled={
                  !inputValue.trim() || isLoading || editingMessageId !== null
                }
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                  inputValue.trim() && !isLoading && editingMessageId === null
                    ? "bg-[#b88a4f] text-[#fff9f1] shadow-md hover:bg-[#a0753e] active:scale-90 cursor-pointer"
                    : "bg-[#e8dfd4]/60 text-[#7f6a55]/40 cursor-not-allowed"
                }`}
                style={{
                  backgroundColor:
                    inputValue.trim() && !isLoading && editingMessageId === null
                      ? "#b88a4f"
                      : "rgba(232, 223, 212, 0.6)",
                  color:
                    inputValue.trim() && !isLoading && editingMessageId === null
                      ? "#fff9f1"
                      : "rgba(127, 106, 85, 0.4)",
                }}
                aria-label="إرسال السؤال"
              >
                <ArrowUp size={15} strokeWidth={2.5} />
              </motion.button>
            </form>
            <div className="text-center mt-1.5 flex items-center justify-center gap-1 text-[10px] font-sans text-[#7f6a55]/80 font-bold">
              <AlertCircle size={10} className="text-[#b88a4f]" style={{ color: "#b88a4f" }} />
              <span style={{ color: "rgba(127, 106, 85, 0.8)" }}>دار الحكايات AI • المساعد الأدبي للكاتبة رحمة السيد موافي</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default DarAlHikayatAIAssistant;
