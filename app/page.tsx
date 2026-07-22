"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  ClipboardCheck,
  Copy,
  FileSearch,
  History,
  ImageIcon,
  LinkIcon,
  Loader2,
  LogOut,
  MessageSquareText,
  PenLine,
  Trash2,
  ShieldCheck,
  Sparkles,
  Target,
  Users
} from "lucide-react";
import AuthPanel from "@/components/auth-panel";
import type { AnalysisHistoryDetail, AnalysisHistorySummary, AnalyzeResponse, AuthUser, ManualProductInput, QualityCheck } from "@/lib/types";

const sampleUrl = "https://www.amazon.com/dp/B0F6YQ96L5";
const clientIdStorageKey = "amazon-analyst-client-id";
const steps = ["解析链接", "获取商品信息", "生成产品分析", "质量检查"];
const currencyOptions = [
  { value: "auto", label: "自动识别" },
  { value: "S$", label: "新加坡币 S$" },
  { value: "$", label: "美元 $" },
  { value: "US$", label: "美元 US$" },
  { value: "HK$", label: "港币 HK$" },
  { value: "€", label: "欧元 €" },
  { value: "£", label: "英镑 £" },
  { value: "¥", label: "日元 ¥" }
];

function factsToManual(facts?: AnalyzeResponse["facts"]): ManualProductInput {
  if (!facts) return {};

  return {
    title: facts.title || "",
    price: splitPriceParts(facts.price).amount,
    category: facts.category || "",
    imageUrl: facts.imageUrl || "",
    features: facts.features.join("\n"),
    specs: Object.entries(facts.specs)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n"),
    notes: facts.description || ""
  };
}

function splitPriceParts(price?: string) {
  const trimmed = price?.trim() || "";
  const match = trimmed.match(/^(S\$|HK\$|US\$|\$|€|£|¥)?\s*([\d,]+(?:\.\d+)?)$/i);

  if (!match) {
    return { currency: "auto", amount: trimmed };
  }

  return {
    currency: match[1] ? match[1].toUpperCase() : "auto",
    amount: match[2]
  };
}

function composeManualPrice(amount?: string, currency = "auto") {
  const trimmed = amount?.trim() || "";
  if (!trimmed) return "";

  const parsed = splitPriceParts(trimmed);
  if (parsed.currency !== "auto" && parsed.amount) return `${parsed.currency}${parsed.amount}`;

  return currency === "auto" ? parsed.amount || trimmed : `${currency}${parsed.amount || trimmed}`;
}

function hasManualInput(manual: ManualProductInput) {
  return Object.values(manual).some((value) => Boolean(value?.trim()));
}

function StatusPill({ status }: { status?: string }) {
  const label =
    status === "complete"
      ? "信息较完整"
      : status === "manual"
        ? "含人工补充"
        : status === "partial"
          ? "降级分析"
          : "待核对";

  return <span className={`status-pill status-${status || "failed"}`}>{label}</span>;
}

