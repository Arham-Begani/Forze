"use client";

import React from "react";

export type AgentId = "genesis" | "identity" | "pipeline" | "feasibility";
export type AgentStatus = "waiting" | "running" | "complete" | "failed";

export interface AgentStatusRowProps {
  agentId: AgentId;
  status: AgentStatus;
}

const AGENT_CONFIG: Record<AgentId, { name: string; color: string }> = {
  genesis: { name: "Genesis Engine", color: "#5A8C6E" },
  identity: { name: "Identity Architect", color: "#5A6E8C" },
  pipeline: { name: "Production Pipeline", color: "#8C7A5A" },
  feasibility: { name: "Deep Validation", color: "#7A5A8C" },
};

export function AgentStatusRow({ agentId, status }: AgentStatusRowProps) {
  const config = AGENT_CONFIG[agentId];
  if (!config) return null;
  const accent = config.color;

  return (
    <>
      <style>{`
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.4); }
        }
      `}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 0",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Agent Name */}
        <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground, var(--text, #111827))" }}>
          {config.name}
        </div>

        {/* Status Badges */}
        {status === "waiting" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "var(--nav-active)",
              color: "var(--muted)",
              padding: "4px 8px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--muted)",
              }}
            />
            Waiting
          </div>
        )}

        {status === "running" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: `${accent}1a`,
              color: accent,
              padding: "4px 8px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: accent,
                animation: "pulseDot 1s infinite",
              }}
            />
            Running
          </div>
        )}

        {status === "complete" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(90, 140, 110, 0.1)",
              color: "#5A8C6E",
              padding: "4px 8px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
              <path d="M8.33333 2.5L3.75 7.08333L1.66667 5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Done
          </div>
        )}

        {status === "failed" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(220, 38, 38, 0.1)",
              color: "#dc2626",
              padding: "4px 8px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
              <path d="M7.5 2.5L2.5 7.5M2.5 2.5L7.5 7.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Failed
          </div>
        )}
      </div>
    </>
  );
}

export default AgentStatusRow;
