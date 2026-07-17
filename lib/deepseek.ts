import { ProductAnalysisResult, ProductFacts, QualityCheck } from "./types";

function hasEnoughFacts(facts: ProductFacts) {
  const hasCoreDescription = facts.features.length > 0 || Boolean(facts.description) || Object.keys(facts.specs).length > 0;
  return Boolean(facts.title && hasCoreDescription);
}

function buildFallbackResult(facts: ProductFacts): ProductAnalysisResult {
  const name = facts.title || facts.asin || "Amazon 商品";
  const enoughFacts = hasEnoughFacts(facts);
  const featureText = facts.features.length
    ? facts.features
    : enoughFacts
      ? ["根据商品页面可见信息梳理核心卖点"]
      : ["请补充商品标题、五点描述或规格后生成分析"];
  const category = facts.category || "待识别品类";

  return {
    productInfo: {
      name,
      category,
      price: facts.price || "页面未获取到价格",
      coreFunctions: featureText.slice(0, 4),
      specs: Object.entries(facts.specs).map(([key, value]) => `${key}: ${value}`).slice(0, 5)
    },
    analysis: {
      targetUsers: enoughFacts ? ["正在寻找该品类解决方案的消费者", "对使用便利性和性价比敏感的用户"] : ["补充商品信息后分析"],
      scenarios: enoughFacts ? ["日常使用场景", "需要快速解决具体痛点的购物场景"] : ["补充商品信息后分析"],
      painPoints: enoughFacts ? ["不知道产品是否适合自己的真实需求", "担心功能描述和实际体验不一致"] : ["补充商品信息后分析"],
      sellingPoints: featureText.slice(0, 4),
      contentAngles: enoughFacts ? ["用一个具体场景切入，展示产品解决问题前后的差异", "围绕用户痛点解释核心功能"] : ["补充商品信息后分析"],
      purchaseDrivers: enoughFacts ? ["功能是否匹配需求", "价格、规格和评价是否支持购买决策"] : ["补充商品信息后分析"]
    },
    script: {
      hook: enoughFacts ? "这个东西适不适合你，先看它解决的痛点。" : "",
      fullText: enoughFacts
        ? `这个东西适不适合你，先看它解决的痛点。${name}主要面向需要${category}解决方案的用户，重点可以从使用场景、核心功能和规格匹配度来看。下单前建议重点确认尺寸、价格和评价是否符合自己的需求。`
        : "",
      sceneSuggestion: enoughFacts ? "先展示使用前的痛点，再切到产品细节和使用效果，最后提醒确认规格。" : "补充商品标题、核心卖点、规格或价格后再生成口播。"
    },
    quality: {
      checks: [],
      riskWarnings: ["当前为降级分析，建议补充商品标题、五点描述和规格后再生成正式内容。"],
      unsupportedClaims: []
    },
    trust: {
      level: enoughFacts && facts.sourceStatus === "complete" ? "medium" : "low",
      factualBasis: facts.sourceFields,
      inferredParts: enoughFacts ? ["目标用户", "使用场景", "内容角度"] : [],
      summary: enoughFacts
        ? "在没有 AI API 或页面信息不足时，系统生成保守版本，避免编造销量、认证和效果承诺。"
        : "当前商品事实严重不足，系统不会生成看似确定的口播或分析。请补充商品信息后重新分析。"
    }
  };
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced || text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON found");
  return JSON.parse(raw.slice(start, end + 1));
}

function chineseLength(value: string) {
  return Array.from(value.replace(/\s+/g, "")).length;
}

function chineseRatio(value: string) {
  const text = value.replace(/\s+/g, "");
  if (!text) return 1;

  const chineseChars = Array.from(text).filter((char) => /[\u4e00-\u9fff]/.test(char)).length;
  const latinWords = text.match(/[A-Za-z]{3,}/g)?.length || 0;
  return chineseChars / Math.max(chineseChars + latinWords, 1);
}

function resultText(value: ProductAnalysisResult) {
  return [
    value.productInfo?.category,
    value.productInfo?.coreFunctions?.join(" "),
    value.productInfo?.specs?.join(" "),
    value.analysis?.targetUsers?.join(" "),
    value.analysis?.scenarios?.join(" "),
    value.analysis?.painPoints?.join(" "),
    value.analysis?.sellingPoints?.join(" "),
    value.analysis?.contentAngles?.join(" "),
    value.analysis?.purchaseDrivers?.join(" "),
    value.script?.hook,
    value.script?.fullText,
    value.script?.sceneSuggestion,
    value.quality?.riskWarnings?.join(" "),
    value.trust?.summary
  ]
    .filter(Boolean)
    .join(" ");
}

