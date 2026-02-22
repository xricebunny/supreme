"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthProvider";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { login, isLoggedIn, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  // Auto-close when login succeeds
  useEffect(() => {
    if (isLoggedIn && isOpen) {
      onClose();
    }
  }, [isLoggedIn, isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    try {
      await login(email.trim());
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10, 15, 13, 0.85)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div
        style={{
          width: 400,
          maxWidth: "90vw",
          background: "#111a16",
          border: "1px solid #1e3329",
          borderRadius: 12,
          padding: "32px 28px",
          boxShadow: "0 0 40px rgba(0, 255, 136, 0.08)",
        }}
      >
        {/* Close button */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button
            onClick={onClose}
            disabled={sending}
            style={{
              background: "none",
              border: "none",
              color: "#4a7a66",
              fontSize: 20,
              cursor: "pointer",
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#ffffff",
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          Login to{" "}
          <span style={{ color: "#00ff88" }}>SUPREME</span>
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "#4a7a66",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          Enter your email to receive a one-time code
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sending}
            autoFocus
            style={{
              width: "100%",
              padding: "12px 14px",
              background: "#0a0f0d",
              border: "1px solid #1e3329",
              borderRadius: 8,
              color: "#ffffff",
              fontSize: 14,
              outline: "none",
              marginBottom: 16,
              boxSizing: "border-box",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#00ff88";
              e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0, 255, 136, 0.3)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#1e3329";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          <button
            type="submit"
            disabled={!email.trim() || sending}
            style={{
              width: "100%",
              padding: "12px",
              background: !email.trim() || sending ? "#1e3329" : "#00ff88",
              color: !email.trim() || sending ? "#4a7a66" : "#0a0f0d",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: !email.trim() || sending ? "not-allowed" : "pointer",
            }}
          >
            {sending ? "Sending code..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
