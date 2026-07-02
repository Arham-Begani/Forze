"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import { ResultCard, ModuleId } from "../ui/ResultCard";
import { FileText, Download, UserPlus } from "lucide-react";
import { downloadPDFFromResult } from "@/lib/client-pdf";
import { VentureHeader, VENTURE_TABS } from "./VentureHeader";

interface VentureDashboardProps {
  venture: {
    id: string;
    name: string;
    context: {
      landing: any;
      shadowBoard?: any;
    };
  };
}

// Map tab ids (module slugs) to their venture.context keys.
const TAB_CONTEXT_KEYS: Record<string, string> = {
  landing: "landing",
  "shadow-board": "shadowBoard",
};

const MODULE_TAB_IDS = VENTURE_TABS
  .filter((t) => t.kind === "module")
  .map((t) => t.id as ModuleId);

function isModuleTabId(value: string | null): value is ModuleId {
  return value !== null && (MODULE_TAB_IDS as string[]).includes(value);
}

export function VentureDashboard({ venture }: VentureDashboardProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = useMemo<ModuleId>(() => {
    const fromQuery = searchParams?.get("tab");
    return isModuleTabId(fromQuery) ? fromQuery : "landing";
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState<ModuleId>(initialTab);
  const [isExporting, setIsExporting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

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

  const headerActions = (
    <>
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
        onClick={() => router.push(`/dashboard/venture/${venture.id}/team`)}
        className="flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl whitespace-nowrap"
        title="Invite teammates to collaborate on this venture"
      >
        <UserPlus size={16} />
        <span className="hidden sm:inline">Invite Teammates</span>
        <span className="sm:hidden">Invite</span>
      </motion.button>
    </>
  );

  return (
    <div className="flex h-full flex-col bg-[var(--bg)]">
      <VentureHeader
        ventureId={venture.id}
        ventureName={venture.name}
        activeTab={activeTab}
        onModuleTabClick={setActiveTab}
        actions={headerActions}
      />

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
                {venture.context[TAB_CONTEXT_KEYS[activeTab] as keyof typeof venture.context] ? (
                  <ResultCard
                    moduleId={activeTab}
                    result={venture.context[TAB_CONTEXT_KEYS[activeTab] as keyof typeof venture.context]}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[var(--border)] py-16 text-center opacity-60 sm:py-24">
                    <div className="w-16 h-16 mb-4 rounded-full bg-[var(--glass-bg)] flex items-center justify-center text-[var(--muted)]">
                      <FileText size={32} />
                    </div>
                    <h3 className="text-xl font-semibold text-[var(--text)]">Section Pending</h3>
                    <p className="max-w-xs mt-2 text-sm text-[var(--muted)]">
                      This module hasn&apos;t been run for this venture yet. Open it from the sidebar to generate this data.
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
