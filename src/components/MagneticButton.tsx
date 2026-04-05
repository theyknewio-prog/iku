"use client";

/**
 * MagneticButton — wraps any button/link and gives it a subtle magnetic hover
 * effect (the element follows the cursor within a radius) plus a GSAP-powered
 * ripple on click.
 *
 * Applied to primary CTAs (Go Pro, Sign Up, Pricing) to add a premium "awwwards"
 * feel without rewriting the buttons themselves — it's a drop-in wrapper.
 *
 * Usage:
 *   <MagneticButton>
 *     <Link href="/pricing" className="hp-go-pro__btn hp-go-pro__btn--primary">
 *       See plans
 *     </Link>
 *   </MagneticButton>
 *
 * Accessibility:
 * - Respects prefers-reduced-motion (renders children statically)
 * - Disabled on touch devices (magnetic hover is irrelevant there)
 * - Keyboard focus still works normally on the inner button/link
 */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

interface MagneticButtonProps {
  children: React.ReactNode;
  /** Magnetic strength — how far the element follows the cursor (0-1). */
  strength?: number;
  /** Hover radius in pixels. Outside this, no attraction. */
  radius?: number;
  /** If true, add a click ripple animation. Default true. */
  ripple?: boolean;
  /** Optional wrapper className. */
  className?: string;
}

export function MagneticButton({
  children,
  strength = 0.35,
  radius = 80,
  ripple = true,
  className,
}: MagneticButtonProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Touch devices skip magnetic hover entirely.
    const isTouch = window.matchMedia("(hover: none)").matches;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isTouch || prefersReduced) return;

    // Look for the first focusable child (button or anchor). Fallback to wrapper.
    const target: HTMLElement =
      wrapper.querySelector<HTMLElement>("button, a") ?? wrapper;

    const onPointerMove = (e: PointerEvent) => {
      const rect = target.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        gsap.to(target, {
          x: dx * strength,
          y: dy * strength,
          duration: 0.4,
          ease: "power2.out",
        });
      } else {
        gsap.to(target, { x: 0, y: 0, duration: 0.5, ease: "power3.out" });
      }
    };

    const onPointerLeave = () => {
      gsap.to(target, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
    };

    const onClick = (e: MouseEvent) => {
      if (!ripple) return;
      const rect = target.getBoundingClientRect();
      const rippleEl = document.createElement("span");
      rippleEl.setAttribute("aria-hidden", "true");
      rippleEl.style.cssText = `
        position: absolute;
        left: ${e.clientX - rect.left}px;
        top: ${e.clientY - rect.top}px;
        width: 0;
        height: 0;
        border-radius: 9999px;
        background: radial-gradient(circle, rgba(255,255,255,0.5), rgba(255,255,255,0));
        transform: translate(-50%, -50%);
        pointer-events: none;
        mix-blend-mode: screen;
        z-index: 1;
      `;
      // Ensure the target is a positioning context so the ripple stays inside.
      const originalPos = getComputedStyle(target).position;
      if (originalPos === "static") target.style.position = "relative";
      target.style.overflow = "hidden";
      target.appendChild(rippleEl);

      const diag = Math.sqrt(rect.width ** 2 + rect.height ** 2);
      gsap.to(rippleEl, {
        width: diag * 2.2,
        height: diag * 2.2,
        opacity: 0,
        duration: 0.7,
        ease: "power2.out",
        onComplete: () => rippleEl.remove(),
      });
    };

    // Use the wrapper for pointer events so the magnetic field extends
    // beyond the child bounds. The child itself handles the click.
    wrapper.addEventListener("pointermove", onPointerMove);
    wrapper.addEventListener("pointerleave", onPointerLeave);
    target.addEventListener("click", onClick);

    return () => {
      wrapper.removeEventListener("pointermove", onPointerMove);
      wrapper.removeEventListener("pointerleave", onPointerLeave);
      target.removeEventListener("click", onClick);
      gsap.killTweensOf(target);
    };
  }, [strength, radius, ripple]);

  return (
    <span
      ref={wrapperRef}
      className={className}
      style={{
        display: "inline-block",
        // Give the wrapper some padding to widen the hover zone for the magnetic field
        // without shifting the visual layout. The child is position:relative so its
        // GSAP x/y transforms work inside this span.
        padding: 8,
        margin: -8,
      }}
    >
      {children}
    </span>
  );
}
