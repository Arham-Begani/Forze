"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;
      window.location.href = "/dashboard";
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyle}>
      {/* Ambient background blobs */}
      <div style={blob1Style} />
      <div style={blob2Style} />
      <div style={blob3Style} />

      {/* Noise overlay */}
      <div style={noiseStyle} />

      <motion.div
        style={cardStyle}
        className="glass-auth-card"
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Top accent line */}
        <div style={accentLineStyle} />

        {/* Logo */}
        <motion.div
          style={logoStyle}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
        >
          <motion.div
            style={hexLogoStyle}
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          />
          <span style={wordmarkStyle}>Forge</span>
        </motion.div>

        <motion.h1
          style={titleStyle}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4 }}
        >
          Welcome back
        </motion.h1>
        <motion.p
          style={subtitleStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.24, duration: 0.4 }}
        >
          Sign in to your Forge account
        </motion.p>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.45 }}
        >
          <label className="auth-label" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            className="auth-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label className="auth-label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="auth-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />

          {error && (
            <motion.p
              className="auth-error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.p>
          )}

          <motion.button
            type="submit"
            className="auth-btn"
            disabled={loading}
            whileHover={!loading ? { scale: 1.015, translateY: -1 } : {}}
            whileTap={!loading ? { scale: 0.985 } : {}}
            style={{ marginTop: 4 }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <motion.span
                  style={spinnerStyle}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                />
                Signing in…
              </span>
            ) : (
              "Sign in"
            )}
          </motion.button>
        </motion.form>

        <motion.p
          style={footerTextStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
        >
          Don&apos;t have an account?{" "}
          <a href="/signup" style={linkStyle}>Sign up</a>
        </motion.p>
      </motion.div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg)",
  fontFamily: "'Inter', sans-serif",
  padding: "1rem",
  position: "relative",
  overflow: "hidden",
};

const blob1Style: React.CSSProperties = {
  position: "fixed",
  width: 560,
  height: 560,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(192,122,58,0.22) 0%, transparent 70%)",
  filter: "blur(80px)",
  top: -180,
  right: -140,
  pointerEvents: "none",
  zIndex: 0,
  animation: "blob-float 14s ease-in-out infinite",
};

const blob2Style: React.CSSProperties = {
  position: "fixed",
  width: 480,
  height: 480,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(90,110,140,0.18) 0%, transparent 70%)",
  filter: "blur(90px)",
  bottom: -160,
  left: -120,
  pointerEvents: "none",
  zIndex: 0,
  animation: "blob-float 18s ease-in-out infinite reverse",
};

const blob3Style: React.CSSProperties = {
  position: "fixed",
  width: 300,
  height: 300,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(122,90,140,0.12) 0%, transparent 70%)",
  filter: "blur(60px)",
  top: "40%",
  left: "10%",
  pointerEvents: "none",
  zIndex: 0,
  animation: "blob-float 10s ease-in-out infinite",
};

const noiseStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
  opacity: 0.4,
  pointerEvents: "none",
  zIndex: 0,
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  padding: "40px 36px 32px",
  position: "relative",
  zIndex: 1,
};

const accentLineStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: "10%",
  right: "10%",
  height: 2,
  background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
  borderRadius: 2,
  opacity: 0.7,
};

const logoStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  marginBottom: 24,
};

const hexLogoStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  background: "linear-gradient(135deg, var(--accent), #e8963a)",
  clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
  flexShrink: 0,
  boxShadow: "0 4px 14px var(--accent-glow)",
};

const wordmarkStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 700,
  color: "var(--accent)",
  letterSpacing: "-0.03em",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  color: "var(--text)",
  textAlign: "center",
  margin: "0 0 6px",
  letterSpacing: "-0.02em",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--muted)",
  textAlign: "center",
  margin: "0 0 28px",
};

const footerTextStyle: React.CSSProperties = {
  textAlign: "center",
  fontSize: 13,
  color: "var(--muted)",
  margin: "20px 0 0",
};

const linkStyle: React.CSSProperties = {
  color: "var(--accent)",
  textDecoration: "none",
  fontWeight: 600,
};

const spinnerStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.3)",
  borderTopColor: "#fff",
  display: "inline-block",
};
