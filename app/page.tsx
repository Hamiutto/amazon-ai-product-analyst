"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  ClipboardCheck,
  FileSearch,
  ImageIcon,
  LinkIcon,
  Loader2,
  MessageSquareText,
  PenLine,
  ShieldCheck,
  Sparkles,
  Target,
  Users
} from "lucide-react";
import type { AnalyzeResponse, ManualProductInput, QualityCheck } from "@/lib/types";

const sampleUrl = "https://www.amazon.com/dp/B0F6YQ96L5";

const steps = ["解析链接", "获取商品信息", "生成产品分析", "质量检查"];

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
  aside
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          {icon}
          <h2>{title}</h2>
        </div>
        {aside}
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

export default function Home() {
  const [url, setUrl] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState<ManualProductInput>({});
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const scriptCount = useMemo(() => {
    const text = data?.result.script.fullText || "";
    return Array.from(text.replace(/\s+/g, "")).length;
  }, [data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setData(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          manual: showManual ? manual : undefined
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "分析失败");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">Cross-border Ecommerce AI Tool</p>
          <h1>AI 产品分析助手</h1>
        </div>
        <div className="topbar-badge">
          <ShieldCheck size={18} />
          事实约束生成
        </div>
      </header>

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
            <button disabled={loading} type="submit">
              {loading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
              {loading ? "分析中" : "开始分析"}
            </button>
          </div>

          <div className="controls-row">
            <button className="ghost-button" type="button" onClick={() => setUrl(sampleUrl)}>
              填入示例
            </button>
            <label className="toggle">
              <input checked={showManual} onChange={(event) => setShowManual(event.target.checked)} type="checkbox" />
              <span>人工补充模式</span>
            </label>
          </div>

          {showManual && (
            <div className="manual-grid">
              <input
                value={manual.title || ""}
                onChange={(event) => setManual((current) => ({ ...current, title: event.target.value }))}
                placeholder="商品标题"
              />
              <input
                value={manual.price || ""}
                onChange={(event) => setManual((current) => ({ ...current, price: event.target.value }))}
                placeholder="价格"
              />
              <input
                value={manual.category || ""}
                onChange={(event) => setManual((current) => ({ ...current, category: event.target.value }))}
                placeholder="品类"
              />
              <input
                value={manual.imageUrl || ""}
                onChange={(event) => setManual((current) => ({ ...current, imageUrl: event.target.value }))}
                placeholder="商品图片链接"
              />
              <textarea
                value={manual.features || ""}
                onChange={(event) => setManual((current) => ({ ...current, features: event.target.value }))}
                placeholder="五点描述 / 核心卖点"
              />
              <textarea
                value={manual.specs || ""}
                onChange={(event) => setManual((current) => ({ ...current, specs: event.target.value }))}
                placeholder="规格参数，如 Size: 10 x 8 in"
              />
            </div>
          )}
        </form>

        <div className="process-panel">
          {steps.map((step, index) => (
            <div className={`step ${loading && index < 3 ? "active" : data ? "done" : ""}`} key={step}>
              <span>{index + 1}</span>
              {step}
            </div>
          ))}
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
          <section className="product-strip">
            <div className="product-image">
              {data.facts.imageUrl ? <img src={data.facts.imageUrl} alt={data.result.productInfo.name} /> : <ImageIcon size={34} />}
            </div>
            <div className="product-main">
              <div className="product-heading">
                <h2>{data.result.productInfo.name}</h2>
                <StatusPill status={data.facts.sourceStatus} />
              </div>
              <div className="meta-grid">
                <span>ASIN: {data.facts.asin || "未识别"}</span>
                <span>品类: {data.result.productInfo.category}</span>
                <span>价格: {data.result.productInfo.price}</span>
                <span>AI: {data.usedAI ? "DeepSeek" : "降级结果"}</span>
              </div>
            </div>
          </section>

          <div className="grid-two">
            <Section title="产品信息整理" icon={<ClipboardCheck size={20} />} aside={<StatusPill status={data.facts.sourceStatus} />}>
              <div className="sub-block">
                <h3>核心功能</h3>
                <BulletList items={data.result.productInfo.coreFunctions} />
              </div>
              <div className="sub-block">
                <h3>规格参数</h3>
                <BulletList items={data.result.productInfo.specs} />
              </div>
            </Section>

            <Section title="信息来源与可信度" icon={<ShieldCheck size={20} />}>
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

          <Section title="产品分析" icon={<Target size={20} />}>
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
            >
              <div className="script-box">
                <p className="hook">{data.result.script.hook}</p>
                <p>{data.result.script.fullText}</p>
              </div>
              <div className="scene-note">
                <PenLine size={16} />
                {data.result.script.sceneSuggestion}
              </div>
            </Section>

            <Section title="质量检查" icon={<BadgeCheck size={20} />}>
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
    </main>
  );
}
