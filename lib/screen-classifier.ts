export interface ScreenClassification {
  isDeviceWideCapable: boolean;
  isLandscape: boolean;
  canOpenAssistant: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isMobilePhone: boolean;
  width: number;
  height: number;
  minDim: number;
  maxDim: number;
}

export const checkIsTabletOrWideScreen = (): ScreenClassification => {
  if (typeof window === "undefined") {
    return {
      isDeviceWideCapable: false,
      isLandscape: false,
      canOpenAssistant: false,
      isTablet: false,
      isDesktop: false,
      isMobilePhone: true,
      width: 0,
      height: 0,
      minDim: 0,
      maxDim: 0,
    };
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  const minDim = Math.min(w, h);
  const maxDim = Math.max(w, h);

  const sw = window.screen ? window.screen.width : 0;
  const sh = window.screen ? window.screen.height : 0;
  const screenMinDim = sw && sh ? Math.min(sw, sh) : minDim;
  const screenMaxDim = sw && sh ? Math.max(sw, sh) : maxDim;

  const isTablet = (screenMinDim >= 500 && screenMaxDim >= 720) || (minDim >= 500 && maxDim >= 720);
  const isDesktop = (w >= 768 && (h >= 500 || screenMinDim >= 600)) || (screenMaxDim >= 1024 && w >= 768);

  const isDeviceWideCapable = isTablet || isDesktop;
  const isMobilePhone = !isTablet && !isDesktop;

  const isLandscape =
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(orientation: landscape)").matches ||
        (Boolean(window.screen?.orientation) && window.screen.orientation.type.includes("landscape")) ||
        (sw > 0 && sh > 0 ? (sw > sh && w >= 600) : w > h)
      : w > h;

  const canOpenAssistant = isDeviceWideCapable && isLandscape;

  return {
    isDeviceWideCapable,
    isLandscape,
    canOpenAssistant,
    isTablet,
    isDesktop,
    isMobilePhone,
    width: w,
    height: h,
    minDim,
    maxDim,
  };
};
