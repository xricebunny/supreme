// Haptic feedback utilities for mobile
// Uses the Vibration API where available

type HapticType = "light" | "medium" | "heavy" | "success" | "warning" | "error";

const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 30],
  warning: [30, 30, 30],
  error: [50, 100, 50],
};

export function haptic(type: HapticType = "light"): void {
  if (typeof window === "undefined") return;

  // Check for Vibration API support
  if ("vibrate" in navigator) {
    const pattern = HAPTIC_PATTERNS[type];
    navigator.vibrate(pattern);
  }
}

export function hapticFeedback(type: HapticType = "light"): void {
  haptic(type);
}

// Specific haptic shortcuts
export const haptics = {
  tap: () => haptic("light"),
  press: () => haptic("medium"),
  impact: () => haptic("heavy"),
  success: () => haptic("success"),
  warning: () => haptic("warning"),
  error: () => haptic("error"),
};
