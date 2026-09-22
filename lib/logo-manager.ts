import { Capacitor, registerPlugin } from "@capacitor/core";
import type { ThemeMode } from "../contexts/AppContext";

interface LogoManagerPlugin {
  setTheme(options: { theme: ThemeMode }): Promise<{ theme: ThemeMode }>;
}

const LogoManager = registerPlugin<LogoManagerPlugin>("LogoManager");

export async function syncNativeLogoTheme(theme: ThemeMode): Promise<void> {
  if (Capacitor.getPlatform() !== "android") return;
  try { await LogoManager.setTheme({ theme }); } catch (error) { console.warn("Unable to sync Android launcher logo theme", error); }
}
