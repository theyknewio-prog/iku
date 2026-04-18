#!/usr/bin/env node
/**
 * generate-clips.mjs — Social media clip generator for iku.gg
 *
 * Pulls top trending videos from PostgreSQL, resolves their MP4 URLs via
 * yt-dlp, extracts a 12-second watermarked clip with ffmpeg, and exports
 * both an MP4 (social media) and a GIF (Reddit).
 *
 * Output:
 *   data/clips/{character}-{slug}-clip.mp4
 *   data/clips/{character}-{slug}-clip.gif
 *   data/clips/manifest.json          (cumulative, appended each run)
 *   data/clipped-videos.json          (tracks processed slugs to skip)
 *
 * Usage:
 *   node scripts/generate-clips.mjs
 *   node scripts/generate-clips.mjs --dry-run   # query only, no downloads
 *   node scripts/generate-clips.mjs --limit 5   # override clips-per-run cap
 *
 * Requirements:
 *   - DATABASE_URL in env
 *   - yt-dlp in PATH (or /usr/local/bin/yt-dlp)
 *   - ffmpeg in PATH
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CLIPS_DIR = join(ROOT, "data", "clips");
const CLIPPED_LOG = join(ROOT, "data", "clipped-videos.json");
const MANIFEST_PATH = join(CLIPS_DIR, "manifest.json");

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitFlag = args.indexOf("--limit");
const CLIPS_PER_RUN = limitFlag !== -1 ? parseInt(args[limitFlag + 1], 10) : 10;

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[generate-clips] ERROR: DATABASE_URL env var is required.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 3 });

// ---------------------------------------------------------------------------
// Tool detection
// ---------------------------------------------------------------------------

/**
 * Locate a binary: try `which`/`where`, then a known absolute path.
 * Returns the resolved path string, or null if not found.
 */
