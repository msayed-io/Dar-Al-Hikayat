import { detectAnalysisCalls, isAnalysisTool, formatAnalysisReports, recoverInterruptedAnalysis, type AnalysisReport } from "../lib/literary-analysis";
import { GroundedSearchSuggestions } from "./GroundedSearchSuggestions";
import ThinkingIndicator from "./ThinkingIndicator";
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowUp,
  ChevronRight,
  ChevronLeft,
  MessageCirclePlus,
  PanelLeftOpen,
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  Pencil,
  SquarePen,
  ThumbsUp,
  ThumbsDown,
  MoreVertical,
  Pin,
  Share2,
  Sparkles,
  AlertCircle,
  Plus,
  Zap,
  Undo2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useApp } from "../contexts/AppContext";
import {
  streamLiteraryAssistantResponse,
  generateAgentCompletionSummary,
  generateDefaultAgentIntro,
  generateDefaultAgentSummary,
  type StoryContext,
} from "../lib/ai-assistant-service";
import {
  AttachedMention,
  validateAndHealMentions,
  formatMentionsForPrompt,
} from "../lib/editor-block-system";
import {
  isExplicitEditIntent,
  formatExecutiveContextForAI,
  executeAgentPlan,
  askExecutiveAgentForDecision,
  type AgentStepItem,
  type ExecutiveToolCall,
  type PendingAgentRequest,
} from "../lib/literary-agent";
import { cancelDiacritizeJob, undoDiacritizeJob } from "../lib/tashkeel-pipeline";

