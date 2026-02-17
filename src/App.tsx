import React, { useEffect, useMemo, useState } from "react";
import type { GeneratedFileDTO, GranularityPreset, LanguageCode, ModelId, SubtitleFormat } from "../shared/ipc/dtos";

import "./App.css";

function baseNameFromFile(name: string) {
    const i = name.lastIndexOf(".");
    return i > 0 ? name.slice(0, i) : name;
}

function sanitizeBaseName(input: string) {
    const trimmed = input.trim();
    const cleaned = trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "");
    return cleaned.replace(/\s+/g, " ").trim();
}

type StepKey = "IDLE" | "PREPARING" | "TRANSCRIBING" | "CONVERTING" | "SAVING" | "DONE" | "ERROR";

const STEPS: { key: StepKey; label: string }[] = [
    { key: "PREPARING", label: "Preparando" },
    { key: "TRANSCRIBING", label: "Transcrevendo" },
    { key: "CONVERTING", label: "Convertendo" },
    { key: "SAVING", label: "Salvando" },
    { key: "DONE", label: "Concluído" }
];

export default function App() {
    // Anti-tela-branca: se preload falhar, não explode o app
    if (!window.api) {
        return (
            <div style={styles.page}>
                <h1 style={{ margin: "4px 0 14px" }}>Legenda Desktop</h1>
                <div style={styles.card}>
                    <h2 style={styles.h2}>Inicializando integração…</h2>
                    <p style={{ marginTop: 8, color: "#555", lineHeight: 1.4 }}>
                        O preload/IPC não carregou. Isso normalmente acontece quando o preload falha em runtime.
                    </p>
                    <p style={{ marginTop: 8, color: "#555", lineHeight: 1.4 }}>
                        Abra o DevTools (Ctrl+Shift+I) e verifique erros de preload.
                    </p>
                </div>
            </div>
        );
    }

    const [audio, setAudio] = useState<{ path: string; name: string } | null>(null);

    const [language, setLanguage] = useState<LanguageCode>("pt");
    const [modelId, setModelId] = useState<ModelId>("small");
    const [format, setFormat] = useState<SubtitleFormat>("srt");
    const [assKaraoke, setAssKaraoke] = useState(false);

    const [outputPath, setOutputPath] = useState<string>("");
    const [busy, setBusy] = useState(false);

    const [step, setStep] = useState<StepKey>("IDLE");
    const [message, setMessage] = useState<string>("");

    const [preview, setPreview] = useState<{ index: number; text: string }[]>([]);
    const [generated, setGenerated] = useState<GeneratedFileDTO[]>([]);
    const [selectedId, setSelectedId] = useState<string>("");

    const [granularity, setGranularity] = useState<GranularityPreset>("MEDIUM");

    const MENU_W = 200;
    const MENU_PAD = 10;

    const [menu, setMenu] = useState<{
        id: string;
        anchor: DOMRect; // posição do botão na tela
    } | null>(null);

    const [audioUrl, setAudioUrl] = useState<string>("");
    const [isMaximized, setIsMaximized] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

    // Busca na lista
    const [query, setQuery] = useState("");
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return generated;
        return generated.filter((g) => g.fileName.toLowerCase().includes(q));
    }, [generated, query]);

    // Modal renomear
    const [renameOpen, setRenameOpen] = useState(false);
    const [renameValue, setRenameValue] = useState("");

    const selected = useMemo(() => generated.find((g) => g.id === selectedId) || null, [generated, selectedId]);

    const canChooseOutput = !!audio && !busy;
    const canGenerate = !!audio && !!outputPath && !busy;
    const isCompactLayout = viewportWidth < 1100;

    const disabledReason = useMemo(() => {
        if (busy) return "Processando...";
        if (!audio) return "Selecione um áudio";
        if (!outputPath) return "Escolha onde salvar";
        return "";
    }, [busy, audio, outputPath]);

    async function refreshGenerated(selectId?: string) {
        const res = await window.api.listGeneratedFiles();
        if (res.ok) {
            setGenerated(res.items);
            if (selectId) setSelectedId(selectId);
            else if (res.items.length > 0 && !selectedId) setSelectedId(res.items[0].id);
        }
    }

    useEffect(() => {
        refreshGenerated();

        const off1 = window.api.onJobProgress((e) => {
            setStep((e.step as StepKey) ?? "IDLE");
            setMessage(e.message || "");
        });

        const off2 = window.api.onJobDone((e) => {
            setBusy(false);
            setStep("DONE");
            setMessage("Concluído.");
            setPreview(e.preview.map((p) => ({ index: p.index, text: p.text })));
            refreshGenerated(e.generated.id);
        });

        const off3 = window.api.onJobError((e) => {
            setBusy(false);
            setStep("ERROR");
            setMessage(e.error.message || "Erro.");
        });

        const off4 = window.api.onGeneratedChanged(() => refreshGenerated());

        return () => {
            off1();
            off2();
            off3();
            off4();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const onResize = () => setViewportWidth(window.innerWidth);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        if (!menu) return;

        const close = () => setMenu(null);

        const onMouseDown = (e: MouseEvent) => {
            // clique fora fecha; clique dentro do menu não (vamos parar no container)
            close();
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") close();
        };

        const onResize = () => close();
        const onScroll = () => close();

        window.addEventListener("mousedown", onMouseDown);
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("resize", onResize);
        window.addEventListener("scroll", onScroll, true); // true = captura scroll em qualquer container

        return () => {
            window.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("resize", onResize);
            window.removeEventListener("scroll", onScroll, true);
        };
    }, [menu]);

    function clamp(n: number, min: number, max: number) {
        return Math.max(min, Math.min(max, n));
    }

    async function pickAudio() {
        const res = await window.api.pickAudio();
        if (!res.ok) return;
        setAudio(res.file);
        setOutputPath("");
        setPreview([]);
        setStep("IDLE");
        setMessage(`Selecionado: ${res.file.name}`);

        const u = await window.api.getFileUrl(res.file.path);
        if (u.ok) setAudioUrl(u.url);
        else setAudioUrl("");
    }

    async function chooseOutput() {
        if (!audio) return null;
        const suggestedBaseName = baseNameFromFile(audio.name);
        const res = await window.api.chooseOutputPath({ suggestedBaseName, format });
        if (!res.ok) return null;
        setOutputPath(res.path);
        return res.path;
    }

    async function start() {
        if (!audio) return;

        let finalOutputPath = outputPath;

        // UX: ao clicar gerar sem outputPath, escolhe destino e já inicia automaticamente
        if (!finalOutputPath) {
            const chosen = await chooseOutput();
            if (!chosen) return;
            finalOutputPath = chosen;
        }

        setBusy(true);
        setPreview([]);
        setStep("PREPARING");
        setMessage("Iniciando...");

        await window.api.startJob({
            audioPath: audio.path,
            outputPath: finalOutputPath,
            language,
            modelId,
            format,
            granularity,
            assKaraoke
        });
    }

    // Ações por item
    async function openFile(id: string) {
        await window.api.openGeneratedFile({ id });
    }
    async function showInFolder(id: string) {
        await window.api.showInFolder({ id });
    }

    function openRenameModal(id: string) {
        const item = generated.find((g) => g.id === id);
        if (!item) return;
        setRenameValue(baseNameFromFile(item.fileName));
        setSelectedId(id);
        setRenameOpen(true);
    }

    const renameValidation = useMemo(() => {
        const v = sanitizeBaseName(renameValue);
        if (!v) return { ok: false, msg: "Informe um nome." };
        if (v.length > 120) return { ok: false, msg: "Nome muito longo." };
        return { ok: true, msg: "" };
    }, [renameValue]);

    async function confirmRename() {
        if (!selected) return;
        const v = sanitizeBaseName(renameValue);
        if (!v) return;

        try {
            const res = await window.api.renameGeneratedFile({ id: selected.id, newBaseName: v });
            if (res.ok) {
                setRenameOpen(false);
                await refreshGenerated(res.item.id);
            }
        } catch (e: any) {
            alert(e?.message || String(e));
        }
    }

    async function deleteItem(id: string) {
        const item = generated.find((g) => g.id === id);
        if (!item) return;

        const ok = confirm(`Apagar do disco?\n\n${item.fileName}\n\nEssa ação não pode ser desfeita.`);
        if (!ok) return;

        try {
            await window.api.deleteGeneratedFile({ id });
            if (selectedId === id) setSelectedId("");
            await refreshGenerated();
        } catch (e: any) {
            alert(e?.message || String(e));
        }
    }

    async function removeFromHistoryOnly(id: string) {
        // Atalho: se o arquivo não existe, a ação mais útil é remover do histórico.
        // Reaproveitando deleteGeneratedFile (já remove do store) — ele tenta unlink se existir.
        await window.api.deleteGeneratedFile({ id });
        if (selectedId === id) setSelectedId("");
        await refreshGenerated();
    }

    const stepIndex = useMemo(() => {
        const idx = STEPS.findIndex((s) => s.key === step);
        return idx;
    }, [step]);

    function flowColors(state: "idle" | "current" | "done" | "error") {
        // tons pastéis
        if (state === "idle") return { bg: "#f6f6f6", border: "#e6e6e6", text: "#777", line: "#e8e8e8" };
        if (state === "current") return { bg: "#eeeeee", border: "#d6d6d6", text: "#444", line: "#d6d6d6" };
        if (state === "done") return { bg: "#e9f6ee", border: "#bfe6cc", text: "#2f6b3f", line: "#bfe6cc" };
        return { bg: "#fdecec", border: "#f2b8b8", text: "#8a1f1f", line: "#f2b8b8" };
    }

    // Mapeia step atual para índice do fluxo
    const flowIndex = useMemo(() => {
        if (step === "IDLE") return -1;
        const idx = STEPS.findIndex((s) => s.key === step);
        return idx;
    }, [step]);

    async function handleMinimizeWindow() {
        await window.api.windowMinimize();
    }

    async function handleToggleMaximizeWindow() {
        const res = await window.api.windowMaximizeToggle();
        if (res?.ok) setIsMaximized(res.maximized);
    }

    async function handleCloseWindow() {
        await window.api.windowClose();
    }

    return (
        <div style={styles.page}>
            <header className="window-topbar">
                <div className="window-brand">
                    <span className="window-dot" />
                    <strong>Legenda Desktop</strong>
                    <span className="window-subtitle">Transcrição profissional</span>
                </div>

                <div className="window-controls no-drag">
                    <button className="window-control-btn" onClick={handleMinimizeWindow} title="Minimizar" aria-label="Minimizar">
                        —
                    </button>
                    <button className="window-control-btn" onClick={handleToggleMaximizeWindow} title="Maximizar" aria-label="Maximizar">
                        {isMaximized ? "❐" : "□"}
                    </button>
                    <button className="window-control-btn close" onClick={handleCloseWindow} title="Fechar" aria-label="Fechar">
                        ✕
                    </button>
                </div>
            </header>

            <main style={styles.contentWrap}>
                <h1 style={styles.h1}>Legenda Desktop</h1>
                <p style={styles.subheading}>Gere legendas com qualidade e fluxo otimizado em poucos cliques.</p>

                <div style={styles.grid2}>
                {/* Configuração */}
                <div style={styles.card} className="app-card">
                    <h2 style={styles.h2}>Configuração</h2>

                    <section style={styles.section}>
                        <div style={styles.label}>Arquivo de áudio</div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <button onClick={pickAudio} disabled={busy}>
                                Selecionar áudio
                            </button>
                            <div style={{ color: "#444" }}>{audio ? audio.name : "Nenhum arquivo selecionado"}</div>
                        </div>
                        {audio && audioUrl && (
                            <div style={{ marginTop: 10 }}>
                                <audio controls src={audioUrl} style={{ width: "100%" }} />
                            </div>
                        )}
                    </section>

                    <section style={styles.section}>
                        <div style={styles.label}>Opções</div>
                        <div style={styles.gridOptions}>
                            <div>
                                <div style={styles.mini}>Idioma</div>
                                <select value={language} onChange={(e) => setLanguage(e.target.value as any)} disabled={busy}>
                                    <option value="pt">PT-BR</option>
                                    <option value="en">EN</option>
                                    <option value="es">ES</option>
                                    <option value="fr">FR</option>
                                    <option value="de">DE</option>
                                    <option value="it">IT</option>
                                </select>
                            </div>

                            <div>
                                <div style={styles.mini}>Modelo</div>
                                <select value={modelId} onChange={(e) => setModelId(e.target.value as any)} disabled={busy}>
                                    <option value="tiny">tiny</option>
                                    <option value="base">base</option>
                                    <option value="small">small (default)</option>
                                    <option value="medium">medium</option>
                                </select>
                            </div>

                            <div>
                                <div style={styles.mini}>Formato</div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button onClick={() => setFormat("srt")} disabled={busy} style={format === "srt" ? styles.pillOn : styles.pillOff}>
                                        SRT
                                    </button>
                                    <button onClick={() => setFormat("ass")} disabled={busy} style={format === "ass" ? styles.pillOn : styles.pillOff}>
                                        ASS (básico)
                                    </button>
                                </div>
                            </div>


                            {format === "ass" && (
                                <div>
                                    <div style={styles.mini}>Estilo ASS</div>
                                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "#444" }}>
                                        <input
                                            type="checkbox"
                                            checked={assKaraoke}
                                            onChange={(e) => setAssKaraoke(e.target.checked)}
                                            disabled={busy}
                                        />
                                        Aplicar estilo karaokê (realce progressivo por palavra)
                                    </label>
                                </div>
                            )}

                            {audio && audioUrl && (
                                <div>
                                    {/* <label className="text-sm opacity-80">Granularidade</label> */}
                                    <div style={styles.mini}>Granularidade</div>
                                    <select
                                        value={granularity}
                                        onChange={(e) => setGranularity(e.target.value as GranularityPreset)}
                                        className="w-full rounded-lg border px-3 py-2"
                                    >
                                        <option value="LOW">Baixa (mais denso)</option>
                                        <option value="MEDIUM">Média (recomendado)</option>
                                        <option value="HIGH">Alta</option>
                                        <option value="ULTRA">Altíssima (mais picado)</option>
                                    </select>
                                </div>
                            )}

                            <div>
                                <div style={styles.mini}>Salvar como</div>
                                <button onClick={chooseOutput} disabled={!canChooseOutput}>
                                    Escolher onde salvar…
                                </button>
                                <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{outputPath ? outputPath : "Nenhum local escolhido ainda."}</div>
                            </div>
                        </div>
                    </section>

                    <section style={styles.section}>
                        <button
                            onClick={start}
                            disabled={!audio || busy} // UX: permite clique mesmo sem outputPath (abre dialog)
                            style={styles.primaryBtn}
                            title={disabledReason}
                        >
                            {busy ? "Gerando..." : "Gerar legenda"}
                        </button>

                        {!canGenerate && (
                            <div style={{ marginTop: 8, fontSize: 12, color: "#777" }}>
                                {busy ? "Processando..." : audio ? "Ao clicar, você escolherá onde salvar se ainda não escolheu." : "Selecione um áudio para continuar."}
                            </div>
                        )}
                    </section>
                </div>

                {/* Execução */}
                <div style={styles.card} className="app-card">
                    <h2 style={styles.h2}>Execução</h2>

                    <section style={styles.section}>
                        <div style={styles.label}>Progresso</div>

                        {/* Stepper */}
                        <div style={styles.flowWrap}>
                            <div style={styles.flowRow}>
                                {STEPS.map((s, i) => {
                                    const isIdle = flowIndex === -1 && step !== "ERROR";
                                    const isDone = flowIndex >= 0 && i < flowIndex && step !== "ERROR";
                                    const isCurrent = flowIndex >= 0 && i === flowIndex && step !== "ERROR";
                                    const isFinalDone = step === "DONE" && i === STEPS.length - 1;
                                    const isError = step === "ERROR" && i === Math.max(flowIndex, 0); // destaca onde estava

                                    const state: "idle" | "current" | "done" | "error" =
                                        isError ? "error" : isFinalDone || isDone ? "done" : isCurrent ? "current" : "idle";

                                    const c = flowColors(state);

                                    return (
                                        <React.Fragment key={s.key}>
                                            <div style={{ ...styles.flowNode, background: c.bg, borderColor: c.border, color: c.text }}>
                                                {s.label}
                                            </div>

                                            {i < STEPS.length - 1 && (
                                                <div style={{ ...styles.flowLine, background: c.line }} />
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>

                            <div style={styles.flowHint}>
                                {step === "IDLE"
                                    ? "Aguardando execução."
                                    : step === "ERROR"
                                        ? "Ocorreu um erro. Verifique e tente novamente."
                                        : busy
                                            ? "Processando…"
                                            : step === "DONE"
                                                ? "Concluído com sucesso."
                                                : ""}
                            </div>

                            {busy && (
                                <div style={{ marginTop: 10, height: 8, background: "#f1f1f1", borderRadius: 999, overflow: "hidden" }}>
                                    <div style={styles.indeterminateBar} />
                                </div>
                            )}
                        </div>
                    </section>

                    <section style={styles.section}>
                        <div style={styles.label}>Prévia</div>
                        {preview.length === 0 ? (
                            <div style={{ color: "#777", fontSize: 13 }}>A prévia aparece ao concluir.</div>
                        ) : (
                            <ol style={{ margin: "8px 0 0 18px" }}>
                                {preview.map((p) => (
                                    <li key={p.index} style={{ marginBottom: 6 }}>
                                        {p.text}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>
                </div>
            </div>

            {/* Arquivos gerados */}
            <div style={{ ...styles.card, marginTop: 14 }} className="app-card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <h2 style={styles.h2}>Arquivos gerados</h2>

                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar por nome…"
                        style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            width: "min(320px, 100%)"
                        }}
                    />
                </div>

                {generated.length === 0 ? (
                    <div style={{ marginTop: 10, color: "#777", fontSize: 13 }}>
                        Ainda não há arquivos gerados. Selecione um áudio e gere sua primeira legenda.
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ marginTop: 10, color: "#777", fontSize: 13 }}>
                        Nenhum resultado para “{query}”.
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: isCompactLayout ? "1fr" : "minmax(280px, 420px) minmax(0, 1fr)", gap: 12, marginTop: 12 }}>
                        {/* Lista */}
                        <div style={{ borderRight: isCompactLayout ? "none" : "1px solid #eee", paddingRight: isCompactLayout ? 0 : 12, maxHeight: 320, overflow: "auto", minWidth: 0 }}>
                            {filtered.map((g) => (
                                <div
                                    key={g.id}
                                    style={{
                                        padding: 10,
                                        borderRadius: 12,
                                        border: g.id === selectedId ? "1px solid #bbb" : "1px solid #eee",
                                        marginBottom: 8,
                                        background: g.exists ? "#fff" : "#fff7f7"
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                        <div
                                            onClick={() => setSelectedId(g.id)}
                                            style={{ cursor: "pointer", flex: 1 }}
                                            title={g.path}
                                        >
                                            <div style={{ fontWeight: 800, fontSize: 13 }}>{g.fileName}</div>
                                            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                                                {new Date(g.createdAtISO).toLocaleString()} • {g.language} • {g.modelId} • {g.format.toUpperCase()}
                                            </div>
                                            {!g.exists && <div style={{ fontSize: 12, color: "#b00020", marginTop: 4 }}>Arquivo não encontrado</div>}
                                        </div>

                                        {/* Ações rápidas */}
                                        <div style={styles.menuWrap} onClick={(e) => e.stopPropagation()}>
                                            <button
                                                style={styles.menuBtn}
                                                title="Opções"
                                                onClick={(e) => {
                                                    e.stopPropagation();

                                                    const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();

                                                    setMenu((prev) => {
                                                        // toggle
                                                        if (prev?.id === g.id) return null;
                                                        return { id: g.id, anchor: r };
                                                    });
                                                }}
                                            >
                                                ⋯
                                            </button>

                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Detalhe */}
                        <div style={{ minWidth: 0 }}>
                            {!selected ? (
                                <div style={{ color: "#777", fontSize: 13 }}>Selecione um item para ver detalhes.</div>
                            ) : (
                                <div style={{ fontSize: 13 }}>
                                    <div>
                                        <b>Nome:</b> {selected.fileName}
                                    </div>
                                    <div style={{ marginTop: 8 }}>
                                        <b>Caminho:</b> {selected.path}
                                    </div>
                                    <div style={{ marginTop: 8 }}>
                                        <b>Idioma:</b> {selected.language} • <b>Modelo:</b> {selected.modelId} • <b>Formato:</b> {selected.format.toUpperCase()}
                                    </div>

                                    {!selected.exists && (
                                        <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: "1px solid #f1c2c2", background: "#fff7f7" }}>
                                            <div style={{ fontWeight: 800, color: "#b00020" }}>Arquivo não encontrado</div>
                                            <div style={{ marginTop: 6, color: "#555" }}>
                                                Ele pode ter sido movido ou apagado fora do app. Você pode remover este item do histórico.
                                            </div>
                                            <div style={{ marginTop: 10 }}>
                                                <button onClick={() => removeFromHistoryOnly(selected.id)}>Remover do histórico</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Generated File - Menu Options */}
            {menu && (
                <div
                    style={styles.menuFixed}
                    // clique no backdrop fecha
                    onMouseDown={() => setMenu(null)}
                >
                    {(() => {
                        const g = generated.find((x) => x.id === menu.id);
                        if (!g) return null;

                        const vw = window.innerWidth;
                        const vh = window.innerHeight;

                        // tenta abrir abaixo e alinhado à direita do botão
                        let left = menu.anchor.right - MENU_W;
                        let top = menu.anchor.bottom + 8;

                        // clamp horizontal (nunca sai da tela)
                        left = clamp(left, MENU_PAD, vw - MENU_W - MENU_PAD);

                        // se não couber embaixo, abre acima
                        const MENU_H_EST = 210; // estimativa segura; se quiser, calculamos via ref depois
                        if (top + MENU_H_EST > vh - MENU_PAD) {
                            top = menu.anchor.top - MENU_H_EST - 8;
                        }
                        top = clamp(top, MENU_PAD, vh - MENU_H_EST - MENU_PAD);

                        return (
                            <div
                                style={{ ...styles.menuPanel, top, left, width: MENU_W }}
                                // impede fechar ao clicar dentro
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                <button
                                    style={g.exists ? styles.menuItem : styles.menuItemDisabled}
                                    disabled={!g.exists}
                                    onClick={() => {
                                        setMenu(null);
                                        openFile(g.id);
                                    }}
                                >
                                    Abrir
                                </button>

                                <button
                                    style={styles.menuItem}
                                    onClick={() => {
                                        setMenu(null);
                                        showInFolder(g.id);
                                    }}
                                >
                                    Mostrar na pasta
                                </button>

                                <button
                                    style={g.exists ? styles.menuItem : styles.menuItemDisabled}
                                    disabled={!g.exists}
                                    onClick={() => {
                                        setMenu(null);
                                        openRenameModal(g.id);
                                    }}
                                >
                                    Renomear
                                </button>

                                <div style={styles.menuDivider} />

                                <button
                                    style={styles.menuItem}
                                    onClick={() => {
                                        setMenu(null);
                                        g.exists ? deleteItem(g.id) : removeFromHistoryOnly(g.id);
                                    }}
                                >
                                    {g.exists ? "Apagar do disco" : "Remover do histórico"}
                                </button>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Modal Renomear */}
                {renameOpen && selected && (
                    <div style={styles.modalBackdrop} onMouseDown={() => setRenameOpen(false)}>
                        <div style={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
                        <h3 style={{ margin: 0 }}>Renomear arquivo</h3>
                        <div style={{ marginTop: 10, color: "#555", fontSize: 13 }}>
                            Nome atual: <b>{selected.fileName}</b>
                        </div>

                        <div style={{ marginTop: 12 }}>
                            <div style={styles.mini}>Novo nome (sem extensão)</div>
                            <input
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                style={styles.input}
                                autoFocus
                            />

                            <div style={{ marginTop: 8, fontSize: 12, color: renameValidation.ok ? "#666" : "#b00020" }}>
                                {renameValidation.ok
                                    ? `Resultado: ${sanitizeBaseName(renameValue)}.${selected.format}`
                                    : renameValidation.msg}
                            </div>
                        </div>

                        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                            <button onClick={() => setRenameOpen(false)}>Cancelar</button>
                            <button onClick={confirmRename} disabled={!renameValidation.ok}>
                                Renomear
                            </button>
                        </div>
                    </div>
                    </div>
                )}
            </main>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        fontFamily: "Inter, system-ui, Arial",
        padding: 0,
        width: "100%",
        minHeight: "100vh",
        overflow: "hidden"
    },
    contentWrap: {
        background: "#f8fafc",
        borderRadius: "0 0 14px 14px",
        border: "1px solid rgba(226,232,240,0.8)",
        borderTop: "none",
        padding: 18,
        boxShadow: "0 20px 45px rgba(15, 23, 42, 0.26)",
        minHeight: "calc(100vh - 48px)",
        overflowY: "auto",
        overflowX: "hidden"
    },
    h1: { margin: 0, fontSize: 26, letterSpacing: -0.3, color: "#0f172a" },
    subheading: { margin: "8px 0 16px", fontSize: 13, color: "#475569" },
    grid2: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16,
        alignItems: "start"
    },
    card: {
        border: "1px solid #d9e2f2",
        borderRadius: 14,
        padding: 16,
        background: "#fff",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)"
    },
    h2: { margin: 0, fontSize: 16, color: "#0f172a" },
    section: { marginTop: 12 },
    label: { fontWeight: 800, marginBottom: 6, color: "#1e293b" },
    mini: { fontSize: 12, color: "#64748b", marginBottom: 6 },
    gridOptions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    pillOn: {
        padding: "7px 10px",
        borderRadius: 999,
        border: "1px solid #bbb",
        background: "#f2f2f2",
        cursor: "pointer"
    },
    pillOff: {
        padding: "7px 10px",
        borderRadius: 999,
        border: "1px solid #eee",
        background: "#fff",
        cursor: "pointer"
    },
    primaryBtn: {
        width: "100%",
        padding: "11px 12px",
        borderRadius: 10,
        border: "1px solid #0f3fb1",
        background: "linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)",
        color: "#fff",
        fontWeight: 700,
        cursor: "pointer"
    },
    indeterminateBar: {
        width: "35%",
        height: "100%",
        background: "#d9d9d9",
        borderRadius: 999,
        animation: "move 1.1s infinite ease-in-out"
    },
    modalBackdrop: {
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
    },
    modal: {
        width: 520,
        maxWidth: "100%",
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #e6e6e6",
        padding: 14
    },
    input: {
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #ddd"
    },
    menuBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        border: "1px solid #e6e6e6",
        background: "#fff",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        fontSize: 18,
        lineHeight: 1
    },
    menuWrap: { position: "relative" },
    menu: {
        position: "absolute",
        top: 38,
        right: 0,
        width: 180,
        background: "#fff",
        border: "1px solid #e6e6e6",
        borderRadius: 12,
        padding: 6,
        boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
        zIndex: 50
    },
    menuItem: {
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        borderRadius: 10,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontSize: 13
    },
    menuItemDisabled: {
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        borderRadius: 10,
        border: "none",
        background: "transparent",
        cursor: "not-allowed",
        fontSize: 13,
        color: "#aaa"
    },
    menuDivider: { height: 1, background: "#eee", margin: "6px 6px" },
    menuFixed: {
        position: "fixed",
        inset: 0,
        zIndex: 9999
    },
    menuPanel: {
        position: "fixed",
        background: "#fff",
        border: "1px solid #d9e2f2",
        borderRadius: 12,
        padding: 6,
        boxShadow: "0 12px 30px rgba(0,0,0,0.08)"
    },
    flowWrap: { marginTop: 8 },
    flowRow: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "nowrap",
        overflowX: "auto",
        overflowY: "hidden",
        paddingBottom: 6,
        WebkitOverflowScrolling: "touch"
    },
    flowNode: {
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid #e6e6e6",
        fontSize: 12,
        fontWeight: 700,
        userSelect: "none",
        whiteSpace: "nowrap",
        flex: "0 0 auto"
    },
    flowLine: {
        height: 2,
        width: 26,
        borderRadius: 999,
        background: "#e8e8e8",
        flex: "0 0 auto"
    },
    flowHint: { marginTop: 8, fontSize: 12, color: "#777" },
};