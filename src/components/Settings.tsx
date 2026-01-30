"use client";

import { useState } from "react";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  onSoundToggle: () => void;
  hapticsEnabled: boolean;
  onHapticsToggle: () => void;
  onResetOnboarding: () => void;
  onResetHistory: () => void;
}

export default function Settings({
  isOpen,
  onClose,
  soundEnabled,
  onSoundToggle,
  hapticsEnabled,
  onHapticsToggle,
  onResetOnboarding,
  onResetHistory,
}: SettingsProps) {
  const [showResetConfirm, setShowResetConfirm] = useState<"onboarding" | "history" | null>(null);

  if (!isOpen) return null;

  const handleReset = (type: "onboarding" | "history") => {
    if (type === "onboarding") {
      onResetOnboarding();
    } else {
      onResetHistory();
    }
    setShowResetConfirm(null);
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="settings-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button className="settings-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Settings list */}
        <div className="settings-list">
          {/* Sound */}
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-icon">🔊</span>
              <div>
                <div className="settings-item-label">Sound Effects</div>
                <div className="settings-item-desc">Play sounds for bets and wins</div>
              </div>
            </div>
            <button
              className={`toggle-btn ${soundEnabled ? "active" : ""}`}
              onClick={onSoundToggle}
            >
              <span className="toggle-knob" />
            </button>
          </div>

          {/* Haptics */}
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-icon">📳</span>
              <div>
                <div className="settings-item-label">Haptic Feedback</div>
                <div className="settings-item-desc">Vibrate on interactions</div>
              </div>
            </div>
            <button
              className={`toggle-btn ${hapticsEnabled ? "active" : ""}`}
              onClick={onHapticsToggle}
            >
              <span className="toggle-knob" />
            </button>
          </div>

          <div className="settings-divider" />

          {/* Reset onboarding */}
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-icon">📖</span>
              <div>
                <div className="settings-item-label">Tutorial</div>
                <div className="settings-item-desc">Show the onboarding guide again</div>
              </div>
            </div>
            <button
              className="settings-action-btn"
              onClick={() => setShowResetConfirm("onboarding")}
            >
              Reset
            </button>
          </div>

          {/* Reset history */}
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-icon">🗑️</span>
              <div>
                <div className="settings-item-label">Clear History</div>
                <div className="settings-item-desc">Remove all position history</div>
              </div>
            </div>
            <button
              className="settings-action-btn danger"
              onClick={() => setShowResetConfirm("history")}
            >
              Clear
            </button>
          </div>

          <div className="settings-divider" />

          {/* App info */}
          <div className="settings-info">
            <div className="settings-info-row">
              <span>Version</span>
              <span>1.0.0</span>
            </div>
            <div className="settings-info-row">
              <span>Network</span>
              <span className="network-badge">Flow Testnet</span>
            </div>
          </div>
        </div>

        {/* Confirmation modal */}
        {showResetConfirm && (
          <div className="confirm-overlay">
            <div className="confirm-modal">
              <h3 className="confirm-title">
                {showResetConfirm === "onboarding" ? "Reset Tutorial?" : "Clear History?"}
              </h3>
              <p className="confirm-desc">
                {showResetConfirm === "onboarding"
                  ? "The tutorial will show again on your next visit."
                  : "This will permanently delete all your position history."}
              </p>
              <div className="confirm-actions">
                <button
                  className="confirm-btn cancel"
                  onClick={() => setShowResetConfirm(null)}
                >
                  Cancel
                </button>
                <button
                  className={`confirm-btn ${showResetConfirm === "history" ? "danger" : "primary"}`}
                  onClick={() => handleReset(showResetConfirm)}
                >
                  {showResetConfirm === "onboarding" ? "Reset" : "Clear"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