export type Message = {
  analysisReports?: AnalysisReport[];
  id: string;
  role: "user" | "assistant" | "system_ephemeral" | "agent_steps";
  content: string;
  thought?: string;
  rawParts?: any[];
  thinkingDuration?: number;
  timestamp: Date;
  isNew?: boolean;
  isStreaming?: boolean;
  isAgent?: boolean;
  mentions?: AttachedMention[];
  ephemeral?: boolean;
  steps?: AgentStepItem[];
  agentResult?: {
    totalMutations: number;
    completed: boolean;
    failed?: boolean;
    error?: string;
  };
  diacritizeJobId?: string;
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
  storyId?: number | string | null;
  attachedMentions?: AttachedMention[];
  onRemoveMention?: (id: string) => void;
  onClearMentions?: () => void;
  editorRootElement?: HTMLElement | null;
  onCommitAgentChanges?: () => void;
  isNovelMode?: boolean;
  chapters?: Array<{ id: string; title: string; content: string }>;
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

/**
 * Minimalist two-lines horizontal menu icon (identical to uploaded design asset)
 */
export const TwoLinesMenuIcon = ({ size = 18, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="shrink-0"
  >
    <path
      d="M5 9.5H19M5 14.5H19"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type WelcomeLine = {
  title: string;
  subtitle: string;
};

const welcomeLines: WelcomeLine[] = [
  { title: "كيف نطوّر الحكاية اليوم؟", subtitle: "أنا هنا لمعاونتكِ خطوة بخطوة في صقل السرد وبناء المشاهد." },
  { title: "أيّ حكاية نمنحها الحياة اليوم؟", subtitle: "من بذرة الفكرة إلى تفاصيل المشهد، نرافق حكايتكِ بعناية." },
  { title: "أيّ شخصية نقترب من عالمها اليوم؟", subtitle: "نستكشف دوافع شخصياتكِ وأصواتها، مع الحفاظ على رؤيتكِ." },
  { title: "أيّ مشهد نُضيء تفاصيله اليوم؟", subtitle: "نعتني بالإيقاع والصورة والحوار، ليصل إحساسكِ إلى القارئ." },
  { title: "إلى أين يأخذنا خيالكِ اليوم؟", subtitle: "مساحة هادئة لتجربة الأفكار ونسج الاحتمالات على مهل." },
  { title: "أيّ سطر نصقله معًا اليوم؟", subtitle: "نراجع اللغة ونوازن الإيقاع، ويبقى للنص صوتكِ الخاص." },
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

export function getStoryConversationsStorageKey(
  storyId: number | string | null | undefined,
  draftSessionId?: string
): string {
  if (storyId !== undefined && storyId !== null && String(storyId).trim() !== "") {
    return `dar_alhikayat_ai_convs_story_${storyId}`;
  }
  return `dar_alhikayat_ai_convs_draft_${draftSessionId || "session"}`;
}

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

  // Determine appropriate text color for content displayed on currentTheme.accent
  const accentTextColor =
    currentTheme.mode === "apple_dark" ? "#000000" : (currentTheme.bg || "#ffffff");

  return (
    <div
      className={`w-fit min-w-[240px] max-w-[85%] text-right border shadow-sm transition-all duration-300 overflow-hidden relative ${borderRadiusClass}`}
      style={{
        backgroundColor: currentTheme.accent,
        borderColor: currentTheme.accent,
        color: accentTextColor,
      }}
    >
      {isEditingThisMessage ? (
        <textarea
          autoFocus
          rows={isEditingLongMessage ? 7 : 3}
          value={editingContent}
          onChange={(event) => setEditingContent(event.target.value)}
          aria-label="تعديل رسالة المستخدم"
          className="w-full min-w-[240px] resize-none bg-transparent px-5 py-3.5 text-right text-xs font-zain-bold leading-relaxed outline-none"
          style={{
            color: accentTextColor,
          }}
        />
      ) : (
        <div className={`w-full px-5 py-3.5 relative ${isOverTwoLines ? "pb-9" : ""}`}>
          <p
            className="text-[14px] font-zain-bold leading-[23px] whitespace-pre-wrap break-words transition-all duration-300"
            style={{
              color: accentTextColor,
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

interface AgentStepsMessageCardProps {
  key?: React.Key;
  message: Message;
  theme: any;
}

function AgentStepsMessageCard({ message, theme }: AgentStepsMessageCardProps) {
  const steps = message.steps || [];
  const result = message.agentResult;
  const isExecuting = !result?.completed && !result?.failed;
  const hasActiveDiacritize = isExecuting && steps.some((s) => s.toolName === "diacritize_scope" && (s.status === "active" || s.status === "waiting"));
  const checkboxId = `agent-tree-toggle-${message.id}`;

  const stepCount = steps.length || 1;
  const stepCountLabel = steps.length > 0 && steps.every(s => isAnalysisTool(s.toolName))
    ? `${stepCount} فحص للقراءة فقط`
    : stepCount === 1
      ? "خطوة جراحية واحدة"
      : stepCount === 2
      ? "خطوتين جراحيتين"
      : stepCount <= 10
      ? `${stepCount} خطوات جراحية`
      : `${stepCount} خطوة جراحية`;

  const headerLabel = isExecuting
    ? `جارٍ تنفيذ ${stepCountLabel}...`
    : result?.completed
    ? `تم تنفيذ ${stepCountLabel}`
    : result?.failed
    ? `تعذر تنفيذ ${stepCountLabel}`
    : `تنفيذ ${stepCountLabel}`;

  // Two background layers: Moving specular beam + Luxurious metallic base
  const shimmerBeam =
    "linear-gradient(110deg, transparent 28%, rgba(255, 255, 255, 0.98) 50%, transparent 72%)";
  const metallicBase = theme.isDark
    ? "linear-gradient(90deg, #9ca3af 0%, #f3f4f6 50%, #9ca3af 100%)"
    : "linear-gradient(90deg, #4b5563 0%, #111827 50%, #4b5563 100%)";

  const treeStrokeColor = theme.isDark
    ? "rgba(255, 255, 255, 0.22)"
    : "rgba(0, 0, 0, 0.22)";

  // Geometry for the curved branch line in RTL
  const isRtl = true;
  const stemX = 11;
  const curveEndX = 2;

  return (
    <div dir="rtl" className="w-full my-1.5 select-none text-start relative">
      {/* Pure CSS Hidden Checkbox Controller: collapsed by default */}
      <input
        type="checkbox"
        id={checkboxId}
        defaultChecked={false}
        className="agent-tree-checkbox"
        aria-label="تبديل عرض مسار الخطوات"
      />

      {/* 1. Header Trigger Line (Pure CSS label) */}
      <label
        htmlFor={checkboxId}
        className="cursor-pointer py-1 px-1 rounded-md transition-opacity hover:opacity-90 group select-none"
        title="عرض / طي تفاصيل الخطوات"
        style={{
          display: "inline-flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "8px",
          whiteSpace: "nowrap",
          width: "auto",
        }}
      >
        <Zap
          size={14}
          strokeWidth={1.8}
          className={`shrink-0 ${
            isExecuting ? "text-amber-400 animate-pulse" : ""
          }`}
          style={{
            display: "inline-block",
            color: isExecuting
              ? theme.accent
              : theme.isDark
              ? "#d1d5db"
              : "#4b5563",
          }}
        />

        {/* Shimmering Text with 2 layers (Metallic Base + Moving Specular Beam) */}
        <span
          className="agent-text-shimmer text-xs font-zain-bold tracking-wide select-none"
          style={{
            display: "inline-block",
            whiteSpace: "nowrap",
            backgroundImage: `${shimmerBeam}, ${metallicBase}`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
          }}
        >
          {headerLabel}
        </span>

        {/* Pure CSS rotating chevron via .agent-tree-chevron */}
        <ChevronDown
          size={13}
          strokeWidth={2.2}
          className="shrink-0 agent-tree-chevron"
          style={{
            display: "inline-block",
            color: theme.isDark ? "#9ca3af" : "#6b7280",
            opacity: 0.75,
          }}
        />
      </label>

      {/* 2. Expanded Tree View (Pure CSS grid-template-rows: 0fr → 1fr) */}
      <div className="agent-tree-toggle mt-0.5">
        <div className="agent-tree-inner">
          <div className="flex flex-col py-0.5">
              {/* Step items */}
              {steps.map((step, idx) => {
                const isStepDone = step.status === "completed";
                const isStepActive = step.status === "active";
                const isStepFailed = step.status === "failed";

                return (
                  <div
                    key={step.id || idx}
                    className="flex items-center h-7 relative"
                  >
                    {/* SVG Curved Branch Connector (Aligned under the Zap icon) */}
                    <div className="w-5 h-7 shrink-0 relative flex items-center justify-center">
                      <svg
                        className="w-5 h-7 absolute inset-0 pointer-events-none"
                        viewBox="0 0 20 28"
                        fill="none"
                      >
                        {/* Stem curves into row branch */}
                        <path
                          d={`M ${stemX} 0 L ${stemX} 5 Q ${stemX} 14 ${curveEndX} 14`}
                          stroke={treeStrokeColor}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Trunk continues straight down to next item */}
                        <path
                          d={`M ${stemX} 5 L ${stemX} 28`}
                          stroke={treeStrokeColor}
                          strokeWidth="1.5"
                        />
                      </svg>
                    </div>

                    {/* Step Content: Bullet Dot + Step Note */}
                    <div className="flex items-center gap-2 pr-1 min-w-0 flex-1">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 transition-transform ${
                          isStepActive ? "animate-ping" : ""
                        }`}
                        style={{
                          backgroundColor: isStepActive
                            ? theme.accent
                            : isStepFailed
                            ? "#ef4444"
                            : theme.isDark
                            ? "rgba(255, 255, 255, 0.5)"
                            : "rgba(0, 0, 0, 0.45)",
                        }}
                      />
                      <span
                        className={`text-[12px] font-zain-bold leading-normal truncate ${
                          isStepDone ? "opacity-75" : ""
                        }`}
                        style={{
                          color: isStepActive
                            ? theme.accent
                            : isStepFailed
                            ? "#ef4444"
                            : theme.text,
                        }}
                        title={step.stepNote}
                      >
                        {step.stepNote}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Terminal Row: Terminal Branch (Done / Executing / Failed) */}
              <div className="flex items-center h-7 relative">
                {/* Terminal SVG Curve (Stops and does not continue downwards) */}
                <div className="w-5 h-7 shrink-0 relative flex items-center justify-center">
                  <svg
                    className="w-5 h-7 absolute inset-0 pointer-events-none"
                    viewBox="0 0 20 28"
                    fill="none"
                  >
                    <path
                      d={`M ${stemX} 0 L ${stemX} 5 Q ${stemX} 14 ${curveEndX} 14`}
                      stroke={treeStrokeColor}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {/* Final status indicator */}
                <div className="flex items-center gap-1.5 pr-1 min-w-0 flex-1">
                  {result?.completed ? (
                    <div className="flex items-center gap-1.5 text-[12px] font-zain-bold text-emerald-500">
                      <Check size={13} strokeWidth={2.5} className="shrink-0" />
                      <span>مكتمل</span>
                      <span className="text-[10px] font-sans opacity-60 font-zain-reg">
                        (Done)
                      </span>
                    </div>
                  ) : result?.failed ? (
                    <div className="flex items-center gap-1.5 text-[12px] font-zain-bold text-rose-500">
                      <AlertCircle size={13} strokeWidth={2} className="shrink-0" />
                      <span>تعذر الإكمال</span>
                      {result.error && (
                        <span className="text-[11px] font-zain-reg opacity-80 truncate">
                          ({result.error})
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between w-full text-[12px] font-zain-bold"
                      style={{ color: theme.accent }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
                        <span>جارٍ التنفيذ...</span>
                      </div>
                      {hasActiveDiacritize && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            cancelDiacritizeJob();
                          }}
                          className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10.5px] font-zain-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white transition-all shadow-xs cursor-pointer select-none border border-rose-700/50"
                          title="إلغاء خط إنتاج الضبط والتراجع الفوري عن أي تغييرات"
                        >
                          <X size={11} strokeWidth={2.5} />
                          <span>إلغاء الضبط</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

export const getStoryStorageKey = (id?: number | string | null): string => {
  if (id !== undefined && id !== null && String(id).trim() !== "") {
    return `dar_alhikayat_ai_convs_story_${id}`;
  }
  return "dar_alhikayat_ai_convs_draft";
};

export const loadStoredConversationsFromStorage = (storageKey: string): StoredConversation[] => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => ({
        ...item,
        lastMessageAt: new Date(item.lastMessageAt),
        pinnedAt: item.pinnedAt ? new Date(item.pinnedAt) : null,
        messages: (item.messages || []).map((m: any) => recoverInterruptedAnalysis({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
      }));
    }
  } catch (e) {
    console.error("Failed to parse stored conversations for key:", storageKey, e);
  }
  return [];
};

export const saveStoredConversationsToStorage = (storageKey: string, list: StoredConversation[]) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(list));
  } catch (e) {
    console.error("Failed to save conversations to storage:", storageKey, e);
  }
};

export const DarAlHikayatAIAssistant = React.memo(function DarAlHikayatAIAssistant({
  onClose,
  storyContext,
  storyId,
  attachedMentions = [],
  onRemoveMention,
  onClearMentions,
  editorRootElement,
  onCommitAgentChanges,
  isNovelMode,
  chapters,
  theme: propTheme,
}: DarAlHikayatAIAssistantProps) {
  const { currentTheme: appContextTheme } = useApp();
  const currentTheme = propTheme || appContextTheme;
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingAgentRequest, setPendingAgentRequest] = useState<PendingAgentRequest | null>(null);
  const [isAgentExecuting, setIsAgentExecuting] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const analysisRunRef = useRef<{ controller: AbortController; story: typeof storyId } | null>(null);
  const analysisStoryRef = useRef(storyId);
  analysisStoryRef.current = storyId;
  useEffect(() => {
    if (analysisRunRef.current && analysisRunRef.current.story !== storyId) {
      analysisRunRef.current.controller.abort(); analysisRunRef.current = null;
      setIsLoading(false); setIsAgentExecuting(false);
    }
  }, [storyId]);
  useEffect(() => () => { analysisRunRef.current?.controller.abort(); analysisRunRef.current = null; }, []);

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
  const [welcomeLineIndex, setWelcomeLineIndex] = useState(getInitialWelcomeLineIndex);
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeFullTextMention, setActiveFullTextMention] = useState<AttachedMention | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isConversationsLoading, setIsConversationsLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [openConversationMenuId, setOpenConversationMenuId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{
    id: string;
    top: number;
    left: number;
    conversation: StoredConversation;
  } | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [renameTarget, setRenameTarget] = useState<StoredConversation | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StoredConversation | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [shareResult, setShareResult] = useState<{ conversation: StoredConversation; url: string } | null>(null);
  const [expandedThoughtIds, setExpandedThoughtIds] = useState<Record<string, boolean>>({});

  // Theme-aware, refined styling for the New Conversation button
  const newChatBtnStyle = useMemo(() => {
    if (currentTheme.mode === "apple_dark") {
      return {
        bg: "rgba(255, 255, 255, 0.08)",
        hoverBg: "rgba(255, 255, 255, 0.14)",
        border: "rgba(255, 255, 255, 0.14)",
        text: "#F5F5F5",
        iconColor: "#FFFFFF",
      };
    }
    if (currentTheme.mode === "night_whisper") {
      return {
        bg: "rgba(159, 163, 101, 0.16)",
        hoverBg: "rgba(159, 163, 101, 0.24)",
        border: "rgba(159, 163, 101, 0.32)",
        text: "#E2DFD2",
        iconColor: currentTheme.accent,
      };
    }
    return {
      bg: currentTheme.accent,
      hoverBg: currentTheme.accent,
      border: "transparent",
      text: "#FFFFFF",
      iconColor: "#FFFFFF",
    };
  }, [currentTheme.mode, currentTheme.accent]);

  // Global outside-click and Escape listener for the conversations drawer
  useEffect(() => {
    if (!isDrawerOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        setIsDrawerOpen(false);
        setOpenConversationMenuId(null);
        setMenuAnchor(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDrawerOpen(false);
        setOpenConversationMenuId(null);
        setMenuAnchor(null);
      }
    };
    window.addEventListener("mousedown", handlePointerDown, true);
    window.addEventListener("touchstart", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown, true);
      window.removeEventListener("touchstart", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawerOpen]);

  // Close floating 3-dots conversation menu on outside click
  useEffect(() => {
    if (!menuAnchor) return;
    const handleMenuClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (menuRef.current && menuRef.current.contains(target)) {
        return;
      }
      if (target.closest('button[aria-label^="إجراءات "]')) {
        return;
      }
      setMenuAnchor(null);
      setOpenConversationMenuId(null);
    };
    window.addEventListener("mousedown", handleMenuClickOutside);
    window.addEventListener("touchstart", handleMenuClickOutside);
    return () => {
      window.removeEventListener("mousedown", handleMenuClickOutside);
      window.removeEventListener("touchstart", handleMenuClickOutside);
    };
  }, [menuAnchor]);

  const toggleThought = useCallback((id: string) => {
    setExpandedThoughtIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const formatThinkingDuration = useCallback((seconds?: number) => {
    const s = Math.max(1, Math.round(seconds || 3));
    const toArabicDigits = (num: number) =>
      String(num).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d, 10)]);

    if (s < 60) {
      return `تم التفكير لمدة ${toArabicDigits(s)} ثانية`;
    }
    const mins = Math.floor(s / 60);
    const remSecs = s % 60;
    if (remSecs === 0) {
      return `تم التفكير لمدة ${toArabicDigits(mins)} دقيقة`;
    }
    return `تم التفكير لمدة ${toArabicDigits(mins)} دقيقة و ${toArabicDigits(remSecs)} ثانية`;
  }, []);

  // Per-story storage key calculation
  const currentStorageKey = useMemo(() => getStoryStorageKey(storyId), [storyId]);
  const prevStoryIdRef = useRef<number | string | null | undefined>(storyId);

  // Helper callbacks bound to current storage key
  const saveStoredConversations = useCallback(
    (list: StoredConversation[]) => {
      saveStoredConversationsToStorage(currentStorageKey, list);
    },
    [currentStorageKey]
  );

  useEffect(() => {
    try {
      localStorage.setItem("dar_alhikayat_ai_welcome_line_index", String(welcomeLineIndex));
    } catch { /* Welcome rotation still works in memory if storage is unavailable. */ }
  }, [welcomeLineIndex]);

  // Load and isolate conversations strictly per-story, handling seamless draft migration upon first save
  useEffect(() => {
    const prevId = prevStoryIdRef.current;
    prevStoryIdRef.current = storyId;

    setIsConversationsLoading(true);

    const hasNewValidId = storyId !== undefined && storyId !== null && String(storyId).trim() !== "";
    const wasUnsavedDraft = prevId === undefined || prevId === null || prevId === "";

    // Case 1: First save of a draft story - migrate draft conversations into the permanent story key
    if (wasUnsavedDraft && hasNewValidId) {
      const targetKey = getStoryStorageKey(storyId);
      const draftConvs = loadStoredConversationsFromStorage("dar_alhikayat_ai_convs_draft");
      const existingConvs = loadStoredConversationsFromStorage(targetKey);

      if (draftConvs.length > 0) {
        const combined = [...draftConvs, ...existingConvs.filter((ec) => !draftConvs.some((dc) => dc.id === ec.id))];
        saveStoredConversationsToStorage(targetKey, combined);
        try {
          localStorage.removeItem("dar_alhikayat_ai_convs_draft");
        } catch {}
        setConversations(combined);
      } else {
        setConversations(existingConvs);
      }
      setIsConversationsLoading(false);
      return;
    }

    // Case 2: Switching from one story to a completely different story
    if (prevId !== storyId) {
      setMessages([]);
      setActiveConversationId(null);
      setInputValue("");
      setEditingMessageId(null);
      setIsDrawerOpen(false);
    }

    const loaded = loadStoredConversationsFromStorage(currentStorageKey);
    setConversations(loaded);
    setIsConversationsLoading(false);
  }, [storyId, currentStorageKey]);

  // Auto-sync active conversation messages to the story's storage
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
    if (analysisRunRef.current) {
      analysisRunRef.current.controller.abort(); analysisRunRef.current = null;
      setIsLoading(false); setIsAgentExecuting(false);
    }
    setWelcomeLineIndex(index => (index + 1) % welcomeLines.length);
    setActiveConversationId(null);
    setMessages([]);
    setInputValue("");
    setIsDrawerOpen(false);
    setOpenConversationMenuId(null);
    setMenuAnchor(null);
    setEditingMessageId(null);
  };

  const openConversation = (conversationId: string) => {
    if (isLoading) return;
    const target = conversations.find((c) => c.id === conversationId);
    if (target) {
      setActiveConversationId(target.id);
      setMessages((target.messages || []).map(recoverInterruptedAnalysis));
      setIsDrawerOpen(false);
      setOpenConversationMenuId(null);
      setMenuAnchor(null);
      setEditingMessageId(null);
    }
  };

  const handleToggleMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    conversation: StoredConversation
  ) => {
    event.stopPropagation();
    event.preventDefault();
    if (openConversationMenuId === conversation.id) {
      setOpenConversationMenuId(null);
      setMenuAnchor(null);
      return;
    }
    const btnRect = event.currentTarget.getBoundingClientRect();
    const drawerElement = drawerRef.current;
    if (drawerElement) {
      const drawerRect = drawerElement.getBoundingClientRect();
      const menuWidth = 170;
      let top = btnRect.bottom - drawerRect.top + 4;
      if (top + 160 > drawerRect.height) {
        top = Math.max(8, btnRect.top - drawerRect.top - 150);
      }
      let left = btnRect.left - drawerRect.left;
      if (left < 8) {
        left = 8;
      }
      if (left + menuWidth > drawerRect.width - 8) {
        left = Math.max(8, drawerRect.width - menuWidth - 8);
      }
      setMenuAnchor({
        id: conversation.id,
        top,
        left,
        conversation,
      });
      setOpenConversationMenuId(conversation.id);
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
    setMenuAnchor(null);
  };

  const openRenameConversation = (conv: StoredConversation) => {
    setRenameTarget(conv);
    setRenameValue(conv.title);
    setOpenConversationMenuId(null);
    setMenuAnchor(null);
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
    setMenuAnchor(null);
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
    setMenuAnchor(null);
  };

  // Auto scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading, isAgentExecuting]);

  const runReadOnlyAnalysis = useCallback(async (calls: ExecutiveToolCall[], request: string) => {
    const run = { controller: new AbortController(), story: storyId };
    analysisRunRef.current?.controller.abort(); analysisRunRef.current = run;
    const current = () => analysisRunRef.current === run && analysisStoryRef.current === run.story && !run.controller.signal.aborted;
    const stepsId = `analysis-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setIsLoading(true); setIsAgentExecuting(true);
    setMessages(prev => [...prev, { id: stepsId + '-intro', role: 'assistant', content: calls.some(c => c.name === 'historical_and_cultural_reference_agent') ? 'سأبحث عن المعلومة مع مصادرها دون تعديل النص. يستخدم هذا الفحص بحث Google وقد يحتسب من حصته الخاصة بالمفتاح.' : 'سأفحص النص وأعرض الملاحظات وأدلتها للقراءة فقط؛ لن أغيّر أي كلمة.', timestamp: new Date(), isAgent: false },
      { id: stepsId, role: 'agent_steps', content: '', timestamp: new Date(), steps: calls.map((c, i) => ({ id: stepsId + i, toolName: c.name, blockId: (c.args as any).target || 'reference', stepNote: (c.args as any).step_note, status: 'waiting' })) }]);
    try {
      const root = editorRootElement || document.querySelector<HTMLElement>('#story-content');
      const anchor = window.getSelection()?.anchorNode;
      const selectedElement = anchor instanceof Element ? anchor : anchor?.parentElement;
      const activeChapterId = selectedElement && root?.contains(selectedElement) ? selectedElement.closest('[data-chapter-id]')?.getAttribute('data-chapter-id') || undefined : undefined;
      const result = await executeAgentPlan({ rootElement: root, rawCalls: calls,
        analysisContext: { title: storyContext.title, chapters: chapters?.length ? chapters : undefined, activeChapterId, request },
        analysisSignal: run.controller.signal, onCommit: () => {},
        onStepUpdate: steps => { if (current()) setMessages(prev => prev.map(m => m.id === stepsId ? { ...m, steps: steps.map(s => ({ ...s })) } : m)); } });
      if (!current()) return;
      setMessages(prev => [...prev.map(m => m.id === stepsId ? { ...m, steps: result.executedSteps,
        agentResult: { totalMutations: 0, completed: result.success, failed: !result.success, error: result.error } } : m),
        { id: stepsId + '-report', role: 'assistant', content: [result.analysisReports?.length ? formatAnalysisReports(result.analysisReports) : '', result.error ? `تعذر إكمال الفحص: ${result.error}` : 'اكتمل التقرير دون تعديل النص.'].filter(Boolean).join('\n\n'),
          analysisReports: result.analysisReports, timestamp: new Date(), isAgent: false }]);
    } catch {
      if (current()) setMessages(prev => [...prev.map(m => m.id === stepsId ? { ...m, agentResult: { totalMutations: 0, completed: false, failed: true, error: 'تعذر التحليل.' } } : m),
        { id: stepsId + '-error', role: 'assistant', content: 'تعذر إكمال التحليل؛ لم يتغير النص. يمكنك إعادة المحاولة.', timestamp: new Date() }]);
    } finally {
      if (analysisRunRef.current === run) { analysisRunRef.current = null; setIsLoading(false); setIsAgentExecuting(false); }
    }
  }, [storyId, storyContext, chapters, editorRootElement]);

  const executeExecutiveEditing = useCallback(
    async (
      userPromptText: string,
      mentionsToUse: AttachedMention[],
      hist: Message[],
      currentConvId?: string | null
    ) => {
      const decisionStory = analysisStoryRef.current;
      setIsAgentExecuting(true);
      setIsLoading(true);

      const targetRoot =
        editorRootElement ||
        (document.querySelector("#story-content") as HTMLElement | null);

      // تحديد رقم الفصل النشط إن وجد ديناميكياً بدلاً من التصليد
      let activeChapterIdx: number | undefined = undefined;
      if (isNovelMode && chapters && chapters.length > 0) {
        if (mentionsToUse.length > 0) {
          const firstBlockId = mentionsToUse[0].blockId;
          const blockEl = targetRoot?.querySelector(`[data-block-id="${firstBlockId}"]`);
          const chapterEl = blockEl?.closest?.("[data-chapter-id]");
          const chId = chapterEl?.getAttribute("data-chapter-id");
          if (chId) {
            const foundIdx = chapters.findIndex((c) => c.id === chId);
            if (foundIdx !== -1) activeChapterIdx = foundIdx;
          }
        }
      }

      const structuredDoc = formatExecutiveContextForAI({
        chapterHtmlOrEl: targetRoot || "",
        chapterTitle: storyContext?.title || "نص الرواية",
        chapterIndex: activeChapterIdx,
        pendingMentions: mentionsToUse,
        allChaptersSummary: chapters?.map((c, i) => ({ index: i, title: c.title })),
      });

      const apiHistory = hist
        .filter((m) => !m.ephemeral && (m.role === "user" || m.role === "assistant"))
        .slice(-8)
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          thought: m.thought,
          rawParts: m.rawParts,
          timestamp: m.timestamp,
        }));

      let effectivePrompt = userPromptText;
      if (pendingAgentRequest) {
        effectivePrompt = `[سياق توضيحي لسؤال سابق: "${pendingAgentRequest.question}"]\nإجابة الكاتبة وقرارها: ${userPromptText}\nالطلب الأصلي الأساسي: ${pendingAgentRequest.originalMessage}`;
        if (pendingAgentRequest.pendingOperations && pendingAgentRequest.pendingOperations.length > 0) {
          effectivePrompt += `\n[عمليات معلقة من خطة سابقة (${pendingAgentRequest.pendingOperations.length}) — خذها في الحسبان عند إعادة التخطيط، ولا تنفذها إلا ضمن خطتك الجديدة]:\n` + 
            pendingAgentRequest.pendingOperations.map(op => `- (${op.name} | الفقرة ${(op.args as any).block_id || (op.args as any).anchor_block_id || (op.args as any).block_id_a || ((op.args as any).target === "chapter" ? "الفصل" : (op.args as any).target) || (op.name === "replace_all" ? "الفصل" : 'بدون')} | ${((op.args as any).step_note || "").slice(0, 60)})`).join("\n");
        }
      }

      const AFFIRM_WORDS = ["نعم","تمام","موافق","موافقة","أجل","أكيد","طبعا","طبعاً","يلا","نفذ","نفذي","طبق","طبقي","استمر","استمري","أوافق","موافقين"];
      const QUALIFIER_WORDS = ["لكن","بس","فقط","بشرط","عدا","ماعدا","ما عدا","إلا","غير","بدون","بلا","لا ","لا،","؟","?"];
      function isStrictAffirmative(raw: string): boolean {
        const t = (raw || "").trim();
        if (t.length === 0 || t.length > 25) return false;
        if (!AFFIRM_WORDS.some((w) => t.startsWith(w))) return false;
        return !QUALIFIER_WORDS.some((q) => t.includes(q));
      }
      const isAffirmative = isStrictAffirmative(userPromptText);
      const isScopeApproval = pendingAgentRequest?.reason === "SCOPE" && isAffirmative;

      let directPendingCalls: ExecutiveToolCall[] | null = null;
      if (pendingAgentRequest?.pendingOperations && pendingAgentRequest.pendingOperations.length > 0 && isAffirmative) {
        directPendingCalls = pendingAgentRequest.pendingOperations;
      }

      let decision: { text?: string; functionCalls: Array<{ name: string; args: any }>; error?: string } = {
        functionCalls: directPendingCalls ? directPendingCalls : [],
      };

      if (!directPendingCalls) {
        decision = await askExecutiveAgentForDecision({
          history: apiHistory,
          userPrompt: effectivePrompt,
          structuredDocContext: structuredDoc,
          mentions: mentionsToUse,
        });
      }

      setIsLoading(false);

      if (decision.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `عذراً يا أستاذة رحمة، واجهت مشكلة في معالجة طلب التعديل: ${decision.error}`,
            timestamp: new Date(),
            isAgent: true,
          },
        ]);
        setIsAgentExecuting(false);
        return;
      }

      if (decision.functionCalls.some(fc => isAnalysisTool(fc.name)) && !decision.functionCalls.some(fc => fc.name === "ask_writer")) {
        if (analysisStoryRef.current !== decisionStory) return;
        await runReadOnlyAnalysis(decision.functionCalls as ExecutiveToolCall[], effectivePrompt);
        return;
      }

      // Check for ask_writer tool call
      const askWriterCall = decision.functionCalls.find(
        (fc) => fc.name === "ask_writer"
      );
      if (askWriterCall) {
        const q =
          (askWriterCall.args as any)?.question ||
          "هل ترغبين في توضيح المقطع المستهدف بدقة؟";
        const reason = (askWriterCall.args as any)?.reason || "AMBIGUOUS";
        const remainingOps = decision.functionCalls.filter((fc) => fc.name !== "ask_writer") as ExecutiveToolCall[];

        setPendingAgentRequest({
          question: q,
          reason,
          originalMessage: pendingAgentRequest?.originalMessage || userPromptText,
          pendingOperations: remainingOps.length > 0 ? remainingOps : undefined,
        });

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: q,
            timestamp: new Date(),
            isAgent: true,
          },
        ]);
        setIsAgentExecuting(false);
        return;
      }

      // If function calls are returned
      if (decision.functionCalls.length > 0) {
        setPendingAgentRequest(null);

        // 1. Initial conversational acknowledgment from the Agent (before steps)
        const introMsgId = (Date.now() + 1).toString();
        const introContent =
          decision.text?.trim() ||
          generateDefaultAgentIntro(
            userPromptText,
            decision.functionCalls as any
          );

        const stepsMsgId = (Date.now() + 2).toString();
        const initialSteps: AgentStepItem[] = decision.functionCalls.map(
          (fc, idx) => ({
            id: `step-${idx}-${Date.now()}`,
            toolName: fc.name,
            blockId:
              (fc.args as any)?.block_id ||
              (fc.args as any)?.anchor_block_id ||
              (fc.args as any)?.block_id_a ||
              ((fc.args as any)?.target === "chapter" ? "الفصل" : (fc.args as any)?.target) ||
              (fc.name === "replace_all" ? "الفصل" : ""),
            status: "waiting",
            stepNote:
              (fc.args as any)?.step_note ||
              `تعديل الفقرة ${(fc.args as any)?.block_id || ""}`,
          })
        );

        setMessages((prev) => [
          ...prev,
          {
            id: introMsgId,
            role: "assistant",
            content: introContent,
            timestamp: new Date(),
            isAgent: true,
          },
          {
            id: stepsMsgId,
            role: "agent_steps",
            content: "",
            timestamp: new Date(),
            steps: initialSteps,
          },
        ]);

        const planResult = await executeAgentPlan({
          requestId: stepsMsgId,
          rootElement: targetRoot,
          rawCalls: decision.functionCalls as ExecutiveToolCall[],
          onStepUpdate: (updatedSteps) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === stepsMsgId
                  ? { ...m, steps: [...updatedSteps] }
                  : m
              )
            );
          },
          onCommit: () => {
            onCommitAgentChanges?.();
          },
          accentColor: currentTheme.accent || "#D97706",
          skipScopeCheck: isScopeApproval === true,
        });

        if (planResult.askWriter) {
          setPendingAgentRequest({
            ...planResult.askWriter,
            originalMessage:
              pendingAgentRequest?.originalMessage || userPromptText,
            pendingOperations: planResult.askWriter.pendingOperations,
          });
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 3).toString(),
              role: "assistant",
              content: planResult.askWriter.question,
              timestamp: new Date(),
              isAgent: true,
            },
          ]);
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === stepsMsgId
              ? {
                  ...m,
                  agentResult: {
                    totalMutations: planResult.totalMutations,
                    completed: planResult.success && !planResult.duplicate,
                    failed: (!planResult.success && !planResult.askWriter) || planResult.duplicate === true,
                    error: planResult.duplicate ? "تم تخطي التنفيذ لتكرار الطلب." : planResult.error,
                  },
                }
              : m
          )
        );

        // 2. Concluding summary and polite inquiry after successful execution
        if (planResult.duplicate) {
          const duplicateMsgId = (Date.now() + 4).toString();
          setMessages((prev) => [
            ...prev,
            {
              id: duplicateMsgId,
              role: "assistant",
              content: "نُفِّذ هذا الطلب مسبقاً — لم يُعَد تطبيقه.",
              timestamp: new Date(),
              isAgent: true,
              isNew: true,
            },
          ]);
        } else if (planResult.success && !planResult.askWriter) {
          const summaryMsgId = (Date.now() + 4).toString();
          let summaryText = "";

          if (planResult.diacritizeReport) {
            const r = planResult.diacritizeReport;
            const skippedText = r.skipped > 0 ? `، وتخطي ${r.skipped} (للحفاظ على الحروف كما هي بدون تغيير)` : "";
            summaryText = `تم إنجاز الضبط اللغوي بدقة رياضية لـ ${r.done} فقرة بنجاح${skippedText}.`;
          } else {
            summaryText = generateDefaultAgentSummary(
              planResult.executedSteps.map((s) => ({
                toolName: s.toolName,
                stepNote: s.stepNote,
              }))
            );
          }

          setMessages((prev) => [
            ...prev,
            {
              id: summaryMsgId,
              role: "assistant",
              content: summaryText,
              timestamp: new Date(),
              isAgent: true,
              isNew: true,
              diacritizeJobId: planResult.diacritizeReport?.jobId,
            },
          ]);
        }

        setIsAgentExecuting(false);
        return;
      }

      // If plain text response
      if (decision.text) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: decision.text || "",
            timestamp: new Date(),
            isAgent: true,
          },
        ]);
      }
      setIsAgentExecuting(false);
    },
    [
      editorRootElement,
      runReadOnlyAnalysis,
      isNovelMode,
      chapters,
      storyContext,
      pendingAgentRequest,
      onCommitAgentChanges,
      currentTheme.accent,
    ]
  );

  const handleSendMessage = async (text: string, replaceUserMessageId?: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || isAgentExecuting) return;

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
      setConversations((prev) => {
        const updated = [newConv, ...prev.filter((c) => c.id !== newId)];
        saveStoredConversations(updated);
        return updated;
      });
    }

    const analysisCalls = detectAnalysisCalls(trimmed, activeMentions);
    if (analysisCalls.length > 0 && pendingAgentRequest === null) {
      await runReadOnlyAnalysis(analysisCalls, trimmed);
      return;
    }

    const isEditIntent =
      isExplicitEditIntent(trimmed, activeMentions.length > 0) ||
      pendingAgentRequest !== null;

    if (isEditIntent) {
      await executeExecutiveEditing(trimmed, activeMentions, historyMessages, currentConvId);
      return;
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
    setIsLoading(true);

    try {
      let accumulated = "";
      let detectedExec = false;
      const apiHistory = historyMessages
        .filter((m) => !m.ephemeral && (m.role === "user" || m.role === "assistant"))
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          thought: m.thought,
          rawParts: m.rawParts,
          timestamp: m.timestamp,
        }));

      const thinkingStartTime = Date.now();
      let thinkingDuration = 0;
      let thinkingEnded = false;
      let accumulatedThought = "";
      let finalRawParts: any[] = [];
      await streamLiteraryAssistantResponse(
        apiHistory,
        trimmed,
        storyContext,
        (chunkObj) => {
          accumulated += chunkObj.text;
          accumulatedThought += chunkObj.thought;
          if (chunkObj.rawParts.length > 0) finalRawParts = chunkObj.rawParts;

          if (!thinkingEnded && chunkObj.text) {
            thinkingEnded = true;
            thinkingDuration = Math.max(1, Math.round((Date.now() - thinkingStartTime) / 1000));
          }

          if (accumulated.includes("[[EXEC]]")) {
            detectedExec = true;
          }
          const displayContent = accumulated.replaceAll("[[EXEC]]", "").trimEnd();
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId
                ? {
                    ...msg,
                    content: displayContent,
                    thought: accumulatedThought,
                    rawParts: finalRawParts,
                    thinkingDuration: thinkingDuration || Math.max(1, Math.round((Date.now() - thinkingStartTime) / 1000)),
                    isStreaming: true,
                  }
                : msg
            )
          );
        },
        mentionsContext
      );

      if (!thinkingDuration) {
        thinkingDuration = Math.max(1, Math.round((Date.now() - thinkingStartTime) / 1000));
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId
            ? {
                ...msg,
                isStreaming: false,
                thought: accumulatedThought,
                rawParts: finalRawParts,
                thinkingDuration,
              }
            : msg
        )
      );
      setStorageError(null);

      // Universal Bridge: Automatically escalate to Executive Mode
      if (detectedExec) {
        await executeExecutiveEditing(
          trimmed,
          activeMentions,
          [
            ...historyMessages,
            {
              id: aiMsgId,
              role: "assistant",
              content: accumulated.replaceAll("[[EXEC]]", "").trim(),
              timestamp: new Date(),
            },
          ],
          currentConvId
        );
      }
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

  const userName = "كاتبتنا رحمة";

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

      {/* --- Apple Top Vignette Effect (Subtle Ambient Shadow Backdrop) --- */}
      <div
        className={`pointer-events-none transition-opacity duration-500 z-30 ${
          currentTheme.mode === "royal_classic"
            ? "apple-top-vignette-light"
            : currentTheme.mode === "night_whisper"
            ? "apple-top-vignette-night"
            : "apple-top-vignette"
        }`}
        style={{ position: "absolute" }}
      />

      {/* --- Apple Magnetic Blur Scroll Dissolve (Effect 2 - Top) --- */}
      <div className="apple-magnetic-dissolve" style={{ position: "absolute", zIndex: 31 }} />

      {/* ── FLOATING TOP HEADER CAPSULES: ABSOLUTE OVERLAY (ZERO BACKGROUND BAR) ── */}
      <header
        className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none select-none"
        style={{ left: "16px", right: "16px" }}
      >
        {/* Right Side: Drawer/Archive Button + Title Capsule */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
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
            aria-label="سجل محادثات هذه الحكاية"
            title="سجل محادثات هذه الحكاية"
          >
            <TwoLinesMenuIcon size={18} color={currentTheme.accent} />
          </button>

          <div
            className="h-11 px-5 border flex items-center justify-center backdrop-blur-xl transition-all duration-300 shadow-md"
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

      {/* ── CONVERSATIONS DRAWER (Portaled to document.body for full viewport coverage) ── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isDrawerOpen && (
              <>
                <motion.div
                  key="drawer-backdrop"
                  aria-label="إغلاق قائمة المحادثات"
                  className="fixed inset-0 z-[65] bg-black/40 backdrop-blur-[2px] cursor-pointer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  onClick={() => {
                    setIsDrawerOpen(false);
                    setOpenConversationMenuId(null);
                    setMenuAnchor(null);
                  }}
                />
                <motion.aside
                  ref={drawerRef}
                  dir="rtl"
                  className="fixed top-3 bottom-3 right-3 z-[70] flex w-[260px] min-w-[260px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[24px] border shadow-2xl backdrop-blur-2xl shrink-0"
                  style={{
                    backgroundColor: currentTheme.glass,
                    borderColor: currentTheme.border,
                    color: currentTheme.text,
                    boxShadow: `0 16px 48px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px ${currentTheme.border}`,
                  }}
                  initial={{ opacity: 0, x: 20, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                >
                  {/* Header: Clean, only "محادثات الحكاية" and Close Button */}
                  <div
                    className="flex h-14 shrink-0 w-full items-center justify-between border-b px-5 select-none"
                    style={{ borderColor: currentTheme.border }}
                  >
                    <div className="flex items-center min-w-0 flex-1 pr-0.5">
                      <span
                        className="font-zain-xbold text-sm tracking-wide truncate"
                        style={{ color: currentTheme.text }}
                      >
                        محادثات الحكاية
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        setOpenConversationMenuId(null);
                        setMenuAnchor(null);
                      }}
                      className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0 ml-1"
                      style={{ color: currentTheme.secondary }}
                      aria-label="إغلاق"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div
                    className="flex-1 overflow-y-auto px-2.5 py-2.5 hide-scrollbar w-full min-w-0"
                    onScroll={() => {
                      if (menuAnchor) {
                        setMenuAnchor(null);
                        setOpenConversationMenuId(null);
                      }
                    }}
                  >
                    {/* New Chat Button: Native list item at the top of the sidebar list, borderless with subtle hover */}
                    <button
                      type="button"
                      onClick={startNewConversation}
                      className="flex items-center gap-2.5 w-full px-3.5 py-3 rounded-xl transition-colors select-none cursor-pointer hover:bg-white/5 active:bg-white/10 text-right mb-1"
                      style={{
                        color: currentTheme.text,
                      }}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: currentTheme.accent }}>
                          <path d="M4 12C4 7.58 7.58 4 12 4C16.42 4 20 7.58 20 12C20 16.42 16.42 20 12 20H8" />
                          <path d="M13.5 9.5L17.5 13.5L11 20H7V16L13.5 9.5Z" />
                        </svg>
                      </div>
                      <span className="text-sm font-zain-bold flex-1 truncate">محادثة جديدة</span>
                    </button>

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
                        className="w-full px-4 py-12 text-center text-xs font-zain-bold leading-6 select-none"
                        style={{ color: currentTheme.secondary }}
                      >
                        لا توجد محادثات سابقة لهذه الحكاية.
                        <br />
                        ابدأي حوارًا جديدًا وسيُحفظ هنا تلقائيًا.
                      </div>
                    ) : (
                      <div className="space-y-1 w-full min-w-0">
                        {conversations.map((conversation) => (
                          <div
                            key={conversation.id}
                            className="group relative flex items-center justify-between gap-2 w-full px-3.5 py-3 rounded-xl transition-colors select-none cursor-pointer hover:bg-white/5 active:bg-white/10"
                            style={{
                              backgroundColor:
                                conversation.id === activeConversationId
                                  ? currentTheme.isDark
                                    ? "rgba(255, 255, 255, 0.08)"
                                    : `${currentTheme.accent}15`
                                  : "transparent",
                            }}
                            onClick={() => openConversation(conversation.id)}
                          >
                            {/* Child 1 in RTL: Sits on the RIGHT (Title) */}
                            <div className="min-w-0 flex-1 text-right pl-2">
                              <span
                                className="block truncate text-sm font-zain-bold leading-normal"
                                style={{ color: currentTheme.text }}
                              >
                                {conversation.pinnedAt && (
                                  <Pin
                                    size={12}
                                    className="inline-block ml-1.5 shrink-0 align-middle"
                                    style={{ color: currentTheme.accent }}
                                    aria-label="مثبتة"
                                  />
                                )}
                                {conversation.title}
                              </span>
                            </div>

                            {/* Child 2 in RTL: Sits on the LEFT (3-dots icon on the far left opposite the title) */}
                            <button
                              type="button"
                              onClick={(event) => handleToggleMenu(event, conversation)}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
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
                                <MoreVertical size={16} />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── FLOATING 3-DOTS CONVERSATION MENU (Rendered inside drawer, floating OVER the chat items) ── */}
                  <AnimatePresence>
                    {menuAnchor && (
                      <motion.div
                        ref={menuRef}
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute z-[80] w-[170px] rounded-[18px] shadow-2xl overflow-hidden p-1.5 border backdrop-blur-2xl pointer-events-auto"
                        style={{
                          top: menuAnchor.top,
                          left: menuAnchor.left,
                          backgroundColor: currentTheme.glass,
                          borderColor: currentTheme.border,
                          boxShadow: `0 12px 36px -4px rgba(0,0,0,0.5)`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            handleShareConversation(menuAnchor.conversation);
                          }}
                          className="flex h-8 w-full items-center gap-2 rounded-[12px] px-2.5 text-right text-xs font-zain-bold transition hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                          style={{ color: currentTheme.text }}
                        >
                          <Share2 size={13} style={{ color: currentTheme.accent }} />
                          <span>مشاركة المحادثة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handlePinConversation(menuAnchor.conversation);
                          }}
                          className="flex h-8 w-full items-center gap-2 rounded-[12px] px-2.5 text-right text-xs font-zain-bold transition hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                          style={{ color: currentTheme.text }}
                        >
                          <Pin
                            size={13}
                            style={{ color: currentTheme.accent }}
                            fill={menuAnchor.conversation.pinnedAt ? "currentColor" : "none"}
                          />
                          <span>
                            {menuAnchor.conversation.pinnedAt
                              ? "إلغاء التثبيت"
                              : "تثبيت"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openRenameConversation(menuAnchor.conversation);
                          }}
                          className="flex h-8 w-full items-center gap-2 rounded-[12px] px-2.5 text-right text-xs font-zain-bold transition hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                          style={{ color: currentTheme.text }}
                        >
                          <Pencil size={13} style={{ color: currentTheme.accent }} />
                          <span>إعادة التسمية</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const conv = menuAnchor.conversation;
                            setMenuAnchor(null);
                            setOpenConversationMenuId(null);
                            setDeleteTarget(conv);
                          }}
                          className="flex h-8 w-full items-center gap-2 rounded-[12px] px-2.5 text-right text-xs font-zain-bold transition hover:bg-red-500/10 cursor-pointer text-red-500"
                        >
                          <Trash2 size={13} />
                          <span>حذف</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.aside>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* ── MODALS (SHARE, RENAME, DELETE) ── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {shareResult && (
              <motion.div
                className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-5 backdrop-blur-xs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShareResult(null)}
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
                  onClick={(e) => e.stopPropagation()}
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
                      className="h-9 flex-1 rounded-full text-xs font-zain-bold transition-opacity hover:opacity-90 cursor-pointer"
                      style={{
                        backgroundColor: currentTheme.accent,
                        color: currentTheme.mode === "apple_dark" ? "#000000" : "#FFFFFF",
                      }}
                    >
                      تم
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {renameTarget && (
              <motion.div
                className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-5 backdrop-blur-xs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setRenameTarget(null)}
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
                  onClick={(e) => e.stopPropagation()}
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
                      className="h-9 flex-1 rounded-full text-xs font-zain-bold transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                      style={{
                        backgroundColor: currentTheme.accent,
                        color: currentTheme.mode === "apple_dark" ? "#000000" : "#FFFFFF",
                      }}
                    >
                      حفظ
                    </button>
                  </div>
                </motion.form>
              </motion.div>
            )}

            {deleteTarget && (
              <motion.div
                className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-5 backdrop-blur-xs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDeleteTarget(null)}
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
                  onClick={(e) => e.stopPropagation()}
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
          </AnimatePresence>,
          document.body
        )}

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
                <p
                  className="text-xs font-zain-bold tracking-wide"
                  style={{ color: currentTheme.accent }}
                >
                  السلام عليكم، {userName}
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

              if (m.role === "agent_steps") {
                return (
                  <AgentStepsMessageCard
                    key={m.id}
                    message={m}
                    theme={currentTheme}
                  />
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
                m.isStreaming !== true &&
                !isLoading &&
                !isAgentExecuting &&
                !messages.slice(idx + 1).some((after) => after.role === "agent_steps");

              const prevMessage = idx > 0 ? messages[idx - 1] : null;
              const isContinuationFromAgent =
                prevMessage &&
                (prevMessage.role === "agent_steps" ||
                  (prevMessage.role === "assistant" && prevMessage.isAgent && m.isAgent));

              return (
                <div key={m.id} className="w-full flex flex-col">
                  <div
                    className={
                      isUser
                        ? "flex flex-col items-start w-full"
                        : "w-full"
                    }
                  >
                    {!isUser && !isContinuationFromAgent && (
                      <div className="w-full mb-1.5" dir="rtl">
                        {m.isStreaming && (!m.content || m.content.trim() === "") ? (
                          <div className="flex items-center gap-2 select-none">
                            <ThinkingIndicator theme={currentTheme} />
                            {m.isAgent && (
                              <span
                                className="text-[10px] font-zain-bold tracking-wide px-2 py-0.5 rounded-full border leading-none select-none inline-flex items-center justify-center"
                                style={{
                                  backgroundColor: `${currentTheme.accent}18`,
                                  borderColor: `${currentTheme.accent}40`,
                                  color: currentTheme.accent,
                                }}
                              >
                                إيجنت
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2 select-none">
                              <button
                                type="button"
                                onClick={() => toggleThought(m.id)}
                                className="inline-flex items-center gap-1 py-0.5 text-xs font-zain-bold transition-opacity hover:opacity-80 cursor-pointer select-none"
                                style={{ color: currentTheme.isDark ? "#9ca3af" : "#6b7280" }}
                              >
                                <span>{formatThinkingDuration(m.thinkingDuration || 3)}</span>
                                <ChevronLeft
                                  size={13}
                                  className={`transition-transform duration-200 ${
                                    expandedThoughtIds[m.id] ? "-rotate-90" : "rotate-0"
                                  }`}
                                />
                              </button>
                              {m.isAgent && (
                                <span
                                  className="text-[10px] font-zain-bold tracking-wide px-2 py-0.5 rounded-full border leading-none select-none inline-flex items-center justify-center"
                                  style={{
                                    backgroundColor: `${currentTheme.accent}18`,
                                    borderColor: `${currentTheme.accent}40`,
                                    color: currentTheme.accent,
                                  }}
                                >
                                  إيجنت
                                </span>
                              )}
                            </div>

                            {/* Accordion Content for Thinking Steps */}
                            {expandedThoughtIds[m.id] && (
                              <div
                                dir="rtl"
                                className="text-[12px] mt-1.5 mb-2 pr-3 pl-2 py-2 border-r-2 text-stone-500 dark:text-stone-400 text-right leading-relaxed font-zain whitespace-pre-wrap rounded-l-md"
                                style={{
                                  borderColor: `${currentTheme.accent}50`,
                                  backgroundColor: currentTheme.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                                }}
                              >
                                {m.thought ? m.thought : "تم التفكير وتحليل السياق بواسطة نموذج Gemini الذكي."}
                              </div>
                            )}
                          </div>
                        )}
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
                              className={`inline-flex h-6 items-center justify-center rounded-full px-3.5 text-[11px] font-zain-bold transition-all cursor-pointer ${
                                (!hasEditedContent || !editingContent.trim()) ? "opacity-40" : "hover:opacity-90"
                              }`}
                              style={{ 
                                backgroundColor: currentTheme.accent,
                                color: currentTheme.mode === "apple_dark" ? "#000000" : (currentTheme.bg || "#ffffff"),
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
                        </div>
                        {m.analysisReports?.map((report, index) => report.searchSuggestionsHtml ? <GroundedSearchSuggestions key={index} html={report.searchSuggestionsHtml} /> : null)}
                        {m.diacritizeJobId && (
                          <div
                            dir="rtl"
                            className="mt-2.5 flex items-center gap-2 select-none"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (editorRootElement && onCommitAgentChanges && m.diacritizeJobId) {
                                  const undone = undoDiacritizeJob(
                                    m.diacritizeJobId,
                                    editorRootElement,
                                    onCommitAgentChanges
                                  );
                                  if (undone) {
                                    setMessages((prev) => [
                                      ...prev,
                                      {
                                        id: Date.now().toString(),
                                        role: "system_ephemeral",
                                        content: "تم التراجع عن الضبط واستعادة النص الأصلي كاملاً.",
                                        timestamp: new Date(),
                                      },
                                    ]);
                                  }
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-zain-bold border transition-all cursor-pointer active:scale-95 shadow-xs"
                              style={{
                                backgroundColor: currentTheme.isDark ? "#2d1616" : "#fee2e2",
                                borderColor: currentTheme.isDark ? "rgba(244, 63, 94, 0.45)" : "#fca5a5",
                                color: currentTheme.isDark ? "#fda4af" : "#9f1239",
                              }}
                              title="تراجع عن الضبط اللغوي واستعادة النص الأصلي كما كان قبل التشكيل"
                            >
                              <Undo2 size={12} strokeWidth={2.2} />
                              <span>تراجع عن الضبط</span>
                            </button>
                          </div>
                        )}
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

            {(isLoading || isAgentExecuting) && !hasStreamingAssistantMessage && (
              (() => {
                const lastMsg = messages[messages.length - 1];
                const isAfterAgentItem =
                  lastMsg &&
                  (lastMsg.role === "agent_steps" ||
                    (lastMsg.role === "assistant" && lastMsg.isAgent));

                return (
                  <div className="w-full flex flex-col animate-in fade-in duration-200">
                    <div className="w-full" dir="rtl">
                      <div className="flex items-center gap-2 mb-1.5 select-none">
                        <ThinkingIndicator theme={currentTheme} />
                        {isAgentExecuting && (
                          <span
                            className="text-[10px] font-zain-bold tracking-wide px-2 py-0.5 rounded-full border leading-none select-none inline-flex items-center justify-center"
                            style={{
                              backgroundColor: `${currentTheme.accent}18`,
                              borderColor: `${currentTheme.accent}40`,
                              color: currentTheme.accent,
                            }}
                          >
                            إيجنت
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* --- Apple Bottom Vignette Effect (Subtle Ambient Shadow Backdrop Underneath Input Area) --- */}
        <div
          className={`pointer-events-none transition-opacity duration-500 ${
            currentTheme.mode === "royal_classic"
              ? "apple-bottom-vignette-light"
              : currentTheme.mode === "night_whisper"
              ? "apple-bottom-vignette-night"
              : "apple-bottom-vignette"
          }`}
          style={{ zIndex: 20 }}
        />

        {/* --- Apple Magnetic Blur Scroll Dissolve (Effect 2 - Bottom Around Input Area) --- */}
        <div className="apple-magnetic-dissolve-bottom" style={{ zIndex: 21 }} />

        {/* ── FLOATING INPUT FIELD BAR: EXACT MATCH WITH DAR AL HIKAYAT BOTTOM FLOATING CAPSULE ── */}
        <footer 
          className="absolute bottom-4 z-40 flex flex-col items-center pointer-events-none w-full"
          style={{ left: 0, padding: "0 16px", zIndex: 40 }}
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
              placeholder={
                analysisRunRef.current
                  ? "جارٍ تحليل النص للقراءة فقط..."
                  : isAgentExecuting
                  ? "جارٍ تنفيذ التعديلات الجراحية في النص..."
                  : pendingAgentRequest
                  ? "أجيبي على سؤال الوكيل لتثبيت التعديل..."
                  : "اسأل المساعد الأدبي..."
              }
              disabled={isLoading || isAgentExecuting || editingMessageId !== null}
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
              disabled={!inputValue.trim() || isLoading || isAgentExecuting || editingMessageId !== null}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer"
              style={{
                backgroundColor:
                  inputValue.trim() && !isLoading && !isAgentExecuting && editingMessageId === null
                    ? currentTheme.accent
                    : currentTheme.isDark
                    ? "rgba(255,255,255,0.06)"
                    : `${currentTheme.accent}18`,
                color:
                  inputValue.trim() && !isLoading && !isAgentExecuting && editingMessageId === null
                    ? currentTheme.mode === "apple_dark"
                      ? "#000000"
                      : (currentTheme.bg || "#ffffff")
                    : currentTheme.secondary,
                opacity:
                  inputValue.trim() && !isLoading && !isAgentExecuting && editingMessageId === null
                    ? 1
                    : 0.65,
              }}
              aria-label="إرسال"
              title="إرسال"
            >
              {isAgentExecuting ? (
                <span
                  className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                  style={{
                    borderColor:
                      currentTheme.mode === "apple_dark"
                        ? "rgba(0,0,0,0.3)"
                        : "rgba(255,255,255,0.4)",
                    borderTopColor:
                      currentTheme.mode === "apple_dark" ? "#000000" : "#ffffff",
                  }}
                />
              ) : (
                <ArrowUp size={16} strokeWidth={2.4} />
              )}
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
