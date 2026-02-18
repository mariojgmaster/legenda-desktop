import fs from "node:fs";
import path from "node:path";
import type { GeneratedFileDTO } from "../../shared/ipc/dtos";

export class GeneratedFilesStore {
    private filePath: string;
    private items: GeneratedFileDTO[];

    constructor(userDataPath: string) {
        this.filePath = path.join(userDataPath, "generated.json");
        if (!fs.existsSync(this.filePath)) {
            fs.writeFileSync(this.filePath, JSON.stringify({ items: [] }), "utf-8");
        }

        const raw = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw) as { items?: GeneratedFileDTO[] };
        this.items = Array.isArray(parsed.items) ? parsed.items : [];
    }

    list(): GeneratedFileDTO[] {
        return [...this.items];
    }

    private persist() {
        fs.writeFileSync(this.filePath, JSON.stringify({ items: this.items }), "utf-8");
    }

    add(item: GeneratedFileDTO) {
        this.items.unshift(item);
        this.persist();
    }

    update(id: string, updater: (x: GeneratedFileDTO) => GeneratedFileDTO) {
        this.items = this.items.map((x) => (x.id === id ? updater(x) : x));
        this.persist();
    }

    remove(id: string) {
        this.items = this.items.filter((x) => x.id !== id);
        this.persist();
    }
}
