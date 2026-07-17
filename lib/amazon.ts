import { ManualProductInput, ProductFacts } from "./types";

const AMAZON_ASIN_RE = /(?:\/dp\/|\/gp\/product\/|\/product\/)([A-Z0-9]{10})(?:[/?]|$)/i;

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchFirst(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeEntities(stripHtml(match[1]));
    }
  }
  return "";
}

function extractPrice(html: string) {
  const splitPrice = html.match(
    /class=["'][^"']*a-price-whole[^"']*["'][^>]*>([\s\S]*?)<\/span>\s*<span[^>]*class=["'][^"']*a-price-fraction[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
  );
  if (splitPrice?.[1]) {
    const whole = decodeEntities(stripHtml(splitPrice[1])).replace(/[^\d,.]/g, "");
    const fraction = decodeEntities(stripHtml(splitPrice[2] || "")).replace(/[^\d]/g, "");
    return fraction ? `$${whole}.${fraction}` : `$${whole}`;
  }

  return matchFirst(html, [
    /id=["']priceblock_ourprice["'][^>]*>([\s\S]*?)<\/span>/i,
    /id=["']priceblock_dealprice["'][^>]*>([\s\S]*?)<\/span>/i,
    /class=["'][^"']*a-offscreen[^"']*["'][^>]*>(\$[^<]+)<\/span>/i
  ]);
}

function uniqueList(values: string[]) {
  return Array.from(new Set(values.map((item) => decodeEntities(stripHtml(item))).filter(Boolean))).slice(0, 8);
}

function extractAsin(url: string) {
  const direct = url.match(AMAZON_ASIN_RE)?.[1]?.toUpperCase();
  if (direct) return direct;

  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("asin")?.toUpperCase() || undefined;
  } catch {
    return undefined;
  }
}

function extractUrlKeywords(url: string) {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname
      .split("/")
      .find((part) => part.length > 12 && !/^[A-Z0-9]{10}$/i.test(part));
    if (!segment) return "";
    return decodeURIComponent(segment)
      .replace(/[-_]+/g, " ")
      .replace(/[^\w\s,]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

function manualToFacts(url: string, manual: ManualProductInput, sourceStatus: ProductFacts["sourceStatus"]): ProductFacts {
  const features = manual.features
    ? manual.features
        .split(/\n|；|;/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const specs = manual.specs
    ? Object.fromEntries(
        manual.specs
          .split(/\n|；|;/)
          .map((item) => item.split(/[:：]/))
          .filter((parts) => parts.length >= 2)
          .map(([key, ...rest]) => [key.trim(), rest.join(":").trim()])
      )
    : {};

  const sourceFields = [
    manual.title && "人工补充标题",
    manual.price && "人工补充价格",
    manual.category && "人工补充品类",
    features.length && "人工补充卖点",
    Object.keys(specs).length && "人工补充规格",
    manual.imageUrl && "人工补充图片",
    manual.notes && "人工补充备注"
  ].filter(Boolean) as string[];

  const urlKeywords = extractUrlKeywords(url);

  return {
    url,
    asin: extractAsin(url),
    title: manual.title || urlKeywords || undefined,
    category: manual.category || undefined,
    price: manual.price || undefined,
    imageUrl: manual.imageUrl || undefined,
    features,
    specs,
    description: manual.notes || undefined,
    sourceStatus,
    sourceSummary:
      sourceStatus === "manual"
        ? "使用人工补充信息进行分析。"
        : "自动抓取信息不足，已使用链接可见信息和人工补充内容降级分析。",
    sourceFields,
    missingFields: []
  };
}

function mergeManual(base: ProductFacts, manual?: ManualProductInput): ProductFacts {
  if (!manual) return base;

  const manualFacts = manualToFacts(base.url, manual, base.sourceStatus);
  const features = uniqueList([...base.features, ...manualFacts.features]);
  const specs = { ...base.specs, ...manualFacts.specs };
  const sourceFields = uniqueList([...base.sourceFields, ...manualFacts.sourceFields]);

  return {
    ...base,
    title: manual.title || base.title,
    category: manual.category || base.category,
    price: manual.price || base.price,
    imageUrl: manual.imageUrl || base.imageUrl,
    features,
    specs,
    description: [base.description, manual.notes].filter(Boolean).join("\n") || undefined,
    sourceStatus: sourceFields.some((field) => field.startsWith("人工补充")) ? "manual" : base.sourceStatus,
    sourceSummary: sourceFields.some((field) => field.startsWith("人工补充"))
      ? "结合自动获取信息与人工补充信息进行分析。"
      : base.sourceSummary,
    sourceFields
  };
}

export async function extractAmazonFacts(url: string, manual?: ManualProductInput): Promise<ProductFacts> {
  const fallback = manualToFacts(url, manual || {}, manual ? "manual" : "failed");

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      ...fallback,
      sourceStatus: manual ? "manual" : "failed",
      sourceSummary: "链接格式无法识别，请补充商品信息后再分析。"
    };
  }

  if (!/amazon\./i.test(parsed.hostname)) {
    return {
      ...fallback,
      sourceStatus: manual ? "manual" : "failed",
      sourceSummary: "当前工具面向 Amazon 商品链接，请输入公开 Amazon 商品页。"
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
      }
    });
    clearTimeout(timer);

    if (!response.ok) {
      return mergeManual(
        {
          ...fallback,
          sourceStatus: manual ? "manual" : "partial",
          sourceSummary: `Amazon 页面返回 ${response.status}，已启用降级分析。`
        },
        manual
      );
    }

    const html = await response.text();
    const title = matchFirst(html, [
      /id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i,
      /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
      /<title>([\s\S]*?)<\/title>/i
    ]);
    const price = extractPrice(html);
    const rating = matchFirst(html, [
      /data-hook=["']rating-out-of-text["'][^>]*>([\s\S]*?)<\/span>/i,
      /class=["'][^"']*a-icon-alt[^"']*["'][^>]*>([^<]*out of 5 stars[^<]*)<\/span>/i
    ]);
    const reviewCount = matchFirst(html, [
      /id=["']acrCustomerReviewText["'][^>]*>([\s\S]*?)<\/span>/i,
      /data-hook=["']total-review-count["'][^>]*>([\s\S]*?)<\/span>/i
    ]);
    const imageUrl = matchFirst(html, [
      /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
      /data-old-hires=["']([^"']+)["']/i,
      /"large":"([^"]+)"/i
    ]).replace(/\\\//g, "/");
    const description = matchFirst(html, [
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
      /id=["']productDescription["'][\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i
    ]);
    const category = matchFirst(html, [
      /id=["']wayfinding-breadcrumbs_feature_div["'][\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
      /<a[^>]+class=["'][^"']*a-link-normal a-color-tertiary[^"']*["'][^>]*>([\s\S]*?)<\/a>/i
    ]);

    const featureBlock = html.match(/id=["']feature-bullets["'][\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i)?.[1] || "";
    const features = uniqueList(Array.from(featureBlock.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map((match) => match[1]));

    const specs: Record<string, string> = {};
    for (const row of html.matchAll(/<tr[^>]*>\s*<t[dh][^>]*>([\s\S]*?)<\/t[dh]>\s*<t[dh][^>]*>([\s\S]*?)<\/t[dh]>\s*<\/tr>/gi)) {
      const key = decodeEntities(stripHtml(row[1]));
      const value = decodeEntities(stripHtml(row[2]));
      if (key && value && Object.keys(specs).length < 8) specs[key] = value;
    }

    const sourceFields = [
      title && "页面标题",
      category && "页面品类",
      price && "页面价格",
      rating && "页面评分",
      reviewCount && "页面评论数",
      imageUrl && "页面图片",
      features.length && "页面五点描述",
      Object.keys(specs).length && "页面规格",
      description && "页面描述"
    ].filter(Boolean) as string[];

    const missingFields = [
      !title && "商品名称",
      !price && "价格",
      !features.length && "核心功能",
      !Object.keys(specs).length && "规格参数",
      !imageUrl && "商品图片"
    ].filter(Boolean) as string[];

    const facts: ProductFacts = {
      url,
      asin: extractAsin(url),
      title: title || extractUrlKeywords(url) || undefined,
      category: category || undefined,
      price: price || undefined,
      rating: rating || undefined,
      reviewCount: reviewCount || undefined,
      imageUrl: imageUrl || undefined,
      features,
      specs,
      description: description || undefined,
      sourceStatus: sourceFields.length >= 5 ? "complete" : "partial",
      sourceSummary:
        sourceFields.length >= 5
          ? "已从 Amazon 页面提取主要商品信息。"
          : "Amazon 页面可获取字段有限，系统将进行保守分析，并建议补充商品信息。",
      sourceFields,
      missingFields
    };

    return mergeManual(facts, manual);
  } catch {
    return mergeManual(
      {
        ...fallback,
        sourceStatus: manual ? "manual" : "partial",
        sourceSummary: "Amazon 页面可能存在反爬或网络限制，已启用降级分析。"
      },
      manual
    );
  }
}
