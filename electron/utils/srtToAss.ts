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

export function convertSrtFileToAss(srtPath: string, assOutPath: string) {
    const srt = fs.readFileSync(srtPath, "utf-8");
    const cues = parseSrt(srt);

    const header = `
[Script Info]
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default, Arial, 44, &H00FFFFFF, &H000000FF, &H00101010, &H64000000, 0, 0, 0, 0, 100, 100, 0, 0, 1, 2, 0, 2, 40, 40, 30, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`.trim();

    const events = cues.map(c => {
        const start = msToAssTime(c.startMs);
        const end = msToAssTime(c.endMs);
        const text = escapeAssText(c.text);
        return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
    });

    const out = header + "\n" + events.join("\n") + "\n";
    fs.writeFileSync(assOutPath, out, "utf-8");
}