"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ReportModal } from "./ReportModal";
import { MoveUpRight, FileText } from "lucide-react";
import { downloadPDFFromResult } from "@/lib/client-pdf";

export type ModuleId =
  | "research"
  | "branding"
  | "marketing"
  | "landing"
  | "feasibility"
  | "full-launch"
  | "general"
  | "shadow-board"
  | "investor-kit"
  | "launch-autopilot"
  | "mvp-scalpel";

interface ResultCardProps {
  moduleId: ModuleId;
  result: Record<string, any>;
  deploymentUrl?: string;
  onModalChange?: (open: boolean) => void;
}

const MODULE_ACCENTS: Record<ModuleId, string> = {
  "full-launch": "#C4975A",
  research: "#5A8C6E",
  branding: "#5A6E8C",
  marketing: "#8C5A7A",
  landing: "#8C7A5A",
  feasibility: "#7A5A8C",
  general: "#6B8F71",
  "shadow-board": "#E04848",
  "investor-kit": "#7A8C5A",
  "launch-autopilot": "#B8864E",
  "mvp-scalpel": "#C45A5A",
};

const MODULE_LABELS: Record<ModuleId, string> = {
  "full-launch": "Full Launch",
  research: "Market Research",
  branding: "Brand Strategy",
  marketing: "GTM Strategy",
  landing: "Production Pipeline",
  feasibility: "Investment Assessment",
  general: "General Chat",
  "shadow-board": "Shadow Board Review",
  "investor-kit": "Investor Kit",
  "launch-autopilot": "Launch Autopilot",
  "mvp-scalpel": "MVP Scalpel",
};

// ─── Action Button ──────────────────────────────────────────────────────────

function ActionButton({ label, icon, onClick }: { label: string; icon?: React.ReactNode; onClick?: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04, backgroundColor: "var(--nav-active)" }}
      whileTap={{ scale: 0.96 }}
      style={{
        padding: "7px 14px",
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 8,
        color: "var(--text-soft)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background 200ms",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {icon}
      {label}
    </motion.button>
  );
}

