#!/usr/bin/env python3
"""
iku.gg Reddit Bot v2 — Auto-post to NSFW subreddits via OAuth bearer token.

No PRAW needed. Uses Reddit's internal OAuth API with a bearer token
extracted from localStorage['chat:access-token'] in Chrome.

Usage:
  # Extract token from Chrome (run on your PC)
  python scripts/reddit-bot.py --extract-token

  # Single run (posts 1 video to 1 sub)
  python scripts/reddit-bot.py --count 1

  # Post to N subs (max 10, spaced 10min apart)
  python scripts/reddit-bot.py --count 5

  # Dry run (no actual posting)
  python scripts/reddit-bot.py --dry-run --count 3

  # List available subs
  python scripts/reddit-bot.py --list-subs

Env vars required:
  REDDIT_TOKEN          — Bearer token (from --extract-token or manual)
  DATABASE_URL          — PostgreSQL connection string (iku DB)
"""

import os
import sys
import json
import time
import random
import argparse
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# Token file (persisted between runs, refreshed every 24h)
TOKEN_FILE = Path(__file__).parent / ".reddit-token.json"

# Subreddits verified to accept iku.gg links (2026-04-07)
# format: (sub_name, members_approx, flair_id_or_None, flair_text_or_None)
SUBREDDITS = [
    # === TIER 1: 100K+ members, NO flair needed, iku.gg accepted ===
    ("ecchi", 1100000, None, None),
    ("thighdeology", 600000, None, None),
    ("hentaimemes", 350000, None, None),
    ("nsfwanimegifs", 250000, None, None),
    ("AnimeBooty", 280000, None, None),
    ("BigAnimeTiddies", 200000, None, None),
    ("AraAra", 200000, None, None),
    ("pantsu", 170000, None, None),
    ("hentaibondage", 160000, None, None),
    ("tentai", 120000, None, None),
    ("handholding", 120000, None, None),

    # === TIER 2: 30K-100K members, NO flair needed ===
    ("animelegs", 60000, None, None),
    ("animearmpits", 60000, None, None),
    ("FinalFantasyNSFW", 60000, None, None),
    ("VideoGamePorn", 50000, None, None),
    ("Artistic_Hentai", 40000, None, None),
    ("muchihentai", 40000, None, None),

    # === TIER 3: 100K+ members, FLAIR required, iku.gg accepted ===
    ("ahegao", 850000, None, None),  # flair list was empty — retry without
    ("wholesomehentai", 350000, "bf736842-59c7-11eb-98bb-0e564b4039ef", "Couple"),
    ("GenshinImpactNSFW", 350000, "525c3e1c-027b-11eb-94f4-0e5db22198bb", "Other"),
    ("3DPorncraft", 250000, "5e03a692-55ae-11e7-9a93-0e6b8cfbbdaa", "[Found Art]"),
    ("Naruto_Hentai", 200000, "1dd79172-4f52-11eb-bca9-0eabc648a843", "Other Girls"),
    ("Overwatch_Porn", 200000, None, None),  # flair list was empty
    ("NSFWgaming", 180000, "b1bb9c36-69a7-11ee-96dc-36c53863c134", "Fan Art"),
    ("DragonBallNSFW", 100000, "e31df084-7fc6-11ec-b9c0-ae9b72114a4e", "Android 18\u200e :RainbowCrystal:"),
    ("CumHentai", 100000, "6a34ec48-ec18-11ee-8567-0a7c1b1878a5", "Cum"),
    ("DemonSlayerNSFW", 80000, "256caea8-177d-11ef-83e0-ced48ae86288", "Mitsuri"),
    ("ResidentEvil34", 60000, None, None),  # flair list was empty
]

