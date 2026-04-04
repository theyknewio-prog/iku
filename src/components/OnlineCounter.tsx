"use client";

import { useState, useEffect } from "react";

/**
 * OnlineCounter
 * Affiche un compteur "online now" qui fluctue toutes les 2-4 secondes
 * pour simuler du trafic en temps réel.
 *
 * Plage : 800 – 2 500 visiteurs
 * Delta par tick : -18 à +21 (légèrement biaisé vers le haut)
 * Intervalle : 2 000 – 4 000 ms (aléatoire pour paraître naturel)
 */
export function OnlineCounter() {
  const [count, setCount] = useState(1247);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function tick() {
      setCount((prev) => {
        const delta = Math.floor(Math.random() * 40) - 18; // -18 to +21
        const next = prev + delta;
        return Math.max(800, Math.min(2500, next));
      });

      // Reschedule avec un délai aléatoire entre 2 et 4 secondes
      const delay = 2000 + Math.random() * 2000;
      timeoutId = setTimeout(tick, delay);
    }

    // Premier tick après 2-4 secondes
    const initialDelay = 2000 + Math.random() * 2000;
    timeoutId = setTimeout(tick, initialDelay);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <>
      <span className="hp-online-dot" aria-hidden="true" />
      <span>{count.toLocaleString()} online now</span>
    </>
  );
}
