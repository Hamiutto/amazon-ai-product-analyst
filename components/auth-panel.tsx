"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Lock, Loader2, Mail, UserPlus } from "lucide-react";
import type { AuthUser } from "@/lib/types";

type AuthMode = "login" | "signup";

type AuthPanelProps = {
  onAuthenticated: (user: AuthUser) => void;
};

export default function AuthPanel({ onAuthenticated }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setStatus("");

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password
        })
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "操作失败");

      setEmail("");
      setPassword("");
      if (mode === "signup" && !payload.signedIn) {
        setStatus("注册成功，请直接登录。");
        return;
      }

      setStatus("已登录。");
      if (payload.user) onAuthenticated(payload.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-shell">
      <div className="auth-copy">
        <p className="eyebrow">Account Access</p>
        <h2>先登录，再分析、计费和导出</h2>
        <p>MVP 采用邮箱密码登录，当前关闭邮箱确认，注册后可直接进入。</p>
        <div className="auth-note">
          <CheckCircle2 size={16} />
          允许多端同时登录，后续可再升级权限和账户体系
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>
            登录
          </button>
          <button className={mode === "signup" ? "active" : ""} type="button" onClick={() => setMode("signup")}>
            注册
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label>
            <Mail size={16} />
            <input
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="邮箱"
              required
              type="email"
            />
          </label>
          <label>
            <Lock size={16} />
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="密码"
              required
              type="password"
            />
          </label>

          {error && <p className="auth-error">{error}</p>}
          {status && <p className="auth-success">{status}</p>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? <Loader2 className="spin" size={16} /> : mode === "login" ? <Lock size={16} /> : <UserPlus size={16} />}
            {loading ? "处理中" : mode === "login" ? "登录" : "注册"}
          </button>
        </form>
      </div>
    </section>
  );
}
