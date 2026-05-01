import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Best AI Girlfriend & AI Hentai Chat (2026) — Tested by iku.gg",
  description:
    "We tested 8 AI girlfriend & hentai chat apps so you don't have to. Ranked by features, NSFW freedom, and value. Candy.AI, OnlyWaifus, DreamGF & more.",
  alternates: { canonical: "https://iku.gg/ai-girlfriend" },
  openGraph: {
    title: "Best AI Girlfriend & AI Hentai Chat (2026) — Tested by iku.gg",
    description:
      "We tested 8 AI girlfriend & hentai chat apps so you don't have to. Ranked by features, NSFW freedom, and value. Candy.AI, OnlyWaifus, DreamGF & more.",
    siteName: "iku.gg",
    type: "website",
    url: "https://iku.gg/ai-girlfriend",
    images: [
      {
        url: "https://iku.gg/og-default.png",
        width: 1200,
        height: 630,
        alt: "Best AI Girlfriend Apps 2026 — Ranked by iku.gg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Best AI Girlfriend & AI Hentai Chat (2026) — iku.gg",
    description:
      "8 AI girlfriend and hentai chat platforms ranked. No fluff — just what actually works.",
    images: ["https://iku.gg/og-default.png"],
  },
  other: { rating: "adult" },
};

const platforms = [
  {
    rank: 1,
    id: "candy-ai",
    name: "Candy.AI",
    tagline: "The most polished AI girlfriend on the market",
    score: "9.4",
    badge: "#1 Pick",
    badgeColor: "aigf-badge--gold",
    bestFor: "Anyone starting out with AI companions",
    keyword: "best ai girlfriend",
    href: "/go/candy-ai",
    review: `Candy.AI sits at the top because it earns it. The character customization goes deep — you pick appearance, personality, voice tone, and relationship style before you even start chatting. The NSFW mode is unlocked by default on the adult tier, meaning no sneaky content filters mid-conversation. Image generation is fast and the anime/realistic hybrid rendering is genuinely impressive compared to what shipped a year ago. The conversation memory is decent for short sessions. One honest negative: the free tier is a teaser at best — real usage requires a subscription, and the pricing jumps quickly if you want unlimited image gen.`,
    pros: [
      "Full NSFW chat with zero content throttling on paid plan",
      "Real-time voice chat option (rare for the niche)",
      "Anime and realistic character styles in the same platform",
      "Consistent conversation memory within a session",
    ],
    cons: [
      "Free tier is heavily limited — treat it as a trial",
      "Image generation credits cap out fast on base plan",
    ],
    pricing: "From $5.99/mo",
  },
  {
    rank: 2,
    id: "only-waifus",
    name: "OnlyWaifus.AI",
    tagline: "Built for anime fans, not pretending to be",
    score: "9.0",
    badge: "Anime Pick",
    badgeColor: "aigf-badge--pink",
    bestFor:
      "Hentai fans who want an AI waifu generator with actual personality",
    keyword: "ai waifu generator",
    href: "/go/only-waifus",
    review: `OnlyWaifus.AI skips the pretense of mainstream AI companion apps and goes full anime-native. The character creation pulls from recognizable tropes — kuudere, tsundere, yandere — with art styles that actually look like they came from a proper visual novel. The NSFW image generation is where it pulls ahead: you can generate lewd scenes of your custom waifu, and the output quality is noticeably better than generic Stable Diffusion wrappers. Chat depth is reasonable without being groundbreaking. The weak point is the mobile app — it lags behind the web version and crashes occasionally.`,
    pros: [
      "Native anime art style — not photorealistic uncanny valley",
      "Custom waifu image gen with explicit support",
      "Personality presets built around actual anime archetypes",
      "Active community of character templates to import",
    ],
    cons: [
      "Mobile app is buggy compared to desktop web",
      "Conversation AI feels shallower than Candy.AI",
    ],
    pricing: "From $9.99/mo",
  },
  {
    rank: 3,
    id: "anime-genius",
    name: "AnimeGenius",
    tagline: "Create any anime character and chat with her",
    score: "8.7",
    badge: "Creator Pick",
    badgeColor: "aigf-badge--purple",
    bestFor: "Users who want to build a custom AI anime character from zero",
    keyword: "ai anime character generator",
    href: "/go/anime-genius",
    review: `AnimeGenius positions itself as an AI anime character generator first, companion second — and that order matters. The character creation suite is the most detailed here: you define personality traits, speech patterns, background story, and visual style with more granularity than any other platform on this list. The resulting characters feel distinct because you actually built them. NSFW capabilities are available and work without the content walls that plague mainstream Character.AI alternatives. The trade-off is learning curve — new users will spend 20 minutes in the creation flow before their first conversation.`,
    pros: [
      "Most detailed character creation system in the niche",
      "No NSFW filter — explicit content allowed throughout",
      "Custom backstory integration shapes how the character responds",
      "Strong community gallery to browse pre-built characters",
    ],
    cons: [
      "Onboarding is overwhelming for users wanting instant gratification",
      "Image gen speed is slower than competitors at peak hours",
    ],
    pricing: "From $7.99/mo",
  },
  {
    rank: 4,
    id: "dream-gf",
    name: "DreamGF",
    tagline: "Established, reliable, and actually feature-complete",
    score: "8.4",
    badge: "Solid Choice",
    badgeColor: "aigf-badge--blue",
    bestFor:
      "Users who want a dependable multi-character platform with image gen included",
    keyword: "ai dream girlfriend",
    href: "/go/dream-gf",
    review: `DreamGF is the veteran of this list — it's been around long enough to actually iron out the bugs that plagued early AI companion apps. You can run multiple characters simultaneously, each with their own personality and relationship context. The image generation is bundled into every paid tier (not sold as a separate add-on, which is a meaningful UX decision). NSFW content is gated behind an age verification but fully unlocked after. The app doesn't try to be cutting-edge — it tries to be reliable, and it mostly succeeds. The interface feels slightly dated compared to newer entrants.`,
    pros: [
      "Multi-character support — maintain multiple AI relationships",
      "Image generation included in base paid tier",
      "Stable platform with consistent uptime",
      "Straightforward NSFW unlock — no gatekeeping after verification",
    ],
    cons: [
      "UI is functional but not visually impressive",
      "Less personality depth per character vs. top-tier competitors",
    ],
    pricing: "From $9.99/mo",
  },
  {
    rank: 5,
    id: "kupid-ai",
    name: "KupidAI",
    tagline: "Conversation-first when most apps forget to chat",
    score: "8.1",
    badge: "Chat Pick",
    badgeColor: "aigf-badge--teal",
    bestFor:
      "Users who care more about conversational depth than image generation",
    keyword: "ai chat girlfriend",
    href: "/go/kupid-ai",
    review: `KupidAI bets on conversation quality over image generation, which makes it a weird fit for a visual niche but a strong fit for users who want an AI chat girlfriend that actually holds a thread. The characters feel more linguistically coherent over long sessions — the memory system is better than average, and the NSFW conversation quality doesn't degrade into generic responses the way cheaper models do. Image generation exists but feels secondary. If you're the type who'd spend two hours talking before anything else, KupidAI earns its spot. If you're here for image gen above all else, look at ranks 1–3.`,
    pros: [
      "Above-average long-session conversation coherence",
      "NSFW dialogue quality holds up across extended chats",
      "Memory system recalls context from earlier in the conversation",
      "Pricing competitive at the mid-tier",
    ],
    cons: [
      "Image generation is clearly an afterthought",
      "Character visual customization options are limited",
    ],
    pricing: "From $6.99/mo",
  },
  {
    rank: 6,
    id: "crush-on-ai",
    name: "CrushOn.AI",
    tagline: "Community characters, no filter, just drama",
    score: "7.8",
    badge: "Community Pick",
    badgeColor: "aigf-badge--orange",
    bestFor:
      "Users who want to chat with fan-made versions of existing anime characters",
    keyword: "crush on ai",
    href: "/go/crush-on-ai",
    review: `CrushOn.AI built its reputation as the no-NSFW-filter alternative to Character.AI, and that reputation is earned — the platform genuinely removes the content restrictions that make mainstream apps frustrating. The real differentiator is the community character library: thousands of fan-created AI versions of anime and game characters, updated constantly. Quality is inconsistent (community-created characters vary wildly), but when you find a well-crafted one, the conversations are surprisingly good. The original character creation tools are less polished than AnimeGenius. Best used for finding existing community characters, not building your own.`,
    pros: [
      "Massive library of community-created anime and game characters",
      "No NSFW content filter — explicit conversations allowed",
      "Free tier is more generous than most competitors",
      "Regular additions from active community",
    ],
    cons: [
      "Community character quality is inconsistent",
      "Custom character creation tools are basic",
    ],
    pricing: "Free tier available, from $4.99/mo",
  },
  {
    rank: 7,
    id: "soulkyn",
    name: "Soulkyn",
    tagline: "Story-driven, premium feel, fewer users rushing past it",
    score: "7.5",
    badge: "Story Pick",
    badgeColor: "aigf-badge--violet",
    bestFor: "Users who want a narrative-driven AI companion experience",
    keyword: "ai soul companion",
    href: "/go/soulkyn",
    review: `Soulkyn takes a different angle than the rest of this list — it wraps AI companion interactions in an actual narrative layer. Characters have ongoing story arcs, not just static personalities. A session with Soulkyn feels less like talking to a chatbot and more like progressing through a visual novel where you influence the direction. The NSFW content integrates into the story rather than feeling bolted on, which some users find more immersive. The downside: story-mode pacing means you can't sprint to explicit content the way you can on Candy.AI or CrushOn. Niche appeal, but deep appeal for the right user.`,
    pros: [
      "Story arc system — relationship progression feels earned",
      "High production value on character art and writing",
      "NSFW content integrated naturally into narrative",
      "Premium feel without an absurd price point",
    ],
    cons: [
      "Slower burn — not for users wanting instant explicit content",
      "Smaller character roster than community platforms",
    ],
    pricing: "From $12.99/mo",
  },
  {
    rank: 8,
    id: "nomi-ai",
    name: "Nomi.AI",
    tagline: "The one that actually remembers who you are",
    score: "7.2",
    badge: "Memory Pick",
    badgeColor: "aigf-badge--green",
    bestFor:
      "Long-term users who want an AI companion with persistent memory across weeks",
    keyword: "ai with memory",
    href: "/go/nomi-ai",
    review: `Nomi.AI solves the problem every AI companion user hits eventually: the character forgets everything between sessions. Nomi's persistent memory system retains context across days and weeks — it remembers your name, your preferences, previous conversations, and builds on them. The effect over time is genuinely different from any other platform here: the companion feels like it has a history with you. The explicit content is available but Nomi leans more into emotional connection than raw NSFW generation. If you're building a long-term daily-use AI companion rather than a session-based experience, Nomi justifies its spot on this list.`,
    pros: [
      "Persistent memory across sessions — remembers weeks of context",
      "Emotional depth and relationship progression over time",
      "NSFW content available on paid tiers",
      "Works as a daily companion, not just occasional sessions",
    ],
    cons: [
      "Weaker on image generation compared to top-ranked platforms",
      "Less visually focused — skews toward emotional connection",
    ],
    pricing: "From $16.99/mo",
  },
];

const faqs = [
  {
    q: "Are these AI girlfriend apps safe to use?",
    a: "All platforms on this list are operated by registered companies with standard privacy policies. None of them sell conversation data to advertisers — their business model is subscriptions. Use a separate email if anonymity matters to you, and check their data retention policy before signing up.",
  },
  {
    q: "Is there a good Character.AI alternative with no NSFW filter?",
    a: "Yes — several. CrushOn.AI was specifically built as a no-filter alternative to Character.AI and has the largest community character library. Candy.AI and OnlyWaifus.AI also remove NSFW restrictions on paid tiers. All three allow explicit conversations that Character.AI blocks entirely.",
  },
  {
    q: "What's the best free AI hentai chat option?",
    a: "CrushOn.AI has the most generous free tier, with access to community characters and basic NSFW chat at no cost. Candy.AI offers a limited free trial that's useful for testing the interface. Most platforms restrict explicit content behind a paywall — you're generally looking at $5–10/month to unlock full features.",
  },
  {
    q: "Can I generate explicit anime images with these platforms?",
    a: "Candy.AI, OnlyWaifus.AI, AnimeGenius, and DreamGF all support explicit AI image generation. OnlyWaifus.AI produces the most consistent anime-style results. Image generation quality varies significantly — most platforms cap monthly credits on base plans, so heavy image-gen users should check the limits before subscribing.",
  },
  {
    q: "What's the difference between an AI waifu and an AI girlfriend app?",
    a: "In practice, the distinction is aesthetic framing. AI waifu platforms (like OnlyWaifus.AI and AnimeGenius) lean into anime art styles, visual novel aesthetics, and Japanese media tropes. AI girlfriend apps (like Candy.AI and DreamGF) target a broader audience with realistic and anime hybrid styling. The underlying chat technology is similar — the difference is in art direction and community culture.",
  },
  {
    q: "Do these platforms work on mobile?",
    a: "All eight platforms have mobile-optimized web versions. Candy.AI and DreamGF have dedicated apps. OnlyWaifus.AI's mobile web version works well; their app lags behind. For the best experience across all platforms, desktop or mobile web is the safest bet right now.",
  },
];

const itemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Best AI Girlfriend & AI Hentai Chat Platforms 2026",
  description:
    "Ranked list of the top 8 AI girlfriend, AI waifu, and NSFW AI chat platforms, tested and reviewed by iku.gg.",
  url: "https://iku.gg/ai-girlfriend",
  numberOfItems: platforms.length,
  itemListElement: platforms.map((p) => ({
    "@type": "ListItem",
    position: p.rank,
    name: p.name,
    url: `https://iku.gg${p.href}`,
    description: p.tagline,
  })),
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: f.a,
    },
  })),
};

