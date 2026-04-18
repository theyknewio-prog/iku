"use client";

import { useRef } from "react";
import Link from "next/link";

interface CarouselProps {
  title: string;
  badge?: string;
  seeAllHref?: string;
  children: React.ReactNode;
}

export function Carousel({
  title,
  badge,
  seeAllHref,
  children,
}: CarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollBy(direction: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = (el.firstElementChild as HTMLElement)?.offsetWidth ?? 160;
    const scrollAmount = cardWidth * 4 + 12 * 3;
    el.scrollBy({ left: direction * scrollAmount, behavior: "smooth" });
  }

  return (
    <section className="carousel-section">
      {/* Section header */}
      <div className="carousel-section__header">
        <div className="carousel-section__left">
          <h2 className="carousel-section__title">{title}</h2>
          {badge && <span className="carousel-section__badge">{badge}</span>}
        </div>
        {seeAllHref && (
          <Link href={seeAllHref} className="carousel-section__see-all">
            See all
          </Link>
        )}
      </div>

      {/* Carousel wrapper with arrow controls */}
      <div className="carousel-wrap">
        <button
          className="carousel-arrow carousel-arrow--left"
          onClick={() => scrollBy(-1)}
          aria-label="Scroll left"
        >
          ‹
        </button>

        <div className="carousel-track" ref={scrollRef}>
          {children}
        </div>

        <button
          className="carousel-arrow carousel-arrow--right"
          onClick={() => scrollBy(1)}
          aria-label="Scroll right"
        >
          ›
        </button>
      </div>
    </section>
  );
}
