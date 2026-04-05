"use client";

/**
 * JoinDiscordCTA — animated button to join the iku.gg Discord server.
 *
 * GSAP animations:
 *   - idle: subtle floating hearts drifting up
 *   - hover: scale + glow pulse + Discord icon bounce + sheen sweep
 *   - click: brief scale pop
 */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

const DISCORD_INVITE = "https://discord.gg/cQZc8trq8N";

interface Props {
  variant?: "hero" | "compact" | "inline";
  className?: string;
}

export function JoinDiscordCTA({ variant = "hero", className = "" }: Props) {
  const btnRef = useRef<HTMLAnchorElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const sheenRef = useRef<HTMLSpanElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);

  // Idle float animation + particle spawner
  useEffect(() => {
    const btn = btnRef.current;
    const glow = glowRef.current;
    const particles = particlesRef.current;
    if (!btn || !glow || !particles) return;

    // Slow glow pulse (always running)
    const glowTween = gsap.to(glow, {
      opacity: 0.65,
      scale: 1.15,
      duration: 1.6,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });

    // Subtle idle breathing
    const breatheTween = gsap.to(btn, {
      y: -2,
      duration: 2.2,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });

    // Floating particles (hearts + sparkles drifting up)
    const emojis = ["♡", "✦", "✧", "♥"];
    const spawnParticle = () => {
      const el = document.createElement("span");
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.className = "jd-particle";
      el.style.left = `${10 + Math.random() * 80}%`;
      particles.appendChild(el);
      gsap.fromTo(
        el,
        { y: 0, opacity: 0, scale: 0.5 },
        {
          y: -60 - Math.random() * 40,
          opacity: 0.9,
          scale: 1,
          duration: 1.2,
          ease: "sine.out",
          onComplete: () => {
            gsap.to(el, {
              opacity: 0,
              duration: 0.3,
              onComplete: () => el.remove(),
            });
          },
        }
      );
    };
    const interval = window.setInterval(spawnParticle, 650);

    return () => {
      glowTween.kill();
      breatheTween.kill();
      clearInterval(interval);
    };
  }, []);

  const handleEnter = () => {
    const btn = btnRef.current;
    const icon = iconRef.current;
    const sheen = sheenRef.current;
    if (!btn || !icon || !sheen) return;

    gsap.to(btn, { scale: 1.05, duration: 0.28, ease: "back.out(2)" });
    gsap.to(icon, {
      rotate: -8,
      scale: 1.15,
      duration: 0.35,
      ease: "back.out(3)",
    });
    // Sheen sweep across
    gsap.fromTo(
      sheen,
      { x: "-110%", opacity: 0.6 },
      { x: "110%", opacity: 0, duration: 0.8, ease: "power2.inOut" }
    );
  };

  const handleLeave = () => {
    const btn = btnRef.current;
    const icon = iconRef.current;
    if (!btn || !icon) return;
    gsap.to(btn, { scale: 1, y: -2, duration: 0.28, ease: "power2.out" });
    gsap.to(icon, {
      rotate: 0,
      scale: 1,
      duration: 0.3,
      ease: "power2.out",
    });
  };

  const handleClick = () => {
    const btn = btnRef.current;
    if (!btn) return;
    gsap.fromTo(
      btn,
      { scale: 0.95 },
      { scale: 1.05, duration: 0.18, ease: "back.out(4)" }
    );
    // PostHog: track Discord invite click (drop-off point)
    import("@/lib/analytics").then(({ track, EVENTS }) => {
      track(EVENTS.DISCORD_INVITE_CLICK, { variant });
    });
  };

  return (
    <a
      ref={btnRef}
      href={DISCORD_INVITE}
      target="_blank"
      rel="noopener noreferrer"
      className={`jd-cta jd-cta--${variant} ${className}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={handleClick}
    >
      {/* Glow halo */}
      <span ref={glowRef} className="jd-cta__glow" aria-hidden="true" />

      {/* Floating particles */}
      <div ref={particlesRef} className="jd-cta__particles" aria-hidden="true" />

      {/* Sheen */}
      <span ref={sheenRef} className="jd-cta__sheen" aria-hidden="true" />

      {/* Content */}
      <span className="jd-cta__inner">
        <span ref={iconRef} className="jd-cta__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
        </span>
        <span className="jd-cta__text">
          <span className="jd-cta__title">Join our Discord</span>
          <span className="jd-cta__sub">353K+ clips · daily drops · watch parties</span>
        </span>
        <span className="jd-cta__arrow" aria-hidden="true">→</span>
      </span>
    </a>
  );
}
