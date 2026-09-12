import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
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
  Plus,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useApp } from "../contexts/AppContext";
import {
  streamLiteraryAssistantResponse,
  type StoryContext,
} from "../lib/ai-assistant-service";
import {
  AttachedMention,
  validateAndHealMentions,
  formatMentionsForPrompt,
} from "../lib/editor-block-system";

export type Message = {
  id: string;
  role: "user" | "assistant" | "system_ephemeral";
  content: string;
  timestamp: Date;
  isNew?: boolean;
  isStreaming?: boolean;
  mentions?: AttachedMention[];
  ephemeral?: boolean;
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
  attachedMentions?: AttachedMention[];
  onRemoveMention?: (id: string) => void;
  onClearMentions?: () => void;
  editorRootElement?: HTMLElement | null;
  theme?: {
    bg: string;
    text: string;
    accent: string;
    secondary: string;
    border: string;
    glass: string;
    shadow?: string;
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

const MarkdownThemeContext = React.createContext<any>(null);

const CodeBlock = ({ children }: { children: string }) => {
  const theme = React.useContext(MarkdownThemeContext);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="my-3 overflow-hidden rounded-[18px] border shadow-sm text-left"
      style={{
        direction: "ltr",
        borderColor: theme?.border || "rgba(0,0,0,0.1)",
        backgroundColor: theme?.glass || "rgba(255,255,255,0.7)",
      }}
    >
      <div
        className="flex items-center justify-between px-3.5 py-1.5 border-b select-none"
        style={{
          borderColor: theme?.border || "rgba(0,0,0,0.1)",
          backgroundColor: theme?.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
          color: theme?.secondary || "#666",
        }}
      >
        <span className="text-[10px] font-mono font-bold tracking-wider">
          CODE / TEXT
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 transition-colors p-1 rounded-md cursor-pointer hover:opacity-80"
          style={{ color: theme?.accent || "currentColor" }}
        >
          {copied ? (
            <Check size={12} />
          ) : (
            <Copy size={12} />
          )}
          <span className="text-[10px] font-bold">
            {copied ? "تم النسخ!" : "نسخ"}
          </span>
        </button>
      </div>
      <pre
        className="p-3.5 overflow-x-auto font-mono text-[12px] leading-relaxed"
        style={{ color: theme?.text || "inherit" }}
      >
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
  h1: ({ children }: any) => {
    const theme = React.useContext(MarkdownThemeContext);
    return (
      <h1
        className="text-[16px] font-zain-xbold mt-4 mb-2 text-right"
        style={{ color: theme?.text }}
      >
        {children}
      </h1>
    );
  },
  h2: ({ children }: any) => {
    const theme = React.useContext(MarkdownThemeContext);
    return (
      <h2
        className="text-[15px] font-zain-xbold mt-3.5 mb-1.5 text-right"
        style={{ color: theme?.text }}
      >
        {children}
      </h2>
    );
  },
  h3: ({ children }: any) => {
    const theme = React.useContext(MarkdownThemeContext);
    return (
      <h3
        className="text-[14px] font-zain-xbold mt-3 mb-1 text-right"
        style={{ color: theme?.text }}
      >
        {children}
      </h3>
    );
  },
  h4: ({ children }: any) => {
    const theme = React.useContext(MarkdownThemeContext);
    return (
      <h4
        className="text-[13.5px] font-zain-xbold mt-2.5 mb-1 text-right"
        style={{ color: theme?.text }}
      >
        {children}
      </h4>
    );
  },
  h5: ({ children }: any) => {
    const theme = React.useContext(MarkdownThemeContext);
    return (
      <h5
        className="text-[13px] font-zain-xbold mt-2.5 mb-1 text-right"
        style={{ color: theme?.text }}
      >
        {children}
      </h5>
    );
  },
  h6: ({ children }: any) => {
    const theme = React.useContext(MarkdownThemeContext);
    return (
      <h6
        className="text-[13px] font-zain-xbold mt-2 mb-1 text-right"
        style={{ color: theme?.secondary }}
      >
        {children}
      </h6>
    );
  },
  p: ({ children }: any) => {
    const theme = React.useContext(MarkdownThemeContext);
    return (
      <p
        className="text-[15.5px] font-zain-reg leading-[1.65] mb-2.5 text-right break-words whitespace-pre-wrap"
        dir="auto"
        style={{ unicodeBidi: "plaintext", color: theme?.text }}
      >
        {children}
      </p>
    );
  },
  strong: ({ children }: any) => {
    const theme = React.useContext(MarkdownThemeContext);
    return (
      <strong className="font-zain-xbold" style={{ color: theme?.text }}>
        {children}
      </strong>
    );
  },
  a: ({ href, children }: any) => {
    const theme = React.useContext(MarkdownThemeContext);
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        referrerPolicy="no-referrer"
        className="underline font-zain-bold hover:opacity-80 transition-colors inline"
        style={{ color: theme?.accent }}
      >
        {children}
      </a>
    );
  },
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
    const theme = React.useContext(MarkdownThemeContext);
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
          className="block w-full text-[15.5px] font-zain-reg leading-[1.65] text-right"
          dir="auto"
          style={{ unicodeBidi: "plaintext", color: theme?.text }}
        >
          <span className="block whitespace-pre-wrap">{compact}</span>
        </li>
      );
    }
    return (
      <li
        className="flex items-start gap-2 text-[15.5px] font-zain-reg leading-[1.65]"
        dir="auto"
        style={{ unicodeBidi: "plaintext", color: theme?.text }}
      >
        <span
          className="mt-1.5 shrink-0 select-none text-[8px]"
          style={{ color: theme?.accent }}
        >
          ●
        </span>
        <span className="flex-1 text-right whitespace-pre-wrap">{compact}</span>
      </li>
    );
  },
  code: ({ children }: any) => {
    const theme = React.useContext(MarkdownThemeContext);
    const isBlock = typeof children === "string" && children.includes("\n");
    if (isBlock) {
      return <CodeBlock>{children}</CodeBlock>;
    }
    return (
      <code
        className="border rounded-md px-1.5 py-0.5 mx-0.5 font-mono text-[12px]"
        style={{
          backgroundColor: theme?.isDark
            ? "rgba(255,255,255,0.06)"
            : "rgba(0,0,0,0.04)",
          borderColor: theme?.border,
          color: theme?.text,
        }}
      >
        {children}
      </code>
    );
  },
  blockquote: ({ children }: any) => {
    const theme = React.useContext(MarkdownThemeContext);
    return (
      <blockquote
        className="border-r-4 pr-3 my-2.5 italic text-right py-1 rounded-l-md font-zain-reg text-[14.5px] leading-relaxed"
        style={{
          borderColor: theme?.accent,
          backgroundColor: theme?.isDark
            ? "rgba(255,255,255,0.04)"
            : `${theme?.accent}10`,
          color: theme?.secondary,
        }}
      >
        {children}
      </blockquote>
    );
  },
  hr: () => {
    const theme = React.useContext(MarkdownThemeContext);
    return (
      <hr
        className="my-3 h-px border-0"
        style={{ backgroundColor: theme?.border }}
      />
    );
  },
  table: ({ children }: any) => {
    const theme = React.useContext(MarkdownThemeContext);
    return (
      <div
        className="overflow-x-auto my-3 border rounded-xl"
        style={{ borderColor: theme?.border }}
      >
        <table className="w-full text-right border-collapse text-xs">
          {children}
        </table>
      </div>
    );
  },
  thead: ({ children }: any) => {
    const theme = React.useContext(MarkdownThemeContext);
    return (
      <thead
        className="font-zain-xbold"
        style={{
          backgroundColor: theme?.isDark
            ? "rgba(255,255,255,0.04)"
            : "rgba(0,0,0,0.03)",
          color: theme?.text,
        }}
      >
        {children}
      </thead>
    );
  },
  tbody: ({ children }: any) => {
    const theme = React.useContext(MarkdownThemeContext);
    return (
      <tbody className="divide-y" style={{ borderColor: theme?.border }}>
        {children}
      </tbody>
    );
  },
  tr: ({ children }: any) => (
    <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
      {children}
    </tr>
  ),
  th: ({ children }: any) => {
    const theme = React.useContext(MarkdownThemeContext);
    return (
      <th
        className="p-2 font-zain-xbold border-b"
        style={{ borderColor: theme?.border }}
      >
        {children}
      </th>
    );
  },
  td: ({ children }: any) => {
    const theme = React.useContext(MarkdownThemeContext);
    return (
      <td className="p-2 font-zain-reg" style={{ color: theme?.text }}>
        {children}
      </td>
    );
  },
};