function Section({
  title,
  icon,
  children,
  aside,
  copyText,
  copied,
  onCopy
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
  copyText?: string;
  copied?: boolean;
  onCopy?: (text: string) => void;
}) {
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          {icon}
          <h2>{title}</h2>
        </div>
        <div className="section-actions">
          {aside}
          {copyText && onCopy && (
            <button className="copy-button" type="button" onClick={() => onCopy(copyText)}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "已复制" : "复制"}
            </button>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function TagList({ items, tone = "neutral" }: { items?: string[]; tone?: "neutral" | "accent" | "risk" }) {
  if (!items?.length) return <p className="empty">暂无可展示信息</p>;
  return (
    <div className="tag-list">
      {items.map((item, index) => (
        <span className={`tag tag-${tone}`} key={`${item}-${index}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function BulletList({ items }: { items?: string[] }) {
  if (!items?.length) return <p className="empty">暂无可展示信息</p>;
  return (
    <ul className="bullet-list">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function CheckRow({ check }: { check: QualityCheck }) {
  const Icon = check.status === "pass" ? BadgeCheck : AlertTriangle;
  return (
    <div className={`check-row check-${check.status}`}>
      <Icon size={18} />
      <div>
        <strong>{check.label}</strong>
        <p>{check.detail}</p>
      </div>
    </div>
  );
}

function getClientId() {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem(clientIdStorageKey);
  if (existing) return existing;

  const value = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(clientIdStorageKey, value);
  return value;
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

export default function Home() {
  const [url, setUrl] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualCurrency, setManualCurrency] = useState("auto");
  const [manualDraft, setManualDraft] = useState<ManualProductInput>({});
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");
  const [clientId, setClientId] = useState("");
  const [historyItems, setHistoryItems] = useState<AnalysisHistorySummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyNotice, setHistoryNotice] = useState("");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const skipNextUrlResetRef = useRef(false);

  const scriptCount = useMemo(() => {
    const text = data?.result.script.fullText || "";
    return Array.from(text.replace(/\s+/g, "")).length;
  }, [data]);

  useEffect(() => {
    void loadCurrentUser();
  }, []);

  useEffect(() => {
    const id = getClientId();
    setClientId(id);
  }, []);

  useEffect(() => {
    if (!clientId) return;
    void loadHistory(clientId);
  }, [clientId]);

  useEffect(() => {
    if (skipNextUrlResetRef.current) {
      skipNextUrlResetRef.current = false;
      return;
    }

    setManualDraft({});
    setManualCurrency("auto");
    setShowManual(false);
    setCopiedKey("");
    setData(null);
  }, [url]);

  useEffect(() => {
    if (!showManual || !data) return;

    setManualDraft((current) => {
      const hasAnyValue = Object.values(current).some((value) => Boolean(value));
      if (hasAnyValue) return current;

      const parsed = splitPriceParts(data.facts.price);
      setManualCurrency(parsed.currency);
      return factsToManual(data.facts);
    });
  }, [showManual, data]);

  async function runAnalysis(manualOverride?: ManualProductInput) {
    const id = clientId || getClientId();
    if (!id) {
      setError("未能生成历史记录标识，请刷新页面后重试。");
      return;
    }
    if (!clientId) setClientId(id);

    setLoading(true);
    setError("");
    setHistoryNotice("");
    setData(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          url,
          manual: manualOverride,
          clientId: id
        })
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "分析失败");
      setData(payload);
      if (typeof payload.credits === "number") {
        setCurrentUser((current) => (current ? { ...current, credits: payload.credits } : current));
      }
      await loadHistory(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadCurrentUser() {
    setAuthLoading(true);
    try {
      const response = await fetch("/api/auth/me", { 
        cache: "no-store",
        credentials: 'include'
      });
      const payload = (await response.json()) as { user?: AuthUser | null };
      setCurrentUser(payload.user || null);
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const manualOverride = buildManualOverride();
    await runAnalysis(manualOverride);
  }

  async function confirmManual() {
    await runAnalysis(buildManualOverride());
  }

  async function loadHistory(id = clientId) {
    if (!id) return;

    setHistoryLoading(true);
    setHistoryNotice("");
    try {
      const response = await fetch(`/api/history?clientId=${encodeURIComponent(id)}`, {
        credentials: 'include'
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "读取历史记录失败");
      setHistoryItems(payload.items || []);
    } catch (err) {
      setHistoryNotice(err instanceof Error ? err.message : "读取历史记录失败");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function restoreHistory(itemId: string) {
    if (!clientId) return;

    setHistoryLoading(true);
    setHistoryNotice("");
    try {
      const response = await fetch(`/api/history/${itemId}?clientId=${encodeURIComponent(clientId)}`, {
        credentials: 'include'
      });
      const payload = (await response.json()) as {
        item?: AnalysisHistoryDetail;
        error?: string;
      };

      if (!response.ok || !payload.item) throw new Error(payload.error || "读取历史详情失败");

      skipNextUrlResetRef.current = true;
      setUrl(payload.item.facts.url);
      setData({
        facts: payload.item.facts,
        result: payload.item.result,
        usedAI: payload.item.usedAI
      });
      setShowManual(false);
      setCopiedKey("");
    } catch (err) {
      setHistoryNotice(err instanceof Error ? err.message : "读取历史详情失败");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function removeHistory(itemId: string) {
    if (!clientId) return;

    setHistoryLoading(true);
    setHistoryNotice("");
    try {
      const response = await fetch(`/api/history/${itemId}?clientId=${encodeURIComponent(clientId)}`, {
        method: "DELETE",
        credentials: 'include'
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "删除历史记录失败");
      await loadHistory(clientId);
    } catch (err) {
      setHistoryNotice(err instanceof Error ? err.message : "删除历史记录失败");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { 
        method: "POST",
        credentials: 'include'
      });
    } finally {
      setCurrentUser(null);
      setData(null);
      setError("");
      setHistoryNotice("");
      setShowManual(false);
      setCopiedKey("");
    }
  }

  function buildManualOverride() {
    if (!showManual) return undefined;

    const manualOverride = {
      ...manualDraft,
      price: composeManualPrice(manualDraft.price, manualCurrency)
    };

    return hasManualInput(manualOverride) ? manualOverride : undefined;
  }

  const displayPrice = data?.result.productInfo.price || "未提供";
  const productSummaryText = data
    ? [
        `商品名称：${data.result.productInfo.name}`,
        `ASIN：${data.facts.asin || "未识别"}`,
        `品类：${data.result.productInfo.category}`,
        `价格：${displayPrice}`,
        `链接：${data.facts.url}`
      ].join("\n")
    : "";
  const productInfoText = data
    ? [
        "产品信息整理",
        `名称：${data.result.productInfo.name}`,
        `品类：${data.result.productInfo.category}`,
        `价格：${displayPrice}`,
        "",
        "核心功能：",
        ...data.result.productInfo.coreFunctions.map((item) => `- ${item}`),
        "",
        "规格参数：",
        ...(data.result.productInfo.specs.length ? data.result.productInfo.specs.map((item) => `- ${item}`) : ["- 暂无"])
      ].join("\n")
    : "";
  const trustText = data
    ? [
        "信息来源与可信度",
        `可信度：${data.result.trust.level.toUpperCase()}`,
        data.result.trust.summary,
        "",
        "已获取字段：",
        ...(data.facts.sourceFields.length ? data.facts.sourceFields.map((item) => `- ${item}`) : ["- 暂无"]),
        "",
        "建议核对字段：",
        ...(data.facts.missingFields.length ? data.facts.missingFields.map((item) => `- ${item}`) : ["- 暂无"])
      ].join("\n")
    : "";
  const analysisText = data
    ? [
        "产品分析",
        "",
        "目标用户：",
        ...data.result.analysis.targetUsers.map((item) => `- ${item}`),
        "",
        "使用场景：",
        ...data.result.analysis.scenarios.map((item) => `- ${item}`),
        "",
        "用户痛点：",
        ...data.result.analysis.painPoints.map((item) => `- ${item}`),
        "",
        "核心卖点：",
        ...data.result.analysis.sellingPoints.map((item) => `- ${item}`),
        "",
        "内容切入角度：",
        ...data.result.analysis.contentAngles.map((item) => `- ${item}`),
        "",
        "购买决策点：",
        ...data.result.analysis.purchaseDrivers.map((item) => `- ${item}`)
      ].join("\n")
    : "";
  const scriptText = data
    ? ["短视频口播文案", `钩子：${data.result.script.hook}`, "", data.result.script.fullText, "", `拍摄建议：${data.result.script.sceneSuggestion}`].join("\n")
    : "";
  const qualityText = data
    ? [
        "质量检查",
        ...data.result.quality.checks.map((check) => `- ${check.label}：${check.detail}`),
        "",
        "风险提示：",
        ...(data.result.quality.riskWarnings.length ? data.result.quality.riskWarnings.map((item) => `- ${item}`) : ["- 暂无"])
      ].join("\n")
    : "";

  async function copySection(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(""), 1400);
    } catch {
      setError("复制失败，请手动选择文本复制。");
    }
  }

  const needsSupplement = data
    ? data.facts.sourceStatus !== "manual" &&
      (data.result.trust.level === "low" || data.facts.sourceFields.length < 3 || data.facts.missingFields.length >= 4)
    : false;
  const credits = currentUser?.credits;
  const hasCredits = typeof credits !== "number" || credits > 0;

  function openManualFromWarning() {
    if (!data) return;

    setShowManual(true);
    setManualDraft(factsToManual(data.facts));
    setManualCurrency(splitPriceParts(data.facts.price).currency);
  }

  if (authLoading) {
    return (
      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Cross-border Ecommerce AI Tool</p>
            <h1>AI 产品分析助手</h1>
          </div>
          <div className="topbar-badge">
            <Loader2 className="spin" size={18} />
            正在检查登录状态
          </div>
        </header>
      </main>
    );
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">Cross-border Ecommerce AI Tool</p>
          <h1>AI 产品分析助手</h1>
        </div>
        {currentUser ? (
          <div className="topbar-user">
            <div className="topbar-badge">
              <ShieldCheck size={18} />
              {currentUser.email || currentUser.id}
            </div>
            <div className="topbar-badge credit-badge">积分 {typeof credits === "number" ? credits : "--"}</div>
            <button className="logout-button" type="button" onClick={logout}>
              <LogOut size={16} />
              退出
            </button>
          </div>
        ) : (
          <div className="topbar-badge">
            <ShieldCheck size={18} />
            未登录
          </div>
        )}
      </header>

      {!currentUser ? (
        <AuthPanel onAuthenticated={setCurrentUser} />
      ) : (
        <>
          <section className="command-band">
            <form onSubmit={submit} className="input-panel">
              <label htmlFor="url">Amazon 商品链接</label>
              <div className="url-row">
                <LinkIcon size={20} />
                <input
                  id="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder={sampleUrl}
                  required
                />
                <button disabled={loading || !hasCredits} type="submit">
                  {loading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
                  {loading ? "分析中" : !hasCredits ? "积分不足" : showManual && data ? "重新分析" : "开始分析"}
                </button>
              </div>

              <div className="controls-row">
                <button className="ghost-button" type="button" onClick={() => setUrl(sampleUrl)}>
                  填入示例
                </button>
                <span className="credit-hint">每次成功分析扣 1 积分，当前剩余 {typeof credits === "number" ? credits : "--"}</span>
                <label className="toggle">
                  <input checked={showManual} onChange={(event) => setShowManual(event.target.checked)} type="checkbox" />
                  <span>人工补充模式</span>
                </label>
              </div>

              {showManual && (
                <>
                  <div className="manual-help">
                    <p>首轮结果如果有误，就在这里修正。改完后点“确认补充并重新分析”，系统会把补充内容直接带入下一轮分析。</p>
                    {data && (
                      <button type="button" className="ghost-button" onClick={() => {
                        setManualDraft(factsToManual(data.facts));
                        setManualCurrency(splitPriceParts(data.facts.price).currency);
                      }}>
                        用当前结果预填
                      </button>
                    )}
                  </div>

                  <div className="manual-grid">
                    <input
                      value={manualDraft.title || ""}
                      onChange={(event) => setManualDraft((current) => ({ ...current, title: event.target.value }))}
                      placeholder="商品标题"
                    />

                    <div className="price-field">
                      <input
                        value={manualDraft.price || ""}
                        onChange={(event) => setManualDraft((current) => ({ ...current, price: event.target.value }))}
                        placeholder="价格金额"
                      />
                      <select value={manualCurrency} onChange={(event) => setManualCurrency(event.target.value)}>
                        {currencyOptions.map((option) => (
                          <option value={option.value} key={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="price-hint">
                        最终显示：{composeManualPrice(manualDraft.price, manualCurrency) || "未填写"}
                      </p>
                    </div>

                    <input
                      value={manualDraft.category || ""}
                      onChange={(event) => setManualDraft((current) => ({ ...current, category: event.target.value }))}
                      placeholder="品类"
                    />
                    <input
                      value={manualDraft.imageUrl || ""}
                      onChange={(event) => setManualDraft((current) => ({ ...current, imageUrl: event.target.value }))}
                      placeholder="商品图片链接"
                    />
                    <textarea
                      value={manualDraft.features || ""}
                      onChange={(event) => setManualDraft((current) => ({ ...current, features: event.target.value }))}
                      placeholder="五点描述 / 核心卖点"
                    />
                    <textarea
                      value={manualDraft.specs || ""}
                      onChange={(event) => setManualDraft((current) => ({ ...current, specs: event.target.value }))}
                      placeholder="规格参数，如 Size: 10 x 8 in"
                    />
                  </div>

                  <div className="manual-actions">
                    <button className="confirm-button" type="button" disabled={loading || !url || !hasCredits} onClick={confirmManual}>
                      {loading ? "重新分析中" : !hasCredits ? "积分不足" : data ? "确认补充并重新分析" : "确认并开始分析"}
                    </button>
                  </div>
                </>
              )}
            </form>

            <div className="side-rail">
              <div className="process-panel">
                {steps.map((step, index) => (
                  <div className={`step ${loading && index < 3 ? "active" : data ? "done" : ""}`} key={step}>
                    <span>{index + 1}</span>
                    {step}
                  </div>
                ))}
              </div>

              <aside className="history-panel">
                <div className="history-title">
                  <div>
                    <History size={18} />
                    <h2>最近历史</h2>
                  </div>
                  <button type="button" onClick={() => loadHistory()} disabled={historyLoading || !clientId}>
                    {historyLoading ? <Loader2 className="spin" size={15} /> : "刷新"}
                  </button>
                </div>

                {historyNotice && (
                  <p className="history-notice">
                    <AlertTriangle size={14} />
                    {historyNotice}
                  </p>
                )}

                {historyItems.length ? (
                  <div className="history-list">
                    {historyItems.map((item) => (
                      <div className="history-item" key={item.id}>
                        <button type="button" onClick={() => restoreHistory(item.id)}>
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
                  <p className="history-empty">{historyLoading ? "读取历史中..." : "完成一次分析后会自动保存。"}</p>
                )}
              </aside>
            </div>
          </section>

          {error && (
            <div className="error-box">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          {!data && !loading && (
            <section className="empty-state">
              <FileSearch size={32} />
              <h2>等待商品分析</h2>
              <p>结果会拆分为商品事实、产品理解、短视频口播、质量检查和可信度提示。</p>
            </section>
          )}

          {data && (
            <div className="result-layout">
              {needsSupplement && (
                <section className="recovery-panel">
                  <div>
                    <strong>商品信息获取不完整，需要补充后再生成正式分析</strong>
                    <p>当前只获取到少量商品信息，你可以从商品页复制标题、价格、五点描述、规格或图片链接，补充后会结合初始信息重新分析。</p>
                  </div>
                  <button type="button" onClick={openManualFromWarning}>
                    打开人工补充
                  </button>
                </section>
              )}

              <section className="product-strip">
                <div className="product-image">
                  {data.facts.imageUrl ? <img src={data.facts.imageUrl} alt={data.result.productInfo.name} /> : <ImageIcon size={34} />}
                </div>
                <div className="product-main">
                  <div className="product-heading">
                    <h2>{data.result.productInfo.name}</h2>
                    <div className="product-actions">
                      <StatusPill status={data.facts.sourceStatus} />
                      <button className="copy-button" type="button" onClick={() => copySection("summary", productSummaryText)}>
                        {copiedKey === "summary" ? <Check size={15} /> : <Copy size={15} />}
                        {copiedKey === "summary" ? "已复制" : "复制概览"}
                      </button>
                    </div>
                  </div>
                  <div className="meta-grid">
                    <span>ASIN: {data.facts.asin || "未识别"}</span>
                    <span>品类: {data.result.productInfo.category}</span>
                    <span>价格: {displayPrice}</span>
                    <span>AI: {data.usedAI ? "DeepSeek" : "降级结果"}</span>
                  </div>
                </div>
              </section>

              <div className="grid-two">
                <Section
                  title="产品信息整理"
                  icon={<ClipboardCheck size={20} />}
                  aside={<StatusPill status={data.facts.sourceStatus} />}
                  copyText={productInfoText}
                  copied={copiedKey === "product"}
                  onCopy={(text) => copySection("product", text)}
                >
                  <div className="sub-block">
                    <h3>核心功能</h3>
                    <BulletList items={data.result.productInfo.coreFunctions} />
                  </div>
                  <div className="sub-block">
                    <h3>规格参数</h3>
                    <BulletList items={data.result.productInfo.specs} />
                  </div>
                </Section>

                <Section
                  title="信息来源与可信度"
                  icon={<ShieldCheck size={20} />}
                  copyText={trustText}
                  copied={copiedKey === "trust"}
                  onCopy={(text) => copySection("trust", text)}
                >
                  <div className={`trust-meter trust-${data.result.trust.level}`}>
                    <strong>{data.result.trust.level.toUpperCase()}</strong>
                    <p>{data.result.trust.summary}</p>
                  </div>
                  <div className="sub-block">
                    <h3>已获取字段</h3>
                    <TagList items={data.facts.sourceFields} tone="accent" />
                  </div>
                  {!!data.facts.missingFields.length && (
                    <div className="sub-block">
                      <h3>建议核对字段</h3>
                      <TagList items={data.facts.missingFields} tone="risk" />
                    </div>
                  )}
                </Section>
              </div>

              <Section
                title="产品分析"
                icon={<Target size={20} />}
                copyText={analysisText}
                copied={copiedKey === "analysis"}
                onCopy={(text) => copySection("analysis", text)}
              >
                <div className="analysis-grid">
                  <div>
                    <h3>
                      <Users size={16} />
                      目标用户
                    </h3>
                    <BulletList items={data.result.analysis.targetUsers} />
                  </div>
                  <div>
                    <h3>使用场景</h3>
                    <BulletList items={data.result.analysis.scenarios} />
                  </div>
                  <div>
                    <h3>用户痛点</h3>
                    <BulletList items={data.result.analysis.painPoints} />
                  </div>
                  <div>
                    <h3>核心卖点</h3>
                    <BulletList items={data.result.analysis.sellingPoints} />
                  </div>
                  <div>
                    <h3>内容切入角度</h3>
                    <BulletList items={data.result.analysis.contentAngles} />
                  </div>
                  <div>
                    <h3>购买决策点</h3>
                    <BulletList items={data.result.analysis.purchaseDrivers} />
                  </div>
                </div>
              </Section>

              <div className="grid-two">
                <Section
                  title="短视频口播文案"
                  icon={<MessageSquareText size={20} />}
                  aside={<span className={scriptCount <= 150 ? "count-ok" : "count-bad"}>{scriptCount}/150</span>}
                  copyText={needsSupplement ? undefined : scriptText}
                  copied={copiedKey === "script"}
                  onCopy={(text) => copySection("script", text)}
                >
                  {needsSupplement ? (
                    <div className="script-placeholder">
                      <strong>暂不生成口播</strong>
                      <p>商品标题、卖点或规格不足时生成口播容易失真。补充商品信息并重新分析后，这里会生成可直接使用的 150 字以内短视频文案。</p>
                      <button type="button" onClick={openManualFromWarning}>
                        补充信息后生成
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="script-box">
                        <p className="hook">{data.result.script.hook}</p>
                        <p>{data.result.script.fullText}</p>
                      </div>
                      <div className="scene-note">
                        <PenLine size={16} />
                        {data.result.script.sceneSuggestion}
                      </div>
                    </>
                  )}
                </Section>

                <Section
                  title="质量检查"
                  icon={<BadgeCheck size={20} />}
                  copyText={qualityText}
                  copied={copiedKey === "quality"}
                  onCopy={(text) => copySection("quality", text)}
                >
                  <div className="checks">
                    {data.result.quality.checks.map((check, index) => (
                      <CheckRow check={check} key={`${check.label}-${index}`} />
                    ))}
                  </div>
                  {!!data.result.quality.riskWarnings.length && (
                    <div className="sub-block">
                      <h3>风险提示</h3>
                      <TagList items={data.result.quality.riskWarnings} tone="risk" />
                    </div>
                  )}
                </Section>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
