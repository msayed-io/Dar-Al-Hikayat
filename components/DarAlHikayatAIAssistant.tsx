import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowUp,
  MessageCirclePlus,
  X,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  Pencil,
  ThumbsUp,
  ThumbsDown,
  Feather,
  RefreshCw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  initializeStoryAssistant,
  streamLiteraryAssistantResponse,
  type AIMessage,
  type StoryContext,
} from "../lib/ai-assistant-service";

type DarAlHikayatAIAssistantProps = {
  onClose: () => void;
  storyContext: StoryContext;
  theme: {
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
            {copied ? "Copied!" : "Copy"}
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
    <h1 className="text-[17px] font-zain-xbold text-[#2b1a10] dark:text-[#f4f1ea] mt-4 mb-2 text-right">
      {children}
    </h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-[16px] font-zain-xbold text-[#2b1a10] dark:text-[#f4f1ea] mt-4 mb-2 text-right">
      {children}
    </h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-[15px] font-zain-xbold text-[#2b1a10] dark:text-[#f4f1ea] mt-3 mb-1.5 text-right">
      {children}
    </h3>
  ),
  p: ({ children }: any) => (
    <p
      className="text-[13.5px] font-zain-bold leading-relaxed text-[#2b1a10] dark:text-[#e2dfd2] mb-2 text-right break-words whitespace-pre-wrap"
      dir="auto"
      style={{ unicodeBidi: "plaintext" }}
    >
      {children}
    </p>
  ),
  strong: ({ children }: any) => (
    <strong className="font-zain-xbold text-[#b88a4f] dark:text-[#deab65]">
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
      <ol className="list-decimal list-inside space-y-1.5 mb-3 pr-2 text-right font-zain-bold text-[13px]">
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
          className="block w-full text-[13.5px] font-zain-bold leading-relaxed text-[#2b1a10] dark:text-[#e2dfd2] text-right"
          dir="auto"
          style={{ unicodeBidi: "plaintext" }}
        >
          <span className="block whitespace-pre-wrap">{compact}</span>
        </li>
      );
    }
    return (
      <li
        className="flex items-start gap-2 text-[13.5px] font-zain-bold leading-relaxed text-[#2b1a10] dark:text-[#e2dfd2]"
        dir="auto"
        style={{ unicodeBidi: "plaintext" }}
      >
        <span className="text-[#b88a4f] mt-1 shrink-0 select-none text-[8px]">
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
      <code className="bg-[#f5ebd9] dark:bg-[#253234] border border-[#e6dccf] dark:border-[#384a4c] rounded-lg px-1.5 py-0.5 mx-0.5 font-mono text-[12.5px] text-[#2b1a10] dark:text-[#e2dfd2]">
        {children}
      </code>
    );
  },
  blockquote: ({ children }: any) => (
    <blockquote className="border-r-4 border-[#b88a4f] pr-3 my-3 italic text-[#7f6a55] dark:text-[#a09580] text-right bg-[#f7f2ea]/50 dark:bg-[#1a2324]/60 py-1 rounded-l-md font-zain-reg text-[13px]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 h-px border-0 bg-[#e6dccf] dark:bg-[#384a4c]" />,
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
    }, 30);

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

