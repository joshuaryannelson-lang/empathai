/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

type EnrollState = "loading" | "enroll" | "verify" | "success" | "error";

function MfaEnrollFallback() {
  return (
    <div style={{ minHeight: "100vh", background: "#080c12", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%", margin: "0 auto 16px",
          border: "3px solid rgba(162,28,175,0.2)",
          borderTopColor: "#a21caf",
          animation: "mfa-spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes mfa-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans',system-ui" }}>
          Loading...
        </div>
      </div>
    </div>
  );
}

export default function MfaEnrollPage() {
  return (
    <Suspense fallback={<MfaEnrollFallback />}>
      <MfaEnrollContent />
    </Suspense>
  );
}

function MfaEnrollContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") ?? "/admin";

  const [state, setState] = useState<EnrollState>("loading");
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseBrowser();

  // Check if user already has MFA enrolled and at aal2
  const checkExistingMfa = useCallback(async () => {
    const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (mfaData?.currentLevel === "aal2") {
      // Already at aal2 — redirect to destination
      router.replace(nextUrl);
      return;
    }

    if (mfaData?.currentLevel === "aal1" && mfaData?.nextLevel === "aal2") {
      // Has a factor enrolled but needs to verify — go to verify step
      setState("verify");
      return;
    }

    // Need to enroll a new factor
    await startEnrollment();
  }, [supabase, nextUrl, router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startEnrollment() {
    setError(null);
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "empathAI Manager MFA",
    });

    if (enrollError || !data) {
      setError(enrollError?.message ?? "Failed to start MFA enrollment.");
      setState("error");
      return;
    }

    setQrUri(data.totp.uri);
    setSecret(data.totp.secret);
    setFactorId(data.id);
    setState("enroll");
  }

  async function handleVerify() {
    if (code.length !== 6) return;
    setError(null);

    // Find the factor to verify
    const verifyFactorId = factorId ?? await getFirstUnverifiedFactorId();
    if (!verifyFactorId) {
      setError("No MFA factor found to verify.");
      return;
    }

    // Challenge
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: verifyFactorId,
    });
    if (challengeError || !challengeData) {
      setError(challengeError?.message ?? "Failed to create challenge.");
      return;
    }

    // Verify
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: verifyFactorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      setError("Invalid code. Please try again.");
      setCode("");
      return;
    }

    setState("success");
    // Brief delay to show success, then redirect
    setTimeout(() => router.replace(nextUrl), 1200);
  }

  async function getFirstUnverifiedFactorId(): Promise<string | null> {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp?.[0];
    return totp?.id ?? null;
  }

  useEffect(() => {
    checkExistingMfa();
  }, [checkExistingMfa]);

  // ── UI ──

  const ACCENT = "#a21caf";
  const ACCENT_RGB = "162,28,175";

  return (
    <div style={{ minHeight: "100vh", background: "#080c12", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <style>{`        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080c12; font-family: 'DM Sans', system-ui; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 20px",
            background: `rgba(${ACCENT_RGB},0.12)`,
            border: `1px solid rgba(${ACCENT_RGB},0.25)`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          }}>
            &#128274;
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: ACCENT, fontFamily: "'DM Mono',monospace", marginBottom: 10 }}>
            Required Security Step
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.8, color: "rgba(255,255,255,0.97)", lineHeight: 1.2, fontFamily: "'Sora',system-ui" }}>
            {state === "verify" ? "Verify your identity" : "Set up two-factor authentication"}
          </h1>
          <p style={{ marginTop: 10, fontSize: 14, color: "rgba(255,255,255,0.42)", lineHeight: 1.6 }}>
            {state === "verify"
              ? "Enter the 6-digit code from your authenticator app."
              : "Manager accounts require MFA for access to admin tools. Scan the QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.)."
            }
          </p>
        </div>

        {/* Loading */}
        {state === "loading" && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
            Checking MFA status...
          </div>
        )}

        {/* Enrollment — show QR code */}
        {state === "enroll" && qrUri && (
          <div style={{ borderRadius: 16, border: "1px solid #1a1e2a", background: "#0d1018", padding: "24px 22px" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              {/* QR code rendered as an image via a data URI service or inline SVG */}
              <div style={{
                width: 200, height: 200, margin: "0 auto", borderRadius: 12,
                background: "white", padding: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {/* Use the otpauth URI directly — user can scan from authenticator apps.
                    In production, use a QR code library. For now, show the URI. */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=176x176&data=${encodeURIComponent(qrUri)}`}
                  alt="MFA QR Code"
                  width={176}
                  height={176}
                  style={{ borderRadius: 8 }}
                />
              </div>
            </div>

            {secret && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 6, fontFamily: "'DM Mono',monospace" }}>
                  Manual entry key
                </div>
                <div style={{
                  fontSize: 13, fontFamily: "'DM Mono',monospace", color: "rgba(255,255,255,0.7)",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, padding: "8px 12px", wordBreak: "break-all",
                }}>
                  {secret}
                </div>
              </div>
            )}

            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8, fontFamily: "'DM Mono',monospace" }}>
              Enter verification code
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => e.key === "Enter" && handleVerify()}
              placeholder="000000"
              style={{
                width: "100%", padding: "14px 16px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
                color: "#e2e8f0", fontSize: 24, fontWeight: 700, letterSpacing: 8,
                textAlign: "center", fontFamily: "'DM Mono',monospace", outline: "none",
              }}
            />

            {error && (
              <div style={{ marginTop: 12, fontSize: 13, color: "#f87171", background: "#1a0808", border: "1px solid #3d1a1a", borderRadius: 8, padding: "10px 12px" }}>
                {error}
              </div>
            )}

            <button
              onClick={handleVerify}
              disabled={code.length !== 6}
              style={{
                width: "100%", marginTop: 16, padding: "14px 28px", borderRadius: 12,
                border: `1px solid rgba(${ACCENT_RGB},0.33)`,
                background: `linear-gradient(135deg, rgba(${ACCENT_RGB},0.2), rgba(${ACCENT_RGB},0.08))`,
                color: "white", fontSize: 15, fontWeight: 800, cursor: code.length === 6 ? "pointer" : "not-allowed",
                fontFamily: "'Sora',system-ui", opacity: code.length === 6 ? 1 : 0.4,
              }}
            >
              Verify &amp; activate
            </button>
          </div>
        )}

        {/* Verify — factor already enrolled, just need the code */}
        {state === "verify" && (
          <div style={{ borderRadius: 16, border: "1px solid #1a1e2a", background: "#0d1018", padding: "24px 22px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8, fontFamily: "'DM Mono',monospace" }}>
              Authenticator code
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => e.key === "Enter" && handleVerify()}
              placeholder="000000"
              autoFocus
              style={{
                width: "100%", padding: "14px 16px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
                color: "#e2e8f0", fontSize: 24, fontWeight: 700, letterSpacing: 8,
                textAlign: "center", fontFamily: "'DM Mono',monospace", outline: "none",
              }}
            />

            {error && (
              <div style={{ marginTop: 12, fontSize: 13, color: "#f87171", background: "#1a0808", border: "1px solid #3d1a1a", borderRadius: 8, padding: "10px 12px" }}>
                {error}
              </div>
            )}

            <button
              onClick={handleVerify}
              disabled={code.length !== 6}
              style={{
                width: "100%", marginTop: 16, padding: "14px 28px", borderRadius: 12,
                border: `1px solid rgba(${ACCENT_RGB},0.33)`,
                background: `linear-gradient(135deg, rgba(${ACCENT_RGB},0.2), rgba(${ACCENT_RGB},0.08))`,
                color: "white", fontSize: 15, fontWeight: 800, cursor: code.length === 6 ? "pointer" : "not-allowed",
                fontFamily: "'Sora',system-ui", opacity: code.length === 6 ? 1 : 0.4,
              }}
            >
              Verify
            </button>
          </div>
        )}

        {/* Success */}
        {state === "success" && (
          <div style={{ textAlign: "center", borderRadius: 16, border: "1px solid #0e2e1a", background: "#061a0b", padding: "32px 22px" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>&#10003;</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#4ade80", fontFamily: "'Sora',system-ui" }}>
              MFA verified
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>
              Redirecting to admin console...
            </p>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#f87171", marginBottom: 16 }}>{error}</div>
            <button
              onClick={() => { setState("loading"); checkExistingMfa(); }}
              style={{
                fontSize: 13, fontWeight: 600, color: ACCENT,
                background: "none", border: `1px solid rgba(${ACCENT_RGB},0.3)`,
                borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Cannot skip notice */}
        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "'DM Mono',monospace" }}>
          MFA is required for manager accounts. This step cannot be skipped.
        </div>
      </div>
    </div>
  );
}
