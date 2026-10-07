/**
 * مفاتيح الإيقاف والتشغيل لمنظومة الكتابة اليدوية (Handwriting Feature Flags)
 *
 * تسمح هذه المفاتيح بالتحكم الدقيق في كافة الميزات المدمجة
 * وإمكانية العودة الفورية للسلوك الأصلي بنسبة 100% في حال الحاجة.
 */

export const HANDWRITING_FEATURE_FLAGS = {
  /** محرك التنعيم وحساب السماكة التفاعلية مع سرعة اليد (المرحلة 1) */
  SMOOTH_GRAPHICS_ENGINE: true,

  /** الممحاة المزدوجة (الممحاة الجزئية + الممحاة الكائنية للمسار الكامل) (المرحلة 2) */
  DUAL_VECTOR_ERASER: true,

  /** قلم التظليل الاحترافي مع CSS multiply وحظر كبسولات النظام (المرحلة 3) */
  HIGHLIGHTER_TOOL: true,

  /** أداة التحديد باللاسو والتحريك والتكبير النسبي (المرحلة 4) */
  LASSO_TOOL: true,

  /** التعرف التلقائي على الأشكال الهندسية مع التوقف المؤقت (المرحلة 5) */
  SMART_SHAPE_RECOGNITION: true,

  /** التعرف المحلي على النصوص العربية بدون إنترنت (المرحلة 6) */
  OFFLINE_INK_TO_TEXT: true,
} as const;

export type HandwritingFeatureKey = keyof typeof HANDWRITING_FEATURE_FLAGS;

export function isHandwritingFeatureEnabled(key: HandwritingFeatureKey): boolean {
  return HANDWRITING_FEATURE_FLAGS[key] ?? true;
}