export const ResultCard = React.memo(function ResultCard({ moduleId, result, deploymentUrl, onModalChange }: ResultCardProps) {
  const accent = MODULE_ACCENTS[moduleId] || "#666";
  const label = MODULE_LABELS[moduleId] || "Analysis";
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const [expanded, setExpanded] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", content: "" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openReport = (title: string, content: string) => {
    setModalContent({ title, content });
    setModalOpen(true);
    onModalChange?.(true);
  };

  if (!mounted) {
    return (
      <div style={{
        background: "var(--glass-bg-strong)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid var(--glass-border)",
        borderRadius: 16,
        padding: "16px 20px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 220, damping: 22 }}
        style={{
          background: "var(--glass-bg-strong)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid var(--glass-border)",
          borderRadius: 16,
          overflow: "hidden",
          position: "relative",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Top accent gradient */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${accent}, ${accent}80, transparent)`,
        }} />

        {/* Background glow */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: 80,
          background: `linear-gradient(to bottom, ${accent}08, transparent)`,
          pointerEvents: "none",
        }} />

        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            width: "100%",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 26, height: 26,
              borderRadius: "50%",
              background: `${accent}18`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
                {label} Complete
              </span>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>{now}</span>
            </div>
          </div>
          <motion.svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </motion.svg>
        </button>

        {/* Collapsible content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: "hidden" }}
            >
              <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 12, position: "relative", zIndex: 1 }}>
                {/* Divider */}
                <div style={{ height: 1, background: "var(--border)", marginBottom: 4 }} />

                {moduleId === "research" && <ResearchDisplay result={result} onOpenReport={(c) => openReport("Market Research Assessment", c)} />}
                {moduleId === "branding" && <BrandingDisplay result={result} onOpenReport={(c) => openReport("Brand Identity Bible", c)} />}
                {moduleId === "marketing" && <MarketingDisplay result={result} onOpenReport={(c) => openReport("Go-To-Market Strategy", c)} />}
                {moduleId === "landing" && <LandingDisplay result={result} externalUrl={deploymentUrl} />}
                {moduleId === "feasibility" && <FeasibilityDisplay result={result} onOpenReport={(c) => openReport("Strategic Feasibility Report", c)} />}
                {moduleId === "full-launch" && (
                  <FullLaunchDisplay
                    result={result}
                    externalUrl={deploymentUrl}
                    onOpenReport={(t, c) => openReport(t, c)}
                  />
                )}
                {moduleId === "shadow-board" && <ShadowBoardDisplay result={result} />}
                {moduleId === "investor-kit" && <InvestorKitDisplay result={result} onOpenReport={(c) => openReport("Investor Memo", c)} />}
                {moduleId === "launch-autopilot" && <LaunchAutopilotDisplay result={result} />}
                {moduleId === "mvp-scalpel" && <MVPScalpelDisplay result={result} />}
              </div>

              {/* Action buttons */}
              <div style={{
                display: "flex",
                gap: 8,
                padding: "12px 20px 16px",
                borderTop: "1px solid var(--border)",
                position: "relative",
                zIndex: 1,
              }}>
                <ActionButton
                  label="Export PDF"
                  icon={<FileText size={12} />}
                  onClick={() => {
                    downloadPDFFromResult(`${label} Report`, result, `${label}_Report`)
                  }}
                />
                <ActionButton
                  label="Copy"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(JSON.stringify(result, null, 2))
                      alert('Copied to clipboard!')
                    } catch {}
                  }}
                />
                <ActionButton
                  label="Share"
                  onClick={async () => {
                    const text = `${label} Report\n\n${JSON.stringify(result, null, 2)}`
                    if (typeof navigator !== 'undefined' && navigator.share) {
                      try { await navigator.share({ title: `${label} Report`, text }) } catch {}
                    } else {
                      try {
                        await navigator.clipboard.writeText(text)
                        alert('Copied to clipboard for sharing!')
                      } catch {}
                    }
                  }}
                />
                {(deploymentUrl || result.landing?.deploymentUrl || result.deploymentUrl) && (
                  <motion.a
                    whileHover={{ scale: 1.04, opacity: 0.9 }}
                    whileTap={{ scale: 0.96 }}
                    href={deploymentUrl || result.landing?.deploymentUrl || result.deploymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      marginLeft: "auto",
                      padding: "7px 16px",
                      background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                      border: "none",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      letterSpacing: "0.01em",
                      boxShadow: `0 4px 12px ${accent}40`,
                    }}
                  >
                    <MoveUpRight size={14} />
                    View Live Site
                  </motion.a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <ReportModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); onModalChange?.(false); }}
        title={modalContent.title}
        content={modalContent.content}
        accentColor={accent}
      />
    </>
  );
})

// ─── Module Specific Displays ───────────────────────────────────────────────

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
  Cell,
} from "recharts";

// ─── Shared Chart Components ─────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--glass-bg-strong)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      border: "1px solid var(--border-strong)",
      borderRadius: 10,
      padding: "10px 14px",
      boxShadow: "var(--shadow-md)",
      minWidth: 120,
    }}>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
          {label}
        </div>
      )}
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < payload.length - 1 ? 4 : 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color || entry.fill, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "var(--text-soft)", fontWeight: 500 }}>{entry.name}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginLeft: "auto", paddingLeft: 8 }}>
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatMillions(val: any): string {
  const n = Number(val);
  if (!n || isNaN(n)) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function parseMagnitudeValue(val: any): number {
  if (val == null) return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;

  const raw = String(val).trim();
  if (!raw) return 0;

  const normalized = raw.toLowerCase().replace(/,/g, "");
  const numericMatch = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!numericMatch) return 0;

  const base = parseFloat(numericMatch[0]);
  if (!Number.isFinite(base)) return 0;

  const compactSuffixMatch = normalized.match(/-?\d+(?:\.\d+)?\s*([kmbt])\b/);
  if (compactSuffixMatch) {
    const suffix = compactSuffixMatch[1];
    if (suffix === "k") return base * 1_000;
    if (suffix === "m") return base * 1_000_000;
    if (suffix === "b") return base * 1_000_000_000;
    if (suffix === "t") return base * 1_000_000_000_000;
  }

  if (/\b(thousand|k)\b/.test(normalized)) return base * 1_000;
  if (/\b(million|mn|mm)\b/.test(normalized)) return base * 1_000_000;
  if (/\b(billion|bn)\b/.test(normalized)) return base * 1_000_000_000;
  if (/\b(trillion|tn)\b/.test(normalized)) return base * 1_000_000_000_000;

  return base;
}

function ResearchDisplay({ result, onOpenReport }: { result: Record<string, any>; onOpenReport: (content: string) => void }) {
  const ACCENT = "#5A8C6E";
  const tamVal = result.research?.tam?.value ?? result.tam?.value ?? result.tam;
  const samVal = result.research?.sam?.value ?? result.sam?.value ?? result.sam;
  const somVal = result.research?.som?.value ?? result.som?.value ?? result.som;
  const stringTam = typeof tamVal === 'object' ? JSON.stringify(tamVal) : String(tamVal || "");

  const tamN = parseMagnitudeValue(tamVal) || 1200;
  const samN = parseMagnitudeValue(samVal) || tamN * 0.35;
  const somN = parseMagnitudeValue(somVal) || tamN * 0.08;

  function formatPct(part: number, total: number): string {
    if (!total || !Number.isFinite(total)) return "0%";
    const rawPct = (part / total) * 100;
    if (!Number.isFinite(rawPct) || rawPct <= 0) return "0%";
    if (rawPct < 1) return "<1%";
    if (rawPct < 10) return `${rawPct.toFixed(1)}%`;
    return `${Math.round(rawPct)}%`;
  }

  const marketData = [
    { segment: "TAM", value: tamN, pctLabel: "100%" },
    { segment: "SAM", value: samN, pctLabel: formatPct(samN, tamN) },
    { segment: "SOM", value: somN, pctLabel: formatPct(somN, tamN) },
  ];

  const gradientId = "researchGrad";

  return (
    <>
      <Row label="Market Summary" value={result.marketSummary} />
      <Row label="TAM" value={stringTam} />
      <Row label="Recommended Concept" value={result.recommendedConcept} />

      {/* ── Premium Market Sizing Chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          marginTop: 12,
          background: "var(--glass-bg)",
          borderRadius: 14,
          border: "1px solid var(--border)",
          padding: "16px 16px 12px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Chart header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: ACCENT, boxShadow: `0 0 8px ${ACCENT}60` }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Market Sizing
          </span>
          <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--muted)", fontWeight: 500 }}>TAM · SAM · SOM</span>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={marketData} margin={{ top: 24, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.95} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} strokeOpacity={0.6} />
            <XAxis
              dataKey="segment"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fontWeight: 700, fill: "var(--muted)", letterSpacing: "0.04em" }}
            />
            <YAxis hide />
            <Tooltip
              content={<ChartTooltip formatter={(v: any) => formatMillions(v)} />}
              cursor={{ fill: `${ACCENT}08`, radius: 8 }}
            />
            <Bar
              dataKey="value"
              name="Market Size"
              fill={`url(#${gradientId})`}
              radius={[8, 8, 3, 3]}
              maxBarSize={72}
              animationDuration={900}
              animationEasing="ease-out"
            >
              <LabelList
                dataKey="value"
                position="top"
                formatter={(v: any) => formatMillions(v)}
                style={{ fontSize: 10, fontWeight: 700, fill: ACCENT, letterSpacing: "0.01em" }}
              />
              {marketData.map((_, index) => (
                <Cell
                  key={index}
                  fill={`url(#${gradientId})`}
                  opacity={index === 0 ? 1 : index === 1 ? 0.75 : 0.5}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Percentage row */}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {marketData.map((d) => (
            <div key={d.segment} style={{
              flex: 1,
              padding: "6px 0",
              textAlign: "center",
              background: `${ACCENT}0A`,
              borderRadius: 8,
              border: `1px solid ${ACCENT}20`,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{d.segment}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT, lineHeight: 1.2, marginTop: 2 }}>{d.pctLabel}</div>
              </div>
            ))}
          </div>
      </motion.div>

      {result.researchPaper && (
        <button
          onClick={() => onOpenReport(result.researchPaper)}
          style={viewReportButtonStyle}
        >
          <FileText size={12} />
          View Comprehensive Research Paper
        </button>
      )}
    </>
  );
}

function BrandingDisplay({ result, onOpenReport }: { result: Record<string, any>; onOpenReport: (content: string) => void }) {
  const colors = Array.isArray(result.colorPalette) ? result.colorPalette : [];
  const brandBible = result.branding?.brandBible || result.brandBible;
  return (
    <>
      <Row label="Brand Name" value={result.brandName} highlight />
      <Row label="Tagline" value={result.tagline} />
      <Row label="Archetype" value={result.brandArchetype} />
      {brandBible && (
        <button
          onClick={() => onOpenReport(brandBible)}
          style={viewReportButtonStyle}
        >
          <FileText size={12} />
          View Complete Brand Strategy Bible
        </button>
      )}
      {colors.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
          <span style={tagLabelStyle}>Identity Palette</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {colors.map((c: any, i: number) => {
              const hex = typeof c === 'string' ? c : (c.hex || '#666');
              return (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.2, y: -2 }}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: String(hex),
                    border: "2px solid var(--glass-border)",
                    boxShadow: `0 2px 8px ${hex}40`,
                    cursor: "pointer",
                  }}
                  title={String(hex)}
                />
              )
            })}
          </div>
        </div>
      )}
    </>
  );
}

function MarketingDisplay({ result, onOpenReport }: { result: Record<string, any>; onOpenReport: (content: string) => void }) {
  const socialCount = result.socialCalendar?.length ?? result.totalPostsCount ?? 0;
  const blogCount = result.seoOutlines?.length ?? 0;
  const marketingPlan = result.marketingPlan || result.gtmStrategy?.marketingPlan;
  return (
    <>
      <Row label="Strategy" value={result.gtmStrategy?.overview ?? result.theme} />
      <Row label="Assets" value={`${socialCount} posts, ${blogCount} SEO articles`} />
      {marketingPlan && (
        <button
          onClick={() => onOpenReport(marketingPlan)}
          style={viewReportButtonStyle}
        >
          <FileText size={12} />
          View Full 30-Day Growth Strategy
        </button>
      )}
    </>
  );
}

function LandingDisplay({ result, externalUrl }: { result: Record<string, any>; externalUrl?: string }) {
  const copy = result.landingPageCopy || {};
  const hero = copy.hero || {};
  const features = Array.isArray(copy.features) ? copy.features : [];
  const pricing = Array.isArray(copy.pricing) ? copy.pricing : [];
  const faq = Array.isArray(copy.faq) ? copy.faq : [];
  const seo = result.seoMetadata || {};
  const url = externalUrl || result.deploymentUrl;

  return (
    <>
      <Row label="Hero Hook" value={hero.headline || result.heroHeadline} highlight />
      {hero.subheadline && <Row label="Subheadline" value={hero.subheadline} />}
      {hero.ctaPrimary && <Row label="Primary CTA" value={hero.ctaPrimary} />}
      <Row label="Features" value={features.length > 0 ? `${features.length} features defined` : undefined} />
      <Row label="Pricing" value={pricing.length > 0 ? pricing.map((p: any) => `${p.tier} (${p.price})`).join(' · ') : undefined} />
      <Row label="FAQ" value={faq.length > 0 ? `${faq.length} questions covered` : undefined} />
      <Row label="SEO Title" value={seo.title} />
      <Row label="Tech Stack" value="Next.js 15 · Tailwind CSS · React · Vercel" />
      <Row label="Production" value={url ? "Live on Forze Pipeline" : "Generating components..."} />
      <Row label="Conversion" value={result.leadCaptureActive ? "Lead capture active" : "Lead capture hooks active"} />
    </>
  );
}

function FeasibilityDisplay({ result, onOpenReport }: { result: Record<string, any>; onOpenReport: (content: string) => void }) {
  const [showChart, setShowChart] = useState(false);
  const ACCENT = "#7A5A8C";
  const ACCENT_MUTED = "#5A8C6E";

  const verdict = result.feasibility?.verdict || result.verdict;
  const verdictRationale = result.verdictRationale || result.feasibility?.verdictRationale;
  const financialModel = result.financialModel || result.feasibility?.financialModel;
  const feasibilityReport = result.feasibilityReport || result.feasibility?.feasibilityReport;
  const marketTimingScore = result.marketTimingScore || result.feasibility?.marketTimingScore;
  const risks = result.risks || result.feasibility?.risks || [];
  const competitiveMoat = result.competitiveMoat || result.feasibility?.competitiveMoat;

  const chartData = [
    { year: "Yr 1", Revenue: parseMagnitudeValue(financialModel?.yearOne?.revenue) || 0, Costs: parseMagnitudeValue(financialModel?.yearOne?.costs) || 0 },
    { year: "Yr 2", Revenue: parseMagnitudeValue(financialModel?.yearTwo?.revenue) || 0, Costs: parseMagnitudeValue(financialModel?.yearTwo?.costs) || 0 },
    { year: "Yr 3", Revenue: parseMagnitudeValue(financialModel?.yearThree?.revenue) || 0, Costs: parseMagnitudeValue(financialModel?.yearThree?.costs) || 0 },
  ];

  const timingColor = (marketTimingScore ?? 0) >= 7 ? "#16a34a" : (marketTimingScore ?? 0) >= 4 ? "#d97706" : "#dc2626";
  const highRisks = risks.filter((r: any) => r.impact === 'high' || r.likelihood === 'high').length;
  const hasChartData = chartData.some(d => d.Revenue > 0 || d.Costs > 0);

  return (
    <>
      {/* Verdict + Market Timing Row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flex: 1, minWidth: 180 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", width: 90, flexShrink: 0 }}>Verdict</span>
          {verdict && <VerdictBadge value={String(verdict)} />}
        </div>
        {marketTimingScore != null && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "5px 12px",
            background: `${timingColor}10`,
            border: `1px solid ${timingColor}20`,
            borderRadius: 8,
          }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Timing</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: timingColor }}>{marketTimingScore}</span>
            <span style={{ fontSize: 10, color: "var(--muted)" }}>/10</span>
          </div>
        )}
      </div>

      {/* Verdict Rationale */}
      {verdictRationale && (
        <p style={{ fontSize: 12, color: "var(--text-soft)", lineHeight: 1.6, margin: "4px 0 0", maxHeight: 48, overflow: "hidden" }}>
          {String(verdictRationale).slice(0, 180)}{String(verdictRationale).length > 180 ? "..." : ""}
        </p>
      )}

      {/* Unit Economics Cards */}
      {financialModel && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8, marginTop: 4 }}>
          {[
            { label: "CAC", value: financialModel.cac },
            { label: "LTV", value: financialModel.ltv },
            { label: "LTV:CAC", value: financialModel.ltvCacRatio },
            { label: "Break-even", value: financialModel.breakEvenMonth ? `Mo ${financialModel.breakEvenMonth}` : null },
          ].filter(m => m.value).map((metric) => (
            <div key={metric.label} style={{
              padding: "8px 10px",
              background: `${ACCENT}08`,
              border: `1px solid ${ACCENT}20`,
              borderRadius: 10,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{metric.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT, marginTop: 2 }}>{String(metric.value)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Risk Summary */}
      {risks.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", width: 90, flexShrink: 0 }}>Risks</span>
          <span style={{ fontSize: 12, color: "var(--text-soft)" }}>
            {risks.length} identified{highRisks > 0 && <span style={{ color: "#dc2626", fontWeight: 600 }}> ({highRisks} high severity)</span>}
          </span>
        </div>
      )}

      {/* Moat snippet */}
      {competitiveMoat && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", width: 90, flexShrink: 0 }}>Moat</span>
          <span style={{ fontSize: 12, color: "var(--text-soft)", lineHeight: 1.5 }}>
            {String(competitiveMoat).slice(0, 120)}{String(competitiveMoat).length > 120 ? "..." : ""}
          </span>
        </div>
      )}

      {/* ── Premium Financial Projections Chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          marginTop: 12,
          background: "var(--glass-bg)",
          borderRadius: 14,
          border: "1px solid var(--border)",
          padding: "16px 16px 12px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Chart header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: ACCENT, boxShadow: `0 0 8px ${ACCENT}60` }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            3-Year Financial Projections
          </span>
          <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--muted)", fontWeight: 500 }}>Revenue · Costs</span>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={chartData}
            margin={{ top: 24, right: 8, left: 0, bottom: 0 }}
            barCategoryGap="30%"
            barGap={4}
          >
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.95} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0.4} />
              </linearGradient>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT_MUTED} stopOpacity={0.65} />
                <stop offset="100%" stopColor={ACCENT_MUTED} stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} strokeOpacity={0.6} />
            <XAxis
              dataKey="year"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fontWeight: 700, fill: "var(--muted)", letterSpacing: "0.04em" }}
            />
            <YAxis hide />
            <Tooltip
              content={<ChartTooltip formatter={(v: any) => formatMillions(v)} />}
              cursor={{ fill: `${ACCENT}06`, radius: 8 }}
            />
            <Legend
              iconType="circle"
              iconSize={7}
              wrapperStyle={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", paddingTop: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}
            />
            <Bar
              dataKey="Revenue"
              fill="url(#revGrad)"
              radius={[7, 7, 3, 3]}
              maxBarSize={48}
              animationDuration={900}
              animationEasing="ease-out"
            >
              <LabelList
                dataKey="Revenue"
                position="top"
                formatter={(v: any) => v > 0 ? formatMillions(v) : ""}
                style={{ fontSize: 9, fontWeight: 700, fill: ACCENT }}
              />
            </Bar>
            <Bar
              dataKey="Costs"
              fill="url(#costGrad)"
              radius={[7, 7, 3, 3]}
              maxBarSize={48}
              animationDuration={900}
              animationEasing="ease-out"
              animationBegin={150}
            >
              <LabelList
                dataKey="Costs"
                position="top"
                formatter={(v: any) => v > 0 ? formatMillions(v) : ""}
                style={{ fontSize: 9, fontWeight: 700, fill: ACCENT_MUTED }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Year detail cards */}
        {financialModel && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
            {[
              { label: "Year 1", data: financialModel.yearOne },
              { label: "Year 2", data: financialModel.yearTwo },
              { label: "Year 3", data: financialModel.yearThree },
            ].map((yr) => yr.data && (
              <div key={yr.label} style={{
                padding: "8px 10px",
                background: `${ACCENT}06`,
                borderRadius: 8,
                border: `1px solid ${ACCENT}15`,
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: ACCENT, marginBottom: 5, letterSpacing: "0.03em" }}>{yr.label}</div>
                <div style={{ fontSize: 10, color: "var(--text-soft)", lineHeight: 1.7 }}>
                  {yr.data.revenue && <div><span style={{ color: "var(--muted)" }}>Rev </span>{yr.data.revenue}</div>}
                  {yr.data.netIncome && <div><span style={{ color: "var(--muted)" }}>Net </span>{yr.data.netIncome}</div>}
                  {yr.data.customers && <div><span style={{ color: "var(--muted)" }}>Users </span>{yr.data.customers}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {feasibilityReport && (
        <button
          onClick={() => onOpenReport(feasibilityReport)}
          style={viewReportButtonStyle}
        >
          <FileText size={12} />
          View Full Investment Assessment Report
        </button>
      )}
    </>
  );
}

function ShadowBoardDisplay({ result }: { result: Record<string, any> }) {
  const score = result.survivalScore ?? 0;
  const scoreColor = score >= 70 ? "#16a34a" : score >= 40 ? "#d97706" : "#E04848";
  const dialogue = Array.isArray(result.boardDialogue) ? result.boardDialogue : [];
  const pivots = Array.isArray(result.strategicPivots) ? result.strategicPivots : [];
  const feedback = Array.isArray(result.syntheticFeedback) ? result.syntheticFeedback : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Survival Score Hero */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 20px",
        background: `${scoreColor}08`,
        border: `1px solid ${scoreColor}20`,
        borderRadius: 12,
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Survival Score</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}<span style={{ fontSize: 16, opacity: 0.5 }}>/100</span></div>
        </div>
        <VerdictBadge value={result.verdictLabel || "Review Complete"} />
      </div>

      {/* Board Dialogue */}
      <div className="flex flex-col gap-4">
        <h4 style={subHeaderStyle}>The Shadow Board Take</h4>
        {dialogue.map((d: any, i: number) => (
          <div key={i} style={{ padding: "12px", background: "var(--glass-bg)", borderRadius: 10, borderLeft: `3px solid ${i === 0 ? '#E04848' : i === 1 ? '#5A6E8C' : '#5A8C6E'}` }}>
             <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{d.role}</div>
             <p style={{ fontSize: 12, color: "var(--text-soft)", fontStyle: "italic", marginBottom: 6 }}>&ldquo;{d.thought}&rdquo;</p>
             <p style={{ fontSize: 12, color: "#E04848", fontWeight: 600 }}>Honesty: {d.brutalHonesty}</p>
          </div>
        ))}
      </div>

      {/* Strategic Pivots */}
      <div className="flex flex-col gap-3">
        <h4 style={subHeaderStyle}>Strategic Pivots</h4>
        {pivots.map((p: any, i: number) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px", border: "1px solid var(--border)", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#999", textDecoration: "line-through" }}>{p.currentPath}</span>
              <span style={{ color: "var(--muted)" }}>→</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{p.betterPath}</span>
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)" }}>{p.rationale}</p>
          </div>
        ))}
      </div>

      {/* Synthetic Feedback */}
      <div className="flex flex-col gap-3">
        <h4 style={subHeaderStyle}>Silicon Pulse (Synthetic Feedback)</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          {feedback.map((f: any, i: number) => (
            <div key={i} style={{ padding: "10px", background: "var(--sidebar)", borderRadius: 8, fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontWeight: 700, color: "var(--text)" }}>{f.persona}</span>
                <span style={{ 
                  color: f.sentiment === 'positive' ? '#16a34a' : f.sentiment === 'negative' ? '#dc2626' : '#d97706',
                  fontWeight: 800,
                  textTransform: "uppercase"
                }}>{f.sentiment}</span>
              </div>
              <p style={{ color: "var(--text-soft)", fontStyle: "italic" }}>&ldquo;{f.quote}&rdquo;</p>
              <div style={{ marginTop: 6, color: "#dc2626", fontWeight: 600 }}>Flaw: {f.criticalFlaw}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FullLaunchDisplay({ result, externalUrl, onOpenReport }: {
  result: Record<string, any>;
  externalUrl?: string;
  onOpenReport: (title: string, content: string) => void;
}) {
  const brandName = result.branding?.brandName || result.brandName;
  const marketSize = result.research?.tam?.value || result.research?.tam || result.tam?.value || result.tam || result.marketSize;
  const verdict = result.feasibility?.verdict || result.verdict;
  const url = externalUrl || result.landing?.deploymentUrl || result.deploymentUrl;

  const stringBrand = typeof brandName === 'object' ? JSON.stringify(brandName) : String(brandName || "");
  const stringMarket = typeof marketSize === 'object' ? (marketSize.value || JSON.stringify(marketSize)) : String(marketSize || "");
  const stringVerdict = typeof verdict === 'object' ? (verdict.verdict || JSON.stringify(verdict)) : String(verdict || "");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-x-6">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h4 style={subHeaderStyle}>Core Strategy</h4>
        <Row label="Venture" value={stringBrand} highlight />
        <Row label="TAM" value={stringMarket} />
        <Row label="Verdict" value={stringVerdict} isBadge />

        {result.research?.researchPaper && (
          <button onClick={() => onOpenReport("Research Assessment", result.research.researchPaper)} style={smallLinkStyle}>
            <FileText size={10} /> Research Paper
          </button>
        )}
        {result.branding?.brandBible && (
          <button onClick={() => onOpenReport("Brand Identity Bible", result.branding.brandBible)} style={smallLinkStyle}>
            <FileText size={10} /> Brand Bible
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h4 style={subHeaderStyle}>Execution Details</h4>
        <Row label="Pipeline" value={url ? "Project Live" : "Drafting..."} />
        <Row label="Marketing" value="GTM Strategy Live" />
        <Row label="Next Steps" value="Beta Launch Cycle" />

        {result.marketing?.marketingPlan && (
          <button onClick={() => onOpenReport("Growth Plan", result.marketing.marketingPlan)} style={smallLinkStyle}>
            <FileText size={10} /> Marketing Plan
          </button>
        )}
        {result.feasibility?.feasibilityReport && (
          <button onClick={() => onOpenReport("Investment Report", result.feasibility.feasibilityReport)} style={smallLinkStyle}>
            <FileText size={10} /> Investment Case
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Row Component ──────────────────────────────────────────────────────────

function Row({
  label,
  value,
  isLink,
  isBadge,
  highlight,
}: {
  label: string;
  value: any;
  isLink?: boolean;
  isBadge?: boolean;
  highlight?: boolean;
}) {
  if (value === undefined || value === null) return null;
  const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);

  return (
    <div style={{
      display: "flex",
      alignItems: "baseline",
      gap: 12,
      padding: "6px 0",
    }}>
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: "var(--muted)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        width: 90,
        flexShrink: 0,
      }}>
        {label}
      </span>
      {isLink ? (
        <a
          href={stringValue}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 13,
            color: "var(--accent)",
            textDecoration: "none",
            borderBottom: "1px solid var(--accent-glow)",
            transition: "opacity 150ms",
          }}
        >
          {stringValue}
        </a>
      ) : isBadge ? (
        <VerdictBadge value={stringValue} />
      ) : (
        <span style={{
          fontSize: 13,
          color: highlight ? "var(--text)" : "var(--text-soft)",
          fontWeight: highlight ? 600 : 400,
          lineHeight: 1.5,
        }}>
          {stringValue}
        </span>
      )}
    </div>
  );
}

function VerdictBadge({ value }: { value: string }) {
  const isNoGo = value.toLowerCase().includes("no");
  const isConditional = value.toLowerCase().includes("conditional");
  const color = isNoGo ? "#dc2626" : isConditional ? "#d97706" : "#16a34a";
  const bg = isNoGo ? "#dc262614" : isConditional ? "#d9770614" : "#16a34a14";

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "5px 12px",
      background: bg,
      color: color,
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      border: `1px solid ${color}20`,
    }}>
      <div style={{
        width: 6, height: 6,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px ${color}60`,
      }} />
      {value}
    </span>
  );
}

// ─── Launch Autopilot Display ────────────────────────────────────────────────

function MetricTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--glass-bg)",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: accent, marginTop: 6 }}>
        {value}
      </div>
    </div>
  );
}

function InvestorKitDisplay({ result, onOpenReport }: { result: Record<string, any>; onOpenReport: (content: string) => void }) {
  const ACCENT = "#7A8C5A";
  const slides = Array.isArray(result.pitchDeckOutline) ? result.pitchDeckOutline : [];
  const ask = result.askDetails || {};
  const milestones = Array.isArray(ask.keyMilestones) ? ask.keyMilestones : [];
  const dataRoomSections = Array.isArray(result.dataRoomSections) ? result.dataRoomSections : [];
  const summary = typeof result.executiveSummary === "string" ? result.executiveSummary : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        <MetricTile label="Deck Slides" value={slides.length ? String(slides.length) : "Drafting"} accent={ACCENT} />
        <MetricTile label="Suggested Raise" value={ask.suggestedRaise || "Pending"} accent={ACCENT} />
        <MetricTile label="Data Room" value={dataRoomSections.length ? `${dataRoomSections.length} sections` : "Pending"} accent={ACCENT} />
      </div>

      {summary && (
        <div style={{
          padding: "12px 14px",
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--glass-bg)",
          color: "var(--text-soft)",
          fontSize: 13,
          lineHeight: 1.65,
        }}>
          {summary.slice(0, 280)}
          {summary.length > 280 ? "..." : ""}
        </div>
      )}

      {slides.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h4 style={subHeaderStyle}>Pitch Deck Outline</h4>
          {slides.slice(0, 4).map((slide: any, index: number) => (
            <div
              key={index}
              style={{
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--sidebar)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                {slide.slide || `Slide ${index + 1}`}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-soft)", lineHeight: 1.55, marginTop: 4 }}>
                {slide.content || "Content pending."}
              </div>
            </div>
          ))}
        </div>
      )}

      {(milestones.length > 0 || dataRoomSections.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <h4 style={subHeaderStyle}>Milestones</h4>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--text-soft)", fontSize: 12, lineHeight: 1.7 }}>
              {milestones.slice(0, 4).map((item: string, index: number) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 style={subHeaderStyle}>Data Room</h4>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--text-soft)", fontSize: 12, lineHeight: 1.7 }}>
              {dataRoomSections.slice(0, 4).map((item: string, index: number) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {result.onePageMemo && (
        <button onClick={() => onOpenReport(result.onePageMemo)} style={smallLinkStyle}>
          <FileText size={10} /> Open Investor Memo
        </button>
      )}
    </div>
  );
}

function LaunchAutopilotDisplay({ result }: { result: Record<string, any> }) {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const ACCENT = "#B8864E";

  const days = Array.isArray(result.days) ? result.days : [];
  const channels = Array.isArray(result.channels) ? result.channels : [];
  const checklist = Array.isArray(result.launchDayChecklist) ? result.launchDayChecklist : [];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const priorityColors: Record<string, { bg: string; color: string; label: string }> = {
    critical: { bg: "#dc262618", color: "#dc2626", label: "CRITICAL" },
    important: { bg: "#d9770618", color: "#d97706", label: "IMPORTANT" },
    "nice-to-have": { bg: "#6b728018", color: "#6b7280", label: "NICE TO HAVE" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      {result.summary && (
        <div style={{
          padding: "14px 16px",
          background: `${ACCENT}08`,
          border: `1px solid ${ACCENT}20`,
          borderRadius: 12,
          fontSize: 13,
          color: "var(--text-soft)",
          lineHeight: 1.6,
        }}>
          {result.launchName && (
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
              {result.launchName}
            </div>
          )}
          {result.summary}
        </div>
      )}

      {/* Channel Strip */}
      {channels.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {channels.map((ch: any, i: number) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              background: "var(--glass-bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 11,
            }}>
              <span style={{ fontWeight: 700, color: "var(--text)" }}>{ch.name}</span>
              <span style={{ color: "var(--muted)" }}>{ch.totalPosts} posts</span>
            </div>
          ))}
        </div>
      )}

      {/* Weekly Goals */}
      {(result.weekOneGoal || result.weekTwoGoal) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {result.weekOneGoal && (
            <div style={{
              padding: "10px 12px",
              background: "#5A8C6E10",
              border: "1px solid #5A8C6E20",
              borderRadius: 10,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#5A8C6E", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Week 1 Goal</div>
              <div style={{ fontSize: 12, color: "var(--text-soft)", lineHeight: 1.5 }}>{result.weekOneGoal}</div>
            </div>
          )}
          {result.weekTwoGoal && (
            <div style={{
              padding: "10px 12px",
              background: `${ACCENT}10`,
              border: `1px solid ${ACCENT}20`,
              borderRadius: 10,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Week 2 Goal</div>
              <div style={{ fontSize: 12, color: "var(--text-soft)", lineHeight: 1.5 }}>{result.weekTwoGoal}</div>
            </div>
          )}
        </div>
      )}

      {/* 14-Day Calendar */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h4 style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--text)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 4,
          opacity: 0.8,
        }}>14-Day Execution Calendar</h4>

        {days.map((day: any, i: number) => {
          const isExpanded = expandedDay === day.day;
          const tasks = Array.isArray(day.tasks) ? day.tasks : [];
          const criticalCount = tasks.filter((t: any) => t.priority === "critical").length;

          return (
            <div key={i} style={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              overflow: "hidden",
              background: isExpanded ? "var(--glass-bg)" : "transparent",
              transition: "background 0.2s",
            }}>
              {/* Day Header */}
              <button
                onClick={() => setExpandedDay(isExpanded ? null : day.day)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "10px 14px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  gap: 10,
                }}
              >
                <span style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: `${ACCENT}18`,
                  color: ACCENT,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  flexShrink: 0,
                }}>
                  {day.day}
                </span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{day.theme}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>{day.date}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {criticalCount > 0 && (
                    <span style={{
                      padding: "2px 6px",
                      background: "#dc262618",
                      color: "#dc2626",
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 700,
                    }}>
                      {criticalCount} CRITICAL
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>
                    {tasks.length} task{tasks.length !== 1 ? "s" : ""}
                  </span>
                  <span style={{
                    fontSize: 14,
                    color: "var(--muted)",
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}>
                    &#9660;
                  </span>
                </div>
              </button>

              {/* Expanded Tasks */}
              {isExpanded && (
                <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ height: 1, background: "var(--border)" }} />

                  {tasks.map((task: any, ti: number) => {
                    const p = priorityColors[task.priority] || priorityColors["important"];
                    const copyKey = `${day.day}-${ti}`;

                    return (
                      <div key={ti} style={{
                        padding: "10px 12px",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        borderLeft: `3px solid ${p.color}`,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}>
                        {/* Task Header */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>{task.time}</span>
                            <span style={{
                              padding: "2px 8px",
                              background: `${ACCENT}14`,
                              color: ACCENT,
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 700,
                            }}>
                              {task.channel}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>{task.action}</span>
                          </div>
                          <span style={{
                            padding: "2px 6px",
                            background: p.bg,
                            color: p.color,
                            borderRadius: 4,
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: "uppercase",
                          }}>
                            {p.label}
                          </span>
                        </div>

                        {/* Exact Copy Block */}
                        {task.exactCopy && (
                          <div style={{ position: "relative" }}>
                            <pre style={{
                              padding: "10px 12px",
                              background: "var(--sidebar)",
                              borderRadius: 6,
                              fontSize: 11,
                              color: "var(--text-soft)",
                              fontFamily: "var(--font-mono, monospace)",
                              lineHeight: 1.6,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              margin: 0,
                              maxHeight: 200,
                              overflowY: "auto",
                            }}>
                              {task.exactCopy}
                            </pre>
                            <button
                              onClick={() => handleCopy(task.exactCopy, copyKey)}
                              style={{
                                position: "absolute",
                                top: 6,
                                right: 6,
                                padding: "3px 8px",
                                background: copiedKey === copyKey ? "#16a34a" : "var(--glass-bg)",
                                border: "1px solid var(--border)",
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 600,
                                color: copiedKey === copyKey ? "#fff" : "var(--muted)",
                                cursor: "pointer",
                                transition: "all 0.2s",
                              }}
                            >
                              {copiedKey === copyKey ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        )}

                        {/* Notes */}
                        {task.notes && (
                          <div style={{ fontSize: 10, color: "var(--muted)", fontStyle: "italic", lineHeight: 1.5 }}>
                            {task.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Day Milestone */}
                  {day.milestone && (
                    <div style={{
                      padding: "8px 12px",
                      background: "#16a34a08",
                      border: "1px solid #16a34a20",
                      borderRadius: 8,
                      fontSize: 11,
                      color: "#16a34a",
                      fontWeight: 600,
                    }}>
                      Milestone: {day.milestone}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Launch Day Checklist */}
      {checklist.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h4 style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 4,
            opacity: 0.8,
          }}>Launch Day Checklist</h4>
          {checklist.map((item: string, i: number) => (
            <label key={i} style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              fontSize: 12,
              color: "var(--text-soft)",
              cursor: "pointer",
            }}>
              <input type="checkbox" style={{ accentColor: ACCENT }} />
              {item}
            </label>
          ))}
        </div>
      )}

      {/* Post-Launch Advice */}
      {result.postLaunchAdvice && (
        <div style={{
          padding: "14px 16px",
          background: "var(--glass-bg)",
          border: "1px solid var(--border)",
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, opacity: 0.8 }}>
            After the 14 Days
          </div>
          <div style={{ fontSize: 12, color: "var(--text-soft)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {result.postLaunchAdvice}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MVP Scalpel Display ─────────────────────────────────────────────────

function MVPScalpelDisplay({ result }: { result: Record<string, any> }) {
  const [expandedKill, setExpandedKill] = useState<number | null>(null);
  const [expandedRule, setExpandedRule] = useState<number | null>(null);
  const ACCENT = "#C45A5A";

  const killList = Array.isArray(result.killList) ? result.killList : [];
  const skeleton = result.skeletonMVP || {};
  const features = Array.isArray(skeleton.features) ? skeleton.features : [];
  const excluded = Array.isArray(skeleton.explicitlyExcluded) ? skeleton.explicitlyExcluded : [];
  const spec = result.weekendSpec || {};
  const hourPlan = Array.isArray(spec.hourByHourPlan) ? spec.hourByHourPlan : [];
  const techStack = Array.isArray(spec.techStack) ? spec.techStack : [];
  const pages = Array.isArray(spec.pages) ? spec.pages : [];
  const endpoints = Array.isArray(spec.endpoints) ? spec.endpoints : [];
  const services = Array.isArray(spec.thirdPartyServices) ? spec.thirdPartyServices : [];
  const ttfd = result.timeToFirstDollar || {};
  const breakdown = Array.isArray(ttfd.breakdown) ? ttfd.breakdown : [];
  const assumptions = Array.isArray(ttfd.assumptions) ? ttfd.assumptions : [];
  const rules = Array.isArray(result.antiScopeCreepRules) ? result.antiScopeCreepRules : [];
  const verdict = result.verdict || {};

  const effortColor = (e: string) => e === 'days' ? '#16a34a' : e === 'weeks' ? '#d97706' : '#dc2626';
  const effortBg = (e: string) => e === 'days' ? '#16a34a14' : e === 'weeks' ? '#d9770614' : '#dc262614';

  const readinessConfig: Record<string, { color: string; bg: string; icon: string }> = {
    'ship-now': { color: '#16a34a', bg: '#16a34a14', icon: '\u2713' },
    'almost-ready': { color: '#d97706', bg: '#d9770614', icon: '\u25CB' },
    'needs-rethink': { color: '#dc2626', bg: '#dc262614', icon: '\u2717' },
  };
  const rc = readinessConfig[verdict.readiness] || readinessConfig['almost-ready'];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Verdict Badge ──────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px",
        background: rc.bg,
        border: `1px solid ${rc.color}20`,
        borderRadius: 12,
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>MVP Readiness</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: rc.color, marginTop: 4, textTransform: "uppercase" }}>{(verdict.readiness || 'almost-ready').replace(/-/g, ' ')}</div>
          {verdict.summary && <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 6, lineHeight: 1.5 }}>{verdict.summary}</div>}
        </div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 12px", background: rc.bg, color: rc.color,
          borderRadius: 8, fontSize: 12, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.04em",
          border: `1px solid ${rc.color}20`,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: rc.color, boxShadow: `0 0 6px ${rc.color}60` }} />
          {verdict.readiness || 'almost-ready'}
        </span>
      </div>

      {/* ── Kill List ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${ACCENT}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </div>
          <h4 style={{ ...scalpelSubHeader, color: ACCENT }}>Features to Kill</h4>
          <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>({killList.length})</span>
        </div>
        {killList.map((item: any, i: number) => {
          const isOpen = expandedKill === i;
          return (
            <div key={i} style={{
              border: "1px solid var(--border)", borderRadius: 10,
              overflow: "hidden", background: isOpen ? `${ACCENT}06` : "transparent",
              transition: "background 200ms",
            }}>
              <button onClick={() => setExpandedKill(isOpen ? null : i)} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "10px 14px", background: "transparent",
                border: "none", cursor: "pointer", fontFamily: "inherit",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", textDecoration: "line-through", textDecorationColor: ACCENT }}>
                    {item.feature}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px",
                    borderRadius: 6, textTransform: "uppercase",
                    color: effortColor(item.effort), background: effortBg(item.effort),
                  }}>{item.effort}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"
                    style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms" }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>
              {isOpen && (
                <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ height: 1, background: "var(--border)" }} />
                  <div style={{ fontSize: 11, color: "var(--text-soft)" }}>
                    <span style={{ fontWeight: 700, color: "#d97706" }}>Why it feels essential: </span>{item.whyItFeelsEssential}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-soft)" }}>
                    <span style={{ fontWeight: 700, color: ACCENT }}>Why it kills you: </span>{item.whyItKills}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-soft)" }}>
                    <span style={{ fontWeight: 700, color: "var(--muted)" }}>Build when: </span>{item.whenToBuild}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Skeleton MVP ───────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h4 style={scalpelSubHeader}>Skeleton MVP</h4>

        {/* One-liner */}
        {skeleton.oneLiner && (
          <div style={{
            padding: "14px 16px", background: `${ACCENT}08`, border: `1px solid ${ACCENT}15`,
            borderRadius: 10, fontSize: 14, fontWeight: 600, color: "var(--text)", lineHeight: 1.5,
          }}>
            {skeleton.oneLiner}
          </div>
        )}

        {/* Core Hypothesis callout */}
        {skeleton.coreHypothesis && (
          <div style={{
            padding: "10px 14px", background: "var(--glass-bg)", borderRadius: 8,
            borderLeft: `3px solid #d97706`, fontSize: 12, color: "var(--text-soft)", lineHeight: 1.5,
          }}>
            <span style={{ fontWeight: 700, color: "#d97706", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Core Hypothesis</span>
            <div style={{ marginTop: 4 }}>{skeleton.coreHypothesis}</div>
          </div>
        )}

        {/* Feature cards */}
        {features.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: features.length > 2 ? "1fr 1fr" : "1fr", gap: 8 }}>
            {features.map((f: any, i: number) => (
              <div key={i} style={{
                padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10,
                display: "flex", flexDirection: "column", gap: 4,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{f.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-soft)", lineHeight: 1.5 }}>{f.description}</div>
                <div style={{ fontSize: 10, color: "#5A8C6E", fontWeight: 600, marginTop: 2 }}>{f.whyIncluded}</div>
              </div>
            ))}
          </div>
        )}

        {/* Excluded */}
        {excluded.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "4px 0" }}>
            {excluded.map((ex: string, i: number) => (
              <span key={i} style={{
                fontSize: 11, color: "var(--muted)", textDecoration: "line-through",
                padding: "3px 10px", background: "var(--sidebar)", borderRadius: 6,
                opacity: 0.7,
              }}>{ex}</span>
            ))}
          </div>
        )}

        {/* Success criteria */}
        {skeleton.successCriteria && (
          <div style={{
            padding: "8px 12px", background: "#16a34a0a", border: "1px solid #16a34a20",
            borderRadius: 8, fontSize: 11, fontWeight: 600, color: "#16a34a",
          }}>
            Success: {skeleton.successCriteria}
          </div>
        )}
      </div>

      {/* ── Weekend Spec ───────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h4 style={scalpelSubHeader}>Build This Weekend</h4>
          {spec.totalHours && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: ACCENT,
              padding: "3px 10px", background: `${ACCENT}14`, borderRadius: 6,
            }}>{spec.totalHours}h total</span>
          )}
        </div>

        {/* Tech stack badges */}
        {techStack.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {techStack.map((t: string, i: number) => (
              <span key={i} style={{
                fontSize: 10, fontWeight: 600, color: "var(--text-soft)",
                padding: "3px 10px", background: "var(--sidebar)", borderRadius: 6,
                border: "1px solid var(--border)",
              }}>{t}</span>
            ))}
          </div>
        )}

        {/* Pages as mini wireframes */}
        {pages.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: pages.length > 2 ? "1fr 1fr" : "1fr", gap: 8 }}>
            {pages.map((p: any, i: number) => (
              <div key={i} style={{
                padding: "10px 12px", border: "1px dashed var(--border)", borderRadius: 8,
                background: "var(--glass-bg)",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>{p.purpose}</div>
                {Array.isArray(p.components) && p.components.map((c: string, j: number) => (
                  <div key={j} style={{
                    fontSize: 9, color: "var(--text-soft)", padding: "2px 6px",
                    background: "var(--sidebar)", borderRadius: 4, display: "inline-block",
                    margin: "1px 3px 1px 0",
                  }}>{c}</div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Endpoints */}
        {endpoints.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {endpoints.map((ep: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
                  color: ep.method === 'GET' ? '#5A8C6E' : ep.method === 'POST' ? '#5A6E8C' : '#d97706',
                  padding: "1px 6px", background: "var(--sidebar)", borderRadius: 4,
                  minWidth: 36, textAlign: "center",
                }}>{ep.method}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--text-soft)" }}>{ep.path}</span>
                <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: "auto" }}>{ep.purpose}</span>
              </div>
            ))}
          </div>
        )}

        {/* Third-party services */}
        {services.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {services.map((s: any, i: number) => (
              <span key={i} style={{
                fontSize: 10, color: "var(--text-soft)",
                padding: "3px 10px", background: "var(--sidebar)", borderRadius: 6,
                border: "1px solid var(--border)",
              }}>{s.name} <span style={{ color: "var(--muted)" }}>({s.cost})</span></span>
            ))}
          </div>
        )}

        {/* Deploy target */}
        {spec.deployTarget && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <span style={{ color: "var(--muted)", fontWeight: 600 }}>Deploy:</span>
            <span style={{
              padding: "2px 10px", background: "#5A8C6E14", color: "#5A8C6E",
              borderRadius: 6, fontWeight: 700, fontSize: 10,
            }}>{spec.deployTarget}</span>
          </div>
        )}

        {/* Hour-by-hour timeline */}
        {hourPlan.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative", paddingLeft: 18 }}>
            <div style={{
              position: "absolute", left: 6, top: 8, bottom: 8,
              width: 2, background: `${ACCENT}30`,
            }} />
            {hourPlan.map((h: any, i: number) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "8px 0", position: "relative",
              }}>
                <div style={{
                  position: "absolute", left: -14, top: 12,
                  width: 8, height: 8, borderRadius: "50%",
                  background: ACCENT, border: "2px solid var(--card-solid, var(--card, #fff))",
                  zIndex: 1,
                }} />
                <div style={{ minWidth: 50, fontSize: 10, fontWeight: 700, color: ACCENT, paddingTop: 2 }}>{h.hour}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{h.task}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{h.deliverable}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Launch ready */}
        {spec.launchReady && (
          <div style={{
            padding: "8px 12px", background: "#16a34a0a", border: "1px solid #16a34a20",
            borderRadius: 8, fontSize: 11, fontWeight: 600, color: "#16a34a",
          }}>
            Done = {spec.launchReady}
          </div>
        )}
      </div>

      {/* ── Time to First Dollar ────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h4 style={scalpelSubHeader}>Time to First Dollar</h4>

        {/* Total days hero */}
        {ttfd.estimatedDays && (
          <div style={{
            display: "flex", alignItems: "center", gap: 16,
            padding: "14px 18px", background: "#d9770608", border: "1px solid #d9770620",
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: "#d97706", lineHeight: 1 }}>
              {ttfd.estimatedDays}<span style={{ fontSize: 14, opacity: 0.6 }}> days</span>
            </div>
          </div>
        )}

        {/* Phase breakdown horizontal */}
        {breakdown.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {breakdown.map((b: any, i: number) => {
              const totalDays = breakdown.reduce((s: number, x: any) => s + (x.days || 0), 0);
              const pct = totalDays > 0 ? Math.max(((b.days / totalDays) * 100), 15) : 100 / breakdown.length;
              return (
                <div key={i} style={{
                  flex: `${pct} 0 0`, minWidth: 80,
                  padding: "8px 10px", background: "var(--glass-bg)", borderRadius: 8,
                  borderTop: `3px solid ${ACCENT}`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text)" }}>{b.phase}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: ACCENT }}>{b.days}d</div>
                  <div style={{ fontSize: 9, color: "var(--muted)", lineHeight: 1.4 }}>{b.description}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Fastest path callout */}
        {ttfd.fastestPath && (
          <div style={{
            padding: "10px 14px", background: "#d9770610", borderRadius: 8,
            borderLeft: `3px solid #d97706`, fontSize: 12, color: "var(--text-soft)", lineHeight: 1.5,
          }}>
            <span style={{ fontWeight: 700, color: "#d97706", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Fastest Path to $1</span>
            <div style={{ marginTop: 4 }}>{ttfd.fastestPath}</div>
          </div>
        )}

        {/* Assumptions */}
        {assumptions.length > 0 && (
          <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.6 }}>
            <span style={{ fontWeight: 700 }}>Assumptions: </span>
            {assumptions.join(' · ')}
          </div>
        )}
      </div>

      {/* ── Anti-Scope Creep Rules ──────────────────────────────────── */}
      <div style={{
        padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 12,
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        <h4 style={{ ...scalpelSubHeader, marginBottom: 4 }}>Anti-Scope Creep Rules</h4>
        {rules.map((r: any, i: number) => {
          const isOpen = expandedRule === i;
          return (
            <button key={i} onClick={() => setExpandedRule(isOpen ? null : i)} style={{
              display: "flex", flexDirection: "column", gap: 4,
              padding: "8px 10px", background: isOpen ? "var(--glass-bg)" : "transparent",
              border: "none", borderRadius: 8, cursor: "pointer",
              fontFamily: "inherit", textAlign: "left", width: "100%",
              transition: "background 200ms",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 900, color: ACCENT,
                  width: 20, height: 20, borderRadius: "50%",
                  background: `${ACCENT}14`, display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>{i + 1}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{r.rule}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"
                  style={{ marginLeft: "auto", transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms", flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {isOpen && (
                <div style={{ fontSize: 11, color: "var(--muted)", paddingLeft: 28, lineHeight: 1.5 }}>{r.why}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const scalpelSubHeader: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
  opacity: 0.8,
};

// ─── Shared Styles ──────────────────────────────────────────────────────────

const subHeaderStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
  opacity: 0.8,
};

const viewReportButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--text-soft)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  marginTop: 8,
  width: "100%",
  transition: "all 0.2s",
};

const smallLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 8px",
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 500,
  cursor: "pointer",
  textDecoration: "underline",
  opacity: 0.8,
};

const tagLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tagStyle: React.CSSProperties = {
  padding: "4px 10px",
  background: "var(--glass-bg)",
  borderRadius: 6,
  fontSize: 11,
  color: "var(--text-soft)",
  border: "1px solid var(--border)",
  lineHeight: 1.4,
};
