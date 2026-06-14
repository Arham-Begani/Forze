"use client";

import React from "react";
import { motion } from "framer-motion";

export type GraphNodeId = "genesis" | "identity" | "pipeline" | "feasibility";
export type GraphStatus = "pending" | "waiting" | "running" | "complete" | "failed";

export interface FullLaunchGraphProps {
  /** Status keyed by graph node id. Missing keys are treated as pending. */
  statuses: Partial<Record<GraphNodeId, GraphStatus>>;
}

interface NodeDef {
  id: GraphNodeId;
  name: string;
  role: string;
  color: string;
  /** Position as a percentage of the container (matches the SVG 0–100 viewBox). */
  x: number;
  y: number;
}

// Full Launch order: Genesis → Identity → (Pipeline + Feasibility in parallel).
// Laid out left → right so the flow reads horizontally and the cards never overlap.
const NODES: NodeDef[] = [
  { id: "genesis",     name: "Genesis Engine",     role: "Market Research", color: "#5A8C6E", x: 14, y: 50 },
  { id: "identity",    name: "Identity Architect", role: "Brand Identity",  color: "#5A6E8C", x: 45, y: 50 },
  { id: "pipeline",    name: "Production Pipeline", role: "Landing Page",    color: "#8C7A5A", x: 83, y: 24 },
  { id: "feasibility", name: "Deep Validation",    role: "Feasibility",     color: "#7A5A8C", x: 83, y: 74 },
];

interface EdgeDef {
  from: GraphNodeId;
  to: GraphNodeId;
  /** SVG path in the 0–100 coordinate space, center-to-center (hidden behind cards). */
  d: string;
}

const EDGES: EdgeDef[] = [
  { from: "genesis",  to: "identity",    d: "M14 50 L45 50" },
  { from: "identity", to: "pipeline",    d: "M45 50 C62 50, 66 24, 83 24" },
  { from: "identity", to: "feasibility", d: "M45 50 C62 50, 66 74, 83 74" },
];

function norm(s: GraphStatus | undefined): GraphStatus {
  return s === "waiting" ? "pending" : (s ?? "pending");
}

