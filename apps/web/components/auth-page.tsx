"use client";

import { LockKeyhole, LogIn, Mail, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAppState } from "./app-provider";

export function AuthPage() {
  const router = useRouter();
  const { authStatus, signIn, signUp } = useAppState();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email")).trim();
    const password = String(data.get("password"));
    try {
      if (mode === "sign-in") {
        await signIn(email, password);
        router.push("/dashboard");
      } else {
        const result = await signUp(email, password);
        if (result.confirmationRequired) {
          setMessage("Check your email to confirm the account, then return here to sign in.");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  if (authStatus === "authenticated") {
    return (
      <main className="page-shell compact-page" id="main">
        <section className="panel auth-panel">
          <div className="panel-header">
            <div>
              <h1>You are signed in</h1>
              <p>Your authenticated scans can now be resumed across devices.</p>
            </div>
            <LogIn size={28} aria-hidden="true" />
          </div>
          <button className="button" type="button" onClick={() => router.push("/dashboard")}>
            Open dashboard
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell compact-page" id="main">
      <section className="panel auth-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Private workspace</p>
            <h1>{mode === "sign-in" ? "Sign in to SkinCause" : "Create your account"}</h1>
            <p>Use one account to keep normalized measurements available across supported clients.</p>
          </div>
          {mode === "sign-in" ? <LogIn size={28} aria-hidden="true" /> : <UserPlus size={28} aria-hidden="true" />}
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "sign-in"}
            className={mode === "sign-in" ? "is-active" : ""}
            onClick={() => setMode("sign-in")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "sign-up"}
            className={mode === "sign-up" ? "is-active" : ""}
            onClick={() => setMode("sign-up")}
          >
            Create account
          </button>
        </div>

        <form className="form-grid auth-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="auth-email"><Mail size={16} aria-hidden="true" /> Email</label>
            <input id="auth-email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="auth-password"><LockKeyhole size={16} aria-hidden="true" /> Password</label>
            <input
              id="auth-password"
              name="password"
              type="password"
              minLength={8}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              required
            />
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {message ? <p className="callout" role="status">{message}</p> : null}
          <button className="button" type="submit" disabled={busy || authStatus === "loading"}>
            {busy ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}