function deterministicChecks(result: ProductAnalysisResult, facts: ProductFacts): QualityCheck[] {
  const text = result.script.fullText || "";
  const riskyWords = ["最", "第一", "100%", "永久", "治愈", "保证", "必买", "全网"];
  const hasHook = Boolean(result.script.hook && text.includes(result.script.hook.slice(0, Math.min(8, result.script.hook.length))));
  const length = chineseLength(text);
  const checks: QualityCheck[] = [
    {
      label: "口播长度",
      status: text ? (length <= 150 ? "pass" : "fail") : "warn",
      detail: text ? `当前约 ${length} 字，要求 150 字以内。` : "商品信息不足，暂不生成口播。"
    },
    {
      label: "前 5 秒钩子",
      status: text && (hasHook || result.script.hook) ? "pass" : "warn",
      detail: result.script.hook || "补充商品信息后生成明确开场钩子。"
    },
    {
      label: "事实来源",
      status: facts.sourceFields.length >= 4 || facts.sourceStatus === "manual" ? "pass" : "warn",
      detail: facts.sourceSummary
    },
    {
      label: "价格核对",
      status: facts.price ? "warn" : "fail",
      detail: facts.price
        ? `自动提取价格为 ${facts.price}。Amazon 可能因地区、配送地址和汇率显示不同价格，若与浏览器可见价格不一致，请用人工补充模式覆盖。`
        : "未能稳定提取商品价格，请使用人工补充模式填入页面可见价格。"
    },
    {
      label: "夸大表达",
      status: riskyWords.some((word) => text.includes(word)) ? "warn" : "pass",
      detail: riskyWords.some((word) => text.includes(word)) ? "发现可能需要人工确认的绝对化表达。" : "未发现明显绝对化表达。"
    }
  ];

  return checks;
}

function normalizeResult(value: ProductAnalysisResult, facts: ProductFacts): ProductAnalysisResult {
  const fallback = buildFallbackResult(facts);
  const result: ProductAnalysisResult = {
    productInfo: {
      name: value?.productInfo?.name || fallback.productInfo.name,
      category: value?.productInfo?.category || fallback.productInfo.category,
      price: facts.price || fallback.productInfo.price,
      coreFunctions: value?.productInfo?.coreFunctions?.length ? value.productInfo.coreFunctions : fallback.productInfo.coreFunctions,
      specs: value?.productInfo?.specs?.length ? value.productInfo.specs : fallback.productInfo.specs
    },
    analysis: {
      targetUsers: value?.analysis?.targetUsers?.length ? value.analysis.targetUsers : fallback.analysis.targetUsers,
      scenarios: value?.analysis?.scenarios?.length ? value.analysis.scenarios : fallback.analysis.scenarios,
      painPoints: value?.analysis?.painPoints?.length ? value.analysis.painPoints : fallback.analysis.painPoints,
      sellingPoints: value?.analysis?.sellingPoints?.length ? value.analysis.sellingPoints : fallback.analysis.sellingPoints,
      contentAngles: value?.analysis?.contentAngles?.length ? value.analysis.contentAngles : fallback.analysis.contentAngles,
      purchaseDrivers: value?.analysis?.purchaseDrivers?.length ? value.analysis.purchaseDrivers : fallback.analysis.purchaseDrivers
    },
    script: {
      hook: value?.script?.hook || fallback.script.hook,
      fullText: value?.script?.fullText || fallback.script.fullText,
      sceneSuggestion: value?.script?.sceneSuggestion || fallback.script.sceneSuggestion
    },
    quality: {
      checks: value?.quality?.checks || [],
      riskWarnings: value?.quality?.riskWarnings || [],
      unsupportedClaims: value?.quality?.unsupportedClaims || []
    },
    trust: {
      level: value?.trust?.level || fallback.trust.level,
      factualBasis: value?.trust?.factualBasis?.length ? value.trust.factualBasis : fallback.trust.factualBasis,
      inferredParts: value?.trust?.inferredParts?.length ? value.trust.inferredParts : fallback.trust.inferredParts,
      summary: value?.trust?.summary || fallback.trust.summary
    }
  };

  result.script.fullText = Array.from(result.script.fullText).slice(0, 150).join("");
  const aiChecks = (result.quality.checks || []).filter((check) => !/(价格|售价|price|S\$|\$)/i.test(`${check.label} ${check.detail}`));
  result.quality.checks = [...deterministicChecks(result, facts), ...aiChecks].slice(0, 8);
  if (facts.sourceStatus !== "complete" && !result.quality.riskWarnings.some((item) => item.includes("信息"))) {
    result.quality.riskWarnings.unshift("商品页面信息不完整，建议人工核对后再用于正式投放。");
  }
  return result;
}