# Characters -> series mapping
CHARACTER_SERIES = {
    "ada_wong": ("Ada Wong", "Resident Evil"),
    "jill_valentine": ("Jill Valentine", "Resident Evil"),
    "tifa_lockhart": ("Tifa Lockhart", "Final Fantasy VII"),
    "aerith_gainsborough": ("Aerith", "Final Fantasy VII"),
    "2b": ("2B", "NieR Automata"),
    "a2": ("A2", "NieR Automata"),
    "d.va": ("D.Va", "Overwatch"),
    "mercy": ("Mercy", "Overwatch"),
    "widowmaker": ("Widowmaker", "Overwatch"),
    "tracer": ("Tracer", "Overwatch"),
    "chun-li": ("Chun-Li", "Street Fighter"),
    "cammy_white": ("Cammy", "Street Fighter"),
    "marie_rose": ("Marie Rose", "Dead or Alive"),
    "kasumi": ("Kasumi", "Dead or Alive"),
    "raiden_shogun": ("Raiden Shogun", "Genshin Impact"),
    "ganyu": ("Ganyu", "Genshin Impact"),
    "keqing": ("Keqing", "Genshin Impact"),
    "mona": ("Mona", "Genshin Impact"),
    "yor_forger": ("Yor Forger", "Spy x Family"),
    "makima": ("Makima", "Chainsaw Man"),
    "power": ("Power", "Chainsaw Man"),
    "zero_two": ("Zero Two", "Darling in the Franxx"),
    "android_18": ("Android 18", "Dragon Ball"),
    "hinata_hyuga": ("Hinata", "Naruto"),
    "tsunade": ("Tsunade", "Naruto"),
    "nico_robin": ("Nico Robin", "One Piece"),
    "nami": ("Nami", "One Piece"),
    "asuka_langley": ("Asuka", "Evangelion"),
    "rei_ayanami": ("Rei", "Evangelion"),
    "mikasa_ackerman": ("Mikasa", "Attack on Titan"),
    "lady_dimitrescu": ("Lady Dimitrescu", "Resident Evil"),
    "lara_croft": ("Lara Croft", "Tomb Raider"),
    "samus_aran": ("Samus", "Metroid"),
    "zelda": ("Zelda", "Legend of Zelda"),
    "peach": ("Princess Peach", "Super Mario"),
    "bayonetta": ("Bayonetta", "Bayonetta"),
    "mitsuri_kanroji": ("Mitsuri", "Demon Slayer"),
    "nezuko_kamado": None,  # BANNED
    "anya_forger": None,    # BANNED
}

# Character -> best sub mapping (character-specific subs w/ flair)
CHARACTER_SUBS = {
    "tifa_lockhart": ["FinalFantasyNSFW", "VideoGamePorn", "BigAnimeTiddies"],
    "aerith_gainsborough": ["FinalFantasyNSFW"],
    "2b": ["VideoGamePorn", "BigAnimeTiddies", "thighdeology"],
    "d.va": ["Overwatch_Porn", "VideoGamePorn"],
    "mercy": ["Overwatch_Porn"],
    "widowmaker": ["Overwatch_Porn", "thighdeology"],
    "raiden_shogun": ["GenshinImpactNSFW", "BigAnimeTiddies"],
    "ganyu": ["GenshinImpactNSFW"],
    "mona": ["GenshinImpactNSFW"],
    "hinata_hyuga": ["Naruto_Hentai", "BigAnimeTiddies"],
    "tsunade": ["Naruto_Hentai", "BigAnimeTiddies"],
    "android_18": ["DragonBallNSFW"],
    "ada_wong": ["ResidentEvil34", "VideoGamePorn"],
    "jill_valentine": ["ResidentEvil34", "VideoGamePorn"],
    "lady_dimitrescu": ["ResidentEvil34"],
    "mitsuri_kanroji": ["DemonSlayerNSFW"],
    "lara_croft": ["VideoGamePorn", "NSFWgaming"],
    "samus_aran": ["VideoGamePorn", "NSFWgaming"],
}

# Comment templates
COMMENTS = [
    "Full video + more on [iku.gg]({url}) — 350K+ free animated hentai videos",
    "Source & more like this: [iku.gg]({url})",
    "Watch the full thing + related videos at [iku.gg]({url})",
    "More {character} content at [iku.gg]({url}) — free, no ads",
    "Found this on [iku.gg]({url}) — huge collection of animated hentai",
]

# Safety
MIN_DELAY_BETWEEN_POSTS = 600  # 10 minutes
MAX_POSTS_PER_RUN = 10
POST_HISTORY_FILE = Path(__file__).parent / ".reddit-post-history.json"