export function FullLaunchGraph({ statuses }: FullLaunchGraphProps) {
  const get = (id: GraphNodeId) => norm(statuses[id]);
  const colorFor = (id: GraphNodeId) => NODES.find((n) => n.id === id)!.color;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 640,
        height: 380,
        margin: "10px auto 28px",
      }}
    >
      {/* Connecting lines (behind the cards) */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
      >
        {EDGES.map((edge) => {
          const from = get(edge.from);
          const to = get(edge.to);
          const color = colorFor(edge.to);

          const idle = from === "pending" || from === "failed";
          const done = from === "complete" && to === "complete";
          const live = !idle; // source running or complete → carry energy

          return (
            <g key={`${edge.from}-${edge.to}`}>
              {/* Soft neon underglow */}
              {live && (
                <motion.path
                  d={edge.d}
                  fill="none"
                  stroke={color}
                  strokeWidth={6}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  style={{ filter: `blur(3px)` }}
                  animate={{ opacity: done ? [0.18, 0.32, 0.18] : [0.25, 0.5, 0.25] }}
                  transition={{ duration: done ? 3.2 : 1.8, repeat: Infinity, ease: "easeInOut" }}
                />
              )}

              {/* Base track */}
              <path
                d={edge.d}
                fill="none"
                stroke={idle ? "var(--border-strong)" : color}
                strokeOpacity={idle ? 1 : 0.45}
                strokeWidth={1.5}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{ transition: "stroke 400ms, stroke-opacity 400ms" }}
              />

              {/* Flowing energy dashes */}
              {live && (
                <motion.path
                  d={edge.d}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray="1 11"
                  vectorEffect="non-scaling-stroke"
                  style={{ filter: `drop-shadow(0 0 4px ${color})` }}
                  animate={{ strokeDashoffset: [36, 0] }}
                  transition={{ duration: done ? 2.4 : 1.1, repeat: Infinity, ease: "linear" }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Nodes */}
      {NODES.map((node, i) => (
        <GraphNode key={node.id} node={node} status={get(node.id)} index={i} />
      ))}
    </div>
  );
}

function GraphNode({ node, status, index }: { node: NodeDef; status: GraphStatus; index: number }) {
  const { color } = node;
  const isRunning = status === "running";
  const isComplete = status === "complete";
  const isFailed = status === "failed";
  const isActive = isRunning || isComplete;
  const ring = isFailed ? "#dc2626" : color;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08, type: "spring", bounce: 0.3 }}
      style={{
        position: "absolute",
        left: `${node.x}%`,
        top: `${node.y}%`,
        transform: "translate(-50%, -50%)",
        width: 132,
      }}
    >
      <div style={{ position: "relative" }}>
        {/* Radar pulse rings (running only) */}
        {isRunning &&
          [0, 1].map((i) => (
            <motion.span
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 16,
                border: `1.5px solid ${ring}`,
                pointerEvents: "none",
              }}
              initial={{ opacity: 0.55, scale: 1 }}
              animate={{ opacity: 0, scale: 1.32 }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: i * 1.2 }}
            />
          ))}

        {/* Card */}
        <motion.div
          animate={
            isRunning
              ? { boxShadow: [`0 0 0 0 ${ring}00`, `0 0 22px 1px ${ring}66`, `0 0 0 0 ${ring}00`] }
              : isComplete
              ? { boxShadow: [`0 0 10px -3px ${ring}33`, `0 0 18px -2px ${ring}66`, `0 0 10px -3px ${ring}33`] }
              : { boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }
          }
          transition={
            isRunning
              ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
              : isComplete
              ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.4 }
          }
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 7,
            padding: "13px 10px 11px",
            borderRadius: 16,
            background: "var(--card-solid)",
            border: `1px solid ${isActive || isFailed ? `${ring}55` : "var(--border)"}`,
            textAlign: "center",
          }}
        >
          {/* Icon disc */}
          <motion.div
            animate={isRunning ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={isRunning ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : {}}
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              background: isActive || isFailed ? `${ring}18` : "var(--nav-active)",
              border: `1px solid ${isActive || isFailed ? `${ring}40` : "var(--border)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              opacity: status === "pending" ? 0.55 : 1,
              transition: "background 300ms, border-color 300ms, opacity 300ms",
            }}
          >
            <NodeIcon id={node.id} color={isActive || isFailed ? ring : "var(--muted)"} />
          </motion.div>

          {/* Name */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: status === "pending" ? "var(--muted)" : "var(--text)",
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
              }}
            >
              {node.name}
            </span>
            <span style={{ fontSize: 9.5, color: "var(--muted)", letterSpacing: "0.02em" }}>{node.role}</span>
          </div>

          {/* Status chip */}
          <NodeStatusChip status={status} color={ring} />
        </motion.div>
      </div>
    </motion.div>
  );
}

function NodeStatusChip({ status, color }: { status: GraphStatus; color: string }) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "2px 9px",
    borderRadius: 20,
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  };

  if (status === "running") {
    return (
      <span style={{ ...base, background: `${color}16`, color, boxShadow: `0 0 8px ${color}30` }}>
        <motion.span
          style={{ width: 5, height: 5, borderRadius: "50%", background: color }}
          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
        Running
      </span>
    );
  }

  if (status === "complete") {
    return (
      <span style={{ ...base, background: "rgba(90,140,110,0.12)", color: "#5A8C6E" }}>
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor">
          <path d="M8.33 2.5 3.75 7.08 1.67 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Done
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span style={{ ...base, background: "rgba(220,38,38,0.10)", color: "#dc2626" }}>
        <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor">
          <path d="M7.5 2.5 2.5 7.5M2.5 2.5 7.5 7.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Failed
      </span>
    );
  }

  return (
    <span style={{ ...base, background: "var(--nav-active)", color: "var(--muted)" }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--muted)", opacity: 0.6 }} />
      Queued
    </span>
  );
}

function NodeIcon({ id, color }: { id: GraphNodeId; color: string }) {
  const p = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (id) {
    case "genesis":
      return (
        <svg {...p}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      );
    case "identity":
      return (
        <svg {...p}>
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.83-.44-1.12-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z" />
        </svg>
      );
    case "pipeline":
      return (
        <svg {...p}>
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
      );
    case "feasibility":
      return (
        <svg {...p}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    default:
      return null;
  }
}

export default FullLaunchGraph;
