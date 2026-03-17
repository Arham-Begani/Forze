"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type ModuleId =
  | "full-launch"
  | "research"
  | "branding"
  | "marketing"
  | "landing"
  | "feasibility"
  | "general"
  | "shadow-board"
  | "launch-autopilot";

export interface ModuleDefinition {
  id: ModuleId;
  icon: string;
  label: string;
  accent: string;
  description: string;
}

const MODULE_GROUPS: { label: string; ids: ModuleId[] }[] = [
  { label: "LAUNCH", ids: ["full-launch", "launch-autopilot"] },
  { label: "AGENTS", ids: ["research", "branding", "marketing", "landing", "feasibility"] },
  { label: "TOOLS", ids: ["general", "shadow-board"] },
];

export const MODULES: Record<ModuleId, ModuleDefinition> = {
  "full-launch": { id: "full-launch", icon: "⬡", label: "Full Launch", accent: "#C4975A", description: "All agents together" },
  "research": { id: "research", icon: "◎", label: "Research", accent: "#5A8C6E", description: "Market intelligence" },
  "branding": { id: "branding", icon: "◇", label: "Branding", accent: "#5A6E8C", description: "Brand bible" },
  "marketing": { id: "marketing", icon: "▲", label: "Marketing", accent: "#8C5A7A", description: "GTM strategy" },
  "landing": { id: "landing", icon: "▣", label: "Landing Page", accent: "#8C7A5A", description: "Live deployment" },
  "feasibility": { id: "feasibility", icon: "◈", label: "Feasibility", accent: "#7A5A8C", description: "GO/NO-GO verdict" },
  "general": { id: "general", icon: "◉", label: "General", accent: "#6B8F71", description: "Ask anything" },
  "shadow-board": { id: "shadow-board", icon: "⚔", label: "Shadow Board", accent: "#E04848", description: "Silicon board review" },
  "launch-autopilot": { id: "launch-autopilot", icon: "▶", label: "Launch Autopilot", accent: "#B8864E", description: "14-day launch calendar" },
};

export interface ModulePickerProps {
  selectedModule: ModuleId;
  onChange: (module: ModuleId) => void;
}

export function ModulePicker({ selectedModule, onChange }: ModulePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentModule = MODULES[selectedModule] || MODULES["full-launch"];

  if (!mounted) {
    return (
      <div className="relative inline-block">
        <div 
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px 6px 8px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            background: `${currentModule.accent}20`,
            border: `1px solid ${currentModule.accent}40`,
            color: currentModule.accent,
          }}
        >
          <div style={{ width: 22, height: 22, borderRadius: 6, background: `${currentModule.accent}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
            {currentModule.icon}
          </div>
          <span>{currentModule.label}</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{
              position: "absolute",
              bottom: "calc(100% + 10px)",
              left: 0,
              background: "var(--glass-bg)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid var(--glass-border)",
              boxShadow: "var(--shadow-lg)",
              borderRadius: 16,
              padding: "6px",
              width: 300,
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {MODULE_GROUPS.map((group, groupIndex) => (
              <div key={group.label}>
                {groupIndex > 0 && (
                  <div style={{ height: 1, background: "var(--border)", margin: "4px 8px" }} />
                )}
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.06em",
                  color: "var(--muted)",
                  padding: "8px 10px 4px",
                }}>
                  {group.label}
                </div>
                {group.ids.map((id) => {
                  const mod = MODULES[id];
                  const isSelected = mod.id === selectedModule;
                  return (
                    <motion.button
                      key={mod.id}
                      whileHover={{ backgroundColor: isSelected ? undefined : "var(--nav-active)" }}
                      onClick={() => {
                        onChange(mod.id);
                        setIsOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "9px 10px",
                        borderRadius: 10,
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                        fontFamily: "inherit",
                        background: isSelected ? `${mod.accent}14` : "transparent",
                        transition: "background 150ms",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 28, height: 28,
                          borderRadius: 8,
                          background: `${mod.accent}20`,
                          color: mod.accent,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12,
                          flexShrink: 0,
                        }}>
                          {mod.icon}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, color: isSelected ? mod.accent : "var(--text)" }}>
                          {mod.label}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--muted)", maxWidth: 100, textAlign: "right", lineHeight: 1.3 }}>
                        {mod.description}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pill */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.04, opacity: 0.9 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px 6px 8px",
          borderRadius: 20,
          cursor: "pointer",
          outline: "none",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12,
          fontWeight: 600,
          background: `${currentModule.accent}20`,
          border: `1px solid ${currentModule.accent}40`,
          color: currentModule.accent,
          boxShadow: `0 0 12px ${currentModule.accent}18, inset 0 0 0 1px ${currentModule.accent}10`,
          transition: "box-shadow 200ms, background 200ms",
          letterSpacing: "0.01em",
        }}
      >
        <div style={{
          width: 22, height: 22,
          borderRadius: 6,
          background: `${currentModule.accent}28`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11,
        }}>
          {currentModule.icon}
        </div>
        <span>{currentModule.label}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
          style={{ opacity: 0.6, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 200ms" }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.button>
    </div>
  );
}