export default function AIGirlfriendPage() {
  return (
    <main className="aigf-page">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="aigf-hero">
        <div className="aigf-hero__inner">
          <div className="aigf-hero__label">Updated May 2026</div>
          <h1 className="aigf-hero__h1">
            Best AI Girlfriend &amp; AI Hentai Chat —{" "}
            <span className="aigf-gradient-text">
              Ranked &amp; Tested (2026)
            </span>
          </h1>
          <p className="aigf-hero__sub">
            If you&apos;re tired of NSFW filters killing the conversation every
            five minutes, you&apos;re in the right place. We tested 8 platforms
            — from polished AI girlfriend apps to full anime waifu generators —
            and ranked them by what actually matters: character quality, NSFW
            freedom, image generation, and price-to-value. No filler, no
            affiliate-first rankings.
          </p>
          <div className="aigf-hero__meta">
            <span className="aigf-hero__meta-item">8 platforms tested</span>
            <span className="aigf-hero__meta-sep" aria-hidden="true">
              ·
            </span>
            <span className="aigf-hero__meta-item">40+ hours of testing</span>
            <span className="aigf-hero__meta-sep" aria-hidden="true">
              ·
            </span>
            <span className="aigf-hero__meta-item">
              Explicit content included
            </span>
          </div>
        </div>
      </section>

      {/* ── QUICK COMPARISON TABLE ────────────────────────────── */}
      <section className="aigf-section">
        <div className="aigf-container">
          <h2 className="aigf-section__title">Quick Comparison</h2>
          <p className="aigf-section__sub">
            Scroll right on mobile. Scores are out of 10.
          </p>
          <div className="aigf-table-wrap">
            <table className="aigf-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Platform</th>
                  <th>Score</th>
                  <th>Best For</th>
                  <th>NSFW</th>
                  <th>Image Gen</th>
                  <th>Pricing</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {platforms.map((p) => (
                  <tr key={p.id}>
                    <td className="aigf-table__rank">{p.rank}</td>
                    <td className="aigf-table__name">
                      <strong>{p.name}</strong>
                    </td>
                    <td>
                      <span className="aigf-score-pill">{p.score}</span>
                    </td>
                    <td className="aigf-table__bestfor">{p.bestFor}</td>
                    <td className="aigf-table__check">Yes</td>
                    <td className="aigf-table__check">
                      {[
                        "candy-ai",
                        "only-waifus",
                        "anime-genius",
                        "dream-gf",
                      ].includes(p.id)
                        ? "Yes"
                        : p.id === "kupid-ai"
                          ? "Basic"
                          : p.id === "nomi-ai"
                            ? "Limited"
                            : "Yes"}
                    </td>
                    <td className="aigf-table__price">{p.pricing}</td>
                    <td>
                      <a
                        href={p.href}
                        className="aigf-cta-btn aigf-cta-btn--sm"
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                      >
                        Try
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── DETAILED REVIEWS ──────────────────────────────────── */}
      <section className="aigf-section aigf-section--reviews">
        <div className="aigf-container">
          <h2 className="aigf-section__title aigf-section__title--reviews">
            Full Reviews — Every Platform Tested
          </h2>
          <p className="aigf-section__sub aigf-section__sub--reviews">
            Each review is based on real usage, not press kits. We note the
            honest downsides so you know what you&apos;re buying.
          </p>

          <div className="aigf-reviews">
            {platforms.map((p) => (
              <article key={p.id} id={p.id} className="aigf-card">
                <div className="aigf-card__header">
                  <div className="aigf-card__rank-wrap">
                    <span className="aigf-card__rank">#{p.rank}</span>
                    <span className={`aigf-badge ${p.badgeColor}`}>
                      {p.badge}
                    </span>
                  </div>
                  <div className="aigf-card__title-wrap">
                    <h2 className="aigf-card__name">{p.name}</h2>
                    <p className="aigf-card__tagline">{p.tagline}</p>
                  </div>
                  <div className="aigf-card__score-wrap">
                    <div className="aigf-card__score">{p.score}</div>
                    <div className="aigf-card__score-label">/ 10</div>
                  </div>
                </div>

                <div className="aigf-card__body">
                  <div className="aigf-card__review-col">
                    <p className="aigf-card__review">{p.review}</p>
                    <div className="aigf-card__best-for">
                      <span className="aigf-card__best-for-label">
                        Best for:
                      </span>{" "}
                      {p.bestFor}
                    </div>
                  </div>
                  <div className="aigf-card__verdict-col">
                    <div className="aigf-card__pros-cons">
                      <div className="aigf-card__pros">
                        <div className="aigf-card__verdict-title aigf-card__verdict-title--pros">
                          Pros
                        </div>
                        <ul className="aigf-card__list">
                          {p.pros.map((pro, i) => (
                            <li
                              key={i}
                              className="aigf-card__list-item aigf-card__list-item--pro"
                            >
                              {pro}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="aigf-card__cons">
                        <div className="aigf-card__verdict-title aigf-card__verdict-title--cons">
                          Cons
                        </div>
                        <ul className="aigf-card__list">
                          {p.cons.map((con, i) => (
                            <li
                              key={i}
                              className="aigf-card__list-item aigf-card__list-item--con"
                            >
                              {con}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="aigf-card__footer">
                      <span className="aigf-card__pricing">{p.pricing}</span>
                      <a
                        href={p.href}
                        className="aigf-cta-btn"
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                      >
                        Try {p.name} →
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW WE RANKED THEM (E-E-A-T) ────────────────────── */}
      <section className="aigf-section aigf-section--methodology">
        <div className="aigf-container">
          <div className="aigf-methodology">
            <h2 className="aigf-methodology__title">
              How We Ranked These Platforms
            </h2>
            <p className="aigf-methodology__intro">
              iku.gg runs one of the largest free hentai streaming libraries
              online — over 320,000 animated videos. We know this audience, and
              we tested these platforms the way our users actually use them:
              late at night, on mobile, looking for an experience that
              doesn&apos;t blue-ball you with content filters.
            </p>
            <div className="aigf-methodology__criteria">
              <div className="aigf-methodology__criterion">
                <div className="aigf-methodology__criterion-icon">01</div>
                <div>
                  <strong>NSFW freedom</strong> — Does the platform actually
                  unlock explicit content, or does it throttle back after three
                  messages? We pushed every character past the point where
                  Character.AI shuts down.
                </div>
              </div>
              <div className="aigf-methodology__criterion">
                <div className="aigf-methodology__criterion-icon">02</div>
                <div>
                  <strong>Conversation quality</strong> — Does the character
                  maintain context? Does it feel like a distinct personality or
                  a generic chatbot with a name slapped on top?
                </div>
              </div>
              <div className="aigf-methodology__criterion">
                <div className="aigf-methodology__criterion-icon">03</div>
                <div>
                  <strong>Image generation quality</strong> — Anime-style output
                  matters here. We tested prompts that would fail on mainstream
                  tools. Consistency across generations, not just the hero
                  screenshot.
                </div>
              </div>
              <div className="aigf-methodology__criterion">
                <div className="aigf-methodology__criterion-icon">04</div>
                <div>
                  <strong>Price vs. what you actually get</strong> — We compare
                  what the free tier gives you vs. what it locks behind a
                  paywall, and whether the paid tier is actually worth it.
                </div>
              </div>
            </div>
            <p className="aigf-methodology__disclosure">
              Disclosure: some links on this page are affiliate links. We earn a
              commission if you subscribe via our links. This does not change
              our rankings — platforms earned their spots on test results.
            </p>
          </div>
        </div>
      </section>

      {/* ── INTERNAL LINK BRIDGE ─────────────────────────────── */}
      <section className="aigf-section">
        <div className="aigf-container">
          <div className="aigf-bridge">
            <h2 className="aigf-bridge__title">
              While your waifu loads — free animated hentai, no paywall
            </h2>
            <p className="aigf-bridge__sub">
              AI chat is one thing. Watching actual animated hentai is another.
              iku.gg has{" "}
              <Link href="/" className="aigf-link">
                320,000+ free videos
              </Link>{" "}
              — including{" "}
              <Link href="/3d" className="aigf-link">
                3D CGI hentai
              </Link>
              ,{" "}
              <Link href="/hentai" className="aigf-link">
                2D anime clips
              </Link>
              , and a{" "}
              <Link href="/feed" className="aigf-link">
                TikTok-style Shorts feed
              </Link>{" "}
              if you want to swipe through content instead of browse.
            </p>
            <div className="aigf-bridge__links">
              <Link href="/trending" className="aigf-bridge__pill">
                Trending now
              </Link>
              <Link href="/tag/ai_generated" className="aigf-bridge__pill">
                AI-generated hentai
              </Link>
              <Link href="/3d" className="aigf-bridge__pill">
                3D animations
              </Link>
              <Link href="/new" className="aigf-bridge__pill">
                New releases
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section className="aigf-section aigf-section--faq">
        <div className="aigf-container">
          <h2 className="aigf-section__title">Frequently Asked Questions</h2>
          <div className="aigf-faq">
            {faqs.map((f, i) => (
              <div key={i} className="aigf-faq__item">
                <h3 className="aigf-faq__q">{f.q}</h3>
                <p className="aigf-faq__a">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────── */}
      <section className="aigf-section aigf-section--final-cta">
        <div className="aigf-container">
          <div className="aigf-final-cta">
            <h2 className="aigf-final-cta__title">
              Our pick: start with{" "}
              <span className="aigf-gradient-text">Candy.AI</span>
            </h2>
            <p className="aigf-final-cta__sub">
              Best interface, no NSFW filter on paid tier, anime and realistic
              styles in one platform. If it&apos;s not the right fit after a
              week, DreamGF and OnlyWaifus.AI are both solid fallbacks.
            </p>
            <div className="aigf-final-cta__actions">
              <a
                href="/go/candy-ai"
                className="aigf-cta-btn aigf-cta-btn--lg"
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                Try Candy.AI — Best AI Girlfriend →
              </a>
              <a
                href="/go/only-waifus"
                className="aigf-cta-btn aigf-cta-btn--lg aigf-cta-btn--secondary"
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                Try OnlyWaifus.AI — Best Waifu Generator →
              </a>
            </div>
            <p className="aigf-final-cta__note">
              All platforms on this list allow explicit content for adult users.
              Verify you are 18+ before signing up.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
