import fs from "node:fs";
import { parseSrt } from "./srtParse";

function msToAssTime(ms: number) {
    // h:mm:ss.cc (centiseconds)
    const cs = Math.floor(ms / 10);
    const cc = cs % 100;
    const totalSec = Math.floor(cs / 100);
    const ss = totalSec % 60;
    const totalMin = Math.floor(totalSec / 60);
    const mm = totalMin % 60;
    const hh = Math.floor(totalMin / 60);
    return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(cc).padStart(2, "0")}`;
}

function escapeAssText(t: string) {
    // ASS usa \N pra quebra de linha
    return t.replace(/\r\n/g, "\n").replace(/\n/g, "\\N");
}

type ConvertAssOptions = {
    karaoke?: boolean;
};

function toKaraokeText(text: string, startMs: number, endMs: number) {
    const normalized = text.replace(/\r\n/g, "\n").trim();
    if (!normalized) return "";

    const lines = normalized
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    const words = lines.flatMap((line) => line.split(/\s+/).filter(Boolean));
    if (words.length === 0) return "";

    const totalCs = Math.max(1, Math.floor((endMs - startMs) / 10));
    const base = Math.max(1, Math.floor(totalCs / words.length));
    let remainder = totalCs - base * words.length;

    return words
        .map((word) => {
            const extra = remainder > 0 ? 1 : 0;
            if (remainder > 0) remainder -= 1;
            return `{\\k${base + extra}}${word}`;
        })
        .join(" ");
}

export function convertSrtFileToAss(srtPath: string, assOutPath: string, opts?: ConvertAssOptions) {
    const srt = fs.readFileSync(srtPath, "utf-8");
    const cues = parseSrt(srt);
    const karaoke = Boolean(opts?.karaoke);

    const header = `
[Script Info]
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default, Arial, 44, &H00FFFFFF, &H0000D7FF, &H00101010, &H64000000, 0, 0, 0, 0, 100, 100, 0, 0, 1, 2, 0, 2, 40, 40, 30, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`.trim();

    const events = cues.map((c) => {
        const start = msToAssTime(c.startMs);
        const end = msToAssTime(c.endMs);
        const text = karaoke ? toKaraokeText(c.text, c.startMs, c.endMs) : escapeAssText(c.text);
        return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
    });

    const out = `${header}\n${events.join("\n")}\n`;
    fs.writeFileSync(assOutPath, out, "utf-8");
}
