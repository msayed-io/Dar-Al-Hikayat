/**
 * RemoteContextMenu — the tablet-side menu opened by the phone's right click.
 *
 * It is intentionally tiny and themed with our own identity (rounded card,
 * blurred surface, Arabic labels) instead of the WebView's default menu, which
 * never opens for synthetic events. It offers exactly the clipboard actions a
 * writer needs while holding only the phone: copy, cut, paste, select all.
 */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Scissors, Copy, ClipboardPaste, SquareDashed } from "lucide-react";
import { subscribeRemoteMouse, type RemoteMouseCommand } from "../lib/remote-mouse";

export interface RemoteContextMenuProps {
  accent?: string;
  isDark?: boolean;
  background?: string;
  text?: string;
  border?: string;
  onAction: (action: "COPY" | "CUT" | "PASTE" | "SELECT_ALL") => void;
}

interface MenuState {
  x: number;
  y: number;
  visible: boolean;
}

const MENU_WIDTH = 168;
const MENU_HEIGHT = 176;

export const RemoteContextMenu: React.FC<RemoteContextMenuProps> = ({
  accent = "#D97706",
  isDark = true,
  background,
  text,
  border,
  onAction,
}) => {
  const [menu, setMenu] = useState<MenuState>({ x: 0, y: 0, visible: false });
  const nodeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeRemoteMouse((command: RemoteMouseCommand) => {
      if (command.action === "MOUSE_CLICK" && command.button === "right") {
        // Position is supplied by the cursor overlay through the DOM event;
        // fall back to the centre so the menu is never lost off-screen.
        setMenu((previous) => ({ ...previous, visible: true }));
      }
    });
    return unsubscribe;
  }, []);

  // The overlay publishes the click point on the body for us to read.
  useEffect(() => {
    const onRemoteMenu = (event: Event) => {
      const detail = (event as CustomEvent<{ x: number; y: number }>).detail || { x: 0, y: 0 };
      const width = window.innerWidth;
      const height = window.innerHeight;
      setMenu({
        x: Math.min(Math.max(detail.x, 8), Math.max(8, width - MENU_WIDTH - 8)),
        y: Math.min(Math.max(detail.y, 8), Math.max(8, height - MENU_HEIGHT - 8)),
        visible: true,
      });
    };
    const onDismiss = () => setMenu((previous) => ({ ...previous, visible: false }));
    const onPress = (event: Event) => {
      const point = (event as CustomEvent<{ x: number; y: number }>).detail;
      if (!point) return;
      const rect = nodeRef.current?.getBoundingClientRect();
      // The menu lives below the pointer overlay, so the press point decides:
      // outside the card → close, inside → let the menu be pressed.
      if (rect && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom) {
        return;
      }
      setMenu((previous) => ({ ...previous, visible: false }));
    };
    window.addEventListener("dar-remote-context-menu", onRemoteMenu as EventListener);
    window.addEventListener("dar-remote-context-dismiss", onDismiss);
    window.addEventListener("dar-remote-pointer-press", onPress as EventListener);
    return () => {
      window.removeEventListener("dar-remote-context-menu", onRemoteMenu as EventListener);
      window.removeEventListener("dar-remote-context-dismiss", onDismiss);
      window.removeEventListener("dar-remote-pointer-press", onPress as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!menu.visible) return;
    const dismiss = (event: Event) => {
      if (nodeRef.current && event.target instanceof Node && nodeRef.current.contains(event.target)) return;
      setMenu((previous) => ({ ...previous, visible: false }));
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu((previous) => ({ ...previous, visible: false }));
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu.visible]);

  if (!menu.visible) return null;

  const items: Array<{ key: "COPY" | "CUT" | "PASTE" | "SELECT_ALL"; label: string; icon: React.ReactNode }> = [
    { key: "COPY", label: "نسخ", icon: <Copy className="w-3.5 h-3.5" /> },
    { key: "CUT", label: "قص", icon: <Scissors className="w-3.5 h-3.5" /> },
    { key: "PASTE", label: "لصق", icon: <ClipboardPaste className="w-3.5 h-3.5" /> },
    { key: "SELECT_ALL", label: "تحديد الكل", icon: <SquareDashed className="w-3.5 h-3.5" /> },
  ];

  const backgroundColor = background || (isDark ? "rgba(22, 24, 30, 0.96)" : "rgba(255, 255, 255, 0.97)");
  const color = text || (isDark ? "#F4F1EA" : "#121A1B");
  const borderColor = border || (isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)");

  return createPortal(
    <div
      ref={nodeRef}
      dir="rtl"
      data-remote-context-menu="true"
      className="fixed rounded-2xl border shadow-2xl overflow-hidden"
      style={{
        // Inline z-index: Tailwind's arbitrary z-classes are not generated in
        // this build, which silently left the menu UNDER the editor (z-50) and
        // made every tap fall through to the text. Inline always wins, and this
        // sits just below the remote pointer so the arrow stays visible.
        zIndex: 2147482900,
        left: menu.x,
        top: menu.y,
        width: MENU_WIDTH,
        backgroundColor,
        borderColor,
        color,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => {
            setMenu((previous) => ({ ...previous, visible: false }));
            onAction(item.key);
          }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-zain-bold transition-colors"
          style={{ color }}
        >
          <span style={{ color: accent }}>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
};

export default RemoteContextMenu;
