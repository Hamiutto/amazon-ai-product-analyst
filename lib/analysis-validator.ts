import type { AnalyzeResponse } from "./types";

/**
 * 判断分析结果是否可计费
 * 只有完整有效的分析才扣积分，降级/失败结果不扣分
 */
export function isBillableAnalysis(response: AnalyzeResponse): boolean {
  const { facts, result } = response;

  // 1. 检查数据源状态
  if (facts.sourceStatus === "failed") {
    return false;
  }

  // 2. 检查可信度等级
  if (result.trust.level === "low") {
    return false;
  }

  // 3. 检查有效字段数量
  if (facts.sourceFields.length < 3) {
    return false;
  }

  // 4. 检查缺失字段数量
  if (facts.missingFields.length >= 4) {
    return false;
  }

  // 5. 检查是否有基本的分析结果
  if (
    !result.productInfo.name ||
    !result.analysis.targetUsers.length ||
    !result.analysis.sellingPoints.length ||
    !result.analysis.contentAngles.length
  ) {
    return false;
  }

  // 所有条件都通过，认为是可计费的有效分析
  return true;
}

/**
 * 判断是否需要人工补充信息
 */
export function needsManualSupplement(response: AnalyzeResponse): boolean {
  const { facts, result } = response;

  return (
    facts.sourceStatus !== "manual" &&
    (
      result.trust.level === "low" ||
      facts.sourceFields.length < 3 ||
      facts.missingFields.length >= 4
    )
  );
}