const remarkPlugins = [remarkGfm];

const MarkdownRenderer = ({
  content,
  animate = false,
  onComplete,
  theme,
}: {
  content: string;
  animate?: boolean;
  onComplete?: () => void;
  theme?: any;
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
    <MarkdownThemeContext.Provider value={theme}>
      <div className="sakeenah-md-flow [&_li_p]:mb-0 [&_blockquote_p]:mb-1 [&_td_p]:mb-0 [&>*:last-child]:mb-0">
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          components={markdownComponents as any}
        >
          {displayedText}
        </ReactMarkdown>
      </div>
    </MarkdownThemeContext.Provider>
  );
};

const CONVERSATIONS_STORAGE_KEY = "dar_alhikayat_ai_saved_conversations";

interface UserMessageBubbleProps {
  message: Message;
  currentTheme: any;
  isEditingThisMessage: boolean;
  isEditingLongMessage: boolean;
  editingContent: string;
  setEditingContent: (val: string) => void;
}

function UserMessageBubble({
  message,
  currentTheme,
  isEditingThisMessage,
  isEditingLongMessage,
  editingContent,
  setEditingContent,
}: UserMessageBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Deterministic calculation: message exceeds 2 lines if > 70 characters or contains > 2 lines
  const isOverTwoLines = useMemo(() => {
    const text = message.content || "";
    return text.length > 70 || text.split("\n").length > 2;
  }, [message.content]);

  // Consistent rounded rectangle border radius matching edit mode exactly
  const borderRadiusClass = "rounded-[22px] rounded-tl-sm";

  return (
    <div
      className={`w-fit min-w-[240px] max-w-[85%] text-right border shadow-sm transition-all duration-300 overflow-hidden relative ${borderRadiusClass}`}
      style={{
        backgroundColor: currentTheme.accent,
        borderColor: currentTheme.accent,
        color: "#ffffff",
      }}
    >
      {isEditingThisMessage ? (
        <textarea
          autoFocus
          rows={isEditingLongMessage ? 7 : 3}
          value={editingContent}
          onChange={(event) => setEditingContent(event.target.value)}
          aria-label="تعديل رسالة المستخدم"
          className="w-full min-w-[240px] resize-none bg-transparent px-5 py-3.5 text-right text-xs font-zain-bold leading-relaxed outline-none text-white placeholder:text-white/60"
        />
      ) : (
        <div className={`w-full px-5 py-3.5 relative ${isOverTwoLines ? "pb-9" : ""}`}>
          <p
            className="text-[14px] font-zain-bold leading-[23px] whitespace-pre-wrap break-words transition-all duration-300"
            style={{
              display: isOverTwoLines && !isExpanded ? "-webkit-box" : "block",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: isOverTwoLines && !isExpanded ? 3 : "none",
              overflow: isOverTwoLines && !isExpanded ? "hidden" : "visible",
            }}
          >
            {message.content}
          </p>

          {/* Fade gradient overlay when collapsed */}
          {isOverTwoLines && !isExpanded && (
            <div
              className="absolute inset-x-0 bottom-0 h-10 pointer-events-none rounded-b-[20px]"
              style={{
                background: `linear-gradient(to top, ${currentTheme.accent} 85%, transparent 100%)`,
              }}
            />
          )}

          {/* Floating toggle button inside bubble - Positioned on the right side */}
          {isOverTwoLines && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="absolute bottom-2 flex h-7.5 w-11 items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-md transition-all active:scale-90 cursor-pointer z-10 border border-white/10 shadow-xs"
              style={{ left: "12px", right: "auto" }}
              aria-label={isExpanded ? "طي النص" : "توسيع النص"}
              title={isExpanded ? "طي النص" : "توسيع النص"}
            >
              {isExpanded ? (
                <ChevronUp size={15} className="text-white" />
              ) : (
                <ChevronDown size={15} className="text-white" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const DarAlHikayatAIAssistant = React.memo(function DarAlHikayatAIAssistant({
  onClose,
  storyContext,
  attachedMentions = [],
  onRemoveMention,
  onClearMentions,
  editorRootElement,
  theme: propTheme,
}: DarAlHikayatAIAssistantProps) {
  const { currentTheme: appContextTheme } = useApp();
  const currentTheme = propTheme || appContextTheme;
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
  const [activeFullTextMention, setActiveFullTextMention] = useState<AttachedMention | null>(null);
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
          const cleanMessages = messages.filter(
            (m) => !m.ephemeral && m.role !== "system_ephemeral"
          );
          return {
            ...c,
            title: title || c.title,
            messages: cleanMessages,
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
    
    // If input value is empty, force a clean, single-line height of 24px and non-multiline state
    if (!inputValue) {
      el.style.height = "24px";
      setIsMultiline(false);
      return;
    }

    el.style.height = "auto";
    const scrollH = el.scrollHeight;
    const newH = Math.max(24, Math.min(scrollH, 96));
    el.style.height = `${newH}px`;
    setIsMultiline(scrollH > 28 || inputValue.includes("\n"));
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
        (m.content.length > 80 || m.content.split("\n").length > 2)
      ) {
        newLongMsgs.add(m.id);
      }
    });
    setLongMsgs(newLongMsgs);
  }, [messages]);

  const toggleExpand = useCallback((msgId: string) => {
    setExpandedMsgs((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
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

    // Process and validate attached mentions for prompt context
    let mentionsContext = "";
    let activeMentions: AttachedMention[] = [];
    let droppedNoticeMsg: Message | null = null;

    if (attachedMentions && attachedMentions.length > 0) {
      const valResult = validateAndHealMentions(attachedMentions, editorRootElement);
      activeMentions = [...valResult.valid, ...valResult.healed];
      if (activeMentions.length > 0) {
        mentionsContext = formatMentionsForPrompt(activeMentions);
      }

      if (valResult.dropped.length > 0) {
        const count = valResult.dropped.length;
        droppedNoticeMsg = {
          id: "ephemeral-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
          role: "system_ephemeral",
          content:
            count === 1
              ? "تعذّر إرفاق مقطع واحد نظراً لتعديل النص الأصلي بعد تحديده."
              : `تعذّر إرفاق ${count} مقاطع نظراً لتعديل النص الأصلي بعد تحديدها.`,
          timestamp: new Date(),
          ephemeral: true,
        };
      }

      onClearMentions?.();
    }

    const userMsg: Message = {
      id: replaceUserMessageId || Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
      mentions: activeMentions.length > 0 ? activeMentions : undefined,
    };

    const historyMessages = replaceUserMessageId
      ? [...messages.slice(0, replaceIndex), userMsg]
      : [...messages, userMsg];

    setMessages((prev) => {
      const base = replaceUserMessageId
        ? (() => {
            const currentIndex = prev.findIndex(
              (m) => m.id === replaceUserMessageId && m.role === "user"
            );
            return currentIndex === -1
              ? prev
              : [...prev.slice(0, currentIndex), userMsg];
          })()
        : [...prev, userMsg];

      if (droppedNoticeMsg) {
        return [...base, droppedNoticeMsg];
      }
      return base;
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
      const apiHistory = historyMessages
        .filter((m) => !m.ephemeral && (m.role === "user" || m.role === "assistant"))
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: m.timestamp,
        }));

      await streamLiteraryAssistantResponse(
        apiHistory,
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
        },
        mentionsContext
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
      className="w-full h-full relative flex flex-col overflow-hidden select-text"
      style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
    >
      {/* Background soft ambient shapes matching theme */}
      <div
        className="absolute top-[-15%] right-[-10%] w-[260px] h-[260px] rounded-full pointer-events-none blur-[90px] opacity-25"
        style={{ backgroundColor: currentTheme.accent }}
      />
      <div
        className="absolute bottom-[-10%] left-[-10%] w-[220px] h-[220px] rounded-full pointer-events-none blur-[80px] opacity-20"
        style={{ backgroundColor: currentTheme.accent }}
      />

      {/* ── FLOATING TOP HEADER CAPSULES: ABSOLUTE OVERLAY (ZERO BACKGROUND BAR) ── */}
      <header
        className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none select-none"
        style={{ left: "16px", right: "16px" }}
      >
        {/* Right Capsule: Dar Al Hikayat AI Title Only */}
        <div
          className="pointer-events-auto h-11 px-5 border flex items-center justify-center backdrop-blur-xl transition-all duration-300 shadow-md"
          style={{
            height: "44px",
            backgroundColor: currentTheme.glass,
            borderColor: currentTheme.border,
            boxShadow: `0 8px 24px -4px ${currentTheme.shadow || "rgba(0,0,0,0.15)"}`,
            borderRadius: "9999px",
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={15} style={{ color: currentTheme.accent }} />
            <span
              className="font-zain-xbold text-sm tracking-wide leading-none pt-0.5 select-none"
              style={{ color: currentTheme.text }}
            >
              دار الحكايات AI
            </span>
          </div>
        </div>

        {/* Left Side: Circular Action Buttons (New Chat & Close Button) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={startNewConversation}
              className="border flex items-center justify-center backdrop-blur-xl transition-all duration-300 hover:scale-105 active:scale-95 group flex-shrink-0 aspect-square cursor-pointer"
              style={{
                width: "44px",
                height: "44px",
                minWidth: "44px",
                minHeight: "44px",
                backgroundColor: currentTheme.glass,
                borderColor: currentTheme.border,
                boxShadow: `0 8px 24px -4px ${currentTheme.shadow || "rgba(0,0,0,0.15)"}`,
                borderRadius: "50%",
              }}
              aria-label="محادثة جديدة"
              title="محادثة جديدة"
            >
              <MessageCirclePlus
                className="w-4.5 h-4.5 transition-transform duration-200"
                style={{ color: currentTheme.accent }}
                strokeWidth={2.2}
              />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="border flex items-center justify-center backdrop-blur-xl transition-all duration-300 hover:scale-105 active:scale-95 group flex-shrink-0 aspect-square cursor-pointer"
            style={{
              width: "44px",
              height: "44px",
              minWidth: "44px",
              minHeight: "44px",
              backgroundColor: currentTheme.glass,
              borderColor: currentTheme.border,
              boxShadow: `0 8px 24px -4px ${currentTheme.shadow || "rgba(0,0,0,0.15)"}`,
              borderRadius: "50%",
            }}
            aria-label="إغلاق"
            title="إغلاق"
          >
            <ChevronRight
              className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
              style={{ color: currentTheme.accent }}
              strokeWidth={2.5}
            />
          </button>
        </div>
      </header>

      {/* ── CONVERSATIONS DRAWER ── */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.button
              type="button"
              aria-label="إغلاق قائمة المحادثات"
              className="fixed inset-0 z-[55] bg-black/30 backdrop-blur-xs cursor-default"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
            />
            <motion.aside
              dir="rtl"
              className="fixed inset-y-0 right-0 left-auto z-[60] flex w-[min(300px,calc(100vw-16px))] flex-col overflow-hidden rounded-l-[28px] border-l shadow-2xl backdrop-blur-2xl"
              style={{
                backgroundColor: currentTheme.glass,
                borderColor: currentTheme.border,
                color: currentTheme.text,
              }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              <div
                className="flex h-12 shrink-0 items-center justify-between border-b px-4"
                style={{ borderColor: currentTheme.border }}
              >
                <div className="flex items-center gap-1.5 select-none">
                  <Sparkles size={14} style={{ color: currentTheme.accent }} />
                  <span
                    className="font-zain-xbold text-xs tracking-wide"
                    style={{ color: currentTheme.text }}
                  >
                    المحادثات المحفوظة
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  style={{ color: currentTheme.secondary }}
                  aria-label="إغلاق"
                >
                  <X size={15} />
                </button>
              </div>

              <button
                type="button"
                onClick={startNewConversation}
                className="mx-3 mt-3 flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-xs font-zain-bold shadow-sm transition-all hover:opacity-90 active:scale-95 text-white cursor-pointer"
                style={{ backgroundColor: currentTheme.accent }}
              >
                <MessageCirclePlus size={15} />
                <span>محادثة جديدة</span>
              </button>

              <div className="flex-1 overflow-y-auto px-3 pb-4 pt-3 hide-scrollbar">
                {isConversationsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-xs font-zain-bold">
                    <span
                      className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: currentTheme.accent, borderTopColor: "transparent" }}
                    />
                    <span style={{ color: currentTheme.secondary }}>
                      جارٍ تحميل المحادثات...
                    </span>
                  </div>
                ) : conversations.length === 0 ? (
                  <div
                    className="px-4 py-10 text-center text-xs font-zain-bold leading-6"
                    style={{ color: currentTheme.secondary }}
                  >
                    لا توجد محادثات محفوظة بعد.
                    <br />
                    ابدأي سؤالًا جديدًا وستظهر هنا.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className="group relative flex items-center gap-1 rounded-[18px] border px-2.5 py-2 transition-all"
                        style={{
                          backgroundColor:
                            conversation.id === activeConversationId
                              ? currentTheme.isDark
                                ? "rgba(255,255,255,0.08)"
                                : `${currentTheme.accent}15`
                              : "transparent",
                          borderColor:
                            conversation.id === activeConversationId
                              ? currentTheme.accent
                              : "transparent",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => openConversation(conversation.id)}
                          className="min-w-0 flex-1 text-right cursor-pointer"
                        >
                          <span
                            className="flex items-center gap-1.5 truncate text-xs font-zain-bold"
                            style={{ color: currentTheme.text }}
                          >
                            {conversation.pinnedAt && (
                              <Pin
                                size={11}
                                className="shrink-0"
                                style={{ color: currentTheme.accent }}
                                aria-label="مثبتة"
                              />
                            )}
                            <span className="truncate">
                              {conversation.title}
                            </span>
                          </span>
                          <span
                            className="mt-0.5 block text-[10px] font-zain-reg"
                            style={{ color: currentTheme.secondary }}
                          >
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
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                          style={{
                            color: conversation.pinnedAt
                              ? currentTheme.accent
                              : currentTheme.secondary,
                          }}
                          aria-label={`إجراءات ${conversation.title}`}
                          title="إجراءات المحادثة"
                        >
                          {conversation.pinnedAt ? (
                            <Pin size={13} fill="currentColor" />
                          ) : (
                            <MoreVertical size={14} />
                          )}
                        </button>
                        <AnimatePresence>
                          {openConversationMenuId === conversation.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.96, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.96, y: -4 }}
                              transition={{ duration: 0.12 }}
                              className="!absolute left-2 top-10 z-[70] w-[170px] rounded-[18px] shadow-xl overflow-hidden p-1.5 border backdrop-blur-2xl"
                              style={{
                                backgroundColor: currentTheme.glass,
                                borderColor: currentTheme.border,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  handleShareConversation(conversation)
                                }
                                className="flex h-8 w-full items-center gap-2 rounded-[12px] px-2.5 text-right text-xs font-zain-bold transition hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                                style={{ color: currentTheme.text }}
                              >
                                <Share2 size={13} style={{ color: currentTheme.accent }} />
                                <span>مشاركة المحادثة</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handlePinConversation(conversation)
                                }
                                className="flex h-8 w-full items-center gap-2 rounded-[12px] px-2.5 text-right text-xs font-zain-bold transition hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                                style={{ color: currentTheme.text }}
                              >
                                <Pin
                                  size={13}
                                  style={{ color: currentTheme.accent }}
                                  fill={conversation.pinnedAt ? "currentColor" : "none"}
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
                                className="flex h-8 w-full items-center gap-2 rounded-[12px] px-2.5 text-right text-xs font-zain-bold transition hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                                style={{ color: currentTheme.text }}
                              >
                                <Pencil size={13} style={{ color: currentTheme.accent }} />
                                <span>إعادة التسمية</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenConversationMenuId(null);
                                  setDeleteTarget(conversation);
                                }}
                                className="flex h-8 w-full items-center gap-2 rounded-[12px] px-2.5 text-right text-xs font-zain-bold transition hover:bg-red-500/10 cursor-pointer text-red-500"
                              >
                                <Trash2 size={13} />
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
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-5 backdrop-blur-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              dir="rtl"
              className="w-full max-w-[340px] rounded-[24px] p-5 border shadow-2xl backdrop-blur-2xl"
              style={{
                backgroundColor: currentTheme.glass,
                borderColor: currentTheme.border,
                color: currentTheme.text,
              }}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-zain-xbold" style={{ color: currentTheme.text }}>
                    تم نسخ نص المحادثة
                  </p>
                  <p className="mt-1 text-xs font-zain-reg" style={{ color: currentTheme.secondary }}>
                    تم نسخ كامل مجريات الحوار الأدبي للحافظة بنجاح.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShareResult(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  style={{ color: currentTheme.secondary }}
                  aria-label="إغلاق"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShareResult(null)}
                  className="h-9 flex-1 rounded-full text-xs font-zain-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
                  style={{ backgroundColor: currentTheme.accent }}
                >
                  تم
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {renameTarget && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-5 backdrop-blur-xs"
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
              className="w-full max-w-[340px] rounded-[24px] p-5 border shadow-2xl backdrop-blur-2xl"
              style={{
                backgroundColor: currentTheme.glass,
                borderColor: currentTheme.border,
                color: currentTheme.text,
              }}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
            >
              <p className="text-sm font-zain-xbold" style={{ color: currentTheme.text }}>
                إعادة تسمية المحادثة
              </p>
              <input
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                maxLength={160}
                className="mt-3.5 h-10 w-full rounded-[16px] px-3.5 text-right text-xs font-zain-bold outline-none border transition-colors"
                style={{
                  backgroundColor: currentTheme.isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)",
                  borderColor: currentTheme.border,
                  color: currentTheme.text,
                }}
                aria-label="اسم المحادثة الجديد"
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRenameTarget(null)}
                  className="h-9 flex-1 rounded-full border text-xs font-zain-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  style={{
                    borderColor: currentTheme.border,
                    color: currentTheme.secondary,
                  }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!renameValue.trim() || actionLoading}
                  className="h-9 flex-1 rounded-full text-xs font-zain-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: currentTheme.accent }}
                >
                  حفظ
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}

        {deleteTarget && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-5 backdrop-blur-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              dir="rtl"
              className="w-full max-w-[340px] rounded-[24px] p-5 border shadow-2xl backdrop-blur-2xl"
              style={{
                backgroundColor: currentTheme.glass,
                borderColor: currentTheme.border,
                color: currentTheme.text,
              }}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-500 shadow-xs">
                  <Trash2 size={16} />
                </div>
                <div>
                  <p className="text-sm font-zain-xbold" style={{ color: currentTheme.text }}>
                    حذف المحادثة نهائيًا؟
                  </p>
                  <p className="mt-1 text-xs font-zain-reg leading-5" style={{ color: currentTheme.secondary }}>
                    سيتم حذف المحادثة وجميع رسائلها نهائيًا. لا يمكن التراجع عن هذا الإجراء.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={actionLoading}
                  className="h-9 flex-1 rounded-full border text-xs font-zain-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  style={{
                    borderColor: currentTheme.border,
                    color: currentTheme.secondary,
                  }}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteConversation(deleteTarget.id)}
                  disabled={actionLoading}
                  className="h-9 flex-1 rounded-full bg-red-600 text-xs font-zain-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs"
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
            className="fixed bottom-16 left-4 right-4 z-[120] mx-auto max-w-xs rounded-full border px-4 py-2 text-center text-xs font-zain-bold shadow-lg backdrop-blur-2xl"
            style={{
              backgroundColor: currentTheme.glass,
              borderColor: currentTheme.border,
              color: currentTheme.text,
            }}
          >
            {storageError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top smooth fade gradient mask */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-16 transition-colors duration-300"
        style={{
          background: `linear-gradient(to bottom, ${currentTheme.bg} 0%, ${currentTheme.bg} 35%, transparent 100%)`,
        }}
        aria-hidden="true"
      />

      {/* Bottom smooth fade gradient mask */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 transition-colors duration-300"
        style={{
          background: `linear-gradient(to top, ${currentTheme.bg} 0%, ${currentTheme.bg} 40%, transparent 100%)`,
        }}
        aria-hidden="true"
      />

      {/* ── MAIN CHAT AREA / EMPTY STATE ── */}
      <div className="flex-1 min-h-0 flex flex-col relative z-10 overflow-hidden">
        {messages.length === 0 ? (
          <div className="flex-1 min-h-0 px-4 pt-28 pb-24 flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={welcomeLineIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="flex flex-col items-center justify-center text-center max-w-[340px] space-y-3"
              >
                <div
                  className="w-11 h-11 rounded-full border flex items-center justify-center shadow-xs"
                  style={{
                    backgroundColor: currentTheme.glass,
                    borderColor: currentTheme.border,
                  }}
                >
                  <Sparkles size={20} style={{ color: currentTheme.accent }} />
                </div>
                <p
                  className="text-xs font-zain-bold tracking-wide"
                  style={{ color: currentTheme.accent }}
                >
                  أهلًا بكِ، {userName}
                </p>
                <h2
                  className="text-base md:text-lg font-zain-xbold leading-snug"
                  style={{ color: currentTheme.text }}
                >
                  {welcomeLines[welcomeLineIndex].title}
                </h2>
                <p
                  className="text-xs font-zain-reg leading-relaxed px-2"
                  style={{ color: currentTheme.secondary }}
                >
                  {welcomeLines[welcomeLineIndex].subtitle}
                </p>

                {/* Quick Prompts Suggestions */}
                <div className="pt-2 flex flex-wrap gap-1.5 justify-center">
                  {[
                    "اقترح حبكة مشوقة للمشهد",
                    "صقل وتدقيق لغة السرد",
                    "تطوير حوار بين الشخصيات",
                  ].map((promptText, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSendMessage(promptText)}
                      className="px-3 py-1 rounded-full border text-[11px] font-zain-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
                      style={{
                        backgroundColor: currentTheme.glass,
                        borderColor: currentTheme.border,
                        color: currentTheme.text,
                      }}
                    >
                      {promptText}
                    </button>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          /* Active Chat Thread */
          <div
            ref={chatContainerRef}
            className="flex-1 min-h-0 overflow-y-auto px-4 pt-28 pb-32 space-y-4 scrollbar-thin hide-scrollbar overscroll-contain touch-pan-y"
          >
            {messages.map((m, idx) => {
              if (m.role === "system_ephemeral") {
                return (
                  <div key={m.id} className="w-full flex justify-center my-2 select-none animate-in fade-in slide-in-from-top-1 duration-200">
                    <div
                      className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-zain-bold border shadow-xs"
                      style={{
                        backgroundColor: currentTheme.isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(254, 243, 199, 0.8)",
                        borderColor: currentTheme.isDark ? "rgba(245, 158, 11, 0.35)" : "rgba(245, 158, 11, 0.4)",
                        color: currentTheme.isDark ? "#FBBF24" : "#92400E",
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <span>{m.content}</span>
                    </div>
                  </div>
                );
              }

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
                  editingContent.length > 180 ||
                  editingContent.split("\n").length > 4);
              const isLastAI =
                !isUser &&
                idx === lastAssistantMessageIndex &&
                m.isNew !== true &&
                m.isStreaming !== true;

              return (
                <div key={m.id} className="w-full flex flex-col">
                  <div
                    className={
                      isUser
                        ? "flex flex-col items-start w-full"
                        : "w-full"
                    }
                  >
                    {!isUser && (
                      <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-zain-bold select-none">
                        <Sparkles size={11} style={{ color: currentTheme.accent }} />
                        <span style={{ color: currentTheme.accent }}>دار الحكايات AI</span>
                      </div>
                    )}

                    {isUser ? (
                      <div className="w-full flex flex-col items-end">
                        {/* Mention Chips Above User Message Bubble */}
                        {m.mentions && m.mentions.length > 0 && (
                          <div
                            dir="rtl"
                            className="flex gap-1.5 mb-2"
                            style={{ flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "85%" }}
                          >
                            {m.mentions.map((mention) => {
                              const raw = (mention.selectedText || "").trim();
                              const words = raw.split(/\s+/).filter(Boolean);
                              const displayText = words.length <= 2 ? raw : `${words[0]} ${words[1]}...`;

                              return (
                                <button
                                  key={mention.id}
                                  type="button"
                                  onClick={() => setActiveFullTextMention(mention)}
                                  className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-zain-bold border transition-all cursor-pointer whitespace-nowrap"
                                  style={{
                                    backgroundColor: currentTheme.isDark
                                      ? "rgba(184, 138, 79, 0.18)"
                                      : `${currentTheme.accent}15`,
                                    borderColor: `${currentTheme.accent}45`,
                                    color: currentTheme.text,
                                  }}
                                  title="عرض النص المقتبس كاملاً"
                                >
                                  <span
                                    className="text-[10px] leading-none"
                                    style={{ color: currentTheme.accent }}
                                  >
                                    @
                                  </span>
                                  <span className="truncate" style={{ maxWidth: 140 }}>
                                    {displayText}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* 1. The Bubble itself (measured dynamically via UserMessageBubble) */}
                        <UserMessageBubble
                          message={m}
                          currentTheme={currentTheme}
                          isEditingThisMessage={isEditingThisMessage}
                          isEditingLongMessage={isEditingLongMessage}
                          editingContent={editingContent}
                          setEditingContent={setEditingContent}
                        />

                        {/* 3. Action Buttons Row (outside bubble to prevent stretching it) */}
                        {isEditingThisMessage ? (
                          <div
                            dir="rtl"
                            className="mt-2 flex items-center justify-end gap-2.5 px-1 text-xs font-zain-bold animate-fade-in w-full"
                          >
                            <button
                              type="button"
                              onClick={cancelEditingUserMessage}
                              className="transition-colors hover:opacity-80 cursor-pointer text-xs font-zain-bold"
                              style={{ color: currentTheme.secondary }}
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              disabled={!hasEditedContent || !editingContent.trim()}
                              onClick={confirmEditingUserMessage}
                              className={`inline-flex h-6 items-center justify-center rounded-full px-3.5 text-[11px] font-zain-bold transition-all text-white cursor-pointer ${
                                (!hasEditedContent || !editingContent.trim()) ? "opacity-40" : "hover:opacity-90"
                              }`}
                              style={{ 
                                backgroundColor: currentTheme.accent
                              }}
                            >
                               تعديل
                            </button>
                          </div>
                        ) : (
                          <div
                            dir="rtl"
                            className="mt-1.5 flex items-center justify-end gap-1.5 px-1 w-full opacity-70 hover:opacity-100 transition-opacity"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyMsgContent(m.id, m.content)
                              }
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors active:scale-90 cursor-pointer"
                              style={{
                                color:
                                  copiedResponseId === m.id
                                    ? "#10b981"
                                    : currentTheme.secondary,
                              }}
                              title="نسخ الرسالة"
                            >
                              {copiedResponseId === m.id ? (
                                <Check size={13} />
                              ) : (
                                <Copy size={13} />
                              )}
                            </button>
                            {canEditThisMessage && (
                              <button
                                type="button"
                                onClick={() => startEditingUserMessage(m)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors active:scale-90 cursor-pointer"
                                style={{ color: currentTheme.secondary }}
                                title="تعديل الرسالة"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        className="w-full text-right bg-transparent border-none shadow-none px-0 py-1"
                        style={{ color: currentTheme.text }}
                      >
                        <div>
                          {m.content.trim() === "" && m.isStreaming ? (
                            <div className="flex items-center gap-1.5 py-2 justify-start">
                              <span
                                className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.3s]"
                                style={{ backgroundColor: currentTheme.accent }}
                              />
                              <span
                                className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.15s]"
                                style={{ backgroundColor: currentTheme.accent }}
                              />
                              <span
                                className="w-2 h-2 rounded-full animate-bounce"
                                style={{ backgroundColor: currentTheme.accent }}
                              />
                            </div>
                          ) : (
                            <MarkdownRenderer
                              content={m.content}
                              animate={m.isNew && !m.isStreaming}
                              theme={currentTheme}
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
                            className="mt-3 flex w-full items-center justify-end gap-1.5 border-t pt-2 select-none"
                            style={{ borderColor: currentTheme.border }}
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
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all active:scale-90 cursor-pointer"
                              style={{
                                color:
                                  feedback[m.id] === "dislike"
                                    ? "#ef4444"
                                    : currentTheme.secondary,
                              }}
                              title="لم يعجبني"
                            >
                              <ThumbsDown
                                size={13}
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
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all active:scale-90 cursor-pointer"
                              style={{
                                color:
                                  feedback[m.id] === "like"
                                    ? currentTheme.accent
                                    : currentTheme.secondary,
                              }}
                              title="أعجبني"
                            >
                              <ThumbsUp
                                size={13}
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
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all active:scale-90 cursor-pointer"
                              style={{
                                color:
                                  copiedResponseId === m.id
                                    ? "#10b981"
                                    : currentTheme.secondary,
                              }}
                              title="نسخ الإجابة"
                            >
                              {copiedResponseId === m.id ? (
                                <Check size={13} />
                              ) : (
                                <Copy size={13} />
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
              <div className="flex justify-start w-full pr-1 py-1 pl-4">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-xs"
                  style={{
                    backgroundColor: currentTheme.glass,
                    borderColor: currentTheme.border,
                  }}
                >
                  <Sparkles
                    className="w-3.5 h-3.5 animate-pulse"
                    style={{ color: currentTheme.accent }}
                  />
                  <span
                    className="text-xs font-zain-bold thinking-shimmer"
                    style={{ color: currentTheme.accent }}
                  >
                    جارٍ التفكير وصياغة الرد...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* ── FLOATING INPUT FIELD BAR: EXACT MATCH WITH DAR AL HIKAYAT BOTTOM FLOATING CAPSULE ── */}
        <footer 
          className="absolute bottom-4 z-40 flex flex-col items-center pointer-events-none w-full"
          style={{ left: 0, padding: "0 16px" }}
        >
          {/* Attached Mention Chips Row */}
          {attachedMentions && attachedMentions.length > 0 && (
            <div
              className="w-full max-w-3xl mb-2 flex items-center gap-1.5 overflow-x-auto custom-scroll px-1 py-0.5 pointer-events-auto select-none"
              dir="rtl"
              style={{ overflowX: "auto" }}
            >
              <div className="flex items-center gap-1.5 flex-nowrap">
                {attachedMentions.map((mention) => {
                  const raw = (mention.selectedText || "").trim();
                  const words = raw.split(/\s+/).filter(Boolean);
                  const displayText = words.length <= 2 ? raw : `${words[0]} ${words[1]}...`;

                  return (
                    <div
                      key={mention.id}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-zain-bold border shadow-sm select-none shrink-0 transition-all animate-in fade-in zoom-in-95 duration-150 flex-nowrap whitespace-nowrap"
                      style={{
                        backgroundColor: currentTheme.isDark
                          ? "rgba(184, 138, 79, 0.18)"
                          : `${currentTheme.accent}15`,
                        borderColor: `${currentTheme.accent}45`,
                        color: currentTheme.text,
                        flexShrink: 0,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveFullTextMention(mention)}
                        className="flex items-center gap-1 cursor-pointer hover:underline text-right"
                        title="عرض النص المقتبس كاملاً"
                      >
                        <span
                          className="font-zain-xbold text-xs leading-none"
                          style={{ color: currentTheme.accent }}
                        >
                          @
                        </span>
                        <span className="truncate max-w-[130px] inline-block pt-0.5 leading-tight">
                          {displayText}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveMention?.(mention.id);
                        }}
                        className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 active:scale-90 cursor-pointer transition-colors"
                        style={{ color: currentTheme.secondary }}
                        title="إزالة الفقرة المستهدفة"
                      >
                        <X size={11} strokeWidth={2.5} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputValue);
            }}
            className={`pointer-events-auto w-full max-w-3xl min-h-[44px] p-1 rounded-full backdrop-blur-2xl border grid transition-all duration-300 ${
              isMultiline ? "items-end" : "items-center"
            }`}
            style={{
              gridTemplateColumns: "1fr 36px",
              gap: "4px",
              borderRadius: isMultiline ? "22px" : "9999px",
              backgroundColor: currentTheme.glass,
              borderColor: currentTheme.border,
              boxShadow: currentTheme.isDark
                ? "0 12px 32px -4px rgba(0,0,0,0.45)"
                : "0 12px 32px -4px rgba(0,0,0,0.08)",
            }}
          >
            {/* 1. المنتصف: حقل الإدخال يبدأ من الجانب الأيمن */}
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="اسأل المساعد الأدبي..."
              disabled={isLoading || editingMessageId !== null}
              rows={1}
              className={`w-full min-w-0 bg-transparent border-none outline-none px-4 py-1 text-sm font-zain-bold disabled:opacity-50 resize-none max-h-24 text-start break-words placeholder:font-zain-reg leading-normal ${
                isMultiline ? "overflow-y-auto" : "overflow-hidden"
              }`}
              style={{
                color: currentTheme.text,
                height: !inputValue ? "24px" : undefined,
              }}
            />

            {/* 3. الجانب الأيسر: زر الإرسال مقاس 36px */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              type="submit"
              disabled={!inputValue.trim() || isLoading || editingMessageId !== null}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer"
              style={{
                backgroundColor:
                  inputValue.trim() && !isLoading && editingMessageId === null
                    ? currentTheme.accent
                    : currentTheme.isDark
                    ? "rgba(255,255,255,0.06)"
                    : `${currentTheme.accent}18`,
                color:
                  inputValue.trim() && !isLoading && editingMessageId === null
                    ? "#ffffff"
                    : currentTheme.text,
                opacity:
                  inputValue.trim() && !isLoading && editingMessageId === null
                    ? 1
                    : 0.65,
              }}
              aria-label="إرسال"
              title="إرسال"
            >
              <ArrowUp size={16} strokeWidth={2.4} />
            </motion.button>
          </form>

          <div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-zain-bold select-none opacity-80">
            <span style={{ color: currentTheme.secondary }}>
              دار الحكايات AI • المساعد الأدبي للكاتبة رحمة السيد موافي
            </span>
          </div>
        </footer>

        {/* ── FULL TEXT MENTION MODAL (Mirroring Lock Dialog Style) ── */}
        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {activeFullTextMention && (
                <motion.div
                  className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setActiveFullTextMention(null)}
                >
                  <motion.div
                    className="w-full max-w-lg rounded-2xl border p-5 shadow-2xl relative"
                    style={{
                      backgroundColor: currentTheme.glass || currentTheme.bg,
                      borderColor: currentTheme.border,
                      color: currentTheme.text,
                    }}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    onClick={(e) => e.stopPropagation()}
                    dir="rtl"
                  >
                    {/* Header */}
                    <div
                      className="flex items-center justify-between pb-3.5 border-b"
                      style={{ borderColor: currentTheme.border, paddingBottom: 14 }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-zain-xbold"
                          style={{
                            backgroundColor: currentTheme.isDark
                              ? "rgba(255,255,255,0.08)"
                              : "rgba(0,0,0,0.05)",
                            color: currentTheme.accent,
                          }}
                        >
                          @
                        </div>
                        <div>
                          <h3 className="text-sm font-zain-bold">النص المقتبس بالمنشن</h3>
                          <p className="text-[11px] font-zain-reg" style={{ color: currentTheme.secondary }}>
                            المقطع المحدد بدقة من محرر دار الحكايات
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveFullTextMention(null)}
                        className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        style={{ color: currentTheme.secondary }}
                        aria-label="إغلاق"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="py-4 space-y-3" style={{ paddingTop: 16, paddingBottom: 16 }}>
                      <div
                        className="p-4 rounded-xl border text-sm font-zain leading-relaxed max-h-[280px] overflow-y-auto whitespace-pre-wrap select-text custom-scroll"
                        style={{
                          backgroundColor: currentTheme.isDark
                            ? "rgba(0,0,0,0.3)"
                            : "rgba(0,0,0,0.02)",
                          borderColor: currentTheme.border,
                          color: currentTheme.text,
                          maxHeight: 280,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {activeFullTextMention.selectedText}
                      </div>

                      <div
                        className="flex items-center justify-between text-xs font-zain px-1"
                        style={{ color: currentTheme.secondary }}
                      >
                        <span className="flex items-center gap-1">
                          <span>الفقرة:</span>
                          <code
                            className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5"
                            style={{ borderRadius: 6, paddingLeft: 6, paddingRight: 6, fontFamily: "monospace" }}
                          >
                            {activeFullTextMention.blockId}
                          </code>
                        </span>
                        <span>
                          الإحداثيات: {activeFullTextMention.startOffset} – {activeFullTextMention.endOffset}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div
                      className="flex items-center justify-end gap-2 pt-3 border-t"
                      style={{ borderColor: currentTheme.border }}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveFullTextMention(null)}
                        className="px-5 py-1.5 rounded-full text-xs font-zain-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
                        style={{ backgroundColor: currentTheme.accent }}
                      >
                        إغلاق
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}
      </div>
    </div>
  );
});

export default DarAlHikayatAIAssistant;
