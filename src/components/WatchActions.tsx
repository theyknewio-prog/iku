"use client";

/**
 * WatchActions — social action bar under the player.
 *
 * Views · Like/Dislike (ratio bar) · Save · Share dropdown
 * (X/Twitter, Telegram, Reddit, copy link). Fires gamification score
 * events on reaction/share and flashes a "+N" micro-toast on points.
 *
 * Like/dislike persists in PG for logged-in users (via /api/video-reaction)
 * and in localStorage for anon users. Ratio bar is YouTube-style.
 */

import { useEffect, useMemo, useState } from "react";
import { addToHistory } from "@/lib/history";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { recordScoreEvent } from "@/lib/score-client";

interface WatchActionsProps {
  videoId: number;
  slug: string;
  title: string;
  thumbnail: string;
  /** video.favorites — baseline save count from the catalogue row */
  initialFavorites: number;
  /** video.score — baseline upvote count */
  initialScore: number;
}

type Reaction = "like" | "dislike" | null;

const LS_REACTIONS_KEY = "iku-video-reactions";

function readLocalReactions(): Record<string, Exclude<Reaction, null>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_REACTIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function writeLocalReaction(slug: string, r: Reaction): void {
  if (typeof window === "undefined") return;
  try {
    const all = readLocalReactions();
    if (r === null) delete all[slug];
    else all[slug] = r;
    localStorage.setItem(LS_REACTIONS_KEY, JSON.stringify(all));
  } catch {
    /* storage full */
  }
}

