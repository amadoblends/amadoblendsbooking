"use client";

/**
 * Failures in the root layout, which the route-level error.tsx can't catch.
 * Renders its own <html> with inline styles only — no stylesheet is
 * guaranteed to have loaded this early.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#0b0b0c",
          color: "#f5f5f5",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ maxWidth: 360, textAlign: "center" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "rgba(220,38,38,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 24,
            }}
          >
            ⚠️
          </div>
          <h1 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 6px" }}>
            No se pudo cargar la app
          </h1>
          <p style={{ fontSize: 13, opacity: 0.65, margin: "0 0 18px", lineHeight: 1.5 }}>
            Tus citas siguen guardadas. Vuelve a intentarlo.
          </p>
          {error.digest && (
            <p style={{ fontSize: 10, opacity: 0.4, fontFamily: "monospace", margin: "0 0 14px" }}>
              {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              width: "100%",
              height: 46,
              borderRadius: 12,
              border: "none",
              background: "#f97316",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
