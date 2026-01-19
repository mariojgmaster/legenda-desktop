export type SrtCue = {
    index: number;
    startMs: number;
    endMs: number;
    text: string;
};

function timeToMs(t: string) {
    // "00:00:03,060"
    const [hms, msStr] = t.split(",");
    const [hh, mm, ss] = hms.split(":").map(Number);
    const ms = Number(msStr);
    return ((hh * 3600 + mm * 60 + ss) * 1000) + ms;
}

export function parseSrt(content: string): SrtCue[] {
    const blocks = content
        .replace(/\r\n/g, "\n")
        .split(/\n\n+/)
        .map(b => b.trim())
        .filter(Boolean);

    const cues: SrtCue[] = [];

    for (const b of blocks) {
        const lines = b.split("\n");
        if (lines.length < 2) continue;

        const index = Number(lines[0].trim()) || (cues.length + 1);
        const times = lines[1].split("-->").map(s => s.trim());
        if (times.length !== 2) continue;

        const startMs = timeToMs(times[0]);
        const endMs = timeToMs(times[1]);
        const text = lines.slice(2).join("\n").trim();

        cues.push({ index, startMs, endMs, text });
    }

    return cues;
}