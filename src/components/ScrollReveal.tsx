"use client";

/**
 * ScrollReveal — fades + slides children into view when they enter the viewport.
 *
 * Built on IntersectionObserver (no ScrollTrigger plugin needed, keeps bundle
 * light). GSAP handles the actual tween so timing/easing stays consistent
 * with JoinDiscordCTA and other GSAP-powered components.
 *
 * Usage:
 *   <ScrollReveal>
 *     <h2>My section</h2>
 *     <p>Contents animated in</p>
 *   </ScrollReveal>
 *
 *   <ScrollReveal stagger={0.08}>
 *     <div>Card 1</div>  // these fade in one after another
 *     <div>Card 2</div>
 *     <div>Card 3</div>
 *   </ScrollReveal>
 *
 * Accessibility: respects `prefers-reduced-motion` — if the user opts out
 * of motion, content appears instantly with no tween.
 */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

interface ScrollRevealProps {
  children: React.ReactNode;
  /** Stagger delay between direct children, in seconds. 0 = single fade. */
  stagger?: number;
  /** Delay before the tween starts, in seconds. */
  delay?: number;
  /** Vertical slide distance in pixels. Default 24px. */
  y?: number;
  /** Tween duration in seconds. Default 0.8. */
  duration?: number;
  /** Trigger offset — how far inside the viewport before firing (0-1). */
  threshold?: number;
  /** Optional className on the wrapper div. */
  className?: string;
  /** If true, only animate direct children (stagger). Default: animate self. */
  staggerChildren?: boolean;
}

export function ScrollReveal({
  children,
  stagger = 0,
  delay = 0,
  y = 24,
  duration = 0.8,
  threshold = 0.15,
  className,
  staggerChildren = false,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced-motion: show content instantly, no tween.
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) {
      el.style.opacity = "1";
      if (staggerChildren) {
        Array.from(el.children).forEach((child) => {
          (child as HTMLElement).style.opacity = "1";
        });
      }
      return;
    }

    // Set initial state — hidden, shifted down.
    if (staggerChildren && el.children.length > 0) {
      gsap.set(Array.from(el.children), { opacity: 0, y });
    } else {
      gsap.set(el, { opacity: 0, y });
    }

    let observer: IntersectionObserver | null = null;
    let fired = false;

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !fired) {
            fired = true;
            if (staggerChildren && el.children.length > 0) {
              gsap.to(Array.from(el.children), {
                opacity: 1,
                y: 0,
                duration,
                delay,
                stagger: stagger || 0.08,
                ease: "power3.out",
              });
            } else {
              gsap.to(el, {
                opacity: 1,
                y: 0,
                duration,
                delay,
                ease: "power3.out",
              });
            }
            // One-shot: disconnect after firing to save resources.
            observer?.disconnect();
          }
        });
      },
      { threshold },
    );

    observer.observe(el);

    return () => {
      observer?.disconnect();
    };
  }, [stagger, delay, y, duration, threshold, staggerChildren]);

  return (
    <div ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}