# Generic subs (for any character)
GENERIC_SUBS = [
    "ecchi", "thighdeology", "hentaimemes", "nsfwanimegifs",
    "AnimeBooty", "BigAnimeTiddies", "AraAra", "pantsu",
    "hentaibondage", "tentai", "animelegs", "Artistic_Hentai",
    "muchihentai", "3DPorncraft", "NSFWgaming", "ahegao",
    "wholesomehentai", "CumHentai",
]


# ---------------------------------------------------------------------------
# Token management
# ---------------------------------------------------------------------------

def get_token():
    """Get Reddit bearer token from env var or token file."""
    # 1. Check env var
    token = os.environ.get("REDDIT_TOKEN")
    if token:
        return token

    # 2. Check token file
    if TOKEN_FILE.exists():
        try:
            with open(TOKEN_FILE) as f:
                data = json.load(f)
            token = data.get("token")
            expires = data.get("expires", 0)
            if token and time.time() < expires:
                return token
            else:
                print("WARNING: Token expired. Run --extract-token to refresh.")
        except Exception:
            pass

    print("ERROR: No Reddit token found.")
    print("\nTo get a token:")
    print("  1. Open Chrome (logged into Reddit)")
    print("  2. Go to reddit.com, open DevTools (F12)")
    print("  3. Console: JSON.parse(localStorage.getItem('chat:access-token')).token")
    print("  4. Copy the token and set: REDDIT_TOKEN=<token>")
    print("  Or run: python scripts/reddit-bot.py --extract-token")
    sys.exit(1)


def save_token(token, expires_in=86400):
    """Save token to file with expiry."""
    with open(TOKEN_FILE, "w") as f:
        json.dump({
            "token": token,
            "expires": time.time() + expires_in,
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }, f, indent=2)
    print(f"Token saved to {TOKEN_FILE} (expires in {expires_in//3600}h)")


# ---------------------------------------------------------------------------
# Reddit API (direct HTTP, no PRAW)
# ---------------------------------------------------------------------------

def reddit_api(method, endpoint, token, data=None):
    """Call Reddit OAuth API."""
    url = f"https://oauth.reddit.com{endpoint}"

    if data and method == "POST":
        body = "&".join(f"{k}={v}" for k, v in data.items()).encode()
    else:
        body = None

    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    req.add_header("User-Agent", "web:iku-bot:v2.0 (by /u/No-Friendship-6656)")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.readable() else ""
        print(f"  API error {e.code}: {error_body[:200]}")
        return None
    except Exception as e:
        print(f"  API error: {e}")
        return None


def submit_link(token, subreddit, title, url, flair_id=None, flair_text=None):
    """Submit a link post to a subreddit."""
    data = {
        "api_type": "json",
        "kind": "link",
        "nsfw": "true",
        "resubmit": "true",
        "sendreplies": "true",
        "sr": subreddit,
        "title": title,
        "url": url,
    }
    if flair_id:
        data["flair_id"] = flair_id
    if flair_text:
        data["flair_text"] = flair_text

    result = reddit_api("POST", "/api/submit", token, data)
    if not result:
        return None

    errors = result.get("json", {}).get("errors", [])
    if errors:
        print(f"  Submit errors: {errors}")
        return None

    return result.get("json", {}).get("data", {})


def add_comment(token, post_id, text):
    """Add a comment to a post."""
    data = {
        "api_type": "json",
        "thing_id": post_id,
        "text": text,
    }
    result = reddit_api("POST", "/api/comment", token, data)
    if not result:
        return False

    errors = result.get("json", {}).get("errors", [])
    if errors:
        print(f"  Comment errors: {errors}")
        return False
    return True


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def get_db_connection():
    """Connect to iku PostgreSQL database."""
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
        sys.exit(1)

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL env var not set")
        sys.exit(1)

    return psycopg2.connect(db_url)


