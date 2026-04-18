import Link from "next/link";

export default function PreviewIndex() {
  const variants = [
    {
      slug: "v1",
      name: "Cinematic / Netflix",
      sub: "Massive hero, dark prestige, horizontal rows",
      bg: "linear-gradient(135deg, #1a0f2e 0%, #3d1a52 100%)",
    },
    {
      slug: "v2",
      name: "Twitch / Gaming",
      sub: "Left creator sidebar, live now, purple",
      bg: "linear-gradient(135deg, #3a1a6b 0%, #6b2ff7 100%)",
    },
    {
      slug: "v3",
      name: "RedGIFs / TikTok",
      sub: "Portrait player center, For You / Trending",
      bg: "linear-gradient(135deg, #1a0a0a 0%, #b91c1c 100%)",
    },
    {
      slug: "v4",
      name: "PimpBunny / Neon",
      sub: "Casino gaudy, neon pink, bunny everywhere",
      bg: "linear-gradient(135deg, #ff006e 0%, #ffbe0b 50%, #8338ec 100%)",
    },
    {
      slug: "v5",
      name: "Classic Tube (xVideos)",
      sub: "Dense grid, red accent, category pills, high density",
      bg: "linear-gradient(135deg, #1b1b1b 0%, #ff0000 100%)",
    },
    {
      slug: "v6",
      name: "Creator Premium (OnlyFans)",
      sub: "Feed of subs, tip buttons, teal/blue, sub gate",
      bg: "linear-gradient(135deg, #00aff0 0%, #0084d1 100%)",
    },
    {
      slug: "v7",
      name: "Anime Streaming (Crunchyroll)",
      sub: "Series-first, continue watching, orange accent",
      bg: "linear-gradient(135deg, #0b0f1a 0%, #ff7a00 100%)",
    },
    {
      slug: "v8",
      name: "Algorithmic Feed (YouTube 2026)",
      sub: "Chip row, massive grid, creator avatars, shorts shelf",
      bg: "linear-gradient(135deg, #0f0f0f 0%, #ff0033 100%)",
    },
    {
      slug: "v9",
      name: "Awwwards Menu (Linear/Raycast)",
      sub: "⌘K palette + collapsible sidebar + sticky chips + autocomplete",
      bg: "linear-gradient(135deg, #0a0a0f 0%, #8b38ff 55%, #ff3d7a 100%)",
    },
  ];

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#0a0612",
        color: "#fff",
        padding: "80px 40px",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1
          style={{
            fontSize: 48,
            fontWeight: 900,
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          iku.gg — 8 UI Variants
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 16,
            marginBottom: 40,
          }}
        >
          Sandbox for the 2026-04-12 redesign pass. Each variant ships its own
          header, layout, and vibe. Pick one, or mix & match sections from
          multiple. Strategic playbook at{" "}
          <Link href="/preview/playbook" style={{ color: "#ff7aa8" }}>
            /preview/playbook
          </Link>
          .
        </p>

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          }}
        >
          {variants.map((v) => (
            <Link
              key={v.slug}
              href={`/preview/${v.slug}`}
              style={{
                display: "block",
                padding: 28,
                borderRadius: 18,
                background: v.bg,
                color: "#fff",
                textDecoration: "none",
                minHeight: 180,
                position: "relative",
                boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  opacity: 0.72,
                  marginBottom: 8,
                }}
              >
                /preview/{v.slug}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  marginBottom: 6,
                  letterSpacing: "-0.01em",
                }}
              >
                {v.name}
              </div>
              <div style={{ fontSize: 13, opacity: 0.82 }}>{v.sub}</div>
              <div
                style={{
                  position: "absolute",
                  right: 24,
                  bottom: 24,
                  fontSize: 24,
                }}
              >
                →
              </div>
            </Link>
          ))}
        </div>

        <div
          style={{
            marginTop: 48,
            padding: 20,
            background: "rgba(255,255,255,0.04)",
            borderRadius: 12,
            fontSize: 13,
            color: "rgba(255,255,255,0.65)",
          }}
        >
          These variants pull the same data as the live site. They bypass the
          default AppShell so each can have its own layout. Current live site is
          at{" "}
          <Link href="/" style={{ color: "#ff7aa8" }}>
            iku.gg/
          </Link>
          .
        </div>
      </div>
    </main>
  );
}
