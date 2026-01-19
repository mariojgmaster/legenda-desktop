export function sanitizeBaseName(input: string): string {
    const trimmed = input.trim();
    const cleaned = trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "");
    return cleaned.replace(/\s+/g, " ").trim();
}