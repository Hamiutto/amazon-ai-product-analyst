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

function normalizePrice(value: string) {
  return decodeEntities(stripHtml(value))
    .replace(/\s+/g, " ")
    .replace(/\s*([.,])\s*/g, "$1")
    .trim();
}

function blockFromId(html: string, id: string, size = 16000) {
  const index = html.search(new RegExp(`id=["']${id}["']`, "i"));
  return index >= 0 ? html.slice(index, index + size) : "";
}

function extractPriceFromBlock(block: string) {
  const offscreenCandidates = Array.from(
    block.matchAll(/class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]*(?:S\$|\$|USD|SGD|£|€|¥)[^<]*)<\/span>/gi)
  )
    .map((match) => normalizePrice(match[1]))
    .filter((price) => /\d/.test(price));

  if (offscreenCandidates.length) return offscreenCandidates[0];

  const splitPrice = block.match(
    /class=["'][^"']*a-price-symbol[^"']*["'][^>]*>([\s\S]*?)<\/span>[\s\S]{0,300}?class=["'][^"']*a-price-whole[^"']*["'][^>]*>([\s\S]*?)<\/span>[\s\S]{0,300}?class=["'][^"']*a-price-fraction[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
  );

  if (splitPrice?.[2]) {
    const symbol = normalizePrice(splitPrice[1]).replace(/\s/g, "");
    const whole = normalizePrice(splitPrice[2]).replace(/[^\d,]/g, "");
    const fraction = normalizePrice(splitPrice[3] || "").replace(/[^\d]/g, "");
    return fraction ? `${symbol}${whole}.${fraction}` : `${symbol}${whole}`;
  }

  return "";
}

function extractPrice(html: string) {
  const focusedBlocks = [
    blockFromId(html, "corePriceDisplay_desktop_feature_div"),
    blockFromId(html, "corePrice_feature_div"),
    blockFromId(html, "apex_desktop"),
    blockFromId(html, "buybox"),
    blockFromId(html, "centerCol")
  ].filter(Boolean);

  for (const block of focusedBlocks) {
    const price = extractPriceFromBlock(block);
    if (price) return price;
  }

  return (
    matchFirst(html, [
      /id=["']priceblock_ourprice["'][^>]*>([\s\S]*?)<\/span>/i,
      /id=["']priceblock_dealprice["'][^>]*>([\s\S]*?)<\/span>/i
    ]) || extractPriceFromBlock(html)
  );
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function walkJson(value: unknown, visit: (item: Record<string, unknown>) => void) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item) => walkJson(item, visit));
    return;
  }

  const record = value as Record<string, unknown>;
  visit(record);
  Object.values(record).forEach((item) => walkJson(item, visit));
}

function extractJsonLd(html: string) {
  const data: {
    title?: string;
    price?: string;
    imageUrl?: string;
    description?: string;
    rating?: string;
    reviewCount?: string;
  } = {};

  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const parsed = safeJsonParse(decodeEntities(match[1].trim()));
    walkJson(parsed, (item) => {
      const type = String(item["@type"] || "").toLowerCase();
      if (type && !type.includes("product") && !item.offers && !item.aggregateRating) return;

      if (!data.title && typeof item.name === "string") data.title = decodeEntities(item.name);
      if (!data.description && typeof item.description === "string") data.description = decodeEntities(item.description);
      if (!data.imageUrl) {
        if (typeof item.image === "string") data.imageUrl = item.image;
        if (Array.isArray(item.image) && typeof item.image[0] === "string") data.imageUrl = item.image[0];
      }

      const offers = item.offers as Record<string, unknown> | undefined;
      if (!data.price && offers) {
        const price = typeof offers.price === "string" || typeof offers.price === "number" ? String(offers.price) : "";
        const currency = typeof offers.priceCurrency === "string" ? offers.priceCurrency : "";
        data.price = price ? `${currency ? `${currency} ` : ""}${price}` : undefined;
      }

      const rating = item.aggregateRating as Record<string, unknown> | undefined;
      if (rating) {
        if (!data.rating && rating.ratingValue) data.rating = `${rating.ratingValue} out of 5 stars`;
        if (!data.reviewCount && rating.reviewCount) data.reviewCount = `${rating.reviewCount} ratings`;
      }
    });
  }

  return data;
}

function extractInlineJsonValue(html: string, keys: string[]) {
  for (const key of keys) {
    const match = html.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, "i"));
    if (match?.[1]) return decodeEntities(match[1].replace(/\\\//g, "/"));
  }
  return "";
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

function candidateUrls(url: string) {
  const urls = [url];
  const asin = extractAsin(url);

  try {
    const parsed = new URL(url);
    if (asin) {
      urls.push(`${parsed.protocol}//${parsed.hostname}/dp/${asin}`);
      urls.push(`${parsed.protocol}//${parsed.hostname}/gp/product/${asin}`);
    }
  } catch {
    return urls;
  }

  return Array.from(new Set(urls));
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

async function fetchAmazonHtml(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "upgrade-insecure-requests": "1",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
      }
    });

    return {
      ok: response.ok,
      status: response.status,
      html: response.ok ? await response.text() : ""
    };
  } finally {
    clearTimeout(timer);
  }
}