export const DarAlHikayatAIAssistant: React.FC<DarAlHikayatAIAssistantProps> = ({
  onClose,
  storyContext,
  theme,
}) => {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializingSession, setIsInitializingSession] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<Record<string, "like" | "dislike">>({});
  const [copiedResponseId, setCopiedResponseId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isMultiline, setIsMultiline] = useState(false);
  const [longMsgs, setLongMsgs] = useState<Set<string>>(new Set());
  const [expandedMsgs, setExpandedMsgs] = useState<Set<string>>(new Set());

  // ── REAL INITIALIZATION WITH GEMINI API ──
  // Reads the full story draft and produces a dynamic greeting referencing actual story details
  const initializeWithStory = useCallback(async () => {
    setIsInitializingSession(true);
    setInitError(null);
    setMessages([]);

    try {
      const dynamicWelcome = await initializeStoryAssistant(storyContext);
      const welcomeMsg: AIMessage = {
        id: "welcome-init-" + Date.now(),
        role: "assistant",
        content: dynamicWelcome,
        timestamp: new Date(),
        isNew: true,
      };
      setMessages([welcomeMsg]);
    } catch (err) {
      console.error("Failed to initialize story assistant with Gemini:", err);
      setInitError("تعذر الاتصال بالمحرر الأدبي حالياً. يرجى التأكد من الاتصال بالإنترنت.");
      // Fallback greeting referencing the actual title
      const fallbackWelcome: AIMessage = {
        id: "welcome-fallback",
        role: "assistant",
        content: `أهلاً بكِ يا أستاذة رحمة. استوعبتُ حكايتكِ **"${storyContext.title || "حكايتكِ الحالية"}"** ونصوصها المكتوبة في المحرر. كيف تحبين أن نبدأ في مراجعة الحبكة أو الصياغة الأدبية؟`,
        timestamp: new Date(),
      };
      setMessages([fallbackWelcome]);
    } finally {
      setIsInitializingSession(false);
    }
  }, [storyContext]);

  useEffect(() => {
    initializeWithStory();
  }, [initializeWithStory]);

  // Auto-resize the textarea
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

  // Auto-detect long messages
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

  // Find the last assistant message index
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

  // Copy helper
  const handleCopyMsgContent = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedResponseId(msgId);
    setTimeout(() => setCopiedResponseId(null), 2000);
  };

  // Auto scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading, isInitializingSession]);

  const handleSendMessage = async (
    text: string,
    replaceUserMessageId?: string
  ) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || isInitializingSession) return;

    const replaceIndex = replaceUserMessageId
      ? messages.findIndex(
          (m) => m.id === replaceUserMessageId && m.role === "user"
        )
      : -1;

    if (replaceUserMessageId && replaceIndex === -1) return;

    const userMsg: AIMessage = {
      id: replaceUserMessageId || Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    const historyForAI = replaceUserMessageId
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

    const aiMsgId = (Date.now() + 1).toString();
    const aiMsg: AIMessage = {
      id: aiMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, aiMsg]);

    await streamLiteraryAssistantResponse(
      historyForAI,
      trimmed,
      storyContext,
      (accumulatedText) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: accumulatedText } : m
          )
        );
      }
    );

    setMessages((prev) =>
      prev.map((m) => (m.id === aiMsgId ? { ...m, isStreaming: false } : m))
    );
    setIsLoading(false);
  };

  const startEditingUserMessage = (msg: AIMessage) => {
    if (isLoading || msg.id !== lastUserMessageId) return;
    setEditingMessageId(msg.id);
    setEditingContent(msg.content);
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

  return (
    <div
      dir="rtl"
      className="w-full h-full font-sans bg-[#ece7de] dark:bg-[#121819] relative flex flex-col overflow-hidden border-r border-[#b88a4f]/20 shadow-2xl"
      style={{ backgroundColor: theme.bg }}
    >
      {/* Background soft ambient shapes */}
      <div className="absolute top-[-20%] right-[-10%] w-[260px] h-[260px] bg-[#b88a4f]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[220px] h-[220px] bg-[#deab65]/10 rounded-full blur-[90px] pointer-events-none" />

      {/* ── FLOATING TOP HEADER (MODIFIED: Drawer Capsule Removed entirely) ── */}
      <div
        className="h-14 px-4 border-b flex items-center justify-between z-30 shrink-0 backdrop-blur-xl transition-all"
        style={{ borderColor: theme.border, backgroundColor: theme.glass }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center border shadow-xs"
            style={{
              backgroundColor: `${theme.accent}18`,
              borderColor: `${theme.accent}35`,
              color: theme.accent,
            }}
          >
            <Feather size={16} strokeWidth={2.2} />
          </div>
          <div>
            <span className="text-[14.5px] font-zain-xbold block leading-tight text-[#2b1a10] dark:text-[#f4f1ea]">
              المساعد الأدبي
            </span>
            <span className="text-[10px] font-zain-bold opacity-75 block text-[#b88a4f]">
              الاستوديو الأدبي للكاتبة رحمة السيد موافي
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={initializeWithStory}
            disabled={isLoading || isInitializingSession}
            className="w-8 h-8 rounded-full border flex items-center justify-center text-[#7f6a55] dark:text-[#a09580] hover:text-[#b88a4f] hover:border-[#b88a4f]/40 hover:bg-white/50 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            title="بدء جلسة جديدة وقراءة النص مجدداً"
          >
            <MessageCirclePlus size={16} strokeWidth={2.1} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border flex items-center justify-center text-[#2b1a10] dark:text-[#f4f1ea] hover:text-[#b88a4f] hover:border-[#b88a4f]/40 hover:bg-white/50 active:scale-95 transition-all cursor-pointer"
            title="إغلاق المساعد الأدبي"
            aria-label="إغلاق"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* ── REAL LOADING BANNER WHILE READING STORY ── */}
      <AnimatePresence>
        {isInitializingSession && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2.5 border-b bg-[#f5ebd9] dark:bg-[#1b2425] flex items-center justify-center gap-2.5 text-xs font-zain-bold text-[#b88a4f] shrink-0"
            style={{ borderColor: theme.border }}
          >
            <RefreshCw size={14} className="animate-spin" />
            <span>جارٍ قراءة الحكاية واستيعاب الحبكة والأحداث...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN CHAT AREA ── */}
      <div className="flex-1 flex flex-col justify-between relative z-10 overflow-hidden">
        {/* Active Chat Thread */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-4 pt-4 pb-32 space-y-4 custom-scroll"
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
                    <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-zain-xbold text-[#b88a4f] select-none">
                      <Feather size={12} />
                      <span>المحرر الأدبي</span>
                    </div>
                  )}

                  {isUser ? (
                    <>
                      <div className="relative text-right bg-gradient-to-br from-[#2b1a10] to-[#3f281a] text-[#fff9f1] border border-[#2b1a10]/20 rounded-[24px] rounded-tl-sm shadow-md transition-all duration-300 overflow-hidden">
                        {isEditingThisMessage ? (
                          <textarea
                            autoFocus
                            rows={isEditingLongMessage ? 7 : 3}
                            value={editingContent}
                            onChange={(event) =>
                              setEditingContent(event.target.value)
                            }
                            aria-label="تعديل الرسالة"
                            className={`w-full resize-none bg-transparent p-3.5 text-right text-[13px] font-zain-bold leading-relaxed text-[#fff9f1] outline-none placeholder:text-white/50 ${
                              isEditingLongMessage
                                ? "min-h-[150px] max-h-[180px] overflow-y-auto"
                                : "min-h-[90px] max-h-[130px] overflow-y-auto"
                            }`}
                          />
                        ) : (
                          <>
                            <div
                              className={`p-3.5 transition-all duration-300 ease-in-out ${
                                longMsgs.has(m.id) && !expandedMsgs.has(m.id)
                                  ? "max-h-[105px] overflow-hidden relative"
                                  : "max-h-none"
                              }`}
                            >
                              <p className="font-zain-bold text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                                {m.content}
                              </p>
                              {longMsgs.has(m.id) &&
                                !expandedMsgs.has(m.id) && (
                                  <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#2b1a10] to-transparent pointer-events-none rounded-b-[24px]" />
                                )}
                            </div>
                            {longMsgs.has(m.id) && (
                              <div
                                className={`flex items-center justify-start ${!expandedMsgs.has(m.id) ? "absolute bottom-2 left-2 z-10" : "px-3.5 pb-2.5 pt-0"}`}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(m.id)}
                                  className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 border border-white/25 flex items-center justify-center text-white cursor-pointer transition-all active:scale-90 shadow-xs"
                                  title={
                                    expandedMsgs.has(m.id)
                                      ? "طي النص"
                                      : "توسيع النص"
                                  }
                                >
                                  {expandedMsgs.has(m.id) ? (
                                    <ChevronUp size={13} />
                                  ) : (
                                    <ChevronDown size={13} />
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
                          className="mt-2 flex items-center justify-start gap-3 px-1 text-[11px] font-zain-bold"
                        >
                          <button
                            type="button"
                            disabled={
                              !hasEditedContent || !editingContent.trim()
                            }
                            onClick={confirmEditingUserMessage}
                            className={`inline-flex h-6 items-center justify-center rounded-full px-3 text-[11px] font-zain-bold transition-all ${
                              hasEditedContent && editingContent.trim()
                                ? "bg-[#b88a4f] text-[#fff9f1] shadow-xs hover:bg-[#a0753e] active:scale-95 cursor-pointer"
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
                          className="mt-1.5 flex items-center justify-start gap-1"
                        >
                          {canEditThisMessage && (
                            <button
                              type="button"
                              onClick={() => startEditingUserMessage(m)}
                              className="inline-flex h-6 w-6 items-center justify-center text-[#7f6a55] dark:text-[#a09580] transition-colors hover:text-[#b88a4f] active:scale-90 cursor-pointer"
                              title="تعديل الرسالة"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyMsgContent(m.id, m.content)
                            }
                            className={`inline-flex h-6 w-6 items-center justify-center text-[#7f6a55] dark:text-[#a09580] transition-colors hover:text-[#b88a4f] active:scale-90 cursor-pointer ${
                              copiedResponseId === m.id
                                ? "text-emerald-600"
                                : ""
                            }`}
                            title="نسخ الرسالة"
                          >
                            {copiedResponseId === m.id ? (
                              <Check size={12} />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full text-right bg-[#fdfcfb]/80 dark:bg-[#182122]/80 border border-[#e6dccf] dark:border-[#2e3c3e] rounded-[24px] rounded-tr-sm p-4 shadow-xs text-[#2b1a10] dark:text-[#f4f1ea]">
                      <div>
                        {m.content.trim() === "" && m.isStreaming ? (
                          <div className="flex items-center gap-1.5 py-2 justify-start">
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

                      {/* Action buttons for assistant response */}
                      {isLastAI && (
                        <div
                          dir="ltr"
                          className="mt-3 flex w-full items-center justify-end gap-1.5 border-t border-[#e6dccf]/60 dark:border-[#334446] pt-2 text-[#7f6a55] dark:text-[#a09580] select-none"
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
                            className={`inline-flex h-6 w-6 items-center justify-center text-[#7f6a55] dark:text-[#a09580] transition-all hover:text-red-500 active:scale-90 cursor-pointer ${
                              feedback[m.id] === "dislike"
                                ? "text-red-600"
                                : ""
                            }`}
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
                            className={`inline-flex h-6 w-6 items-center justify-center text-[#7f6a55] dark:text-[#a09580] transition-all hover:text-[#b88a4f] active:scale-90 cursor-pointer ${
                              feedback[m.id] === "like"
                                ? "text-[#b88a4f]"
                                : ""
                            }`}
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
                            className={`inline-flex h-6 w-6 items-center justify-center text-[#7f6a55] dark:text-[#a09580] transition-all hover:text-[#b88a4f] active:scale-90 cursor-pointer ${
                              copiedResponseId === m.id
                                ? "text-emerald-600"
                                : ""
                            }`}
                            title="نسخ الإجابة"
                          >
                            {copiedResponseId === m.id ? (
                              <Check size={13} className="text-emerald-600" />
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
            <div className="flex justify-start w-full pr-1 py-2">
              <div className="relative inline-flex items-center gap-2 text-xs font-zain-bold text-[#b88a4f]">
                <Feather size={16} className="animate-spin" />
                <span>يتأمّل النص ويصيغ الرأي الأدبي...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── BACKGROUND UNDER INPUT BAR ── */}
        <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none h-24 bg-gradient-to-t from-[#ece7de] dark:from-[#121819] via-[#ece7de]/80 dark:via-[#121819]/80 to-transparent" />

        {/* ── FLOATING INPUT FIELD BAR (Strictly NO religious text below as requested) ── */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center pointer-events-none px-4 pb-3">
          <div className="w-full pointer-events-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputValue);
              }}
              className="flex items-end gap-2 p-1.5 transition-shadow duration-300"
              style={{
                borderRadius: isMultiline ? "20px" : "9999px",
                overflow: "hidden",
                background:
                  "linear-gradient(180deg, rgba(253,252,251,0.85) 0%, rgba(244,240,234,0.75) 100%)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid rgba(184,138,79,0.25)",
                boxShadow: "0 12px 28px -8px rgba(43,26,16,0.12)",
                transition: "border-radius 0.3s ease",
              }}
            >
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="اكتبي استفساركِ أو طلبكِ الأدبي هنا..."
                disabled={
                  isLoading ||
                  isInitializingSession ||
                  editingMessageId !== null
                }
                rows={1}
                className="flex-1 min-h-[38px] text-right bg-transparent border-none outline-none px-3 py-2 text-[13px] font-zain-bold text-[#2b1a10] placeholder-[#7f6a55]/60 disabled:opacity-50 resize-none max-h-[130px] overflow-y-auto leading-relaxed break-words"
              />

              <motion.button
                whileTap={{ scale: 0.9 }}
                type="submit"
                disabled={
                  !inputValue.trim() ||
                  isLoading ||
                  isInitializingSession ||
                  editingMessageId !== null
                }
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                  inputValue.trim() &&
                  !isLoading &&
                  !isInitializingSession &&
                  editingMessageId === null
                    ? "bg-[#b88a4f] text-[#fff9f1] shadow-xs hover:bg-[#a0753e] active:scale-90 cursor-pointer"
                    : "bg-[#e8dfd4]/60 text-[#7f6a55]/40 cursor-not-allowed"
                }`}
                aria-label="إرسال"
                title="إرسال"
              >
                <ArrowUp size={15} strokeWidth={2.5} />
              </motion.button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DarAlHikayatAIAssistant;
