export type ManualProductInput = {
  title?: string;
  price?: string;
  category?: string;
  features?: string;
  specs?: string;
  imageUrl?: string;
  notes?: string;
};

export type ProductFacts = {
  url: string;
  asin?: string;
  title?: string;
  category?: string;
  price?: string;
  rating?: string;
  reviewCount?: string;
  imageUrl?: string;
  features: string[];
  specs: Record<string, string>;
  description?: string;
  sourceStatus: "complete" | "partial" | "manual" | "failed";
  sourceSummary: string;
  sourceFields: string[];
  missingFields: string[];
};

export type QualityCheck = {
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

export type ProductAnalysisResult = {
  productInfo: {
    name: string;
    category: string;
    price: string;
    coreFunctions: string[];
    specs: string[];
  };
  analysis: {
    targetUsers: string[];
    scenarios: string[];
    painPoints: string[];
    sellingPoints: string[];
    contentAngles: string[];
    purchaseDrivers: string[];
  };
  script: {
    hook: string;
    fullText: string;
    sceneSuggestion: string;
  };
  quality: {
    checks: QualityCheck[];
    riskWarnings: string[];
    unsupportedClaims: string[];
  };
  trust: {
    level: "high" | "medium" | "low";
    factualBasis: string[];
    inferredParts: string[];
    summary: string;
  };
};

export type AnalyzeResponse = {
  facts: ProductFacts;
  result: ProductAnalysisResult;
  usedAI: boolean;
};

export type AnalysisHistorySummary = {
  id: string;
  clientId: string | null;
  url: string;
  asin: string | null;
  productName: string | null;
  imageUrl: string | null;
  sourceStatus: string;
  usedAI: boolean;
  createdAt: string;
};

export type AnalysisHistoryDetail = {
  id: string;
  clientId: string | null;
  createdAt: string;
  facts: ProductFacts;
  result: ProductAnalysisResult;
  usedAI: boolean;
};

export type AuthUser = {
  id: string;
  email: string | null;
};
