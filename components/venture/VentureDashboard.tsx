"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ResultCard, ModuleId } from "../ui/ResultCard";
import { FileText, Download, Rocket, Info, Palette, Globe, ShieldCheck, Share2 } from "lucide-react";

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

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/ventures/${venture.id}/export`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${venture.name.replace(/\s+/g, "_")}_Dossier.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      {/* Top Header / Stats */}
      <div className="flex items-center justify-between p-6 bg-[var(--sidebar)] border-b border-[var(--border)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{venture.name}</h1>
          <p className="text-sm text-[var(--muted)]">Master Venture Dossier</p>
        </div>
        <div className="flex gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--nav-active)] border border-[var(--border)] rounded-lg text-sm font-semibold text-[var(--text)] hover:bg-[var(--glass-bg-strong)] transition-all shadow-sm disabled:opacity-50"
          >
            <Download size={16} className={isExporting ? "animate-bounce" : ""} />
            {isExporting ? "Exporting..." : "Export Unified PDF"}
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all"
          >
            <Share2 size={16} />
            Share Dossier
          </motion.button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 p-4 bg-[var(--glass-bg)] border-b border-[var(--border)] overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 relative
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
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 bg-[var(--bg)] scroll-smooth no-scrollbar">
        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {venture.context[activeTab as keyof typeof venture.context] ? (
                <ResultCard
                  moduleId={activeTab}
                  result={venture.context[activeTab as keyof typeof venture.context]}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-[var(--border)] rounded-3xl opacity-60">
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
        </div>
      </div>
    </div>
  );
}
