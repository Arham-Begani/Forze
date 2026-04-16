"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ResultCard, ModuleId } from "../ui/ResultCard";
import { FileText, Download, Rocket, Info, Palette, Globe, ShieldCheck, Share2 } from "lucide-react";
import { downloadPDFFromResult } from "@/lib/client-pdf";

interface VentureDashboardProps {
  venture: {
    id: string;
    name: string;
    context: {
      research: any;
      branding: any;
      marketing: any;
      landing: any;
      feasibility: any;
    };
  };
}

const TABS: { id: ModuleId; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "research", label: "Research", icon: <Info size={16} />, color: "#5A8C6E" },
  { id: "branding", label: "Branding", icon: <Palette size={16} />, color: "#5A6E8C" },
  { id: "marketing", label: "Marketing", icon: <Rocket size={16} />, color: "#8C5A7A" },
  { id: "landing", label: "Landing", icon: <Globe size={16} />, color: "#8C7A5A" },
  { id: "feasibility", label: "Feasibility", icon: <ShieldCheck size={16} />, color: "#7A5A8C" },
];

export function VentureDashboard({ venture }: VentureDashboardProps) {
  const [activeTab, setActiveTab] = useState<ModuleId>("research");
  const [isExporting, setIsExporting] = useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      downloadPDFFromResult(
        `${venture.name} — Venture Dossier`,
        venture.context,
        `${venture.name.replace(/\s+/g, "_")}_Dossier`
      );
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[var(--bg)]">
      {/* Top Header / Stats */}
      <div className="border-b border-[var(--border)] bg-[var(--sidebar)]">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6 max-w-7xl mx-auto w-full">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text)] sm:text-2xl truncate">{venture.name}</h1>
            <p className="text-sm text-[var(--muted)]" style={{ marginTop: '2px' }}>Master Venture Dossier</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto sm:justify-end sm:gap-3 flex-wrap sm:flex-nowrap">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--nav-active)] px-3 py-2 text-sm font-semibold text-[var(--text)] shadow-sm transition-all hover:bg-[var(--glass-bg-strong)] disabled:opacity-50 whitespace-nowrap"
            >
              <Download size={16} className={isExporting ? "animate-bounce" : ""} />
              <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export PDF"}</span>
              <span className="sm:hidden">{isExporting ? "..." : "PDF"}</span>
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl whitespace-nowrap"
            >
              <Share2 size={16} />
              <span className="hidden sm:inline">Share</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto border-b border-[var(--border)] bg-[var(--glass-bg)] p-3 sm:p-4 no-scrollbar">
        <div className="max-w-7xl mx-auto flex gap-2 w-full">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              relative flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-300 sm:px-6
              ${activeTab === tab.id 
                ? "bg-[var(--glass-bg-strong)] text-[var(--text)] shadow-sm" 
                : "text-[var(--muted)] hover:text-[var(--text-soft)] hover:bg-[var(--glass-bg)]"}
            `}
          >
            <span style={{ color: activeTab === tab.id ? tab.color : "inherit" }}>
              {tab.icon}
            </span>
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-2 right-2 h-0.5"
                style={{ backgroundColor: tab.color }}
              />
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-[var(--bg)] p-4 scroll-smooth sm:p-8 no-scrollbar">
        <div className="max-w-7xl mx-auto">
          {mounted && (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              >
                {venture.context[activeTab as keyof typeof venture.context] ? (
                  <ResultCard
                    moduleId={activeTab}
                    result={venture.context[activeTab as keyof typeof venture.context]}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[var(--border)] py-16 text-center opacity-60 sm:py-24">
                    <div className="w-16 h-16 mb-4 rounded-full bg-[var(--glass-bg)] flex items-center justify-center text-[var(--muted)]">
                       <FileText size={32} />
                    </div>
                    <h3 className="text-xl font-semibold text-[var(--text)]">Section Pending</h3>
                    <p className="max-w-xs mt-2 text-sm text-[var(--muted)]">
                      This module hasn&apos;t been run for this venture yet. Run the full launch or individual agent to populate this data.
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
