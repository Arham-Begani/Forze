"use client";

import React, { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Email and password are required.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: { name: name.trim() || undefined },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) throw authError;

      if (data.session) {
        window.location.href = "/dashboard";
      } else {
        setInfo("Account created. If email confirmation is enabled, check your inbox and click the verification link.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create your account. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const strength = getPasswordStrength(password);
  const strengthLabel = strengthLabels[Math.min(strength.score, strengthLabels.length - 1)];

  return (
    <div style={pageStyle}>
      <div style={blob1Style} />
      <div style={blob2Style} />
      <div style={blob3Style} />
      <div style={noiseStyle} />

      {mounted ? (
        <motion.div
          style={cardStyle}
          className="glass-auth-card"
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={accentLineStyle} />
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
            Create your account
          </motion.h1>
          <motion.p
            style={subtitleStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.24, duration: 0.4 }}
          >
            Sign up with your email, password, and name.
          </motion.p>

          <motion.form
            onSubmit={handleSignUp}
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

            <label className="auth-label" htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              className="auth-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (optional)"
              autoComplete="name"
            />

            <label className="auth-label" htmlFor="password">Password</label>
            <div style={passwordFieldWrapStyle}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="auth-input"
                style={passwordInputStyle}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={passwordToggleStyle}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <div style={strengthWrapStyle}>
              <div style={strengthBarTrackStyle}>
                <motion.div
                  style={{
                    ...strengthBarFillStyle,
                    width: `${(strength.score / 4) * 100}%`,
                    background: strength.color,
                  }}
                  initial={false}
                  animate={{ width: `${(strength.score / 4) * 100}%` }}
                  transition={{ duration: 0.25 }}
                />
              </div>
              <div style={{ ...strengthMetaStyle, color: strength.color }}>
                {strengthLabel}
              </div>
            </div>
            <ul style={criteriaListStyle}>
              {strength.criteria.map((item) => (
                <li key={item.key} style={{ ...criteriaItemStyle, color: item.met ? "var(--text)" : "var(--muted)" }}>
                  <span style={{
                    ...criteriaDotStyle,
                    background: item.met ? strength.color : "var(--border-strong)",
                  }} />
                  {item.label}
                </li>
              ))}
            </ul>

            <label className="auth-label" htmlFor="confirmPassword">Confirm password</label>
            <div style={passwordFieldWrapStyle}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                className="auth-input"
                style={passwordInputStyle}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(v => !v)}
                style={passwordToggleStyle}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>

            {error && (
              <motion.p
                className="auth-error"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.p>
            )}

            {info && !error && (
              <motion.p
                className="auth-success"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {info}
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
                  Creating account...
                </span>
              ) : (
                "Create account"
              )}
            </motion.button>
          </motion.form>

          <motion.p
            style={footerTextStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
          >
            Already have an account?{" "}
            <a href="/signin" style={linkStyle}>Sign in</a>
          </motion.p>
        </motion.div>
      ) : (
        <div style={cardStyle} className="glass-auth-card">
          <div style={accentLineStyle} />
          <div style={logoStyle}>
            <div style={hexLogoStyle} />
            <span style={wordmarkStyle}>Forge</span>
          </div>
          <h1 style={titleStyle}>Create your account</h1>
          <p style={subtitleStyle}>Sign up with your email, password, and name.</p>
        </div>
      )}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg)",
  fontFamily: "'Inter', sans-serif",
  padding: "1.5rem 1rem",
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
  background: "radial-gradient(circle, rgba(90,140,110,0.12) 0%, transparent 70%)",
  filter: "blur(60px)",
  top: "50%",
  right: "15%",
  pointerEvents: "none",
  zIndex: 0,
  animation: "blob-float 10s ease-in-out infinite 2s",
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
  padding: "36px 36px 28px",
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
  marginBottom: 22,
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
  fontSize: "1.2rem",
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
  margin: "0 0 24px",
};

const footerTextStyle: React.CSSProperties = {
  textAlign: "center",
  fontSize: 13,
  color: "var(--muted)",
  margin: "18px 0 0",
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

const strengthLabels = ["Very weak", "Weak", "Fair", "Strong", "Very strong"] as const;

function getPasswordStrength(password: string) {
  const criteria = [
    { key: "length", label: "At least 8 characters", met: password.length >= 8 },
    { key: "lower", label: "A lowercase letter", met: /[a-z]/.test(password) },
    { key: "upper", label: "An uppercase letter", met: /[A-Z]/.test(password) },
    { key: "digit", label: "A number", met: /\d/.test(password) },
    { key: "symbol", label: "A symbol", met: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = criteria.reduce((total, item) => total + (item.met ? 1 : 0), 0);
  const color = score <= 1 ? "#d97706" : score <= 3 ? "#16a34a" : "#0f766e";

  return { score, color, criteria };
}

const passwordFieldWrapStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
};

const passwordInputStyle: React.CSSProperties = {
  paddingRight: 72,
};

const passwordToggleStyle: React.CSSProperties = {
  position: "absolute",
  right: 12,
  top: "50%",
  transform: "translateY(-50%)",
  border: "none",
  background: "transparent",
  color: "var(--accent)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const strengthWrapStyle: React.CSSProperties = {
  marginTop: 8,
};

const strengthBarTrackStyle: React.CSSProperties = {
  width: "100%",
  height: 8,
  borderRadius: 999,
  background: "var(--nav-active)",
  overflow: "hidden",
};

const strengthBarFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
};

const strengthMetaStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  fontWeight: 700,
};

const criteriaListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "10px 0 0",
  display: "grid",
  gap: 6,
};

const criteriaItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  lineHeight: 1.4,
};

const criteriaDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  flexShrink: 0,
};
