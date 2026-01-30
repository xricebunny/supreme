"use client";

import { useEffect, useState, useCallback } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
}

interface ConfettiProps {
  active: boolean;
  onComplete?: () => void;
}

const COLORS = ["#00ff88", "#00e5ff", "#22c55e", "#40efff", "#00ffaa", "#88ffcc"];
const PARTICLE_COUNT = 50;

export default function Confetti({ active, onComplete }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  const createParticles = useCallback(() => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      newParticles.push({
        id: i,
        x: 50 + (Math.random() - 0.5) * 20,
        y: 40,
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 12 - 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
      });
    }
    return newParticles;
  }, []);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }

    setParticles(createParticles());

    let frame: number;
    let startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;

      if (elapsed > 2000) {
        setParticles([]);
        onComplete?.();
        return;
      }

      setParticles((prev) =>
        prev.map((p) => ({
          ...p,
          x: p.x + p.vx * 0.3,
          y: p.y + p.vy * 0.3,
          vy: p.vy + 0.3,
          rotation: p.rotation + p.rotationSpeed,
          vx: p.vx * 0.99,
        })).filter((p) => p.y < 120)
      );

      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [active, createParticles, onComplete]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="confetti-container">
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
}