def get_trending_videos(conn, limit=100):
    """Get trending videos with known characters from the DB."""
    cur = conn.cursor()
    cur.execute("""
        SELECT id, slug, url, thumbnail, tags, characters, copyrights, artists,
               score, duration, source, width, height
        FROM videos
        WHERE characters IS NOT NULL
          AND array_length(characters, 1) > 0
          AND source IN ('rule34', 'gelbooru', 'danbooru')
          AND duration IS NOT NULL
          AND duration > 5
          AND duration < 120
          AND score > 100
        ORDER BY score DESC
        LIMIT %s
    """, (limit,))

    columns = [desc[0] for desc in cur.description]
    rows = [dict(zip(columns, row)) for row in cur.fetchall()]
    cur.close()

    result = []
    for row in rows:
        chars = row.get("characters", []) or []
        for char in chars:
            char_lower = char.lower().replace(" ", "_")
            if char_lower in CHARACTER_SERIES and CHARACTER_SERIES[char_lower] is not None:
                row["_matched_char"] = char_lower
                row["_char_display"], row["_series"] = CHARACTER_SERIES[char_lower]
                result.append(row)
                break

    return result


# ---------------------------------------------------------------------------
# Post logic
# ---------------------------------------------------------------------------

def build_title(video, subreddit):
    """Build a title for the post."""
    character = video.get("_char_display", "Unknown")
    series = video.get("_series", "")
    artists = video.get("artists", []) or []
    artist = artists[0].replace("_", " ").title() if artists else None

    if artist:
        return f"{character} ({series}) [{artist}]"
    else:
        return f"{character} ({series})"


def get_sub_config(sub_name):
    """Get config for a subreddit."""
    for config in SUBREDDITS:
        if config[0] == sub_name:
            return config
    return None


def load_post_history():
    if POST_HISTORY_FILE.exists():
        try:
            with open(POST_HISTORY_FILE) as f:
                return json.load(f)
        except Exception:
            return {"posts": [], "last_post_time": 0}
    return {"posts": [], "last_post_time": 0}


def save_post_history(history):
    history["posts"] = history["posts"][-200:]
    with open(POST_HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)


def was_already_posted(history, video_slug, sub_name):
    key = f"{video_slug}:{sub_name}"
    return key in [p.get("key") for p in history.get("posts", [])]


