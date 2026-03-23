"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { resolveLandingComponent, stripGeneratedCodeFences } from "@/lib/landing-page";

export default function VenturePreviewPage() {
  const { id } = useParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ventureName, setVentureName] = useState("");

  useEffect(() => {
    if (!id) return;

    async function loadPreview() {
      try {
        const res = await fetch(`/api/ventures/${id}/preview`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || "Failed to load preview");
          return;
        }

        const data = await res.json();
        setVentureName(data.name || "");

        // Resolve the component — handles missing/placeholder fullComponent
        // by generating a polished fallback from the structured landing copy
        const resolved = resolveLandingComponent({
          ventureName: data.name,
          fullComponent: data.landing?.fullComponent,
          landingPageCopy: data.landing?.landingPageCopy,
          seoMetadata: data.landing?.seoMetadata,
        });

        if (!resolved) {
          setError("Landing page not yet generated for this venture.");
          return;
        }

        // Build full HTML document for the iframe
        const seo = data.landing?.seoMetadata || {};
        const fullHtml = buildHtmlDocument(resolved, seo, data.name);
        setHtml(fullHtml);
      } catch (err: any) {
        console.error("Error loading preview:", err);
        setError("Network error loading preview.");
      }
    }

    loadPreview();
  }, [id]);

  // Write HTML into iframe via srcdoc
  useEffect(() => {
    if (html && iframeRef.current) {
      iframeRef.current.srcdoc = html;
    }
  }, [html]);

  if (error) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        color: "#fff",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        padding: 32,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: "rgba(192,122,58,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 20,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c07a3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>Preview Unavailable</h1>
        <p style={{ color: "#888", maxWidth: 400, textAlign: "center", fontSize: 14, lineHeight: 1.6 }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 24,
            padding: "10px 24px",
            background: "#c07a3a",
            color: "#fff",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
            border: "none",
            fontSize: 14,
            fontFamily: "inherit",
          }}
        >
          Retry
        </button>
        <a
          href="/dashboard"
          style={{
            marginTop: 12,
            color: "#666",
            fontSize: 12,
            textDecoration: "none",
          }}
        >
          Back to Dashboard
        </a>
      </div>
    );
  }

  if (!html) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        color: "#fff",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 40, height: 40,
            border: "3px solid #222",
            borderTopColor: "#c07a3a",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 20px",
          }} />
          <p style={{ fontSize: 13, color: "#666", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
            Loading Preview...
          </p>
          {ventureName && (
            <p style={{ fontSize: 12, color: "#444", marginTop: 6 }}>{ventureName}</p>
          )}
        </div>
        <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        background: "#000",
      }}
    >
      <iframe
        ref={iframeRef}
      title={`${ventureName} — Live Preview`}
      style={{
        width: "100%",
        height: "100vh",
        border: "none",
        display: "block",
      }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
      <a
        href="https://tryforze.ai"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "fixed",
          left: "50%",
          bottom: 14,
          transform: "translateX(-50%)",
          zIndex: 20,
          padding: "6px 12px",
          borderRadius: 999,
          background: "rgba(0, 0, 0, 0.72)",
          color: "#fff",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textDecoration: "none",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 6px 24px rgba(0,0,0,0.28)",
        }}
      >
        Made with Forze
      </a>
    </div>
  );
}

/**
 * Builds a complete HTML document from the generated component code.
 * The agent generates JSX-like code, but since we render in an iframe,
 * we convert it to a standalone HTML page with Tailwind CDN and React CDN.
 */
function buildHtmlDocument(
  componentCode: string,
  seo: { title?: string; description?: string; keywords?: string[] },
  ventureName: string
): string {
  // Detect if the code is a React component (JSX) or raw HTML
  const isReactComponent =
    componentCode.includes("export default") ||
    componentCode.includes("function ") ||
    componentCode.includes("const ") ||
    componentCode.includes("useState") ||
    componentCode.includes("React");

  if (isReactComponent) {
    // Wrap in a self-contained HTML page with React + Tailwind CDN
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(seo.title || ventureName || "Landing Page")}</title>
  ${seo.description ? `<meta name="description" content="${escapeHtml(seo.description)}" />` : ""}
  ${seo.keywords?.length ? `<meta name="keywords" content="${escapeHtml(seo.keywords.join(", "))}" />` : ""}
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    html { scroll-behavior: smooth; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useRef } = React;

    ${componentCode
      .replace(/^import\s+.*$/gm, "// import removed for preview")
      .replace(/export\s+default\s+/g, "const __LandingPage__ = ")}

    // Find the component — try multiple patterns
    const App = typeof __LandingPage__ !== 'undefined'
      ? __LandingPage__
      : typeof LandingPage !== 'undefined'
        ? LandingPage
        : typeof HomePage !== 'undefined'
          ? HomePage
          : typeof Page !== 'undefined'
            ? Page
            : () => React.createElement('div', {style:{padding:40,textAlign:'center'}}, 'Component not found');

    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
  <\/script>
</body>
</html>`;
  }

  // If it's raw HTML, wrap it directly
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(seo.title || ventureName || "Landing Page")}</title>
  ${seo.description ? `<meta name="description" content="${escapeHtml(seo.description)}" />` : ""}
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  </style>
</head>
<body>
  ${componentCode}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
