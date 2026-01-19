import type { SegmentPreviewDTO, SubtitleFormat } from "../../shared/ipc/dtos";

export function buildMockPreview(): SegmentPreviewDTO[] {
    return [
        { index: 1, startMs: 320, endMs: 3120, text: "Você já acordou decidido a mudar tudo," },
        { index: 2, startMs: 3120, endMs: 6540, text: "mas poucas horas depois não conseguiu nem começar?" },
        { index: 3, startMs: 6540, endMs: 9880, text: "A motivação vem, mas vai embora rápido." }
    ];
}

export function exportMock(format: SubtitleFormat): string {
    const segs = buildMockPreview();

    if (format === "srt") {
        return segs
            .map((s) => `${s.index}\n${toSrt(s.startMs)} --> ${toSrt(s.endMs)}\n${s.text}\n`)
            .join("\n");
    }

    // ASS básico válido
    const lines = segs
        .map((s) => `Dialogue: 0,${toAss(s.startMs)},${toAss(s.endMs)},Default,,0,0,0,,${escapeAss(s.text)}`)
        .join("\n");

    return `[Script Info]
Title: Legenda
ScriptType: v4.00+
Collisions: Normal
PlayResX: 1920
PlayResY: 1080
Timer: 100.0000

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,2,0,2,80,80,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${lines}
`;
}

function pad(n: number, w = 2) {
    return String(n).padStart(w, "0");
}
function toSrt(ms: number) {
    const hh = Math.floor(ms / 3600000);
    const mm = Math.floor((ms % 3600000) / 60000);
    const ss = Math.floor((ms % 60000) / 1000);
    const mmm = ms % 1000;
    return `${pad(hh)}:${pad(mm)}:${pad(ss)},${String(mmm).padStart(3, "0")}`;
}
function toAss(ms: number) {
    const total = Math.floor(ms / 10); // centiseconds
    const cs = total % 100;
    const s = Math.floor(total / 100) % 60;
    const m = Math.floor(total / 6000) % 60;
    const h = Math.floor(total / 360000);
    return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`;
}
function escapeAss(text: string) {
    return text.replace(/\r?\n/g, "\\N");
}