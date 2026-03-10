"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

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
    <div className="page">
      <div className="card">
        {/* Logo */}
        <div className="logo">
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M18 2L32.124 10V26L18 34L3.876 26V10L18 2Z"
              fill="#c07a3a"
            />
          </svg>
          <span className="wordmark">Forge</span>
        </div>

        <h1 className="title">Sign in to your account</h1>

        <form onSubmit={handleSubmit}>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />

          {error && <p className="error">{error}</p>}

          <button type="submit" className="button" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="footer">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="link">
            Sign up
          </a>
        </p>
      </div>

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap");

        .page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #faf9f6;
          font-family: "DM Sans", sans-serif;
          padding: 1rem;
        }

        @media (prefers-color-scheme: dark) {
          .page {
            background: #111110;
          }

          .card {
            background: #1a1918 !important;
            border-color: #272523 !important;
          }

          .title {
            color: #f5f5f4 !important;
          }

          .label {
            color: #a8a29e !important;
          }

          .input {
            background: #111110 !important;
            border-color: #272523 !important;
            color: #f5f5f4 !important;
          }

          .input::placeholder {
            color: #57534e !important;
          }

          .footer {
            color: #a8a29e !important;
          }
        }

        .card {
          width: 100%;
          max-width: 400px;
          background: #ffffff;
          border: 1px solid #e8e4dc;
          border-radius: 12px;
          padding: 2.5rem 2rem;
        }

        .logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .wordmark {
          font-size: 1.5rem;
          font-weight: 600;
          color: #c07a3a;
          letter-spacing: -0.02em;
        }

        .title {
          font-size: 1.125rem;
          font-weight: 500;
          color: #1c1917;
          text-align: center;
          margin: 0 0 1.5rem;
        }

        .label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #44403c;
          margin-bottom: 0.375rem;
        }

        .input {
          width: 100%;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          font-family: "DM Sans", sans-serif;
          border: 1px solid #e8e4dc;
          border-radius: 8px;
          background: #faf9f6;
          color: #1c1917;
          outline: none;
          margin-bottom: 1rem;
          box-sizing: border-box;
        }

        .input:focus {
          border-color: #c07a3a;
          box-shadow: 0 0 0 2px rgba(192, 122, 58, 0.15);
        }

        .error {
          font-size: 0.8125rem;
          color: #dc2626;
          margin: 0 0 1rem;
        }

        .button {
          width: 100%;
          padding: 0.625rem;
          font-size: 0.875rem;
          font-weight: 500;
          font-family: "DM Sans", sans-serif;
          color: #ffffff;
          background: #c07a3a;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: opacity 0.15s;
        }

        .button:hover {
          opacity: 0.9;
        }

        .button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .footer {
          text-align: center;
          font-size: 0.8125rem;
          color: #78716c;
          margin: 1.25rem 0 0;
        }

        .link {
          color: #c07a3a;
          text-decoration: none;
          font-weight: 500;
        }

        .link:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