async function findBinary(name, fallbackPaths = []) {
  // Try the name directly (if it's in PATH)
  try {
    const { stdout } = await execFileAsync("which", [name]);
    return stdout.trim();
  } catch {
    // `which` not available on Windows
  }
  try {
    const { stdout } = await execFileAsync("where", [name]);
    return stdout.split("\n")[0].trim();
  } catch {
    // not found in PATH
  }
  for (const p of fallbackPaths) {
    try {
      await execFileAsync(p, ["--version"]);
      return p;
    } catch {
      // not at this path
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Duration helpers
// ---------------------------------------------------------------------------

/**
 * Use ffprobe to get the duration of a remote/local media file in seconds.
 * Returns null on failure.
 */
async function probeDuration(ffprobePath, url) {
  try {
    const { stdout } = await execFileAsync(
      ffprobePath,
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        url,
      ],
      { timeout: 30_000 },
    );
    const secs = parseFloat(stdout.trim());
    return isNaN(secs) ? null : secs;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// yt-dlp URL resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a page URL to a direct MP4 URL using yt-dlp -g.
 * Returns the URL string or null on failure.
 */
async function resolveWithYtdlp(ytdlpPath, pageUrl) {
  try {
    const { stdout } = await execFileAsync(
      ytdlpPath,
      ["-g", "--no-playlist", "--no-warnings", pageUrl],
      { timeout: 45_000 },
    );
    // yt-dlp -g can return multiple lines (video + audio). Take the first line.
    const url = stdout.trim().split("\n")[0].trim();
    return url.startsWith("http") ? url : null;
  } catch (err) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ffmpeg clip + watermark
// ---------------------------------------------------------------------------

/**
 * Extract a watermarked 12-second MP4 clip.
 *   - Start at 25% of total duration (fallback: 10s)
 *   - Scale to max 720p, keep aspect ratio
 *   - H.264, fast preset, optimised for social media
 *   - Watermark: "iku.gg" white @ 50% opacity, bottom-right, 20px inset
 */
async function extractMp4(ffmpegPath, inputUrl, outputPath, durationSecs) {
  const startTime = durationSecs ? Math.floor(durationSecs * 0.25) : 10;

  const args = [
    "-ss",
    String(startTime),
    "-i",
    inputUrl,
    "-t",
    "12",
    // Scale: width max 1280, height max 720, keep aspect, divisible by 2
    "-vf",
    [
      "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
      "pad=ceil(iw/2)*2:ceil(ih/2)*2",
      "drawtext=text='iku.gg':fontsize=28:fontcolor=white@0.5:x=w-tw-20:y=h-th-20",
    ].join(","),
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-movflags",
    "+faststart",
    "-an", // no audio (clips for social, keep filesize low)
    "-y", // overwrite
    outputPath,
  ];

  await execFileAsync(ffmpegPath, args, { timeout: 120_000 });
}

/**
 * Convert the MP4 clip to an 8-second 480p GIF via ffmpeg palette trick
 * (two-pass for much better colour quality than a naive -vf gif).
 */
async function extractGif(ffmpegPath, mp4Path, outputPath) {
  const palettePath = outputPath.replace(".gif", "-palette.png");

  // Pass 1: generate palette
  await execFileAsync(
    ffmpegPath,
    [
      "-i",
      mp4Path,
      "-t",
      "8",
      "-vf",
      "fps=12,scale=480:-1:flags=lanczos,palettegen=stats_mode=diff",
      "-y",
      palettePath,
    ],
    { timeout: 60_000 },
  );

  // Pass 2: render GIF using palette
  await execFileAsync(
    ffmpegPath,
    [
      "-i",
      mp4Path,
      "-i",
      palettePath,
      "-t",
      "8",
      "-lavfi",
      "fps=12,scale=480:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5",
      "-y",
      outputPath,
    ],
    { timeout: 60_000 },
  );

  // Clean up palette temp file
  try {
    const { unlink } = await import("fs/promises");
    await unlink(palettePath);
  } catch {
    // non-fatal
  }
}

// ---------------------------------------------------------------------------
// Manifest & tracking helpers
// ---------------------------------------------------------------------------

function loadClippedLog() {
  if (!existsSync(CLIPPED_LOG)) return new Set();
  try {
    return new Set(JSON.parse(readFileSync(CLIPPED_LOG, "utf8")));
  } catch {
    return new Set();
  }
}

function saveClippedLog(slugSet) {
  writeFileSync(CLIPPED_LOG, JSON.stringify([...slugSet], null, 2), "utf8");
}

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) return [];
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return [];
  }
}

function saveManifest(entries) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(entries, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Caption / hashtag builder
// ---------------------------------------------------------------------------

function buildCaption(characters, copyrights) {
  const char = characters?.[0]
    ? characters[0].replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;
  const series = copyrights?.[0]
    ? copyrights[0].replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  if (char && series) return `${char} from ${series}`;
  if (char) return char;
  if (series) return series;
  return "Watch on iku.gg";
}

function buildHashtags(characters, copyrights, tags) {
  const base = ["#hentai", "#rule34", "#anime", "#nsfw"];

  const charTags = (characters || [])
    .slice(0, 2)
    .map((c) => "#" + c.replace(/[^a-zA-Z0-9]/g, "").toLowerCase())
    .filter((t) => t.length > 1);

  const seriesTags = (copyrights || [])
    .slice(0, 2)
    .map((c) => "#" + c.replace(/[^a-zA-Z0-9]/g, "").toLowerCase())
    .filter((t) => t.length > 1);

  // Add a couple of the most relevant content tags
  const contentTags = (tags || [])
    .filter((t) =>
      ["animated", "loop", "sex", "ahegao", "threesome"].includes(t),
    )
    .slice(0, 2)
    .map((t) => "#" + t);

  const all = [
    ...new Set([...base, ...charTags, ...seriesTags, ...contentTags]),
  ];
  return all.join(" ");
}

// ---------------------------------------------------------------------------
// Safe filename builder
// ---------------------------------------------------------------------------

function safeFilename(str) {
  return (str || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("[generate-clips] Starting clip generation for iku.gg");
  if (DRY_RUN)
    console.log("[generate-clips] DRY RUN — no files will be written");

  // --- Detect tools ---
  const ytdlpPath = await findBinary("yt-dlp", ["/usr/local/bin/yt-dlp"]);
  if (!ytdlpPath) {
    console.error(
      "[generate-clips] ERROR: yt-dlp not found.\n" +
        "  Install: pip install yt-dlp  OR  curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp",
    );
    process.exit(1);
  }
  console.log(`[generate-clips] yt-dlp found at: ${ytdlpPath}`);

  const ffmpegPath = await findBinary("ffmpeg", [
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
  ]);
  const ffprobePath = await findBinary("ffprobe", [
    "/usr/bin/ffprobe",
    "/usr/local/bin/ffprobe",
  ]);

  if (!ffmpegPath) {
    console.error(
      "[generate-clips] ERROR: ffmpeg not found.\n" +
        "  Install: apt-get install ffmpeg  (Debian/Ubuntu/Hetzner)\n" +
        "  Or: brew install ffmpeg  (macOS)",
    );
    process.exit(1);
  }
  console.log(`[generate-clips] ffmpeg found at: ${ffmpegPath}`);

  // --- Prepare output directories ---
  if (!DRY_RUN) {
    mkdirSync(CLIPS_DIR, { recursive: true });
    mkdirSync(join(ROOT, "data"), { recursive: true });
  }

  // --- Load already-processed slugs ---
  const clipped = loadClippedLog();
  console.log(
    `[generate-clips] Already clipped: ${clipped.size} videos (will skip)`,
  );

  // --- Query top videos from PostgreSQL ---
  // Exclude sources that need complex proxying for the initial clip run.
  // rule34video and WP sources use IP-bound tokens — yt-dlp handles them fine
  // server-side, so we include all sources.
  const { rows: videos } = await pool.query(`
    SELECT
      slug, url, page_url, source, title, thumbnail,
      score, characters, copyrights, tags, duration
    FROM videos
    WHERE score > 0
    ORDER BY score DESC
    LIMIT 200
  `);

  await pool.end();

  // Filter out already-clipped videos
  const candidates = videos.filter((v) => !clipped.has(v.slug));
  console.log(
    `[generate-clips] Candidates after skip filter: ${candidates.length}`,
  );

  if (candidates.length === 0) {
    console.log("[generate-clips] Nothing new to clip. Exiting.");
    return;
  }

  // Cap per run
  const toProcess = candidates.slice(0, CLIPS_PER_RUN);
  console.log(
    `[generate-clips] Will process ${toProcess.length} video(s) this run`,
  );

  if (DRY_RUN) {
    console.log("[generate-clips] Dry-run candidates:");
    toProcess.forEach((v, i) => {
      console.log(`  ${i + 1}. [${v.source}] ${v.slug} (score: ${v.score})`);
    });
    return;
  }

  // --- Load manifest ---
  const manifest = loadManifest();

  // --- Process each video ---
  let successCount = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const video = toProcess[i];
    const {
      slug,
      url,
      page_url,
      source,
      title,
      characters,
      copyrights,
      tags,
      duration,
    } = video;

    console.log(
      `\n[${i + 1}/${toProcess.length}] Processing: ${slug} (source: ${source})`,
    );

    // Determine the URL to feed yt-dlp.
    // - For rule34video + WP sources, use page_url (the watchable page).
    // - For booru sources, use url directly (it's already an MP4).
    const resolveTarget =
      source === "rule34video" || source === "wp" ? page_url || url : url;

    if (!resolveTarget) {
      console.warn(`  [SKIP] No resolvable URL for ${slug}`);
      clipped.add(slug); // mark to avoid retrying broken entries
      continue;
    }

    // --- Resolve direct MP4 URL ---
    console.log(`  Resolving MP4 URL via yt-dlp...`);
    let mp4Url = null;

    // For booru sources that already end in a media extension, skip yt-dlp
    const looksLikeDirect = /\.(mp4|webm|gif)(\?|$)/i.test(resolveTarget);

    if (looksLikeDirect) {
      mp4Url = resolveTarget;
      console.log(`  Direct URL detected, skipping yt-dlp.`);
    } else {
      mp4Url = await resolveWithYtdlp(ytdlpPath, resolveTarget);
      if (!mp4Url) {
        console.warn(`  [SKIP] yt-dlp could not resolve URL for ${slug}`);
        clipped.add(slug); // skip on next run too
        saveClippedLog(clipped);
        continue;
      }
      console.log(`  Resolved: ${mp4Url.slice(0, 80)}...`);
    }

    // --- Probe duration if DB has none ---
    let durationSecs = typeof duration === "number" ? duration : null;
    if (!durationSecs && ffprobePath) {
      console.log(`  Probing duration via ffprobe...`);
      durationSecs = await probeDuration(ffprobePath, mp4Url);
      if (durationSecs) {
        console.log(`  Duration: ${durationSecs.toFixed(1)}s`);
      } else {
        console.log(`  Duration unknown — defaulting clip start to 10s`);
      }
    }

    // --- Build output filenames ---
    const charPart = safeFilename(
      characters?.[0] || copyrights?.[0] || "hentai",
    );
    const slugPart = safeFilename(slug);
    const baseName = `${charPart}-${slugPart}-clip`;
    const mp4Out = join(CLIPS_DIR, baseName + ".mp4");
    const gifOut = join(CLIPS_DIR, baseName + ".gif");

    // --- Extract MP4 clip ---
    console.log(`  Extracting MP4 clip → ${baseName}.mp4`);
    try {
      await extractMp4(ffmpegPath, mp4Url, mp4Out, durationSecs);
      console.log(`  MP4 done.`);
    } catch (err) {
      console.error(
        `  [FAIL] MP4 extraction failed for ${slug}: ${err.message}`,
      );
      // Don't mark as clipped — could be a transient error
      continue;
    }

    // --- Generate GIF ---
    console.log(`  Generating GIF → ${baseName}.gif`);
    try {
      await extractGif(ffmpegPath, mp4Out, gifOut);
      console.log(`  GIF done.`);
    } catch (err) {
      console.error(
        `  [WARN] GIF generation failed for ${slug}: ${err.message}`,
      );
      // GIF is best-effort; MP4 is the primary deliverable
    }

    // --- Build manifest entry ---
    const caption = buildCaption(characters, copyrights);
    const hashtags = buildHashtags(characters, copyrights, tags);

    const entry = {
      slug,
      source,
      character: characters?.[0] || null,
      series: copyrights?.[0] || null,
      tags: (tags || []).slice(0, 10),
      score: video.score,
      mp4_path: `data/clips/${baseName}.mp4`,
      gif_path: `data/clips/${baseName}.gif`,
      suggested_caption: caption,
      suggested_hashtags: hashtags,
      watch_url: `https://iku.gg/watch/${slug}`,
      thumbnail: video.thumbnail || null,
      clipped_at: new Date().toISOString(),
    };

    manifest.push(entry);
    clipped.add(slug);

    // Save after each success so a crash mid-run doesn't lose progress
    saveManifest(manifest);
    saveClippedLog(clipped);

    successCount++;
    console.log(`  Done. Caption: "${caption}"`);
  }

  // --- Summary ---
  console.log(
    `\n[generate-clips] Run complete. ${successCount}/${toProcess.length} clips generated.`,
  );
  console.log(`[generate-clips] Manifest: ${MANIFEST_PATH}`);
  console.log(`[generate-clips] Clips dir: ${CLIPS_DIR}`);

  if (manifest.length > 0) {
    const recent = manifest.slice(-successCount);
    console.log("\n--- Suggested posts ---");
    recent.forEach((e) => {
      console.log(`  ${e.watch_url}`);
      console.log(`  Caption : ${e.suggested_caption}`);
      console.log(`  Tags    : ${e.suggested_hashtags}`);
      console.log(`  MP4     : ${e.mp4_path}`);
      console.log(`  GIF     : ${e.gif_path}`);
      console.log();
    });
  }
}

main().catch((err) => {
  console.error("[generate-clips] Fatal error:", err);
  process.exit(1);
});
