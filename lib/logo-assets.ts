import type { ThemeMode } from "../contexts/AppContext";

export function logoAsset(theme: ThemeMode): string {
  return `/dar-al-hikayat-logo-${theme}.png`;
}

export function logoTransparentAsset(theme: ThemeMode): string {
  return `/dar-al-hikayat-logo-transparent-${theme}.png`;
}

export function emptyStateAsset(theme: ThemeMode): string {
  return `/empty-state-${theme}.png`;
}

export function updateBannerAsset(theme: ThemeMode): string {
  return `/update-banner-${theme}.png`;
}
