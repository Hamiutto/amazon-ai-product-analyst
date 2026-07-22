"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Copy, History, Loader2, Trash2 } from "lucide-react";
import type { AnalysisHistoryDetail, AnalysisHistorySummary, AuthUser } from "@/lib/types";

const clientIdStorageKey = "amazon-analyst-client-id";

function getClientId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(clientIdStorageKey) || "";
}

function formatHistoryTime(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function HistoryPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<AnalysisHistorySummary[]>([]);
  const [selected, setSelected] = useState<AnalysisHistoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    const id = getClientId();
    setClientId(id);
    void loadCurrentUser();
    void loadHistory(id);
  }, []);

  async function loadCurrentUser() {
    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "include"
      });
      const payload = (await response.json()) as { user?: AuthUser | null };
      setCurrentUser(payload.user || null);
    } catch {
      setCurrentUser(null);
    }
  }

  async function loadHistory(id = clientId) {
    setLoading(true);
    setError("");
    try {
      const suffix = id ? `?clientId=${encodeURIComponent(id)}&limit=50` : "?limit=50";
      const response = await fetch(`/api/history${suffix}`, { credentials: "include" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "读取历史记录失败");
      setItems(payload.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取历史记录失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(itemId: string) {
    setDetailLoading(true);
    setError("");
    try {
      const suffix = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
      const response = await fetch(`/api/history/${itemId}${suffix}`, { credentials: "include" });
      const payload = (await response.json()) as { item?: AnalysisHistoryDetail; error?: string };
      if (!response.ok || !payload.item) throw new Error(payload.error || "读取历史详情失败");
      setSelected(payload.item);
      setCopiedKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取历史详情失败");
    } finally {
      setDetailLoading(false);
    }
  }

  async function removeHistory(itemId: string) {
    setError("");
    try {
      const suffix = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
      const response = await fetch(`/api/history/${itemId}${suffix}`, {
        method: "DELETE",
        credentials: "include"
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "删除历史记录失败");
      if (selected?.id === itemId) setSelected(null);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除历史记录失败");
    }
  }

  async function copySection(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(""), 1400);
    } catch {
      setError("复制失败，请手动选择文本复制。");
    }
  }

  const productText = selected
    ? [
        "产品信息整理",
        `名称：${selected.result.productInfo.name}`,
        `ASIN：${selected.facts.asin || "未识别"}`,
        `品类：${selected.result.productInfo.category}`,
        `价格：${selected.result.productInfo.price || "未提供"}`,
        "",
        "核心卖点：",
        ...selected.result.analysis.sellingPoints.map((item) => `- ${item}`)
      ].join("\n")
    : "";
  const scriptText = selected
    ? ["短视频口播文案", `钩子：${selected.result.script.hook}`, "", selected.result.script.fullText, "", `拍摄建议：${selected.result.script.sceneSuggestion}`].join("\n")
    : "";
  const markdownText = selected
    ? [
        `# ${selected.result.productInfo.name || selected.facts.asin || "产品分析"}`,
        "",
        `- ASIN: ${selected.facts.asin || "未识别"}`,
        `- 品类: ${selected.result.productInfo.category}`,
        `- 价格: ${selected.result.productInfo.price || "未提供"}`,
        `- AI: ${selected.usedAI ? "DeepSeek" : "降级结果"}`,
        "",
        "## 核心卖点",
        ...selected.result.analysis.sellingPoints.map((item) => `- ${item}`),
        "",
        "## 口播文案",
        selected.result.script.fullText,
        "",
        "## 拍摄建议",
        selected.result.script.sceneSuggestion
      ].join("\n")
    : "";

  return (
    <main className="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">Analysis History</p>
          <h1>历史记录</h1>
        </div>
        <div className="topbar-user">
          {currentUser && <div className="topbar-badge">{currentUser.email || currentUser.id}</div>}
          <Link className="logout-button" href="/">
            <ArrowLeft size={16} />
            返回分析
          </Link>
        </div>
      </header>

      {error && (
        <div className="error-box">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <section className="history-page-layout">
        <aside className="panel history-page-list">
          <div className="history-title">
            <div>
              <History size={18} />
              <h2>全部历史</h2>
            </div>
            <button type="button" onClick={() => loadHistory()} disabled={loading}>
              {loading ? <Loader2 className="spin" size={15} /> : "刷新"}
            </button>
          </div>

          {items.length ? (
            <div className="history-list">
              {items.map((item) => (
                <div className="history-item" key={item.id}>
                  <button type="button" onClick={() => loadDetail(item.id)}>
                    <strong>{item.productName || item.asin || "未命名商品"}</strong>
                    <span>{formatHistoryTime(item.createdAt)} · {item.usedAI ? "AI" : "降级"}</span>
                  </button>
                  <button className="icon-button" type="button" onClick={() => removeHistory(item.id)} aria-label="删除历史记录">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="history-empty">{loading ? "读取历史中..." : "暂无历史记录。"}</p>
          )}
        </aside>

        <section className="panel history-detail-panel">
          {detailLoading ? (
            <p className="history-empty">读取详情中...</p>
          ) : selected ? (
            <>
              <div className="section-title">
                <div>
                  <History size={20} />
                  <h2>{selected.result.productInfo.name || selected.facts.asin || "历史详情"}</h2>
                </div>
                <div className="section-actions">
                  <button className="copy-button" type="button" onClick={() => copySection("product", productText)}>
                    {copiedKey === "product" ? <Check size={15} /> : <Copy size={15} />}
                    {copiedKey === "product" ? "已复制" : "产品信息"}
                  </button>
                  <button className="copy-button" type="button" onClick={() => copySection("script", scriptText)}>
                    {copiedKey === "script" ? <Check size={15} /> : <Copy size={15} />}
                    {copiedKey === "script" ? "已复制" : "口播"}
                  </button>
                  <button className="copy-button" type="button" onClick={() => copySection("markdown", markdownText)}>
                    {copiedKey === "markdown" ? <Check size={15} /> : <Copy size={15} />}
                    {copiedKey === "markdown" ? "已复制" : "Markdown"}
                  </button>
                </div>
              </div>
              <div className="history-detail-grid">
                <span>ASIN: {selected.facts.asin || "未识别"}</span>
                <span>品类: {selected.result.productInfo.category}</span>
                <span>价格: {selected.result.productInfo.price || "未提供"}</span>
                <span>AI: {selected.usedAI ? "DeepSeek" : "降级结果"}</span>
              </div>
              <div className="sub-block">
                <h3>核心卖点</h3>
                <ul className="bullet-list">
                  {selected.result.analysis.sellingPoints.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                </ul>
              </div>
              <div className="sub-block">
                <h3>口播文案</h3>
                <div className="script-box">
                  <p className="hook">{selected.result.script.hook}</p>
                  <p>{selected.result.script.fullText}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="history-empty">选择左侧记录查看详情。</p>
          )}
        </section>
      </section>
    </main>
  );
}
