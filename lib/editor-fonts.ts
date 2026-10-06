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
  {
    id: "cairo",
    family: "Cairo",
    label: "القاهرة",
    weights: [200, 300, 400, 500, 600, 700, 800, 900, 1000],
    files: ["Cairo-Variable.ttf"],
  },
  {
    id: "tajawal",
    family: "Tajawal",
    label: "تجوّل",
    weights: [275, 300, 400, 500, 700, 800, 900],
    files: [
      "Tajawal-ExtraLight.ttf",
      "Tajawal-Light.ttf",
      "Tajawal-Regular.ttf",
      "Tajawal-Medium.ttf",
      "Tajawal-Bold.ttf",
      "Tajawal-ExtraBold.ttf",
      "Tajawal-Black.ttf",
    ],
  },
  {
    id: "almarai",
    family: "Almarai",
    label: "المراعي",
    weights: [300, 400, 700, 800],
    files: [
      "Almarai-Light.ttf",
      "Almarai-Regular.ttf",
      "Almarai-Bold.ttf",
      "Almarai-ExtraBold.ttf",
    ],
  },
  {
    id: "alexandria",
    family: "Alexandria",
    label: "الإسكندرية",
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    files: ["Alexandria-Variable.ttf"],
  },
  {
    id: "readexpro",
    family: "Readex Pro",
    label: "ريدكس برو",
    weights: [160, 200, 300, 400, 500, 600, 700],
    files: ["ReadexPro-Variable.ttf"],
  },
  {
    id: "elmessiri",
    family: "El Messiri",
    label: "المسيري",
    weights: [400, 500, 600, 700],
    files: ["ElMessiri-Variable.ttf"],
  },
  {
    id: "changa",
    family: "Changa",
    label: "تشانغا",
    weights: [200, 300, 400, 500, 600, 700, 800],
    files: ["Changa-Variable.ttf"],
  },
  {
    id: "harmattan",
    family: "Harmattan",
    label: "هرمتان",
    weights: [400, 500, 600, 700],
    files: [
      "Harmattan-Regular.ttf",
      "Harmattan-Medium.ttf",
      "Harmattan-SemiBold.ttf",
      "Harmattan-Bold.ttf",
    ],
  },
  {
    id: "lateef",
    family: "Lateef",
    label: "لطيف",
    weights: [200, 300, 400, 500, 600, 700, 800],
    files: [
      "Lateef-ExtraLight.ttf",
      "Lateef-Light.ttf",
      "Lateef-Regular.ttf",
      "Lateef-Medium.ttf",
      "Lateef-SemiBold.ttf",
      "Lateef-Bold.ttf",
      "Lateef-ExtraBold.ttf",
    ],
  },
  {
    id: "markazitext",
    family: "Markazi Text",
    label: "مركزي",
    weights: [400, 500, 600, 700],
    files: ["MarkaziText-Variable.ttf"],
  },
  {
    id: "mada",
    family: "Mada",
    label: "مدى",
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
    files: ["Mada-Variable.ttf"],
  },
  {
    id: "vazirmatn",
    family: "Vazirmatn",
    label: "وزير متن",
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    files: ["Vazirmatn-Variable.ttf"],
  },
  {
    id: "kufam",
    family: "Kufam",
    label: "كوفام",
    weights: [400, 500, 600, 700, 800, 900],
    files: ["Kufam-Variable.ttf"],
  },
  {
    id: "lalezar",
    family: "Lalezar",
    label: "لاليزار",
    weights: [400],
    files: ["Lalezar-Regular.ttf"],
  },
  {
    id: "reemkufi",
    family: "Reem Kufi",
    label: "ريم كوفي",
    weights: [400, 500, 600, 700],
    files: ["ReemKufi-Variable.ttf"],
  },
  {
    id: "rakkas",
    family: "Rakkas",
    label: "رقّاص",
    weights: [400],
    files: ["Rakkas-Regular.ttf"],
  },
  {
    id: "lemonada",
    family: "Lemonada",
    label: "ليمونادة",
    weights: [300, 400, 500, 600, 700],
    files: ["Lemonada-Variable.ttf"],
  },
  {
    id: "mirza",
    family: "Mirza",
    label: "ميرزا",
    weights: [400, 500, 600, 700],
    files: [
      "Mirza-Regular.ttf",
      "Mirza-Medium.ttf",
      "Mirza-SemiBold.ttf",
      "Mirza-Bold.ttf",
    ],
  },
  {
    id: "gulzar",
    family: "Gulzar",
    label: "جلزار",
    weights: [400],
    files: ["Gulzar-Regular.ttf"],
  },
  {
    id: "notokufiarabic",
    family: "Noto Kufi Arabic",
    label: "نوتو كوفي",
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    files: ["NotoKufiArabic-Variable.ttf"],
  },
  {
    id: "marhey",
    family: "Marhey",
    label: "مرحي",
    weights: [300, 400, 500, 600, 700],
    files: ["Marhey-Variable.ttf"],
  },
  {
    id: "katibeh",
    family: "Katibeh",
    label: "كتيبة",
    weights: [400],
    files: ["Katibeh-Regular.ttf"],
  },
  {
    id: "baloobhaijaan2",
    family: "Baloo Bhaijaan 2",
    label: "بالو بهيجان",
    weights: [400, 500, 600, 700, 800],
    files: ["BalooBhaijaan2-Variable.ttf"],
  },
  {
    id: "qahiri",
    family: "Qahiri",
    label: "قاهري",
    weights: [400],
    files: ["Qahiri-Regular.ttf"],
  },
];
export const WEIGHT_LABELS: Record<number, string> = {
  160: "رفيع",
  275: "خفيف جدًا",
  1000: "فائق الثقل",
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
