import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider } from '../../contexts/AppContext';
import Assistant from '../../components/DarAlHikayatAIAssistant';
if (!(import.meta as any).env.DEV) throw new Error('Development QA only');
const editor = document.getElementById('story-content')!;
(window as any).__analysisQA = { original: editor.innerHTML, commits: 0 };
createRoot(document.getElementById('root')!).render(<AppProvider><Assistant storyId="qa-analysis-only" storyContext={{ title: 'عينة اختبار غير حقيقية', fullText: editor.innerHTML }} editorRootElement={editor} onCommitAgentChanges={() => (window as any).__analysisQA.commits++} onClose={() => {}} /></AppProvider>);
