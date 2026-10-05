/** Curated offline library. Only weights present in the bundled font files. */
export interface EditorFont {
  id: string;
  family: string;
  label: string;
  weights: number[];
  files: string[];
}
export const EDITOR_FONTS: EditorFont[] = [
  {
    id: "default",
    family: "Thmanyah Sans",
    label: "الافتراضي",
    weights: [400, 700],
    files: [],
  },
  {
    id: "amiri",
    family: "Amiri",
    label: "أميري",
    weights: [400, 700],
    files: ["Amiri-Regular.ttf", "Amiri-Bold.ttf"],
  },
  {
    id: "notonaskharabic",
    family: "Noto Naskh Arabic",
    label: "نوتو نسخ",
    weights: [400, 500, 600, 700],
    files: ["NotoNaskhArabic-Variable.ttf"],
  },
  {
    id: "scheherazadenew",
    family: "Scheherazade New",
    label: "شهرزاد",
    weights: [400, 500, 600, 700],
    files: [
      "ScheherazadeNew-Regular.ttf",
      "ScheherazadeNew-Medium.ttf",
      "ScheherazadeNew-SemiBold.ttf",
      "ScheherazadeNew-Bold.ttf",
    ],
  },
  {
    id: "notosansarabic",
    family: "Noto Sans Arabic",
    label: "نوتو عربي",
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    files: ["NotoSansArabic-Variable.ttf"],
  },
  {
    id: "ibmplexsansarabic",
    family: "IBM Plex Sans Arabic",
    label: "آي بي إم بليكس عربي",
    weights: [100, 200, 300, 400, 500, 600, 700],
    files: [
      "IBMPlexSansArabic-Thin.ttf",
      "IBMPlexSansArabic-ExtraLight.ttf",
      "IBMPlexSansArabic-Light.ttf",
      "IBMPlexSansArabic-Regular.ttf",
      "IBMPlexSansArabic-Medium.ttf",
      "IBMPlexSansArabic-SemiBold.ttf",
      "IBMPlexSansArabic-Bold.ttf",
    ],
  },
  {
    id: "arefruqaa",
    family: "Aref Ruqaa",
    label: "عارف رقعة",
    weights: [400, 700],
    files: ["ArefRuqaa-Regular.ttf", "ArefRuqaa-Bold.ttf"],
  },
];
export const WEIGHT_LABELS: Record<number, string> = {
  100: "رفيع",
  200: "خفيف جدًا",
  300: "خفيف",
  400: "عادي",
  500: "متوسط",
  600: "نصف عريض",
  700: "عريض",
  800: "عريض جدًا",
  900: "ثقيل",
};
export const findEditorFont = (family: string) =>
  EDITOR_FONTS.find(
    (f) => f.family === family.replace(/["']/g, "").split(",")[0].trim(),
  );
export async function loadEditorFont(
  font: EditorFont,
  weight: number,
): Promise<void> {
  if (!font.weights.includes(weight))
    throw new Error("Unsupported font weight");
  if (typeof document !== "undefined" && document.fonts) {
    const faces = await document.fonts.load(
      `${weight} 20px "${font.family}"`,
      "رحمة",
    );
    if (!faces.length) throw new Error("Font unavailable");
  }
}