function formatCount(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export function WatchActions({
  videoId,
  slug,
  title,
  thumbnail,
  initialFavorites,
  initialScore,
}: WatchActionsProps) {
  const [favorited, setFavorited] = useState(false);
  const [favCount, setFavCount] = useState(initialFavorites);

  const [myReaction, setMyReaction] = useState<Reaction>(null);
  const [likes, setLikes] = useState(Math.max(0, initialScore));
  const [dislikes, setDislikes] = useState(0);

  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const syntheticViews = Math.max(initialFavorites * 15, initialScore * 4, 1);

  useEffect(() => {
    addToHistory(videoId, slug, thumbnail, title);
    setFavorited(isFavorite(videoId));

    const local = readLocalReactions()[slug];
    if (local === "like" || local === "dislike") setMyReaction(local);

    fetch(`/api/video-reaction?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: { mine?: Reaction; likes?: number; dislikes?: number } | null,
        ) => {
          if (!data) return;
          if (data.mine === "like" || data.mine === "dislike") {
            setMyReaction(data.mine);
          }
          if (typeof data.likes === "number") {
            setLikes((prev) => Math.max(prev, data.likes!));
          }
          if (typeof data.dislikes === "number") setDislikes(data.dislikes);
        },
      )
      .catch(() => {
        /* silent */
      });
  }, [videoId, slug, thumbnail, title]);

  useEffect(() => {
    if (!shareOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShareOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && !t.closest("[data-share-root]")) setShareOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [shareOpen]);

  function flashPoints(text: string) {
    setFlash(text);
    window.setTimeout(() => setFlash(null), 1400);
  }

  function handleToggleFavorite() {
    const next = toggleFavorite({ id: videoId, slug, title, thumbnail });
    setFavorited(next);
    setFavCount((c) => Math.max(0, c + (next ? 1 : -1)));
    if (next) flashPoints("+8");
  }

  async function handleReaction(r: Exclude<Reaction, null>) {
    const previous = myReaction;
    const nextValue: Reaction = previous === r ? null : r;

    // Optimistic update
    setMyReaction(nextValue);
    setLikes((prev) => {
      if (previous === "like" && nextValue !== "like")
        return Math.max(0, prev - 1);
      if (previous !== "like" && nextValue === "like") return prev + 1;
      return prev;
    });
    setDislikes((prev) => {
      if (previous === "dislike" && nextValue !== "dislike")
        return Math.max(0, prev - 1);
      if (previous !== "dislike" && nextValue === "dislike") return prev + 1;
      return prev;
    });
    writeLocalReaction(slug, nextValue);

    try {
      if (nextValue === null) {
        await fetch(`/api/video-reaction?slug=${encodeURIComponent(slug)}`, {
          method: "DELETE",
        });
      } else {
        const res = await fetch(`/api/video-reaction`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, reaction: nextValue }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.awarded && data.awarded > 0) {
            flashPoints(`+${data.awarded}`);
          }
        } else if (res.status === 401 && previous === null) {
          // Anon: fire fire-and-forget score event (server 401s silently)
          recordScoreEvent(
            nextValue === "like" ? "video_like" : "video_dislike",
            { slug },
          );
        }
      }
    } catch {
      /* optimistic state stays */
    }
  }

  function handleShare(platform: "twitter" | "telegram" | "reddit" | "copy") {
    const url = `https://iku.gg/watch/${slug}`;
    const shareText = `${title} — watch free on iku.gg`;
    if (platform === "copy") {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        })
        .catch(() => {
          /* silent */
        });
    } else if (platform === "twitter") {
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
        "_blank",
        "noopener,noreferrer",
      );
    } else if (platform === "telegram") {
      window.open(
        `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`,
        "_blank",
        "noopener,noreferrer",
      );
    } else if (platform === "reddit") {
      window.open(
        `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(shareText)}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
    setShareOpen(false);
    recordScoreEvent("share_click", { slug, platform });
    flashPoints("+5");
  }

  const totalReactions = likes + dislikes;
  const likeRatio = useMemo(() => {
    if (totalReactions === 0) return 1;
    return likes / totalReactions;
  }, [likes, totalReactions]);

  return (
    <div className="watch-actions" data-share-root>
      <div className="watch-actions__views" aria-label="Views">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>{formatCount(syntheticViews)} views</span>
      </div>

      <div
        className="watch-actions__ratio"
        role="group"
        aria-label="Rate this video"
      >
        <button
          type="button"
          className={`watch-actions__rate watch-actions__rate--like${
            myReaction === "like" ? " is-active" : ""
          }`}
          aria-pressed={myReaction === "like"}
          aria-label={myReaction === "like" ? "Remove like" : "Like this video"}
          onClick={() => handleReaction("like")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={myReaction === "like" ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
            <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
          </svg>
          <span>{formatCount(likes)}</span>
        </button>

        <span
          className="watch-actions__ratio-bar"
          aria-hidden
          style={
            {
              ["--ratio"]: `${Math.round(likeRatio * 100)}%`,
            } as React.CSSProperties
          }
        >
          <span className="watch-actions__ratio-fill" />
        </span>

        <button
          type="button"
          className={`watch-actions__rate watch-actions__rate--dislike${
            myReaction === "dislike" ? " is-active" : ""
          }`}
          aria-pressed={myReaction === "dislike"}
          aria-label={
            myReaction === "dislike" ? "Remove dislike" : "Dislike this video"
          }
          onClick={() => handleReaction("dislike")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={myReaction === "dislike" ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
            <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
          </svg>
          <span>{dislikes > 0 ? formatCount(dislikes) : ""}</span>
        </button>
      </div>

      <button
        type="button"
        onClick={handleToggleFavorite}
        aria-pressed={favorited}
        aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
        className={`watch-actions__btn${favorited ? " is-active" : ""}`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={favorited ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <span>{favorited ? "Saved" : "Save"}</span>
        <span className="watch-actions__btn-count">
          {formatCount(favCount)}
        </span>
      </button>

      <div className="watch-actions__share-wrap">
        <button
          type="button"
          className="watch-actions__btn"
          aria-haspopup="menu"
          aria-expanded={shareOpen}
          aria-label="Share this video"
          onClick={(e) => {
            e.stopPropagation();
            setShareOpen((o) => !o);
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span>Share</span>
        </button>
        {shareOpen && (
          <div role="menu" className="watch-actions__share-menu">
            <button
              role="menuitem"
              onClick={() => handleShare("twitter")}
              aria-label="Share on X / Twitter"
            >
              X / Twitter
            </button>
            <button
              role="menuitem"
              onClick={() => handleShare("telegram")}
              aria-label="Share on Telegram"
            >
              Telegram
            </button>
            <button
              role="menuitem"
              onClick={() => handleShare("reddit")}
              aria-label="Share on Reddit"
            >
              Reddit
            </button>
            <button
              role="menuitem"
              onClick={() => handleShare("copy")}
              aria-label="Copy link"
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          </div>
        )}
      </div>

      {flash && (
        <span className="watch-actions__flash" aria-live="polite">
          {flash}
        </span>
      )}
    </div>
  );
}
