#!/usr/bin/env node
/**
 * twitter-autopost.mjs — Auto-post watermarked clips to @ikudotgg
 *
 * Posts one clip from data/clips/manifest.json every run.
 * Tracks posted clips in data/twitter-posted.json to avoid duplicates.
 *
 * Uses X's internal GraphQL API with auth_token cookie.
 * Credentials stored in /opt/iku-scrapers/.twitter-creds
 *
 * Usage:
 *   node scripts/twitter-autopost.mjs
 *   node scripts/twitter-autopost.mjs --dry-run
 *
 * Cron: every 6 hours (4 posts/day)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const MANIFEST_PATH = resolve(ROOT, "data/clips/manifest.json");
const POSTED_PATH = resolve(ROOT, "data/twitter-posted.json");
const CREDS_PATH = "/opt/iku-scrapers/.twitter-creds";
const DRY_RUN = process.argv.includes("--dry-run");

const log = (msg) => console.log(`[twitter] ${msg}`);

// Tweet templates — rotate for variety
const TEMPLATES = [
  (c) => `${c.suggested_caption}\n\nFull video: ${c.watch_url}\n\n${c.suggested_hashtags}`,
  (c) => `New on iku.gg\n\n${c.watch_url}\n\n${c.suggested_hashtags} #hentaivideo`,
  (c) => `${c.suggested_caption} — watch free on iku.gg\n\n${c.watch_url}\n\n${c.suggested_hashtags}`,
  (c) => `Trending on iku.gg right now\n\n${c.watch_url}\n\n${c.suggested_hashtags} #trending`,
];

function loadCreds() {
  if (!existsSync(CREDS_PATH)) throw new Error("Twitter creds not found at " + CREDS_PATH);
  const content = readFileSync(CREDS_PATH, "utf8");
  const creds = {};
  for (const line of content.split("\n")) {
    const [key, ...val] = line.split("=");
    if (key && val.length) creds[key.trim()] = val.join("=").trim();
  }
  return creds;
}

function loadPosted() {
  if (!existsSync(POSTED_PATH)) return [];
  try { return JSON.parse(readFileSync(POSTED_PATH, "utf8")); } catch { return []; }
}

function savePosted(posted) {
  writeFileSync(POSTED_PATH, JSON.stringify(posted, null, 2));
}

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) throw new Error("No clips manifest at " + MANIFEST_PATH);
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

async function postTweet(text, creds) {
  const body = JSON.stringify({
    variables: {
      tweet_text: text,
      dark_request: false,
      media: { media_entities: [], possibly_sensitive: true },
      semantic_annotation_ids: [],
    },
    features: {
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      tweetypie_unmention_optimization_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      articles_preview_enabled: true,
      rweb_video_timestamps_enabled: true,
      rweb_tipjar_consumption_enabled: true,
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_enhance_cards_enabled: false,
    },
    queryId: "oB-5XsHNAbjvARJEc8CZFw",
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "x.com",
        path: "/i/api/graphql/oB-5XsHNAbjvARJEc8CZFw/CreateTweet",
        method: "POST",
        headers: {
          authorization: `Bearer ${creds.BEARER}`,
          "content-type": "application/json",
          "x-csrf-token": creds.CT0,
          "x-twitter-active-user": "yes",
          "x-twitter-auth-type": "OAuth2Session",
          cookie: `auth_token=${creds.AUTH_TOKEN}; ct0=${creds.CT0}`,
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.data?.create_tweet) {
              resolve({ ok: true, tweet_id: json.data.create_tweet.tweet_results?.result?.rest_id });
            } else {
              resolve({ ok: false, error: JSON.stringify(json).slice(0, 200) });
            }
          } catch (e) {
            resolve({ ok: false, error: data.slice(0, 200) });
          }
        });
      }
    );
    req.on("error", (e) => reject(e));
    req.write(body);
    req.end();
  });
}

async function main() {
  log("Starting Twitter autopost for @ikudotgg");

  const creds = loadCreds();
  const manifest = loadManifest();
  const posted = loadPosted();
  const postedSlugs = new Set(posted.map((p) => p.slug));

  // Find next unposted clip
  const next = manifest.find((c) => !postedSlugs.has(c.slug));
  if (!next) {
    log("All clips already posted. Generate more with: node scripts/generate-clips.mjs");
    return;
  }

  // Pick a random template
  const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  const tweetText = template(next);

  log(`Posting clip: ${next.slug}`);
  log(`Text: ${tweetText.slice(0, 100)}...`);

  if (DRY_RUN) {
    log("DRY RUN — not posting");
    return;
  }

  const result = await postTweet(tweetText, creds);

  if (result.ok) {
    log(`OK — tweet posted (id: ${result.tweet_id})`);
    posted.push({
      slug: next.slug,
      tweet_id: result.tweet_id,
      posted_at: new Date().toISOString(),
      text: tweetText,
    });
    savePosted(posted);
  } else {
    log(`FAIL — ${result.error}`);
  }
}

main().catch((e) => {
  console.error("[twitter] FATAL:", e.message);
  process.exit(1);
});