function scoreFacts(facts: ProductFacts) {
  return [
    facts.title,
    facts.price,
    facts.imageUrl,
    facts.features.length,
    Object.keys(facts.specs).length,
    facts.description,
    facts.rating,
    facts.reviewCount
  ].filter(Boolean).length;
}

function parseAmazonHtml(url: string, html: string, fallback: ProductFacts) {
    const jsonLd = extractJsonLd(html);
    const title = matchFirst(html, [
      /id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i,
      /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
      /<meta\s+name=["']title["']\s+content=["']([^"']+)["']/i,
      /<title>([\s\S]*?)<\/title>/i,
      /data-automation-id=["']title["'][^>]*>([\s\S]*?)<\/span>/i
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
      /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
      /data-old-hires=["']([^"']+)["']/i,
      /"large":"([^"]+)"/i
    ]).replace(/\\\//g, "/") || extractInlineJsonValue(html, ["hiRes", "large", "mainUrl"]);
    const description = matchFirst(html, [
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
      /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i,
      /id=["']productDescription["'][\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i
    ]);
    const category = matchFirst(html, [
      /id=["']wayfinding-breadcrumbs_feature_div["'][\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
      /<a[^>]+class=["'][^"']*a-link-normal a-color-tertiary[^"']*["'][^>]*>([\s\S]*?)<\/a>/i
    ]);

    const featureBlock = html.match(/id=["']feature-bullets["'][\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i)?.[1] || "";
    const aplusBlock = html.match(/id=["']aplus["'][\s\S]*?(?:id=["']important-information["']|<\/body>)/i)?.[0] || "";
    const features = uniqueList([
      ...Array.from(featureBlock.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map((match) => match[1]),
      ...Array.from(aplusBlock.matchAll(/<p[^>]*>([\s\S]{20,260}?)<\/p>/gi)).map((match) => match[1])
    ]);

    const specs: Record<string, string> = {};
    for (const row of html.matchAll(/<tr[^>]*>\s*<t[dh][^>]*>([\s\S]*?)<\/t[dh]>\s*<t[dh][^>]*>([\s\S]*?)<\/t[dh]>\s*<\/tr>/gi)) {
      const key = decodeEntities(stripHtml(row[1]));
      const value = decodeEntities(stripHtml(row[2]));
      if (key && value && Object.keys(specs).length < 8) specs[key] = value;
    }

    const finalTitle = title || jsonLd.title || extractUrlKeywords(url);
    const finalCategory = category || fallback.category || "";
    const finalPrice = price || jsonLd.price || "";
    const finalRating = rating || jsonLd.rating || "";
    const finalReviewCount = reviewCount || jsonLd.reviewCount || "";
    const finalImageUrl = imageUrl || jsonLd.imageUrl || "";
    const finalDescription = description || jsonLd.description || "";

    const sourceFields = [
      finalTitle && (title ? "页面标题" : jsonLd.title ? "结构化标题" : "链接标题"),
      finalCategory && "页面品类",
      finalPrice && (price ? "页面价格" : "结构化价格"),
      finalRating && (rating ? "页面评分" : "结构化评分"),
      finalReviewCount && (reviewCount ? "页面评论数" : "结构化评论数"),
      finalImageUrl && (imageUrl ? "页面图片" : "结构化图片"),
      features.length && "页面五点描述",
      Object.keys(specs).length && "页面规格",
      finalDescription && (description ? "页面描述" : "结构化描述")
    ].filter(Boolean) as string[];

    const missingFields = [
      !finalTitle && "商品名称",
      !finalPrice && "价格",
      !features.length && "核心功能",
      !Object.keys(specs).length && "规格参数",
      !finalImageUrl && "商品图片"
    ].filter(Boolean) as string[];

    const facts: ProductFacts = {
      url,
      asin: extractAsin(url),
      title: finalTitle || undefined,
      category: finalCategory || undefined,
      price: finalPrice || undefined,
      rating: finalRating || undefined,
      reviewCount: finalReviewCount || undefined,
      imageUrl: finalImageUrl || undefined,
      features,
      specs,
      description: finalDescription || undefined,
      sourceStatus: sourceFields.length >= 5 ? "complete" : "partial",
      sourceSummary:
        sourceFields.length >= 5
          ? "已从 Amazon 页面提取主要商品信息。"
          : "Amazon 页面可获取字段有限，系统将进行保守分析，并建议补充商品信息。",
      sourceFields,
      missingFields
    };

    return facts;
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

  let bestFacts: ProductFacts | undefined;
  let lastStatus = 0;

  for (const candidate of candidateUrls(url)) {
    try {
      const response = await fetchAmazonHtml(candidate);
      lastStatus = response.status;
      if (!response.ok || !response.html) continue;

      const facts = parseAmazonHtml(url, response.html, fallback);
      if (!bestFacts || scoreFacts(facts) > scoreFacts(bestFacts)) {
        bestFacts = facts;
      }
      if (scoreFacts(facts) >= 5) break;
    } catch {
      continue;
    }
  }

  if (bestFacts) {
    return mergeManual(bestFacts, manual);
  }

  if (lastStatus) {
    return mergeManual(
      {
        ...fallback,
        sourceStatus: manual ? "manual" : "partial",
        sourceSummary: `Amazon 页面返回 ${lastStatus}，已启用降级分析。`
      },
      manual
    );
  }

  try {
    return mergeManual(fallback, manual);
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
