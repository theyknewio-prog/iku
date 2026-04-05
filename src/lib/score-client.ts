/**
 * Client-side helper to fire scoring events.
 * Anonymous users get 401 which is silently ignored.
 *
 * Includes an optional toast notification when a new badge is awarded
 * or when the user levels up — lightweight, pure DOM.
 */

type ScoreEvent =
  | "video_view"
  | "video_complete"
  | "favorite_add"
  | "daily_quest"
  | "video_of_day"
  | "new_character"
  | "share_click";

interface ScoreResponse {
  ok: boolean;
  awarded?: number;
  newBadges?: Array<{ code: string; name: string; emoji: string; description: string }>;
  newTier?: { name: string; emoji: string; index: number };
  completedQuests?: Array<{ code: string; title: string; emoji: string }>;
  stats?: { score: number; current_streak: number };
}

/** Fire a scoring event. Silent on errors (anon users, offline, etc). */
export async function recordScoreEvent(
  event: ScoreEvent,
  meta?: Record<string, unknown>
): Promise<ScoreResponse | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, meta }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ScoreResponse;

    // Show a toast for new badges / tier ups / completed quests
    if (data.newBadges && data.newBadges.length > 0) {
      for (const b of data.newBadges) {
        showScoreToast(`${b.emoji} Badge unlocked: ${b.name}`, b.description);
      }
    }
    if (data.newTier) {
      showScoreToast(
        `${data.newTier.emoji} Tier up — ${data.newTier.name}`,
        "Check your profile for new perks"
      );
    }
    if (data.completedQuests && data.completedQuests.length > 0) {
      for (const q of data.completedQuests) {
        showScoreToast(`${q.emoji} Quest complete: ${q.title}`, "+15 points · keep going");
      }
    }

    return data;
  } catch {
    return null;
  }
}

/** Lightweight toast — creates DOM element, animates in/out, auto-removes. */
function showScoreToast(title: string, subtitle?: string): void {
  if (typeof document === "undefined") return;
  const container = getToastContainer();

  const el = document.createElement("div");
  el.className = "score-toast";
  el.innerHTML = `
    <div class="score-toast__title">${escapeHtml(title)}</div>
    ${subtitle ? `<div class="score-toast__sub">${escapeHtml(subtitle)}</div>` : ""}
  `;
  container.appendChild(el);

  // Animate in
  requestAnimationFrame(() => el.classList.add("score-toast--in"));

  // Remove after 5s
  setTimeout(() => {
    el.classList.remove("score-toast--in");
    el.classList.add("score-toast--out");
    setTimeout(() => el.remove(), 400);
  }, 5000);
}

function getToastContainer(): HTMLElement {
  let c = document.getElementById("score-toast-container");
  if (!c) {
    c = document.createElement("div");
    c.id = "score-toast-container";
    document.body.appendChild(c);
  }
  return c;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
