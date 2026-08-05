"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { X, Pencil, Check, Loader2 } from "lucide-react";
import { downloadPDF } from "@/lib/client-pdf";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  accentColor: string;
  onSurgicalEdit?: (oldText: string, newText: string) => Promise<void>;
}

export function ReportModal({ isOpen, onClose, title, content, accentColor, onSurgicalEdit }: ReportModalProps) {
  const [selectedText, setSelectedText] = useState("");
  const [editedText, setEditedText] = useState("");
  const [editState, setEditState] = useState<"idle" | "selecting" | "editing" | "saving">("idle");
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setEditState("idle");
      setSelectedText("");
      setEditedText("");
      setPopoverPos(null);
      setEditError(null);
    }
  }, [isOpen]);

  // Focus textarea
  useEffect(() => {
    if (editState === "editing" && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editState]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [editedText]);

  const cancelEdit = useCallback(() => {
    setEditState("idle");
    setSelectedText("");
    setEditedText("");
    setPopoverPos(null);
    setEditError(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!onSurgicalEdit || editState === "editing" || editState === "saving") return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !contentRef.current) return;

    const selected = selection.toString().trim();
    if (!selected || selected.length < 2) return;

    const range = selection.getRangeAt(0);
    if (!contentRef.current.contains(range.commonAncestorContainer)) return;

    const rect = range.getBoundingClientRect();
    const containerRect = contentRef.current.getBoundingClientRect();

    setSelectedText(selected);
    setEditedText(selected);
    setPopoverPos({
      top: rect.bottom - containerRect.top + 8,
      left: Math.max(0, Math.min(
        rect.left - containerRect.left + rect.width / 2 - 145,
        containerRect.width - 310
      )),
    });
    setEditState("selecting");
    setEditError(null);
  }, [onSurgicalEdit, editState]);

  const confirmEdit = useCallback(async () => {
    if (!selectedText || editedText === selectedText || !onSurgicalEdit) {
      cancelEdit();
      return;
    }
    setEditState("saving");
    setEditError(null);
    try {
      await onSurgicalEdit(selectedText, editedText);
      cancelEdit();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to save");
      setEditState("editing");
    }
  }, [selectedText, editedText, onSurgicalEdit, cancelEdit]);

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
            <div
              ref={contentRef}
              className="markdown-report report-modal-content"
              onMouseUp={handleMouseUp}
              style={{
                padding: "40px 48px",
                overflowY: "auto",
                flex: 1,
                color: "var(--text-soft)",
                lineHeight: 1.6,
                position: "relative",
                cursor: onSurgicalEdit ? "text" : undefined,
              }}
            >
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

              {/* Edit hint for report */}
              {onSurgicalEdit && editState === "idle" && (
                <div style={{
                  position: "sticky",
                  bottom: 0,
                  textAlign: "center",
                  padding: "8px 0",
                  opacity: 0.4,
                  fontSize: 11,
                  color: "var(--muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  pointerEvents: "none",
                }}>
                  <Pencil size={10} />
                  Select any text to edit it
                </div>
              )}

              {/* Surgical edit popover */}
              <AnimatePresence>
                {popoverPos && editState !== "idle" && (
                  <motion.div
                    ref={popoverRef}
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      top: popoverPos.top,
                      left: popoverPos.left,
                      zIndex: 200,
                      width: 300,
                      background: "var(--glass-bg-strong)",
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      border: "1px solid var(--glass-border)",
                      borderRadius: 14,
                      boxShadow: "var(--shadow-lg)",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ height: 2, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}60, transparent)` }} />
                    <div style={{ padding: "10px 14px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${accentColor}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Pencil size={10} style={{ color: accentColor }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>Surgical Edit</span>
                      </div>
                      <button onClick={cancelEdit} style={{ width: 22, height: 22, borderRadius: "50%", background: "transparent", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--muted)", padding: 0, fontFamily: "inherit" }}>
                        <X size={11} />
                      </button>
                    </div>

                    {editState === "selecting" && (
                      <div style={{ padding: "0 14px 12px" }}>
                        <div style={{ fontSize: 12, color: "var(--text-soft)", lineHeight: 1.5, padding: "8px 10px", background: `${accentColor}08`, border: `1px solid ${accentColor}18`, borderRadius: 8, marginBottom: 10, maxHeight: 60, overflow: "hidden" }}>
                          &ldquo;{selectedText}&rdquo;
                        </div>
                        <button
                          onClick={() => { setEditState("editing"); window.getSelection()?.removeAllRanges(); }}
                          style={{ width: "100%", padding: "8px 12px", background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: `0 4px 12px ${accentColor}30`, fontFamily: "inherit" }}
                        >
                          <Pencil size={12} /> Edit This Text
                        </button>
                      </div>
                    )}

                    {(editState === "editing" || editState === "saving") && (
                      <div style={{ padding: "0 14px 12px" }}>
                        <div style={{ marginBottom: 6 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Original</span>
                          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5, padding: "6px 8px", background: "var(--nav-active)", borderRadius: 6, marginTop: 3, textDecoration: "line-through", opacity: 0.6, maxHeight: 44, overflow: "hidden" }}>
                            {selectedText}
                          </div>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>Replacement</span>
                          <textarea
                            ref={textareaRef}
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); confirmEdit(); } }}
                            disabled={editState === "saving"}
                            style={{ width: "100%", minHeight: 40, maxHeight: 120, resize: "none", fontSize: 12, color: "var(--text)", lineHeight: 1.5, padding: "8px 10px", background: "var(--glass-bg)", border: `1px solid ${accentColor}30`, borderRadius: 8, marginTop: 3, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                          />
                        </div>
                        {editError && (
                          <div style={{ fontSize: 11, color: "#dc2626", padding: "6px 8px", background: "#dc262608", borderRadius: 6, marginBottom: 8 }}>
                            {editError}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={cancelEdit} disabled={editState === "saving"} style={{ flex: 1, padding: "7px 10px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-soft)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: editState === "saving" ? 0.5 : 1 }}>
                            Cancel
                          </button>
                          <button
                            onClick={confirmEdit}
                            disabled={editState === "saving" || editedText === selectedText}
                            style={{ flex: 1, padding: "7px 10px", background: editedText === selectedText ? "var(--nav-active)" : `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, border: "none", borderRadius: 8, color: editedText === selectedText ? "var(--muted)" : "#fff", fontSize: 11, fontWeight: 700, cursor: editedText === selectedText ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, boxShadow: editedText !== selectedText ? `0 3px 10px ${accentColor}30` : "none" }}
                          >
                            {editState === "saving" ? <><Loader2 size={11} className="surgical-spin" /> Saving</> : <><Check size={11} /> Apply</>}
                          </button>
                        </div>
                        <div style={{ fontSize: 9, color: "var(--muted)", textAlign: "center", marginTop: 6, opacity: 0.6 }}>
                          {typeof navigator !== "undefined" && navigator.platform?.includes("Mac") ? "\u2318" : "Ctrl"}+Enter to apply
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
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
                  void downloadPDF(title, sections).catch(err => console.error('Export failed:', err))
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
