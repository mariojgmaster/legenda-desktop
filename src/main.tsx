import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

type BoundaryState = {
    hasError: boolean;
    details?: string;
};

class AppErrorBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
    state: BoundaryState = { hasError: false };

    static getDerivedStateFromError(error: unknown): BoundaryState {
        return {
            hasError: true,
            details: error instanceof Error ? error.message : String(error)
        };
    }

    componentDidCatch(error: unknown) {
        console.error("[renderer] erro não tratado:", error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#0b1220" }}>
                    <div style={{ maxWidth: 720, width: "100%", background: "#fff", borderRadius: 14, border: "1px solid #d9e2f2", padding: 18 }}>
                        <h1 style={{ margin: 0, fontSize: 22 }}>Não foi possível carregar o app</h1>
                        <p style={{ marginTop: 10, color: "#475569", lineHeight: 1.5 }}>
                            O Legenda encontrou um erro inesperado, mas você pode tentar novamente sem perder seus arquivos.
                        </p>
                        {this.state.details && (
                            <pre style={{ marginTop: 12, background: "#f8fafc", border: "1px solid #e2e8f0", padding: 12, borderRadius: 10, whiteSpace: "pre-wrap" }}>
                                {this.state.details}
                            </pre>
                        )}
                        <button onClick={() => window.location.reload()} style={{ marginTop: 12 }}>
                            Recarregar aplicativo
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

window.addEventListener("error", (event) => {
    console.error("[renderer] window.error:", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
    console.error("[renderer] unhandledrejection:", event.reason);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <AppErrorBoundary>
            <App />
        </AppErrorBoundary>
    </React.StrictMode>
);
