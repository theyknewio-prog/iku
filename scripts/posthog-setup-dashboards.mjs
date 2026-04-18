#!/usr/bin/env node
/**
 * scripts/posthog-setup-dashboards.mjs
 *
 * Creates the 3 iku.gg dashboards in PostHog via the public API:
 *   1. 📊 Acquisition & Engagement (6 trend insights)
 *   2. 🎯 Conversion Funnels       (4 funnel insights)
 *   3. 🔁 Retention & Gamification (6 mixed insights)
 *
 * Idempotent: looks up existing dashboards by name and skips creation if
 * already present. Safe to re-run.
 *
 * REQUIRED ENV:
 *   POSTHOG_PERSONAL_API_KEY  — phs_... token with dashboard:write + insight:write scopes
 *                                Get one at https://us.posthog.com → Settings → Personal API keys
 *
 * OPTIONAL ENV:
 *   POSTHOG_PROJECT_ID  — defaults to 370092 (iku.gg US cloud project)
 *   POSTHOG_HOST        — defaults to https://us.posthog.com
 *   DRY_RUN=1           — log what would be created without hitting the API
 *
 * USAGE:
 *   POSTHOG_PERSONAL_API_KEY=phs_xxx node scripts/posthog-setup-dashboards.mjs
 *   DRY_RUN=1 POSTHOG_PERSONAL_API_KEY=phs_xxx node scripts/posthog-setup-dashboards.mjs
 */

const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID || "370092";
const HOST = (process.env.POSTHOG_HOST || "https://us.posthog.com").replace(
  /\/$/,
  "",
);
const DRY_RUN = process.env.DRY_RUN === "1";

