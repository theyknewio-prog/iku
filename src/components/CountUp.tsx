"use client";

/**
 * CountUp — animates a number from 0 → target when it enters the viewport.
 *
 * Used on stat counters (353,000+ videos, online users, etc.) to add a
 * premium feel to the hero sections.
 *
 * Usage:
 *   <CountUp end={353000} duration={2} suffix="+" />
 *   <CountUp end={1247} prefix="" />
 *
 * Respects prefers-reduced-motion — shows final value instantly.
 */

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

interface CountUpProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  /** Separator for thousands. Default: comma. */
  separator?: string;
  className?: string;
}

export function CountUp({
  end,
  duration = 1.8,
  prefix = "",
  suffix = "",
  separator = ",",
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const format = (n: number) => {
      const int = Math.round(n);
      const withSep = int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);
      return `${prefix}${withSep}${suffix}`;
    };

    if (prefersReduced) {
      setDisplay(format(end));
      return;
    }

    let fired = false;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !fired) {
            fired = true;
            const obj = { val: 0 };
            gsap.to(obj, {
              val: end,
              duration,
              ease: "power2.out",
              onUpdate: () => setDisplay(format(obj.val)),
            });
            observer.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, [end, duration, prefix, suffix, separator]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
