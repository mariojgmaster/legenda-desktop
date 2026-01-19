import fs from "node:fs";
import path from "node:path";
import type { GeneratedFileDTO } from "../../shared/ipc/dtos";

export class GeneratedFilesStore {
    private filePath: string;

    constructor(userDataPath: string) {
        this.filePath = path.join(userDataPath, "generated.json");
        if (!fs.existsSync(this.filePath)) {
            fs.writeFileSync(this.filePath, JSON.stringify({ items: [] }, null, 2), "utf-8");
        }
    }

    list(): GeneratedFileDTO[] {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw) as { items: GeneratedFileDTO[] };
        return parsed.items ?? [];
    }

    saveAll(items: GeneratedFileDTO[]) {
        fs.writeFileSync(this.filePath, JSON.stringify({ items }, null, 2), "utf-8");
    }

    add(item: GeneratedFileDTO) {
        const items = this.list();
        items.unshift(item);
        this.saveAll(items);
    }

    update(id: string, updater: (x: GeneratedFileDTO) => GeneratedFileDTO) {
        const items = this.list().map((x) => (x.id === id ? updater(x) : x));
        this.saveAll(items);
    }

    remove(id: string) {
        const items = this.list().filter((x) => x.id !== id);
        this.saveAll(items);
    }
}