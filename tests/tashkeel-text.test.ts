import { describe, it, expect } from "vitest";
import {
  stripForCompare,
  hamzaFold,
  invariantHolds,
  diacriticDensity,
  isAlreadyVocalized,
  parseNumberedBatch,
} from "../lib/tashkeel-text";

describe("Tashkeel Mechanical Invariant Engine (T-B)", () => {
  describe("1. تجريد النص والمقارنة (stripForCompare)", () => {
    it("يزيل علامات التشكيل بالكامل", () => {
      const text = "ذَهَبَ زَيْدٌ إِلَى الحَدِيقَةِ مَسَاءً";
      expect(stripForCompare(text)).toBe("ذهب زيد إلى الحديقة مساء");
    });

    it("يزيل التطويل / الكشيدة", () => {
      const text = "كــــتـــــاب جــمـيــل";
      expect(stripForCompare(text)).toBe("كتاب جميل");
    });

    it("يتجاهل الفواصل وعلامات الترقيم ويوحد المسافات", () => {
      const text = "قال: «مرحباً، يا صديقي!»... فأجاب: «أهلاً».";
      expect(stripForCompare(text)).toBe("قال مرحبا يا صديقي فأجاب أهلا");
    });
  });

  describe("2. توحيد عائلة الهمزة (hamzaFold)", () => {
    it("يوحد {ا أ إ آ ؤ ئ ء} إلى ا", () => {
      expect(hamzaFold("أحمد إبراهيم آدم مؤمن بيئة سماء")).toBe("احمد ابراهيم ادم مامن بياة سماا");
    });

    it("لا يلمس التاء المربوطة/الهاء أو الألف المقصورة/الياء (حظر مطلق)", () => {
      const text = "فتاة مدينة وجه على إلى يمشي هدى";
      const folded = hamzaFold(text);
      // 'ة' should remain 'ة', 'ه' should remain 'ه', 'ى' should remain 'ى', 'ي' should remain 'ي'
      expect(folded.includes("فتاة")).toBe(true);
      expect(folded.includes("مدينة")).toBe(true);
      expect(folded.includes("وجه")).toBe(true);
      expect(folded.includes("على")).toBe(true);
      expect(folded.includes("هدى")).toBe(true);
    });
  });

  describe("3. الثابت الميكانيكي (invariantHolds)", () => {
    it("يقبل النص المشكّل مع فواصل أدبية وهمزات صحيحة", () => {
      const original = "قال احمد لصديقه مرحبا بك في دار الحكايات";
      const vocalized = "قَالَ «أَحْمَدُ» لِصَدِيقِهِ: «مَرْحَبًا بِكَ فِي دَارِ الحِكَايَاتِ!»";
      expect(invariantHolds(original, vocalized)).toBe(true);
    });

    it("يقبل تصحيح الهمزات ضمن العائلة (وصل / قطع / نبرة)", () => {
      const original = "سال الكاتب عن رايه في المسالة واقبل اكراما له";
      const vocalized = "سَأَلَ الكَاتِبُ عَنْ رَأْيِهِ فِي المَسْأَلَةِ، وَأَقْبَلَ إِكْرَامًا لَهُ.";
      expect(invariantHolds(original, vocalized)).toBe(true);
    });

    it("يرفض رفضاً قاطعاً تغيير أي حرف خارج عائلة الهمزة", () => {
      const original = "كان البيت هادئا في الليل";
      const altered = "كَانَ المَنْزِلُ هَادِئًا فِي اللَّيْلِ"; // تبديل البيت بالمنزل
      expect(invariantHolds(original, altered)).toBe(false);
    });

    it("يرفض حذف كلمة أو حرف", () => {
      const original = "ذهب زيد مسرعا إلى المدرسة";
      const truncated = "ذَهَبَ زَيْدٌ إِلَى المَدْرَسَةِ"; // حذف مسرعاً
      expect(invariantHolds(original, truncated)).toBe(false);
    });

    it("يرفض إضافة كلمة أو حرف", () => {
      const original = "جلس في الحديقة";
      const extended = "جَلَسَ فِي الحَدِيقَةِ الوَاسِعَةِ"; // إضافة الواسعة
      expect(invariantHolds(original, extended)).toBe(false);
    });

    it("يرفض تحويل التاء المربوطة إلى هاء أو العكس", () => {
      const original = "رأيت القطة الجميلة";
      const altered = "رَأَيْتُ القِطَّه الجَمِيلَه"; // ة -> ه
      expect(invariantHolds(original, altered)).toBe(false);
    });

    it("يرفض تحويل الألف المقصورة إلى ياء أو العكس", () => {
      const original = "مشى الفتى إلى المستشفى";
      const altered = "مَشِي الفَتِي إِلَى المُسْتَشْفِي"; // ى -> ي
      expect(invariantHolds(original, altered)).toBe(false);
    });
  });

  describe("4. كثافة التشكيل وسياسة التخطي (diacriticDensity & Threshold)", () => {
    it("يحسب كثافة الحركات بدقة", () => {
      const plain = "هذا نص مجرد تماما من الحركات";
      expect(diacriticDensity(plain)).toBe(0);

      const heavy = "هَذَا نَصٌّ مُشَكَّلٌ تَشْكِيلًا دَقِيقًا";
      const density = diacriticDensity(heavy);
      expect(density).toBeGreaterThan(0.20);
    });

    it("يتخطى الفقرات المنجزة التي تتجاوز كثافتها العتبة 0.10", () => {
      const alreadyVocalizedText = "فَتَحَ البَابَ وَدَخَلَ الغُرْفَةَ بِهُدُوءٍ.";
      expect(isAlreadyVocalized(alreadyVocalizedText)).toBe(true);

      const unvocalizedText = "فتح الباب ودخل الغرفة بهدوء.";
      expect(isAlreadyVocalized(unvocalizedText)).toBe(false);
    });
  });

  describe("5. تحليل الدفعة المرقمة (parseNumberedBatch)", () => {
    it("يحلل 3 فقرات متسلسلة بنجاح", () => {
      const response = `[1] الفقرة الأولى المشكّلة.\n[2] الفقرة الثانية المشكّلة.\n[3] الفقرة الثالثة المشكّلة.`;
      const parsed = parseNumberedBatch(response, 3);
      expect(parsed).not.toBeNull();
      expect(parsed?.length).toBe(3);
      expect(parsed?.[0]).toBe("الفقرة الأولى المشكّلة.");
      expect(parsed?.[1]).toBe("الفقرة الثانية المشكّلة.");
      expect(parsed?.[2]).toBe("الفقرة الثالثة المشكّلة.");
    });

    it("يفشل ويعيد null عند نقص إحدى الفقرات", () => {
      const response = `[1] الفقرة الأولى المشكّلة.\n[3] الفقرة الثالثة المشكّلة.`; // missing [2]
      expect(parseNumberedBatch(response, 3)).toBeNull();
    });

    it("يفشل ويعيد null عند زيادة فقرة غير متوقعة", () => {
      const response = `[1] فقرة 1\n[2] فقرة 2\n[3] فقرة 3\n[4] فقرة 4 زائدة`;
      expect(parseNumberedBatch(response, 3)).toBeNull();
    });
  });
});
