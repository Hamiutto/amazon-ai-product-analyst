# AI Product Analyst

一个面向跨境电商内容团队的 Amazon 商品 AI 分析助手。输入公开 Amazon 商品链接后，工具会提取商品信息，生成产品理解、短视频中文口播文案，并展示质量检查和可信度提示。

## Features

- Amazon 商品链接分析
- 商品信息整理：名称、品类、价格、图片、核心功能、规格参数
- 产品分析：目标用户、使用场景、用户痛点、核心卖点、内容切入角度、购买决策点
- 短视频口播：中文、150 字以内、包含前 5 秒钩子
- 质量检查：长度、钩子、事实来源、夸大表达风险
- 可信度提示：区分页面事实、AI 推断和需要人工核对的字段
- 人工补充模式：当 Amazon 页面存在反爬或字段缺失时，仍可基于人工粘贴信息完成分析

## Why This Design

题目重点不是简单总结商品页，而是判断工具是否能支持真实业务场景。因此本项目将流程拆成：

1. 商品信息获取
2. 结构化事实整理
3. 基于事实的产品理解
4. 短视频内容生成
5. 内容质量检查
6. 信息可信度提示

这样可以减少 AI 幻觉，也更贴近跨境电商团队内部工具的实际使用方式。

## Tech Stack

- Next.js App Router
- TypeScript
- DeepSeek API
- Vercel 部署

## Local Development

```bash
npm install
npm run dev
```

复制 `.env.example` 为 `.env.local`，填入 DeepSeek API Key：

```bash
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

如果未配置 `DEEPSEEK_API_KEY`，应用会返回保守降级结果，方便本地检查页面流程。

## Vercel Deployment

1. 将代码推送到 GitHub。
2. 在 Vercel 导入该仓库。
3. 在 Project Settings -> Environment Variables 添加：
   - `DEEPSEEK_API_KEY`
   - `DEEPSEEK_BASE_URL`
   - `DEEPSEEK_MODEL`
4. 部署后使用多个 Amazon 商品链接测试。

## Notes On Amazon Pages

Amazon 页面可能因为地区、反爬、Cookie 或验证码导致字段不完整。本项目没有硬做复杂反爬，而是使用业务工具更可控的降级方案：

- 优先自动提取页面标题、价格、图片、五点描述、规格等字段
- 字段不足时展示“降级分析”和“建议核对字段”
- 支持人工补充标题、卖点、规格、价格和图片链接
- AI 生成时要求基于已获取事实，不编造销量、认证、排名或功效

## Submission Checklist

- Vercel 部署链接可访问
- GitHub 仓库链接可访问
- Vercel 环境变量已配置
- 使用至少 2-3 个不同公开 Amazon 商品链接测试
- 检查口播文案是否在 150 字以内
