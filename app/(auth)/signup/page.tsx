"use client";

import React, { useState, useEffect, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";

type Step = "email" | "otp";

export default function SignUpPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          data: { name: name.trim() || undefined },
          shouldCreateUser: true,
        },
      });
      if (otpError) throw otpError;
      setStep("otp");
      setResendCooldown(60);
    } catch {
      setError("Could not send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(code: string) {
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: "email",
      });
      if (verifyError) throw verifyError;
      window.location.href = "/dashboard";
    } catch {
      setError("Invalid or expired code. Please try again.");
      setOtp(["", "", "", "", "", ""]);
      // Focus first input
      const firstInput = document.querySelector<HTMLInputElement>('[data-otp="0"]');
      firstInput?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          data: { name: name.trim() || undefined },
          shouldCreateUser: true,
        },
      });
      if (otpError) throw otpError;
      setResendCooldown(60);
    } catch {
      setError("Could not resend code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      const nextInput = document.querySelector<HTMLInputElement>(`[data-otp="${nextIndex}"]`);
      nextInput?.focus();
      const fullCode = newOtp.join("");
      if (fullCode.length === 6) handleVerifyOtp(fullCode);
      return;
    }

    const digit = value.replace(/\D/g, "");
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      const nextInput = document.querySelector<HTMLInputElement>(`[data-otp="${index + 1}"]`);
      nextInput?.focus();
    }

    const fullCode = newOtp.join("");
    if (fullCode.length === 6) handleVerifyOtp(fullCode);
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.querySelector<HTMLInputElement>(`[data-otp="${index - 1}"]`);
      prevInput?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
    }
  }

  const cardContent = step === "email" ? (
    <>
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
        We&apos;ll send a verification code to your email
      </motion.p>

      <motion.form
        onSubmit={handleSendOtp}
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
              Sending code…
            </span>
          ) : (
            "Continue"
          )}
        </motion.button>
      </motion.form>

      <motion.p
        style={footerTextStyle}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Already have an account?{" "}
        <a href="/signin" style={linkStyle}>Sign in</a>
      </motion.p>
    </>
  ) : (
    <>
      <motion.h1
        style={titleStyle}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Enter verification code
      </motion.h1>
      <motion.p
        style={subtitleStyle}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        Sent to <span style={{ color: "var(--accent)", fontWeight: 600 }}>{email}</span>
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div style={otpContainerStyle}>
          {otp.map((digit, i) => (
            <input
              key={i}
              data-otp={i}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={digit}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              style={otpInputStyle}
              className="auth-input otp-digit"
              autoFocus={i === 0}
              autoComplete="one-time-code"
            />
          ))}
        </div>

        {error && (
          <motion.p
            className="auth-error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: "center" }}
          >
            {error}
          </motion.p>
        )}

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", margin: "16px 0" }}>
            <motion.span
              style={{ ...spinnerStyle, borderTopColor: "var(--accent)" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
            />
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0 || loading}
            style={{
              ...resendBtnStyle,
              opacity: resendCooldown > 0 ? 0.5 : 1,
              cursor: resendCooldown > 0 ? "default" : "pointer",
            }}
          >
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button
            onClick={() => { setStep("email"); setOtp(["", "", "", "", "", ""]); setError(""); }}
            style={backBtnStyle}
          >
            Change email
          </button>
        </div>
      </motion.div>
    </>
  );

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

          {cardContent}
        </motion.div>
      ) : (
        <div style={cardStyle} className="glass-auth-card">
          <div style={accentLineStyle} />
          <div style={logoStyle}>
            <div style={hexLogoStyle} />
            <span style={wordmarkStyle}>Forge</span>
          </div>
          <h1 style={titleStyle}>Create your account</h1>
          <p style={subtitleStyle}>We&apos;ll send a verification code to your email</p>
        </div>
      )}
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

const otpContainerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 8,
  marginBottom: 16,
};

const otpInputStyle: React.CSSProperties = {
  width: 48,
  height: 56,
  textAlign: "center",
  fontSize: "1.5rem",
  fontWeight: 700,
  letterSpacing: 0,
  padding: 0,
  fontFamily: "'JetBrains Mono', monospace",
};

const resendBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--accent)",
  fontSize: 13,
  fontWeight: 600,
  padding: "4px 8px",
};

const backBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--muted)",
  fontSize: 13,
  cursor: "pointer",
  padding: "4px 8px",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};
