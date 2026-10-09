import type { AgentStepItem } from './literary-agent';
const actions: Record<string, string> = {
  replace_text: 'استبدال نص', insert_text: 'إدراج نص', delete_text: 'حذف نص', ask_writer: 'طلب توضيح',
  merge_blocks: 'دمج فقرتين', move_block: 'نقل فقرة', split_text: 'تقسيم فقرة', replace_all: 'استبدال المواضع المطابقة', diacritize_scope: 'الضبط اللغوي',
  character_continuity_checker: 'فحص اتساق الشخصيات', pacing_and_emotion_analyzer: 'تحليل الإيقاع والمشاعر', plot_hole_detector: 'فحص الحبكة', voice_and_tone_guardian: 'مراجعة النبرة والأسلوب',
};
export type ExecutionResultView = { completed: boolean; failed?: boolean; awaitingClarification?: boolean; skipped?: boolean; totalMutations: number; error?: string };
export function describeExecution(steps: AgentStepItem[], result: ExecutionResultView | undefined, live: boolean) {
  const readOnly = steps.length > 0 && steps.every(s => /^(character_continuity_checker|pacing_and_emotion_analyzer|plot_hole_detector|voice_and_tone_guardian)$/.test(s.toolName));
  const completed = steps.filter(s => s.status === 'completed').length;
  const failed = steps.filter(s => s.status === 'failed').length;
  const active = steps.some(s => s.status === 'active');
  const state = result?.awaitingClarification ? 'awaiting' : result?.skipped ? 'skipped' : result?.failed ? 'failed' : result?.completed ? 'completed' : !live ? 'interrupted' : active ? 'running' : steps.length > 0 && completed === steps.length ? 'finalizing' : 'waiting';
  const header = state === 'awaiting' ? 'بانتظار توضيحك؛ لم يبدأ التنفيذ' : state === 'skipped' ? 'لم يُنفذ طلب مكرر' : state === 'failed' ? `لم تكتمل ${readOnly ? 'عملية الفحص' : 'عملية التنفيذ'}` : state === 'completed' ? (readOnly ? `اكتمل ${completed} فحص للقراءة فقط` : `انتهت المعالجة — ${result!.totalMutations} تغييرات معتمدة`) : state === 'interrupted' ? 'انقطع مسار التنفيذ؛ لا توجد عملية جارية' : state === 'running' ? (readOnly ? 'جارٍ فحص النص…' : 'جارٍ التنفيذ…') : state === 'finalizing' ? 'جارٍ اعتماد النتيجة…' : completed ? 'بانتظار الخطوة التالية…' : 'بانتظار بدء الخطوات…';
  const terminal = state === 'completed' ? (readOnly ? 'اكتمل الفحص' : 'انتهت المعالجة') : state === 'failed' ? `تعذر الإكمال${readOnly && completed ? `؛ اكتمل ${completed} من ${steps.length}` : ''}` : state === 'awaiting' ? 'بانتظار الإجابة' : state === 'skipped' ? 'لم يُعد التنفيذ' : state === 'interrupted' ? 'المسار متوقف' : state === 'running' ? (readOnly ? 'جارٍ التحليل…' : 'جارٍ التنفيذ…') : state === 'finalizing' ? 'الخطوات انتهت؛ النتيجة قيد الاعتماد' : 'بانتظار بدء الخطوة';
  const rows = steps.map(step => {
    let status: string;
    if (state === 'awaiting') status = 'بانتظار التوضيح';
    else if (state === 'skipped') status = 'لم تُنفذ من جديد';
    else if (step.status === 'completed') status = !readOnly && state === 'failed' && result?.totalMutations === 0 ? 'لم يُعتمد تغييرها ضمن النتيجة النهائية' : readOnly ? 'اكتمل الفحص' : 'اكتملت الخطوة';
    else if (step.status === 'failed') status = step.error?.startsWith('لم يبدأ') ? 'لم تبدأ بعد تعذر خطوة سابقة' : step.error ? `تعذرت الخطوة — ${step.error.slice(0, 160)}` : 'تعذرت الخطوة';
    else if (state === 'failed' || state === 'interrupted' || state === 'completed') status = step.status === 'active' ? 'توقفت دون تأكيد اكتمالها' : 'لم تُنفذ';
    else status = step.status === 'active' ? 'قيد التنفيذ' : 'لم تبدأ بعد';
    return `${actions[step.toolName] || 'خطوة غير معروفة'} — ${status}`;
  });
  return { state, header, terminal, rows, completed, failed, readOnly, running: state === 'running' || state === 'finalizing', busy: state === 'running' || state === 'waiting' || state === 'finalizing' };
}
