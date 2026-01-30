"use client";

import { useState, useEffect } from "react";

interface OnboardingProps {
  isOpen: boolean;
  onComplete: () => void;
}

interface Step {
  title: string;
  description: string;
  icon: string;
  highlight?: string;
}

const STEPS: Step[] = [
  {
    title: "Welcome to Supreme",
    description: "Turn price prediction into a visual game. No complex charts, no confusing numbers.",
    icon: "🎮",
  },
  {
    title: "The Grid",
    description: "Each cell represents a price level. The pink line shows the current market price moving in real-time.",
    icon: "📊",
    highlight: "grid",
  },
  {
    title: "Place Your Bet",
    description: "Tap any cell to place a bet. The further from the current price, the higher the multiplier!",
    icon: "👆",
    highlight: "cell",
  },
  {
    title: "Risk vs Reward",
    description: "Cells close to the price line are safer but pay less. Reach further for bigger wins!",
    icon: "⚖️",
    highlight: "multiplier",
  },
  {
    title: "Win When Price Hits",
    description: "When the price line reaches your cell, you win! Your bet is multiplied by the cell's value.",
    icon: "🎯",
    highlight: "hit",
  },
  {
    title: "Ready to Play!",
    description: "Start small, learn the rhythm, and may the odds be ever in your favor.",
    icon: "🚀",
  },
];

export default function Onboarding({ isOpen, onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (isAnimating) return;

    if (isLastStep) {
      onComplete();
      return;
    }

    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep((prev) => prev + 1);
      setIsAnimating(false);
    }, 200);
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleBack = () => {
    if (currentStep > 0 && !isAnimating) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep((prev) => prev - 1);
        setIsAnimating(false);
      }, 200);
    }
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-container">
        {/* Progress bar */}
        <div className="onboarding-progress">
          <div
            className="onboarding-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Skip button */}
        <button className="onboarding-skip" onClick={handleSkip}>
          Skip
        </button>

        {/* Content */}
        <div className={`onboarding-content ${isAnimating ? "animating" : ""}`}>
          <div className="onboarding-icon">{step.icon}</div>
          <h2 className="onboarding-title">{step.title}</h2>
          <p className="onboarding-description">{step.description}</p>

          {/* Visual hint based on step */}
          {step.highlight && (
            <div className="onboarding-visual">
              {step.highlight === "grid" && (
                <div className="visual-grid">
                  <div className="visual-price-line" />
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="visual-cell" />
                  ))}
                </div>
              )}
              {step.highlight === "cell" && (
                <div className="visual-tap">
                  <div className="visual-cell-tap" />
                  <div className="visual-finger">👆</div>
                </div>
              )}
              {step.highlight === "multiplier" && (
                <div className="visual-multipliers">
                  <div className="visual-mult low">1.5x</div>
                  <div className="visual-mult mid">2.5x</div>
                  <div className="visual-mult high">5.0x</div>
                </div>
              )}
              {step.highlight === "hit" && (
                <div className="visual-hit">
                  <div className="visual-cell-win" />
                  <span className="visual-win-text">WIN!</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="onboarding-nav">
          {currentStep > 0 ? (
            <button className="onboarding-btn-back" onClick={handleBack}>
              Back
            </button>
          ) : (
            <div />
          )}

          {/* Dots */}
          <div className="onboarding-dots">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`onboarding-dot ${i === currentStep ? "active" : ""} ${i < currentStep ? "completed" : ""}`}
              />
            ))}
          </div>

          <button className="onboarding-btn-next" onClick={handleNext}>
            {isLastStep ? "Let's Go!" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
