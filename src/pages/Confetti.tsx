import React, { useEffect, useRef } from 'react';

interface ConfettiProps {
  active: boolean;
  onDone?: () => void;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#eab308', '#0ea5e9'];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function Confetti({ active, onDone }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();
  const particles = useRef<any[]>([]);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Spawn particles
    particles.current = Array.from({ length: 120 }, () => ({
      x: canvas.width / 2 + randomBetween(-200, 200),
      y: canvas.height * 0.4,
      vx: randomBetween(-8, 8),
      vy: randomBetween(-18, -6),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: randomBetween(6, 12),
      rotation: randomBetween(0, Math.PI * 2),
      rotationSpeed: randomBetween(-0.3, 0.3),
      opacity: 1,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }));

    let done = false;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.current = particles.current.filter(p => p.opacity > 0);

      for (const p of particles.current) {
        p.x += p.vx;
        p.vy += 0.5; // gravity
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.012;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (particles.current.length > 0) {
        animRef.current = requestAnimationFrame(animate);
      } else if (!done) {
        done = true;
        onDone?.();
      }
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[999] pointer-events-none"
    />
  );
}
