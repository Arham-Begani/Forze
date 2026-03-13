"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { X } from "lucide-react";
import { downloadPDF } from "@/lib/client-pdf";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  accentColor: string;
}

export function ReportModal({ isOpen, onClose, title, content, accentColor }: ReportModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="report-modal-overlay" style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
            }}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="report-modal-container"
            style={{
              width: "100%",
              maxWidth: 900,
              maxHeight: "90vh",
              background: "var(--glass-bg-strong)",
              backdropFilter: "blur(20px)",
              border: "1px solid var(--glass-border)",
              borderRadius: 24,
              overflow: "hidden",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 24px 48px rgba(0,0,0,0.4), 0 0 0 1px var(--glass-border)",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: `linear-gradient(to right, ${accentColor}10, transparent)`,
              gap: 16,
            }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</h2>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>Comprehensive Analysis & Strategy</p>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 36, height: 36,
                  borderRadius: "50%",
                  background: "var(--glass-bg)",
                  border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "var(--text-soft)",
                  transition: "all 0.2s",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Area */}
            <div className="markdown-report report-modal-content" style={{
              padding: "40px 48px",
              overflowY: "auto",
              flex: 1,
              color: "var(--text-soft)",
              lineHeight: 1.6,
            }}>
              <style jsx global>{`
                .markdown-report h1 { font-size: 2.5em; margin-bottom: 0.8em; color: var(--text); font-weight: 800; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
                .markdown-report h2 { font-size: 1.8em; margin-top: 1.5em; margin-bottom: 0.6em; color: var(--text); font-weight: 700; }
                .markdown-report h3 { font-size: 1.4em; margin-top: 1.2em; margin-bottom: 0.4em; color: var(--text); }
                .markdown-report p { margin-bottom: 1.2em; font-size: 1.05rem; }
                .markdown-report ul, .markdown-report ol { margin-bottom: 1.2em; padding-left: 1.5em; }
                .markdown-report li { margin-bottom: 0.5em; }
                .markdown-report table { width: 100%; border-collapse: collapse; margin-bottom: 2em; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
                .markdown-report th { background: var(--nav-active); padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid var(--border); }
                .markdown-report td { padding: 12px; border-bottom: 1px solid var(--border); }
                .markdown-report blockquote { border-left: 4px solid ${accentColor}; padding-left: 1.5em; font-style: italic; color: var(--muted); margin: 2em 0; }
                .markdown-report strong { color: var(--text); font-weight: 600; }
                .markdown-report code { background: var(--nav-active); padding: 2px 6px; borderRadius: 4px; font-family: monospace; }
                .markdown-report hr { border: none; border-top: 1px solid var(--border); margin: 3em 0; }
              `}</style>
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>

            {/* Footer */}
            <div style={{
              padding: "16px 32px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "flex-end",
              background: "var(--nav-bg)",
            }}>
              <button
                onClick={() => {
                  const lines = content.split('\n')
                  const sections: { title: string; content: string }[] = []
                  let currentTitle = title
                  let currentContent: string[] = []

                  for (const line of lines) {
                    const trimmed = line.trim()
                    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
                      if (currentContent.length) {
                        sections.push({ title: currentTitle, content: currentContent.join('\n') })
                        currentContent = []
                      }
                      currentTitle = trimmed.replace(/^#\s+/, '')
                    } else {
                      currentContent.push(line)
                    }
                  }
                  if (currentContent.length) {
                    sections.push({ title: currentTitle, content: currentContent.join('\n') })
                  }
                  if (sections.length === 0) {
                    sections.push({ title, content })
                  }
                  downloadPDF(title, sections)
                }}
                style={{
                  padding: "8px 20px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  color: "var(--text-soft)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Download PDF
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
