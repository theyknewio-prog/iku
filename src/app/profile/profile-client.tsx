"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { JoinDiscordCTA } from "@/components/JoinDiscordCTA";
import { track, EVENTS } from "@/lib/analytics";

const AVATAR_OPTIONS = ["🌸", "🎮", "⚔️", "🧙", "🐉", "🏹", "😈", "👹", "🌙", "🤖", "🌿", "⚗️", "🐱", "🦊", "🧝", "🧛", "🧜", "👑", "💎", "🔥"];

interface Props {
  initialUsername: string;
  initialAvatar: string;
  hasPassword: boolean;
}

export function ProfileClient({ initialUsername, initialAvatar, hasPassword }: Props) {
  const router = useRouter();
  const search = useSearchParams();

  // PostHog: track Pro purchase completion (user lands here after successful Stripe checkout)
  useEffect(() => {
    if (search.get("upgraded") === "1") {
      track(EVENTS.PRO_PURCHASE);
    }
    if (search.get("verified") === "1") {
      track("email_verified");
    }
  }, [search]);

  const [username, setUsername] = useState(initialUsername);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [passMsg, setPassMsg] = useState<string | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, avatar }),
      });
      const json = await res.json();
      if (!res.ok) {
        setProfileMsg(json.error || "Update failed");
      } else {
        setProfileMsg("Saved ✨");
        router.refresh();
      }
    } catch {
      setProfileMsg("Something went wrong");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPass(true);
    setPassMsg(null);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPassMsg(json.error || "Update failed");
      } else {
        setPassMsg("Password updated ✓");
        setCurrentPass("");
        setNewPass("");
      }
    } catch {
      setPassMsg("Something went wrong");
    } finally {
      setSavingPass(false);
    }
  }

  return (
    <>
      <form onSubmit={saveProfile} className="profile-section">
        <h2>Profile</h2>

        <label className="auth-label">
          <span>Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_-]+"
            className="auth-input"
          />
        </label>

        <div style={{ marginTop: 14 }}>
          <div className="auth-label" style={{ marginBottom: 8 }}><span>Avatar</span></div>
          <div className="profile-avatar-picker">
            {AVATAR_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`profile-avatar-option ${avatar === emoji ? "profile-avatar-option--active" : ""}`}
                onClick={() => setAvatar(emoji)}
                aria-label={`Use ${emoji} avatar`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {profileMsg && (
          <div style={{ marginTop: 12, fontSize: 13, color: profileMsg.includes("fail") || profileMsg.includes("wrong") ? "#fca5a5" : "#86efac" }}>
            {profileMsg}
          </div>
        )}

        <button type="submit" disabled={savingProfile} className="auth-submit" style={{ marginTop: 16 }}>
          {savingProfile ? "Saving…" : "Save changes"}
        </button>
      </form>

      {hasPassword && (
        <form onSubmit={changePassword} className="profile-section">
          <h2>Change password</h2>

          <label className="auth-label">
            <span>Current password</span>
            <input
              type="password"
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              required
              className="auth-input"
              autoComplete="current-password"
            />
          </label>

          <label className="auth-label" style={{ marginTop: 12 }}>
            <span>New password</span>
            <input
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              required
              minLength={8}
              className="auth-input"
              autoComplete="new-password"
            />
          </label>

          {passMsg && (
            <div style={{ marginTop: 12, fontSize: 13, color: passMsg.includes("✓") ? "#86efac" : "#fca5a5" }}>
              {passMsg}
            </div>
          )}

          <button type="submit" disabled={savingPass} className="auth-submit" style={{ marginTop: 14 }}>
            {savingPass ? "Updating…" : "Update password"}
          </button>
        </form>
      )}

      <div className="profile-section">
        <h2>Community</h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", margin: "0 0 14px" }}>
          Jump into the iku.gg Discord — daily drops, genre forums, watch parties, and a community of fans.
        </p>
        <JoinDiscordCTA variant="compact" />
      </div>

      <div className="profile-section">
        <h2>Session</h2>
        <button
          type="button"
          className="profile-logout"
          onClick={() => {
            track(EVENTS.LOGOUT);
            signOut({ callbackUrl: "/" });
          }}
        >
          Sign out
        </button>
      </div>
    </>
  );
}
