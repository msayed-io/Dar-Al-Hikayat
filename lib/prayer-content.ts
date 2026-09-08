// lib/prayer-content.ts
// ثوابت ومحتوى شاشة مواقيت الصلاة والمحراب

export interface PrayerReflection {
  isQuran: boolean;
  text: string;
  source: string;
}

export const PRAYER_BACKGROUNDS: Record<string, string> = {
  fajr: "https://images.unsplash.com/photo-1542816417-0983c9c9ad53?q=80&w=1200&auto=format&fit=crop", // Dawn over minarets
  sunrise: "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?q=80&w=1200&auto=format&fit=crop", // Sunrise golden light
  duha: "https://images.unsplash.com/photo-1564769625905-50e93615e769?q=80&w=1200&auto=format&fit=crop", // Morning bright mosque
  dhuhr: "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?q=80&w=1200&auto=format&fit=crop", // Midday arches
  asr: "https://images.unsplash.com/photo-1519817650390-64a93db51149?q=80&w=1200&auto=format&fit=crop", // Afternoon warm amber
  maghrib: "https://images.unsplash.com/photo-1565552645632-d725f8bfc19a?q=80&w=1200&auto=format&fit=crop", // Sunset twilight
  isha: "https://images.unsplash.com/photo-1507692049790-de58290a4334?q=80&w=1200&auto=format&fit=crop", // Night starry mosque
};

export const PRAYER_REFLECTIONS: Record<string, PrayerReflection> = {
  fajr: {
    isQuran: true,
    text: "أَقِمِ الصَّلَاةَ لِدُلُوكِ الشَّمْسِ إِلَىٰ غَسَقِ اللَّيْلِ وَقُرْآنَ الْفَجْرِ ۖ إِنَّ قُرْآنَ الْفَجْرِ كَانَ مَشْهُودًا",
    source: "سورة الإسراء — آية ٧٨",
  },
  sunrise: {
    isQuran: true,
    text: "فَاصْبِرْ عَلَىٰ مَا يَقُولُونَ وَسَبِّحْ بِحَمْدِ رَبِّكَ قَبْلَ طُلُوعِ الشَّمْسِ وَقَبْلَ الْغُرُوبِ",
    source: "سورة ق — آية ٣٩",
  },
  duha: {
    isQuran: false,
    text: "يُصْبِحُ عَلَى كُلِّ سُلاَمَى مِنْ أَحَدِكُمْ صَدَقَةٌ... وَيُجْزِئُ مِنْ ذَلِكَ رَكْعَتَانِ يَرْكَعُهُمَا مِنَ الضُّحَى",
    source: "صحيح مسلم — حديث ٧٢٠",
  },
  dhuhr: {
    isQuran: false,
    text: "إِنَّ هَذِهِ سَاعَةٌ تُفْتَحُ فِيهَا أَبْوَابُ السَّمَاءِ، فَأُحِبُّ أَنْ يَصْعَدَ لِي فِيهَا عَمَلٌ صَالِحٌ",
    source: "سنن الترمذي — حديث ٤٧٨",
  },
  asr: {
    isQuran: true,
    text: "حَافِظُوا عَلَى الصَّلَوَاتِ وَالصَّلَاةِ الْوُسْطَىٰ وَقُومُوا لِلَّهِ قَانِتِينَ",
    source: "سورة البقرة — آية ٢٣٨",
  },
  maghrib: {
    isQuran: true,
    text: "فَسُبْحَانَ اللَّهِ حِينَ تُمْسُونَ وَحِينَ تُصْبِحُونَ ۝ وَلَهُ الْحَمْدُ فِي السَّمَاوَاتِ وَالْأَرْضِ وَعَشِيًّا وَحِينَ تُظْهِرُونَ",
    source: "سورة الروم — آية ١٧-١٨",
  },
  isha: {
    isQuran: false,
    text: "بَشِّرِ الْمَشَّائِينَ فِي الظُّلَمِ إِلَى الْمَسَاجِدِ بِالنُّورِ التَّامِّ يَوْمَ الْقِيَامَةِ",
    source: "سنن أبي داود — حديث ٥٦١",
  },
};

export interface HadithItem {
  id: number;
  text: string;
  narrator: string;
  source: string;
  explanation?: string;
}

export const DAILY_HADITHS: HadithItem[] = [
  {
    id: 1,
    text: "مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا، سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ",
    narrator: "عن أبي هريرة رضي الله عنه",
    source: "صحيح مسلم",
    explanation: "فضل السعي في طلب العلم الشرعي والنافع",
  },
  {
    id: 2,
    text: "أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ",
    narrator: "عن عائشة رضي الله عنها",
    source: "صحيح البخاري ومسلم",
    explanation: "المداومة على العمل الصالح وإن كان يسيراً",
  },
  {
    id: 3,
    text: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
    narrator: "عن عثمان بن عفان رضي الله عنه",
    source: "صحيح البخاري",
    explanation: "عظمة تعلم القرآن الكريم وتعليمه للناس",
  },
  {
    id: 4,
    text: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى",
    narrator: "عن عمر بن الخطاب رضي الله عنه",
    source: "متفق عليه",
    explanation: "إخلاص النية لله تعالى في سائر الأعمال",
  },
  {
    id: 5,
    text: "لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ",
    narrator: "عن أنس بن مالك رضي الله عنه",
    source: "صحيح البخاري",
    explanation: "كمال الإيمان وحب الخير لجميع المسلمين",
  },
];

export function getTodayHadith(date: Date = new Date()): HadithItem {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  return DAILY_HADITHS[dayOfYear % DAILY_HADITHS.length];
}

export const RING_RADIUS = 36;
export const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
