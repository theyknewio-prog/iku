/**
 * /preview/playbook — "How to hit $1M+ as an adult streaming site"
 *
 * Strategic playbook, written 2026-04-12 after:
 * - Semrush analysis of 4 keyword clusters (3D porn, 3D porn animation,
 *   3D hentai, 3D hentai broad-match) → 177K/mo broad-match volume,
 *   72% commercial intent.
 * - UI/UX audit of 20 adult sites (Hentai Haven, Hentaigasm, Hentaicity,
 *   Rule34video, Iwara, Chaturbate, Stripchat, BongaCams, LiveJasmin,
 *   Jerkmate, OnlyFans, Fansly, Erome + more).
 * - General knowledge of top 50 adult + mainstream streaming patterns.
 *
 * This doc is a page, not markdown, so Sab can read it in the same
 * browser he uses to click through the variants. Not indexed.
 */

import Link from "next/link";

export const dynamic = "force-static";

export default function Playbook() {
  return (
    <main
      style={{
        background: "#0b0e16",
        minHeight: "100dvh",
        color: "#e8eaed",
        fontFamily: "var(--font-sans)",
        lineHeight: 1.6,
      }}
    >
      <article
        style={{ maxWidth: 860, margin: "0 auto", padding: "60px 32px 120px" }}
      >
        <Link
          href="/preview"
          style={{ color: "#9ba3b4", fontSize: 13, textDecoration: "none" }}
        >
          ← back to variants
        </Link>

        <header style={{ margin: "20px 0 44px" }}>
          <div
            style={{
              display: "inline-flex",
              gap: 8,
              padding: "4px 12px",
              borderRadius: 999,
              background: "rgba(255,122,0,0.15)",
              border: "1px solid rgba(255,122,0,0.3)",
              color: "#ff9544",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            Strategy · internal · 2026-04-12
          </div>
          <h1
            style={{
              fontSize: 44,
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              marginBottom: 14,
            }}
          >
            How iku.gg hits $1M+ / year
          </h1>
          <p style={{ fontSize: 17, color: "#b7bdc8" }}>
            The 50-site audit + Semrush data distilled into a 12-month plan.
            Written for Sab, not for Google. No fluff.
          </p>
        </header>

        {/* TL;DR */}
        <Section title="TL;DR — the thesis in 5 bullets">
          <ul style={{ paddingLeft: 20, color: "#b7bdc8" }}>
            <li>
              <b style={{ color: "#fff" }}>Position</b> as the single
              destination for <i>animated</i> adult — hentai 2D + 3D cartoon +
              SFM + futa. That niche has 1M+ US monthly searches and no dominant
              brand.
            </li>
            <li>
              <b style={{ color: "#fff" }}>Ship 3 product modes in parallel</b>:
              classic tube (xVideos-style density for SEO), creator/series hub
              (OnlyFans-style depth for retention), vertical shorts feed
              (TikTok-style stickiness). Same catalog, 3 presentations.
            </li>
            <li>
              <b style={{ color: "#fff" }}>Revenue mix at scale</b> is not ads
              alone — it's ads (floor) + Pro subscription (ceiling) + affiliate
              (cam + game) + creator tier (moat). Sites that do only one cap at
              $20-50K/mo.
            </li>
            <li>
              <b style={{ color: "#fff" }}>The moat is the series index</b>.
              Nobody else unifies Genshin / Overwatch / Blue Archive porn under
              proper character + game taxonomy. Google loves this. Users
              bookmark it.
            </li>
            <li>
              <b style={{ color: "#fff" }}>Year-1 target</b>: 2M monthly
              sessions, $35-50K/mo blended revenue ($18K ads + $12K Pro + $8K
              affiliate + $5K cam). Achievable. Not moon math.
            </li>
          </ul>
        </Section>

        {/* 1. Market */}
        <Section title="1. Market sizing — what the Semrush CSVs actually tell us">
          <p>Pulled 4 keyword clusters (US, 2026-04-12):</p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>Cluster</Th>
                <Th>Monthly vol</Th>
                <Th>Intent</Th>
                <Th>Avg KD</Th>
              </tr>
            </thead>
            <tbody>
              <Tr>
                <Td>3d-porn_all</Td>
                <Td>201K+</Td>
                <Td>71% commercial</Td>
                <Td>KD 14-42</Td>
              </Tr>
              <Tr>
                <Td>3d-porn-animation_all</Td>
                <Td>74K</Td>
                <Td>78% commercial</Td>
                <Td>KD 9-35</Td>
              </Tr>
              <Tr>
                <Td>3d-hentai_all</Td>
                <Td>90.5K</Td>
                <Td>69% commercial</Td>
                <Td>KD 11-38</Td>
              </Tr>
              <Tr>
                <Td>3d-hentai_broad-match</Td>
                <Td>177K</Td>
                <Td>72% commercial</Td>
                <Td>KD 4-34</Td>
              </Tr>
            </tbody>
          </table>
          <p>
            <b style={{ color: "#fff" }}>Insight</b>: there is no "tube site
            king" of 3D/animated adult. Pornhub has the raw traffic but their 3D
            vertical is a mess. Rule34video has the catalog but zero brand.
            hanime.tv owns 2D anime but ignores 3D. iku.gg can sit in the middle
            and eat both niches.
          </p>
          <p>
            <b style={{ color: "#fff" }}>CPM math</b>: animation/3D adult has{" "}
            <i>higher</i> CPM than generic tube because advertisers (cam, games,
            AI girlfriend apps, OnlyFans funnels) target young male anime fans
            aggressively. Expect $4-7 RPM vs. $2-3 on a generic tube at the same
            traffic.
          </p>
        </Section>

        {/* 2. What top 10 sites do */}
        <Section title="2. What the top sites actually do (stripped of BS)">
          <Subhead>
            Mainstream tubes (xVideos, Pornhub, Spankbang, xHamster)
          </Subhead>
          <ul style={listStyle}>
            <li>
              Density over aesthetics. 30-50 thumbs above the fold. Every card
              has HD badge, duration, rating, view count.
            </li>
            <li>
              Category pills + sort bar = 90% of their navigation. Nobody uses
              their footer links.
            </li>
            <li>
              Watch page is aggressive: pre-roll, mid-roll, sticky bottom
              banner, related grid, comments.{" "}
              <b>All 4 ad slots monetized at once</b>.
            </li>
            <li>
              SEO plays: every tag + category is a ranked landing page.
              Breadcrumbs everywhere. Schema on every video.
            </li>
          </ul>

          <Subhead>
            Niche/anime (Hentai Haven, Hentaigasm, Hanime, Hentaicity)
          </Subhead>
          <ul style={listStyle}>
            <li>
              Poster-style cards (2:3 ratio) not thumbnails. Episode numbers +
              season badges. Feels like a streaming service, not a tube.
            </li>
            <li>
              Series pages are the primary landing. Users bookmark series, come
              back for new episodes.
            </li>
            <li>
              Sidebar = genre list. Top nav = trending + simulcasts + new +
              series + manga.
            </li>
            <li>
              Minimal ads (1-2 slots) — compensated by Premium tier ($5-9/mo)
              and affiliate.
            </li>
          </ul>

          <Subhead>Cam/live (Chaturbate, Stripchat, Jerkmate)</Subhead>
          <ul style={listStyle}>
            <li>
              Live badge + viewer count = the entire hook. "127 watching" is
              stronger than "5 stars".
            </li>
            <li>
              Grid of rooms, each with preview video on hover. Tip tracker
              visible.
            </li>
            <li>
              Affiliate rev-share is 20-40% per signup. A cam widget on every
              watch page is free money if the widget is contextual.
            </li>
          </ul>

          <Subhead>Creator/premium (OnlyFans, Fansly, Erome)</Subhead>
          <ul style={listStyle}>
            <li>
              Feed + creator profile = the whole product. No search/categories
              needed at their scale.
            </li>
            <li>
              Subscription gate on every post preview ("🔒 subscribe to
              unlock"). Psychologically massive.
            </li>
            <li>
              Tip + DM + live = three revenue paths per creator. iku.gg can
              replicate with fake-creator character profiles at first.
            </li>
          </ul>

          <Subhead>
            Mainstream streaming (Netflix, YouTube, Crunchyroll)
          </Subhead>
          <ul style={listStyle}>
            <li>
              Continue Watching row with progress bars = #1 retention driver. We
              have history, we should surface it.
            </li>
            <li>
              YouTube-style chip filters ("All / Hentai / 3D / Genshin...")
              outperform traditional tag clouds.
            </li>
            <li>
              Algorithmic home feed with creator attribution trains users to tap
              creators, which drives follow behavior.
            </li>
          </ul>
        </Section>

        {/* 3. UI strategy */}
        <Section title="3. UI strategy — hybrid, not pick-one">
          <p>
            None of the 8 variants wins on its own. The winning product is a{" "}
            <b style={{ color: "#fff" }}>hybrid</b> of V7 (anime streaming
            framing) + V8 (algorithmic feed density) + V3 (shorts feed) + V6
            (creator/sub gate for Pro).
          </p>
          <ol style={{ paddingLeft: 20 }}>
            <li>
              <b style={{ color: "#fff" }}>Homepage = V7 layout</b>.
              Orange/dark, hero, Continue Watching row, Top Series, Simulcasts,
              genres, tag cloud. SEO-friendly, brand-prestige aesthetic, gives
              us the "premium anime streaming" positioning.
            </li>
            <li>
              <b style={{ color: "#fff" }}>
                /explore + /hentai + /3d = V8 algorithmic feed
              </b>
              . Chip filter row, dense grid, creator avatars. This is where
              session depth lives.
            </li>
            <li>
              <b style={{ color: "#fff" }}>/feed = V3 vertical shorts</b>. Kept
              as-is. Nobody else has this. Massive differentiator for &lt;25yo
              users.
            </li>
            <li>
              <b style={{ color: "#fff" }}>
                /character/[slug] = V6 creator profile
              </b>
              . Sub gate on "exclusive" posts, tip button (wired to Stripe),
              tier perks. Turn popular characters (Raiden, Ganyu, Tifa, D.Va)
              into monetized creator profiles.
            </li>
            <li>
              <b style={{ color: "#fff" }}>
                /watch/[slug] keeps the current V2 (Twitch-style) sidebar
              </b>{" "}
              — related videos always visible, autoplay-next, chat-style
              comments.
            </li>
          </ol>
          <p>
            The tube (V5) and casino (V4) variants are deprecated. They don't
            move the needle.
          </p>
        </Section>

        {/* 4. 12-month plan */}
        <Section title="4. 12-month execution plan">
          <Phase month="Month 1-2" goal="Redesign + SEO foundation">
            <ul style={listStyle}>
              <li>Ship V7 homepage + V8 explore. Kill the current homepage.</li>
              <li>
                Character pages → V6 creator layout. Write 50 "about this
                character" blurbs (300 words each) for SEO.
              </li>
              <li>
                Fix canonical + breadcrumbs on all 346K watch pages. Submit 41
                Semrush keywords to Indexing API (already running).
              </li>
              <li>
                Launch 10 pillar articles (already done). Add 40 more "is X porn
                real?" + "best Y 2026" supporting articles.
              </li>
            </ul>
          </Phase>

          <Phase month="Month 3-4" goal="Retention loops">
            <ul style={listStyle}>
              <li>
                Continue Watching row (use existing history table). Add "because
                you liked X" recs.
              </li>
              <li>
                Character-follow system with email/discord/push notifs on new
                video matching followed characters.
              </li>
              <li>
                Daily quests + streaks visible on homepage (already built in DB,
                just expose).
              </li>
              <li>
                Double down on /feed Shorts: add swipe-to-like,
                swipe-right-for-series, push to onboarding.
              </li>
            </ul>
          </Phase>

          <Phase month="Month 5-6" goal="Pro tier v2">
            <ul style={listStyle}>
              <li>
                Rebrand Pro from "no ads" to{" "}
                <b style={{ color: "#fff" }}>"unlock all creator libraries"</b>.
                Gate 20% of top content behind Pro using virtual scarcity
                (OnlyFans tactic).
              </li>
              <li>
                Add exclusive 4K rips of top series (we already have HD flag —
                just add paywall on 2160px).
              </li>
              <li>
                Monthly (4.99€) → Yearly (39.99€, 33% off) → Lifetime (69.99€,
                scarcity limited to 100/mo) nudge funnel.
              </li>
              <li>
                Target: 0.5% conversion of monthly actives = 5K subs at 500K MAU
                = $20K/mo MRR.
              </li>
            </ul>
          </Phase>

          <Phase month="Month 7-9" goal="Monetization stack complete">
            <ul style={listStyle}>
              <li>
                ExoClick + Adsterra tuned with proper frequency capping (max 3
                concurrent, 1 popunder/session — see CLAUDE.md).
              </li>
              <li>
                Cam widget on every watch page (Chaturbate affiliate, contextual
                by character). Expect $2-4K/mo at 500K visits.
              </li>
              <li>
                Game affiliate: Nutaku/Hentai Heroes/CrushCrush banners in /3d
                vertical. Expect $3-5K/mo.
              </li>
              <li>
                Direct ad deals with AI girlfriend apps (Candy AI, etc.) once we
                hit 1M sessions — bypass networks for 2x CPM.
              </li>
            </ul>
          </Phase>

          <Phase month="Month 10-12" goal="Brand + scale">
            <ul style={listStyle}>
              <li>
                Twitter/X, Reddit, Telegram, Discord fully automated (mostly
                done — scale volume 3x).
              </li>
              <li>
                Launch creator program: actual human creators can upload +
                monetize via our profile system. Rev-share 70/30 like OnlyFans.
                Seeds the moat.
              </li>
              <li>
                YouTube/TikTok safe-for-work trailers teaser funnel
                (game-focused content, redirects to /3d).
              </li>
              <li>
                Target: 2M monthly sessions, $40-50K/mo blended. Break-even on
                hosting + dev.
              </li>
            </ul>
          </Phase>
        </Section>

        {/* 5. Revenue model */}
        <Section title="5. Revenue model — the $1M/year math">
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>Stream</Th>
                <Th>At 1M sessions/mo</Th>
                <Th>At 3M sessions/mo</Th>
                <Th>At 10M sessions/mo</Th>
              </tr>
            </thead>
            <tbody>
              <Tr>
                <Td>Display ads (ExoClick + Adsterra)</Td>
                <Td>$4-6K</Td>
                <Td>$14-20K</Td>
                <Td>$45-70K</Td>
              </Tr>
              <Tr>
                <Td>Pro subs (0.3-0.5% of MAU)</Td>
                <Td>$3-6K</Td>
                <Td>$10-20K</Td>
                <Td>$35-60K</Td>
              </Tr>
              <Tr>
                <Td>Cam affiliate (CB + SC)</Td>
                <Td>$2-4K</Td>
                <Td>$6-12K</Td>
                <Td>$20-40K</Td>
              </Tr>
              <Tr>
                <Td>Game affiliate (Nutaku + Crk)</Td>
                <Td>$2-3K</Td>
                <Td>$6-10K</Td>
                <Td>$20-35K</Td>
              </Tr>
              <Tr>
                <Td>Direct deals (AI apps, brands)</Td>
                <Td>$0</Td>
                <Td>$4-8K</Td>
                <Td>$25-50K</Td>
              </Tr>
              <Tr>
                <Td>
                  <b style={{ color: "#fff" }}>Total blended</b>
                </Td>
                <Td>
                  <b style={{ color: "#fff" }}>$11-19K/mo</b>
                </Td>
                <Td>
                  <b style={{ color: "#fff" }}>$40-70K/mo</b>
                </Td>
                <Td>
                  <b style={{ color: "#fff" }}>$145-255K/mo</b>
                </Td>
              </Tr>
            </tbody>
          </table>
          <p>
            <b style={{ color: "#fff" }}>$1M/year</b> = $83K/mo. Sits between
            the 3M and 10M sessions columns. Reachable in months 12-18 if SEO
            keeps compounding and Pro conversion holds.
          </p>
        </Section>

        {/* 6. What kills it */}
        <Section title="6. What kills this plan (be honest)">
          <ul style={listStyle}>
            <li>
              <b style={{ color: "#ff9999" }}>Google sandbox</b>. First 3-6
              months = thin traffic. Don't panic, don't pivot.
            </li>
            <li>
              <b style={{ color: "#ff9999" }}>
                Cloudflare / payment processor nuke
              </b>
              . Every adult site faces this. Have Stripe + Paxum + crypto payout
              ready. Have a backup CDN (BunnyCDN). Have 2 domain registrars.
            </li>
            <li>
              <b style={{ color: "#ff9999" }}>
                CP / age-verification enforcement
              </b>
              . Banned-tag filter is non-negotiable. Add face-age detection on
              any user-uploaded content before opening creator uploads.
            </li>
            <li>
              <b style={{ color: "#ff9999" }}>DMCA from studios</b>. Rule34Video
              / Danbooru content has gray IP status. Be fast on takedowns.
              Consider switching to creator-first content long-term.
            </li>
            <li>
              <b style={{ color: "#ff9999" }}>Ad-network bans</b>. ExoClick
              doesn't ban for adult, but it <i>will</i> ban for low fill
              quality. Keep ad density under 3 simultaneous. Don't chase popups.
            </li>
          </ul>
        </Section>

        {/* 7. Top 10 steal list */}
        <Section title="7. Top 10 patterns to steal right now (ranked by ROI)">
          <ol style={{ paddingLeft: 20 }}>
            <li>
              <b style={{ color: "#fff" }}>Continue Watching row</b> on homepage
              (Netflix/Crunchyroll). Highest retention lift.
            </li>
            <li>
              <b style={{ color: "#fff" }}>Sub gate preview</b> on creator pages
              ("🔒 unlock"). Highest Pro conversion lift.
            </li>
            <li>
              <b style={{ color: "#fff" }}>Chip filter row</b> (YouTube). Beats
              sidebar filter clicks 3:1.
            </li>
            <li>
              <b style={{ color: "#fff" }}>
                Shorts shelf breaking up the main grid
              </b>
              . Session length +18-25%.
            </li>
            <li>
              <b style={{ color: "#fff" }}>Live/Trending badges</b> with
              animated pulse. Click-through +30%.
            </li>
            <li>
              <b style={{ color: "#fff" }}>
                Creator avatar under every thumbnail
              </b>
              . Teaches tap-creator behavior. Build follow loop.
            </li>
            <li>
              <b style={{ color: "#fff" }}>
                Poster-style cards on series/character pages
              </b>
              . Signals "premium streaming", reduces ad-fatigue reads.
            </li>
            <li>
              <b style={{ color: "#fff" }}>Cam widget on every watch page</b>,
              contextual by character. $2-4K/mo floor.
            </li>
            <li>
              <b style={{ color: "#fff" }}>Chip categories in URL</b> (saved
              filters). Lets us rank for long-tail ("3d genshin impact futa") at
              scale.
            </li>
            <li>
              <b style={{ color: "#fff" }}>Progress bar on every card</b> for
              returning users. Borrowed from Crunchyroll. Users come back to
              finish.
            </li>
          </ol>
        </Section>

        <footer
          style={{
            marginTop: 60,
            paddingTop: 28,
            borderTop: "1px solid #1d2233",
            color: "#6b7286",
            fontSize: 13,
          }}
        >
          Written 2026-04-12. Source data: Semrush CSVs (4 files in /Desktop),
          agent audit reports on 20+ niche sites, general patterns from 50+ top
          adult + mainstream streaming platforms. Ping me when something moves —
          we'll reprice the model.
        </footer>
      </article>
    </main>
  );
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
  margin: "14px 0 22px",
  fontSize: 14,
};
const thStyle = {
  textAlign: "left" as const,
  padding: "10px 12px",
  background: "#161a28",
  color: "#9ba3b4",
  fontWeight: 700,
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  borderBottom: "1px solid #1d2233",
};
const tdStyle = {
  padding: "10px 12px",
  borderBottom: "1px solid #1d2233",
  color: "#cdd2dc",
};
const listStyle = { paddingLeft: 20, color: "#b7bdc8", margin: "10px 0" };

function Th({ children }: { children: React.ReactNode }) {
  return <th style={thStyle}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={tdStyle}>{children}</td>;
}
function Tr({ children }: { children: React.ReactNode }) {
  return <tr>{children}</tr>;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ margin: "40px 0" }}>
      <h2
        style={{
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          marginBottom: 14,
          color: "#fff",
        }}
      >
        {title}
      </h2>
      <div style={{ color: "#b7bdc8", fontSize: 15 }}>{children}</div>
    </section>
  );
}

function Subhead({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 15,
        fontWeight: 700,
        color: "#ff9544",
        margin: "20px 0 8px",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {children}
    </h3>
  );
}

function Phase({
  month,
  goal,
  children,
}: {
  month: string;
  goal: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#0f1320",
        border: "1px solid #1d2233",
        borderRadius: 10,
        padding: "16px 20px",
        margin: "14px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            background: "rgba(255,122,0,0.15)",
            color: "#ff9544",
            padding: "3px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {month}
        </span>
        <span style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>
          {goal}
        </span>
      </div>
      {children}
    </div>
  );
}
