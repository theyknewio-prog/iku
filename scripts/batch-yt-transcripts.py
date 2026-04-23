#!/usr/bin/env python3
"""
Batch download YouTube transcripts for the Wizards Podcast videos that
map to iku.gg's core questions (adult affiliation, SEO 2026, AI girlfriend,
parasite SEO, monetization).

Writes one .txt per video under data/yt-transcripts/ and a single
index.md with metadata.

Runs from the local laptop (consumer IP) — Hetzner is datacenter-banned
by YouTube's /api/timedtext endpoint.
"""
from pathlib import Path
from youtube_transcript_api import YouTubeTranscriptApi
import re, sys, json, time

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "yt-transcripts"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Priority videos — adult / SEO / affiliation / monetisation / automation
VIDEOS = [
    # Tier A — adult affiliation direct
    ("zwgN9d3CRo8", "niches-affiliation-adulte-2026", "Les NICHES D'AFFILIATION ADULTE qui rapportent le plus en 2026 (Laurence / CrakRevenue)"),
    ("thO6WLJfAqM", "guide-ultime-affiliation-2026", "Le guide ULTIME de l'affiliation en 2026"),
    ("Fk4AQ3kd-WU", "affiliation-secrete-niches-sombres", "AFFILIATION SECRÈTE : Les niches SOMBRES à 1500€/vente"),
    ("0Qe_KWIThy4", "streaming-spam-millions-pionnier", "Streaming, spam et millions : confessions d'un pionnier de l'affiliation"),
    # Tier B — SEO 2026 / Google cassé / parasite
    ("MrXjGjmbDQI", "affiliation-seo-2026-ce-qui-marche", "Affiliation SEO en 2026 : ce qui marche encore"),
    ("W7WoqhABsD8", "google-casse-spam-ia-seo-2026", "Google est CASSÉ : Spam, IA, automatisation et SEO 2026"),
    ("XgpKFoG8WhE", "editeurs-sites-2026-survie", "Editeurs de sites : pourquoi la plupart ne survivront pas à 2026"),
    ("nsoAbFamgKs", "seo-chute-libre-blackhat-2025", "SEO en CHUTE LIBRE, Blackhat 2025, Backlink à 0€"),
    ("4LxP1x7sJng", "40k-24h-tool-seo", "On a fait 40k€ en 24h avec notre tool SEO"),
    ("q8uovf5P6Ws", "vente-liens-46-sites", "Vente de liens 2026 : méthode 46 sites"),
    ("gcVIe5Qgdcc", "vente-liens-seo-2025", "VENTE DE LIENS SEO 2025 : 10K€/mois"),
    # Tier C — automation / Claude Code
    ("cgJEI-Xe2v8", "claude-code-edition-sites", "Claude Code révolutionne l'édition de sites"),
    ("bIkZxzYKbLQ", "80pct-business-claude-code", "Il automatise 80% de son business avec Claude Code"),
    ("Dxa7H_OylcY", "niches-secretes-youtube-faceless", "Niches secrètes, YouTube Faceless"),
]

def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:80]

def fetch_one(vid: str, slug: str, title: str) -> dict:
    out_file = OUT_DIR / f"{slug}.txt"
    meta_file = OUT_DIR / f"{slug}.meta.json"
    if out_file.exists() and out_file.stat().st_size > 1000:
        return {"vid": vid, "slug": slug, "status": "cached", "chars": out_file.stat().st_size}
    try:
        ytt = YouTubeTranscriptApi()
        t = ytt.fetch(vid, languages=["fr", "en"])
        text = " ".join(s.text for s in t)
        # Sentence-split for readability
        sentences = re.split(r"(?<=[.!?])\s+", text)
        buf, chunks = "", []
        for s in sentences:
            if len(buf) + len(s) > 600:
                chunks.append(buf.strip())
                buf = s + " "
            else:
                buf += s + " "
        if buf.strip(): chunks.append(buf.strip())
        header = f"# {title}\n# https://www.youtube.com/watch?v={vid}\n# segments={len(list(t))}  chars={len(text)}\n\n"
        out_file.write_text(header + "\n\n".join(chunks), encoding="utf-8")
        meta_file.write_text(json.dumps({"vid": vid, "slug": slug, "title": title, "chars": len(text), "segments": len(list(t))}, ensure_ascii=False, indent=2), encoding="utf-8")
        return {"vid": vid, "slug": slug, "status": "ok", "chars": len(text)}
    except Exception as e:
        return {"vid": vid, "slug": slug, "status": "error", "err": f"{type(e).__name__}: {str(e)[:200]}"}

def main():
    results = []
    for i, (vid, slug, title) in enumerate(VIDEOS, 1):
        r = fetch_one(vid, slug, title)
        print(f"[{i:2}/{len(VIDEOS)}] {r['status']:7} {vid}  {r.get('chars', 0):6}c  {slug}")
        if r["status"] == "error":
            print(f"         err: {r['err']}")
        results.append(r)
        time.sleep(0.8)  # be polite
    # Write index
    idx_lines = ["# Wizards Podcast transcripts (iku.gg research 2026-04-23)\n"]
    for r, (vid, slug, title) in zip(results, VIDEOS):
        status_icon = "✓" if r["status"] in ("ok", "cached") else "✗"
        idx_lines.append(f"- {status_icon} [{slug}]({slug}.txt) — {title} · {r.get('chars', 0):,} chars · https://www.youtube.com/watch?v={vid}")
    (OUT_DIR / "index.md").write_text("\n".join(idx_lines), encoding="utf-8")
    ok = sum(1 for r in results if r["status"] in ("ok", "cached"))
    print(f"\nDone: {ok}/{len(VIDEOS)} transcripts saved to {OUT_DIR}")

if __name__ == "__main__":
    main()