def pick_videos_and_subs(videos, history, count):
    """Pick video+sub combos."""
    combos = []
    used_subs = set()

    random.shuffle(videos)

    for video in videos:
        if len(combos) >= count:
            break

        char_key = video.get("_matched_char", "")

        # Character-specific subs first, then generic
        best_subs = CHARACTER_SUBS.get(char_key, []) + GENERIC_SUBS
        random.shuffle(best_subs)

        for sub in best_subs:
            if sub in used_subs:
                continue
            if was_already_posted(history, video["slug"], sub):
                continue
            if get_sub_config(sub) is None:
                continue

            combos.append((video, sub))
            used_subs.add(sub)
            break

    return combos


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="iku.gg Reddit Bot v2")
    parser.add_argument("--count", type=int, default=1, help="Number of posts (max 10)")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually post")
    parser.add_argument("--list-subs", action="store_true", help="List available subs")
    parser.add_argument("--extract-token", action="store_true", help="Extract token from Chrome")
    parser.add_argument("--set-token", type=str, help="Manually set bearer token")
    parser.add_argument("--delay", type=int, default=MIN_DELAY_BETWEEN_POSTS,
                        help=f"Delay between posts in seconds (default: {MIN_DELAY_BETWEEN_POSTS})")
    args = parser.parse_args()

    # --set-token: save manually
    if args.set_token:
        save_token(args.set_token)
        return

    # --extract-token: extract from Chrome localStorage
    if args.extract_token:
        print("Extracting token from Chrome...")
        print("Make sure Chrome is running with --remote-debugging-port=9222")
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.connect_over_cdp("http://localhost:9222")
                contexts = browser.contexts
                if not contexts:
                    print("ERROR: No browser contexts found")
                    return
                page = contexts[0].pages[0]
                page.goto("https://www.reddit.com")
                page.wait_for_load_state("networkidle")
                token_raw = page.evaluate(
                    "JSON.parse(localStorage.getItem('chat:access-token')).token"
                )
                if token_raw:
                    save_token(token_raw, 86400)
                    print(f"Token: {token_raw[:50]}...")
                else:
                    print("ERROR: No token found in localStorage")
        except ImportError:
            print("ERROR: playwright not installed. Run: pip install playwright")
        except Exception as e:
            print(f"ERROR: {e}")
            print("\nManual method:")
            print("  1. Open reddit.com in Chrome, F12, Console:")
            print("  2. JSON.parse(localStorage.getItem('chat:access-token')).token")
            print("  3. python scripts/reddit-bot.py --set-token <TOKEN>")
        return

    # --list-subs
    if args.list_subs:
        print("Available subreddits (verified 2026-04-07):\n")
        print(f"  {'Sub':25s} {'Members':>10s}  {'Flair':15s}")
        print(f"  {'---':25s} {'-------':>10s}  {'-----':15s}")
        for sub, members, flair_id, flair_text in SUBREDDITS:
            flair_str = flair_text or "none"
            print(f"  r/{sub:24s} {members:>10,}  {flair_str:15s}")
        print(f"\n  Total: {len(SUBREDDITS)} subs")
        return

    count = min(args.count, MAX_POSTS_PER_RUN)

    print(f"=== iku.gg Reddit Bot v2 ===")
    print(f"Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"Posts planned: {count}")
    if args.dry_run:
        print("MODE: DRY RUN")
    print()

    # Check rate limit
    history = load_post_history()
    last_post = history.get("last_post_time", 0)
    elapsed = time.time() - last_post
    if elapsed < args.delay and not args.dry_run and last_post > 0:
        wait = int(args.delay - elapsed)
        print(f"Rate limit: wait {wait}s more (--delay 0 to override)")
        return

    # Get token
    token = get_token()
    print(f"Token: ...{token[-20:]}")

    # Connect to DB
    print("Connecting to database...")
    conn = get_db_connection()

    # Get trending videos
    print("Fetching trending videos...")
    videos = get_trending_videos(conn, limit=100)
    print(f"Found {len(videos)} eligible videos")

    if not videos:
        print("No eligible videos found.")
        conn.close()
        return

    # Pick combos
    combos = pick_videos_and_subs(videos, history, count)
    print(f"Selected {len(combos)} video+sub combos")

    if not combos:
        print("No new combos available. Try again later.")
        conn.close()
        return

    # Post
    success_count = 0
    for i, (video, sub_name) in enumerate(combos):
        config = get_sub_config(sub_name)
        _, _, flair_id, flair_text = config

        title = build_title(video, sub_name)
        iku_url = f"https://iku.gg/watch/{video['slug']}"
        character = video.get("_char_display", "")
        comment_text = random.choice(COMMENTS).format(url=iku_url, character=character)

        print(f"\n--- Post {i+1}/{len(combos)} ---")
        print(f"  Video: {video['slug']} (score: {video.get('score', 0)})")
        print(f"  Character: {character} ({video.get('_series', '')})")
        print(f"  Sub: r/{sub_name}")
        print(f"  Title: {title}")
        print(f"  URL: {iku_url}")
        print(f"  Flair: {flair_text or 'none'}")

        if args.dry_run:
            print("  [DRY RUN] Would post here")
            success_count += 1
            continue

        # Submit
        result = submit_link(token, sub_name, title, iku_url, flair_id, flair_text)
        if not result:
            print("  FAILED to submit")
            continue

        post_url = result.get("url", "")
        post_id = result.get("name", "")
        print(f"  POSTED! {post_url}")

        # Comment
        time.sleep(3)
        if add_comment(token, post_id, comment_text):
            print(f"  Comment added!")
        else:
            print(f"  Comment failed (post still live)")

        success_count += 1

        # Record
        history["posts"].append({
            "key": f"{video['slug']}:{sub_name}",
            "slug": video["slug"],
            "sub": sub_name,
            "character": character,
            "time": datetime.now(timezone.utc).isoformat(),
            "url": post_url,
        })
        history["last_post_time"] = time.time()
        save_post_history(history)

        # Delay
        if i < len(combos) - 1:
            print(f"\n  Waiting {args.delay}s...")
            time.sleep(args.delay)

    conn.close()
    print(f"\n=== Done! {success_count}/{len(combos)} posts successful ===")


if __name__ == "__main__":
    main()
