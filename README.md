# AI Product Analyst

面向跨境电商内容团队的 Amazon 商品 AI 分析助手。用户输入 Amazon 商品链接后，系统会尝试获取商品信息，并生成产品信息整理、产品分析、短视频中文口播文案和质量检查结果。

这个项目的目标不是做一个简单的“商品页总结器”，而是模拟真实业务里的内容生产工具：当商品页面信息完整时自动分析；当信息获取不完整时，引导用户补充关键事实，再基于补充信息重新分析。

## Online Usage

1. 输入公开 Amazon 商品链接。
2. 点击 `开始分析`。
3. 查看商品信息、产品分析、短视频口播和质量检查。
4. 如果页面提示信息获取不完整，打开 `人工补充模式`，补充商品标题、价格、五点描述、规格或图片链接。
5. 点击 `确认补充并重新分析`，系统会结合初始信息和人工补充信息重新生成结果。

## Core Features

- Amazon 商品链接解析和 ASIN 识别
- 商品信息整理：名称、品类、价格、图片、核心功能、规格参数
- 产品分析：目标用户、使用场景、用户痛点、核心卖点、内容切入角度、购买决策点
- 短视频口播：中文、150 字以内、包含前 5 秒钩子
- 质量检查：口播长度、事实来源、价格核对、夸大表达风险
- 可信度提示：区分页面事实、AI 推断和建议核对字段
- 人工补充模式：页面信息不足时，仍可基于用户补充事实继续分析
- 结果复制：商品概览、产品信息、产品分析、口播文案、质量检查均支持复制

## Design Decisions

题目重点是判断候选人能否把真实业务需求拆成可落地工具，所以本项目将流程拆成：

1. 商品链接解析
2. 商品事实提取
3. 结构化事实整理
4. AI 产品理解
5. 短视频内容生成
6. 质量检查和可信度提示
7. 信息不足时的人工补充与二次分析

这样做的好处是：AI 不直接“凭空生成”，而是先依赖事实层，再进行内容分析。价格、标题、规格等关键事实优先使用页面提取或人工补充的内容，不交给 AI 自行改写。

## Handling Incomplete Amazon Data

Amazon 页面可能因为地区、语言、配送地址、Cookie、验证码或页面动态渲染导致信息不完整。本项目不尝试复杂反爬，而是采用更稳定的业务工具思路：

- 优先自动提取页面标题、价格、图片、五点描述和规格
- 信息不足时展示明显提示，而不是伪装成完整分析
- 严重缺少事实时不生成正式口播，避免内容显得虚假
- 引导用户从商品页复制标题、价格、五点描述、规格或图片链接
- 补充后再次交给 AI 基于事实分析，并继续做质量检查

## AI And Quality Control

AI 模型使用 DeepSeek Chat API。服务端会将商品事实整理成结构化输入，并在提示词中约束：

- 只能基于已提供的商品事实分析
- 不编造销量、排名、认证、医学功效、材质等未提供信息
- 合理推断需要归入分析维度，不能当作商品事实
- 口播文案必须在 150 个中文字以内
- 前 5 秒需要有吸引用户继续观看的钩子

同时系统会进行规则型检查：

- 口播长度是否超出 150 字
- 是否有明确开场钩子
- 商品信息来源是否充分
- 价格是否需要人工核对
- 是否出现明显绝对化或夸大表达

## Tech Stack

- Next.js App Router
- TypeScript
- DeepSeek API
- Vercel

## Local Development

```bash
npm install
npm run dev
```

复制 `.env.example` 为 `.env.local`，填入：

```bash
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

如果未配置 `DEEPSEEK_API_KEY`，应用会返回保守降级结果，方便检查页面流程。

## Vercel Deployment

1. 将代码推送到 GitHub。
2. 在 Vercel 导入该仓库。
3. 在 Project Settings -> Environment Variables 添加：
   - `DEEPSEEK_API_KEY`
   - `DEEPSEEK_BASE_URL`
   - `DEEPSEEK_MODEL`
4. 部署后使用多个公开 Amazon 商品链接测试。

## Project Structure

```txt
app/
  api/analyze/route.ts   API route for extraction and AI analysis
  page.tsx               Main product-analysis workspace
  globals.css            UI styles
lib/
  amazon.ts              Amazon URL parsing and product fact extraction
  deepseek.ts            DeepSeek call, fallback logic, quality checks
  types.ts               Shared TypeScript types
```

## Submission Checklist

- Vercel 部署链接可访问
- GitHub 仓库链接可访问
- Vercel 环境变量已配置
- 使用多个公开 Amazon 商品链接测试
- 测试自动分析、人工补充、重新分析、结果复制
- 检查口播文案是否在 150 字以内
