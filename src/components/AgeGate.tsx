"use client";

import { useState, useEffect } from "react";

export function AgeGate({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("iku-age-verified");
    setVerified(stored === "true");
  }, []);

  const handleVerify = () => {
    localStorage.setItem("iku-age-verified", "true");
    setVerified(true);
  };

  // Loading state
  if (verified === null) {
    return (
      <div className="flex items-center justify-center h-dvh bg-[#0a0a0a]">
        <div className="loader" />
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="age-gate">
        <div className="flex flex-col items-center gap-6 px-8 max-w-sm text-center">
          {/* Logo */}
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="text-white">iku</span>
            <span className="text-accent">.gg</span>
          </h1>

          <p className="text-text-secondary text-sm leading-relaxed">
            This website contains adult content.
            <br />
            You must be at least <strong className="text-white">18 years old</strong> to enter.
          </p>

          <button
            onClick={handleVerify}
            className="w-full py-3.5 rounded-xl bg-accent text-black font-semibold text-base transition-all hover:brightness-110 active:scale-[0.98]"
          >
            I am 18 or older — Enter
          </button>

          <a
            href="https://google.com"
            className="text-text-secondary text-xs hover:text-white transition-colors"
          >
            I am under 18 — Leave
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
