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

  /* Hydration loading state */
  if (verified === null) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100dvh",
          background: "#0a0a0a",
        }}
      >
        <div className="loader" />
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="age-gate">
        <div className="age-gate__card">
          {/* Logo */}
          <div className="age-gate__logo">iku.gg</div>
          <div className="age-gate__tagline">Anime · Uncensored · Free</div>

          <h1 className="age-gate__title">Adults only</h1>
          <p className="age-gate__sub">
            This site contains explicit adult content.
            <br />
            You must be at least <strong>18 years old</strong> to enter.
          </p>

          <div className="age-gate__actions">
            <button onClick={handleVerify} className="age-gate__enter">
              I am 18 or older &mdash; Enter
            </button>
            <a href="https://google.com" className="age-gate__leave">
              I am under 18 &mdash; Leave
            </a>
          </div>

          <p className="age-gate__legal">
            By entering you agree to our <a href="/terms">Terms of Service</a>{" "}
            and confirm you are of legal age in your jurisdiction. All content
            is user-submitted from{" "}
            <a
              href="https://danbooru.donmai.us"
              target="_blank"
              rel="noopener noreferrer"
            >
              Danbooru
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
