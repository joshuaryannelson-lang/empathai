"use client";

import React, { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalIdentityContext } from "../layout";
import Button from "@/app/components/ui/Button";

const PRONOUN_OPTIONS = [
  { value: "", label: "Select pronouns (optional)" },
  { value: "he/him", label: "He / Him" },
  { value: "she/her", label: "She / Her" },
  { value: "they/them", label: "They / Them" },
  { value: "prefer not to say", label: "Prefer not to say" },
  { value: "other", label: "Other" },
];

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/;

function containsIdentifier(text: string): boolean {
  return EMAIL_RE.test(text) || PHONE_RE.test(text);
}

export default function ProfileSetupPage() {
  const router = useRouter();
  const { session, authHeader } = useContext(PortalIdentityContext);

  const [preferredName, setPreferredName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [timezone, setTimezone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameWarning, setNameWarning] = useState<string | null>(null);

  const [checkingProfile, setCheckingProfile] = useState(true);

  // Auto-detect timezone on mount
  useEffect(() => {
    setTimezone(detectTimezone());
  }, []);

  // Redirect if no session
  useEffect(() => {
    if (session === null) {
      router.replace("/portal/onboarding");
    }
  }, [session, router]);

  // Check if profile is already completed — redirect to welcome
  useEffect(() => {
    if (!session) return;
    const auth = authHeader();
    if (!auth) { setCheckingProfile(false); return; }

    fetch("/api/portal/profile", {
      headers: { Authorization: auth },
    })
      .then(r => r.json())
      .then(data => {
        if (data?.has_completed_profile) {
          router.replace("/portal/welcome");
        } else {
          setCheckingProfile(false);
        }
      })
      .catch(() => setCheckingProfile(false));
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Validate name field for identifier patterns
  function handleNameChange(value: string) {
    setPreferredName(value);
    if (value.trim() && containsIdentifier(value)) {
      setNameWarning("Please use a first name only — no email addresses or phone numbers.");
    } else {
      setNameWarning(null);
    }
  }

  async function handleSubmit(skip: boolean) {
    setSaving(true);
    setError(null);

    const auth = authHeader();
    if (!auth) {
      setError("Session expired. Please sign in again.");
      setSaving(false);
      return;
    }

    const body = skip
      ? {}
      : {
          preferred_name: preferredName.trim() || undefined,
          pronouns: pronouns || undefined,
          timezone: timezone || undefined,
        };

    try {
      const res = await fetch("/api/portal/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: auth,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Something went wrong.");
      // Set cookie for middleware gate
      document.cookie = "portal_profile_complete=1; path=/portal; SameSite=Lax; max-age=31536000";
      router.push("/portal/welcome");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!session || checkingProfile) return null;

  const canSave = !saving && !nameWarning;

  return (
    <div style={{
      minHeight: "calc(100vh - 61px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 16px",
      width: "100%",
    }}>
      <div style={{ width: "100%", maxWidth: 480, margin: "0 auto" }}>

        {/* Progress indicator */}
        <div className="fade-in" style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginBottom: 32,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#4ade80",
          }} />
          <div style={{
            width: 24, height: 1,
            background: "rgba(255,255,255,0.15)",
          }} />
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            border: "2px solid #6b82d4",
            background: "transparent",
          }} />
          <div style={{
            width: 24, height: 1,
            background: "rgba(255,255,255,0.08)",
          }} />
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "rgba(255,255,255,0.12)",
          }} />
          <span style={{
            fontSize: 10,
            color: "#94a3b8",
            marginLeft: 8,
            fontFamily: "'DM Mono', monospace",
            letterSpacing: 0.5,
          }}>
            Step 2 of 3
          </span>
        </div>

        {/* Header */}
        <div className="fade-in" style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "#6b82d4",
            opacity: 0.85,
            fontFamily: "'DM Mono', monospace",
            marginBottom: 12,
          }}>
            Set up your profile
          </div>
          <h1 style={{
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: -0.8,
            color: "#f1f5f9",
            lineHeight: 1.2,
            fontFamily: "'Sora', system-ui",
          }}>
            A little about you
          </h1>
          <p style={{
            marginTop: 10,
            fontSize: 14,
            color: "#94a3b8",
            lineHeight: 1.6,
          }}>
            This helps your care team personalize your experience.
            All fields are optional.
          </p>
        </div>

        {/* Form card */}
        <div className="card fade-in-1" style={{ display: "grid", gap: 18 }}>

          {/* Preferred name */}
          <div>
            <div className="label">What should we call you?</div>
            <input
              className="input-field"
              type="text"
              placeholder="First name"
              value={preferredName}
              onChange={e => handleNameChange(e.target.value)}
              maxLength={50}
              autoComplete="given-name"
              style={{ fontSize: 15 }}
            />
            {nameWarning && (
              <div style={{
                marginTop: 6,
                fontSize: 12,
                color: "#f87171",
                lineHeight: 1.4,
              }}>
                {nameWarning}
              </div>
            )}
          </div>

          {/* Pronouns */}
          <div>
            <div className="label">Pronouns</div>
            <select
              className="input-field"
              value={pronouns}
              onChange={e => setPronouns(e.target.value)}
              style={{
                fontSize: 14,
                color: pronouns ? "#f1f5f9" : "rgba(255,255,255,0.25)",
                cursor: "pointer",
              }}
            >
              {PRONOUN_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Timezone */}
          <div>
            <div className="label">Your timezone</div>
            <input
              className="input-field"
              type="text"
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              placeholder="e.g. America/New_York"
              maxLength={100}
              style={{ fontSize: 14, fontFamily: "'DM Mono', monospace" }}
            />
            <div style={{
              marginTop: 4,
              fontSize: 11,
              color: "rgba(255,255,255,0.2)",
              fontFamily: "'DM Mono', monospace",
            }}>
              Auto-detected from your browser
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              fontSize: 13,
              color: "#f87171",
              background: "#1a0808",
              border: "1px solid #3d1a1a",
              borderRadius: 8,
              padding: "10px 12px",
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
            <Button
              variant="primary"
              disabled={!canSave}
              onClick={() => handleSubmit(false)}
              style={{
                width: "100%",
                padding: "13px 0",
                fontSize: 15,
                fontWeight: 800,
                borderRadius: 12,
                fontFamily: "'Sora', system-ui",
                letterSpacing: -0.2,
              }}
            >
              {saving ? "Saving\u2026" : "Save & continue"}
            </Button>

            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => handleSubmit(true)}
              style={{
                width: "100%",
                padding: "11px 0",
                fontSize: 13,
                color: "#94a3b8",
              }}
            >
              Skip for now
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="fade-in-2" style={{
          marginTop: 14,
          textAlign: "center",
          fontSize: 11,
          color: "rgba(255,255,255,0.18)",
          fontFamily: "'DM Mono', monospace",
        }}>
          You can update these anytime from your portal
        </div>
      </div>
    </div>
  );
}