if (!API_KEY) {
  console.error("❌ Missing POSTHOG_PERSONAL_API_KEY (phs_...)");
  console.error(
    "   Get one at https://us.posthog.com → Settings → Personal API keys",
  );
  console.error("   Scopes needed: dashboard:write, insight:write");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

const base = `${HOST}/api/projects/${PROJECT_ID}`;

// ─────────────────────────────────────────────────────────────
// API wrappers
// ─────────────────────────────────────────────────────────────
async function api(method, path, body) {
  if (DRY_RUN) {
    console.log(
      `[DRY] ${method} ${path}`,
      body ? `body.name=${body.name || "?"}` : "",
    );
    // Return plausible stubs so chained calls work in dry-run:
    //   GET /dashboards/  → empty list (triggers create path)
    //   POST *            → echo with random id
    if (method === "GET" && path.startsWith("/dashboards/")) {
      return { results: [] };
    }
    return { id: Math.floor(Math.random() * 100000), ...body };
  }
  const res = await fetch(base + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(
      `${method} ${path} → ${res.status}: ${JSON.stringify(data).slice(0, 500)}`,
    );
  }
  return data;
}

async function findDashboardByName(name) {
  const list = await api("GET", `/dashboards/?limit=200`);
  return list.results?.find((d) => d.name === name) || null;
}

async function ensureDashboard(name, description) {
  const existing = await findDashboardByName(name);
  if (existing) {
    console.log(`✓  dashboard already exists: "${name}" (id=${existing.id})`);
    return existing;
  }
  const created = await api("POST", `/dashboards/`, { name, description });
  console.log(`+  created dashboard: "${name}" (id=${created.id})`);
  return created;
}

async function createInsight({
  name,
  description,
  dashboardId,
  filters,
  query,
}) {
  const body = {
    name,
    description,
    dashboards: [dashboardId],
  };
  if (query) body.query = query;
  if (filters) body.filters = filters;
  const created = await api("POST", `/insights/`, body);
  console.log(`   + insight: "${name}"`);
  return created;
}

// ─────────────────────────────────────────────────────────────
// Insight builders (legacy filters format, still supported by PostHog API)
// ─────────────────────────────────────────────────────────────

/** Trend on $pageview with optional breakdown. */
function trendPageviews(opts = {}) {
  const filter = {
    insight: "TRENDS",
    events: [{ id: "$pageview", type: "events", order: 0 }],
    interval: opts.interval || "day",
    date_from: opts.dateFrom || "-30d",
    display: opts.display || "ActionsLineGraph",
  };
  if (opts.math) filter.events[0].math = opts.math;
  if (opts.breakdown) {
    filter.breakdown = opts.breakdown;
    filter.breakdown_type = "event";
  }
  return filter;
}

/** Trend on a custom event (count). */
function trendEvent(eventName, opts = {}) {
  const filter = {
    insight: "TRENDS",
    events: [{ id: eventName, type: "events", order: 0 }],
    interval: opts.interval || "day",
    date_from: opts.dateFrom || "-30d",
    display: opts.display || "ActionsBar",
  };
  if (opts.breakdown) {
    filter.breakdown = opts.breakdown;
    filter.breakdown_type = "event";
  }
  return filter;
}

/** Funnel across a list of event IDs. */
function funnelFilter(events, opts = {}) {
  return {
    insight: "FUNNELS",
    events: events.map((e, i) => ({
      id: typeof e === "string" ? e : e.id,
      type: "events",
      order: i,
      ...(typeof e === "object" && e.properties
        ? { properties: e.properties }
        : {}),
    })),
    funnel_window_interval: opts.windowInterval || 7,
    funnel_window_interval_unit: opts.windowUnit || "day",
    date_from: opts.dateFrom || "-30d",
  };
}

/** Retention cohort. */
function retentionFilter(opts = {}) {
  return {
    insight: "RETENTION",
    target_entity: { id: opts.targetEvent || "signup", type: "events" },
    returning_entity: {
      id: opts.returningEvent || "$pageview",
      type: "events",
    },
    retention_type: "retention_first_time",
    period: opts.period || "Day",
    total_intervals: opts.totalIntervals || 11,
    date_from: opts.dateFrom || "-30d",
  };
}

// ─────────────────────────────────────────────────────────────
// Dashboard 1: Acquisition & Engagement
// ─────────────────────────────────────────────────────────────
async function buildAcquisitionDashboard() {
  const dash = await ensureDashboard(
    "📊 Acquisition & Engagement",
    "Top-of-funnel: pageviews, unique visitors, landing pages, referrers, geo, device.",
  );

  const insights = [
    {
      name: "Total pageviews — last 30 days",
      description: "Line chart of daily $pageview count.",
      filters: trendPageviews({ display: "ActionsLineGraph" }),
    },
    {
      name: "Unique daily visitors (DAU)",
      description: "Distinct user count per day.",
      filters: trendPageviews({ math: "dau", display: "ActionsLineGraph" }),
    },
    {
      name: "Top landing pages",
      description: "Pageviews broken down by $pathname (top 10).",
      filters: trendPageviews({
        breakdown: "$pathname",
        display: "ActionsBarValue",
      }),
    },
    {
      name: "Top referrers",
      description: "Pageviews broken down by $referring_domain.",
      filters: trendPageviews({
        breakdown: "$referring_domain",
        display: "ActionsBarValue",
      }),
    },
    {
      name: "Traffic by country",
      description: "Pageviews broken down by $geoip_country_code (world map).",
      filters: trendPageviews({
        breakdown: "$geoip_country_code",
        display: "WorldMap",
      }),
    },
    {
      name: "Mobile vs Desktop split",
      description: "Pageviews broken down by $device_type.",
      filters: trendPageviews({
        breakdown: "$device_type",
        display: "ActionsPie",
      }),
    },
  ];

  for (const i of insights) await createInsight({ ...i, dashboardId: dash.id });
}

// ─────────────────────────────────────────────────────────────
// Dashboard 2: Conversion Funnels
// ─────────────────────────────────────────────────────────────
async function buildFunnelsDashboard() {
  const dash = await ensureDashboard(
    "🎯 Conversion Funnels",
    "Anon → signup → active, signup → Pro, video engagement, Discord join.",
  );

  const insights = [
    {
      name: "Funnel A — Anon → Signup → Active user",
      description:
        "pageview → signup → login → first favorite_add. 7-day window.",
      filters: funnelFilter(["$pageview", "signup", "login", "favorite_add"], {
        windowInterval: 7,
        windowUnit: "day",
      }),
    },
    {
      name: "Funnel B — Signup → Pro Purchase",
      description:
        "signup → /pricing view → pro_checkout_start → pro_purchase. 30-day window.",
      filters: funnelFilter(
        ["signup", "$pageview", "pro_checkout_start", "pro_purchase"],
        {
          windowInterval: 30,
          windowUnit: "day",
        },
      ),
    },
    {
      name: "Funnel C — Video engagement",
      description:
        "watch pageview → video_view → favorite_add. 1-day window (single session).",
      filters: funnelFilter(["$pageview", "video_view", "favorite_add"], {
        windowInterval: 1,
        windowUnit: "day",
      }),
    },
    {
      name: "Funnel D — Discord community join",
      description:
        "pageview → discord_invite_click → discord_link (only if user completes OAuth).",
      filters: funnelFilter(
        ["$pageview", "discord_invite_click", "discord_link"],
        {
          windowInterval: 1,
          windowUnit: "day",
        },
      ),
    },
  ];

  for (const i of insights) await createInsight({ ...i, dashboardId: dash.id });
}

// ─────────────────────────────────────────────────────────────
// Dashboard 3: Retention & Gamification
// ─────────────────────────────────────────────────────────────
async function buildRetentionDashboard() {
  const dash = await ensureDashboard(
    "🔁 Retention & Gamification",
    "Cohort retention, DAU/WAU/MAU, streaks, badges, top users.",
  );

  const insights = [
    {
      name: "Cohort retention (signup → pageview)",
      description:
        "Users who sign up, do they come back? Daily intervals, 11 days.",
      filters: retentionFilter({
        targetEvent: "signup",
        returningEvent: "$pageview",
      }),
    },
    {
      name: "DAU / WAU / MAU",
      description: "Daily, weekly, monthly active users — the classic trio.",
      filters: {
        insight: "TRENDS",
        events: [
          { id: "$pageview", type: "events", order: 0, math: "dau" },
          { id: "$pageview", type: "events", order: 1, math: "weekly_active" },
          { id: "$pageview", type: "events", order: 2, math: "monthly_active" },
        ],
        interval: "day",
        date_from: "-30d",
        display: "ActionsLineGraph",
      },
    },
    {
      name: "Tier up distribution",
      description: "tier_up events broken down by tier_name.",
      filters: trendEvent("tier_up", {
        breakdown: "tier_name",
        display: "ActionsBarValue",
      }),
    },
    {
      name: "Badge earning rate",
      description: "badge_earned events broken down by badge code.",
      filters: trendEvent("badge_earned", {
        breakdown: "code",
        display: "ActionsBarValue",
      }),
    },
    {
      name: "Gamification engagement (stacked)",
      description:
        "video_view + favorite_add + badge_earned + tier_up, stacked over time.",
      filters: {
        insight: "TRENDS",
        events: [
          { id: "video_view", type: "events", order: 0 },
          { id: "favorite_add", type: "events", order: 1 },
          { id: "badge_earned", type: "events", order: 2 },
          { id: "tier_up", type: "events", order: 3 },
        ],
        interval: "day",
        date_from: "-30d",
        display: "ActionsLineGraph",
      },
    },
    {
      name: "Top users by video_view",
      description: "video_view events broken down by distinct_id (top 20).",
      filters: trendEvent("video_view", {
        breakdown: "distinct_id",
        display: "ActionsBarValue",
      }),
    },
  ];

  for (const i of insights) await createInsight({ ...i, dashboardId: dash.id });
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`iku.gg PostHog dashboard setup`);
  console.log(`  host:    ${HOST}`);
  console.log(`  project: ${PROJECT_ID}`);
  console.log(`  dry_run: ${DRY_RUN}`);
  console.log();

  await buildAcquisitionDashboard();
  console.log();
  await buildFunnelsDashboard();
  console.log();
  await buildRetentionDashboard();
  console.log();
  console.log("✅ done. Visit your PostHog dashboards list to see them:");
  console.log(`   ${HOST}/project/${PROJECT_ID}/dashboard`);
}

main().catch((err) => {
  console.error("fatal:", err.message);
  process.exit(1);
});