export async function analyzeWithDeepSeek(facts: ProductFacts) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  if (!hasEnoughFacts(facts)) {
    return {
      result: normalizeResult(buildFallbackResult(facts), facts),
      usedAI: false
    };
  }

  if (!apiKey) {
    return {
      result: normalizeResult(buildFallbackResult(facts), facts),
      usedAI: false
    };
  }

  const prompt = `
你是跨境电商公司的 AI 产品分析助理。请基于输入的 Amazon 商品事实，生成中文结构化结果。

硬性要求：
1. 只能基于商品事实分析，不要编造销量、排名、认证、医学功效、材质等未提供信息。
2. 如果是合理推断，请放到 inferredParts 或分析维度里，不要当作商品事实。
3. 口播文案必须 150 个中文字以内，前 5 秒要有吸引继续观看的钩子，适合真实短视频带货场景。
4. 产品分析要体现业务理解，不要只复述标题；必须覆盖目标用户、使用场景、用户痛点、核心卖点、内容切入角度、购买决策点。
5. 除商品原始品牌名、型号、ASIN、URL、规格单位外，所有解释性内容、分析内容、质量检查内容和口播文案必须使用简体中文。
6. 返回 JSON，不要 Markdown，不要解释。

商品事实：
${JSON.stringify(facts, null, 2)}

JSON 结构：
{
  "productInfo": {
    "name": "string",
    "category": "string",
    "price": "string",
    "coreFunctions": ["string"],
    "specs": ["string"]
  },
  "analysis": {
    "targetUsers": ["string"],
    "scenarios": ["string"],
    "painPoints": ["string"],
    "sellingPoints": ["string"],
    "contentAngles": ["string"],
    "purchaseDrivers": ["string"]
  },
  "script": {
    "hook": "string",
    "fullText": "string",
    "sceneSuggestion": "string"
  },
  "quality": {
    "checks": [{"label":"string","status":"pass|warn|fail","detail":"string"}],
    "riskWarnings": ["string"],
    "unsupportedClaims": ["string"]
  },
  "trust": {
    "level": "high|medium|low",
    "factualBasis": ["string"],
    "inferredParts": ["string"],
    "summary": "string"
  }
}`;

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "你擅长把跨境电商商品信息拆解成可落地的中文内容生产方案。输出必须是严格 JSON，除品牌名、型号和规格单位外，所有字段内容必须使用简体中文。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.4,
        response_format: { type: "json_object" }
      })
    });
  } catch {
    const fallback = buildFallbackResult(facts);
    fallback.quality.riskWarnings.unshift("AI 接口请求失败，当前展示保守降级结果。");
    return {
      result: normalizeResult(fallback, facts),
      usedAI: false
    };
  }

  if (!response.ok) {
    const fallback = buildFallbackResult(facts);
    fallback.quality.riskWarnings.unshift(`AI 接口返回 ${response.status}，当前展示保守降级结果。`);
    return {
      result: normalizeResult(fallback, facts),
      usedAI: false
    };
  }

  try {
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    let parsed = extractJson(content) as ProductAnalysisResult;
    if (chineseRatio(resultText(parsed)) < 0.35) {
      const repairResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: "把输入 JSON 中除品牌名、型号、ASIN、URL、规格单位以外的所有英文内容改写为自然简体中文。保持相同 JSON 结构，不要 Markdown。"
            },
            {
              role: "user",
              content: JSON.stringify(parsed)
            }
          ],
          temperature: 0.2,
          response_format: { type: "json_object" }
        })
      });

      if (repairResponse.ok) {
        const repairData = await repairResponse.json();
        parsed = extractJson(repairData?.choices?.[0]?.message?.content || "{}") as ProductAnalysisResult;
      }
    }

    return {
      result: normalizeResult(parsed, facts),
      usedAI: true
    };
  } catch {
    const fallback = buildFallbackResult(facts);
    fallback.quality.riskWarnings.unshift("AI 返回格式无法解析，当前展示保守降级结果。");
    return {
      result: normalizeResult(fallback, facts),
      usedAI: false
    };
  }
}
