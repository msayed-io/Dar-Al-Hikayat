// Separate development entry. Never imported by the application or placed in public/.
import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Handwriting, { type HandwritingHandle, type Stroke } from "../../components/DarAlHikayatHandwriting";
import { StorageService } from "../../lib/storage-service";
import type { ThemeColors } from "../../contexts/AppContext";
if (!(import.meta as any).env.DEV)
    throw new Error("Handwriting diagnostics are development-only");
const dark = new URLSearchParams(location.search).has("dark");
const theme: ThemeColors = { mode: dark ? "apple_dark" : "royal_classic", bg: dark ? "#000000" : "#EAE6D2", text: dark ? "#FFFFFF" : "#121A1B", accent: "#A7AA63", secondary: "#4A5556", glass: "rgba(244,241,228,.96)", border: "rgba(128,128,128,.2)", shadow: "rgba(0,0,0,.3)", isDark: dark };
const KEY = 880000001;
const EMPTY: Stroke[] = [];
function Harness({ seed = EMPTY }: {
    seed?: Stroke[];
}) {
    const ref = useRef<HandwritingHandle>(null);
    const [mode, setMode] = useState(seed.length ? "edit" : "off");
    const [initial, setInitial] = useState<Stroke[]>(seed);
    const ink = useRef<Stroke[]>(EMPTY);
    async function save() {
        const strokes = ref.current!.getStrokes();
        await StorageService.saveStory({ id: KEY, title: "Synthetic handwriting baseline", content: "", styles: { fontSize: 20, fontWeight: 400, textAlign: "right", textColor: theme.text, paperStyleIndex: 0, handwriting: { strokes, isPageRuled: false, dataUrl: ref.current!.getDataUrl() } } });
        return "saved" as const;
    }
    async function restore() {
        const all = await StorageService.loadNotesMetadata();
        const note = all.find(n => n.id === KEY);
        if (!note)
            throw new Error("Baseline saved story missing");
        setInitial(note.styles.handwriting.strokes);
        setMode("edit");
    }
    (window as any).__hwBaseline = {
        mode: setMode,
        load: (strokes: Stroke[]) => { setInitial(strokes); setMode("edit"); },
        strokes: () => ref.current?.getStrokes(),
        undo: () => ref.current?.undo(), redo: () => ref.current?.redo(), clear: () => ref.current?.clear(),
        save, restore,
        reset: () => { ref.current?.clear(); },
    };
    return <Handwriting ref={ref} isActive={mode === "edit"} isReadingMode={mode === "read"} onClose={() => setMode("off")} theme={theme} initialStrokes={initial} title="اختبار خط الأساس" onStrokesChange={s => { ink.current = s; setInitial(s); }} onSave={save}/>;
}
async function bootstrap() {
    // Match the editor's normal opening path: note styles exist before mount.
    const restored = new URLSearchParams(location.search).has("restore")
        ? (await StorageService.loadNotesMetadata()).find(n => n.id === KEY)?.styles?.handwriting?.strokes || EMPTY
        : EMPTY;
    createRoot(document.getElementById("root")!).render(<Harness seed={restored}/>);
}
void bootstrap();
