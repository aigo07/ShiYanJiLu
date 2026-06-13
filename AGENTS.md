# AGENTS.md

本文件面向在本仓库中工作的 AI/自动化代理。修改代码前先阅读本文件，并以更近目录中的 `AGENTS.md` 为优先规则。

## 项目概览

ShiYanJiLu 是一个“客户调样合成实验记录系统”MVP。当前生产架构为：

- 前端：React + TypeScript + Vite，部署到 CloudBase 静态托管。
- 后端能力：CloudBase Auth + CloudBase 云数据库 + CloudBase 普通云函数。
- 数据初始化：通过 `backend/src/seed.ts` 创建集合并写入基础 seed。
- 部署自动化：GitHub Actions 推送 `main` 时先部署 CloudBase 后端，再构建并发布 CloudBase 静态托管。

旧 Supabase、Postgres、RLS、RPC、FastAPI、Alembic、本地 PostgreSQL、Cookie session、CSRF 和 nginx `/api` 反向代理路径已经移除；不要在新代码或文档中继续引用。

## 目录职责

- `frontend/`：Vite React 应用。
  - `src/main.tsx`：React Router 路由入口和登录保护。
  - `src/app/`：应用壳层、主导航和布局样式。
  - `src/pages/`：页面级组件；大部分业务 UI 在这里。
  - `src/components/`：复用弹窗、图表等组件。
  - `src/lib/cloudbase.ts`：CloudBase Web SDK client，读取 `VITE_CLOUDBASE_ENV_ID`、`VITE_CLOUDBASE_REGION` 和可选的 `VITE_CLOUDBASE_ACCESS_KEY`。
  - `src/lib/api.ts`：HTTP API client，读取 `VITE_API_BASE_URL`。
  - `src/lib/auth.tsx`：认证上下文，使用 CloudBase Auth session，并从 `GET /me` 读取角色和显示名。
  - `src/lib/data.ts`：业务数据访问层，集中封装 CloudBase HTTP API 到普通云函数的调用。
  - `src/lib/exportFiles.ts`：前端 CSV/ZIP 导出工具。
  - `src/lib/types.ts`：前端共享类型，保持 snake_case，与 CloudBase API 返回值一致。
- `backend/`：CloudBase 普通云函数。
  - `src/index.ts`：HTTP API 入口、权限校验、业务校验、审计和集合读写。
  - `src/seed.ts`：创建 CloudBase 云数据库集合并写入 `process_types` seed。
  - `cloudbaserc.json`：CloudBase 云函数部署配置，包含普通函数类型、入口和运行时环境变量。
  - `package.json`：后端构建、seed、部署脚本。
- `.github/workflows/deploy.yml`：生产部署 workflow。
- `DEPLOYMENT.md`：CloudBase 后端、静态托管和 secrets 说明。
- `docs/`：产品文档和 MVP backlog。
- `design-system/`：设计系统与页面设计说明。

## 技术栈细节

### 前端

- React `19.x`
- React Router DOM `7.x`
- TypeScript `~6.0`
- Vite `8.x`
- ESLint flat config
- 无全局状态库；认证状态通过 `AuthProvider`，业务数据多在页面内拉取。
- 页面不要直接拼业务请求；使用 `src/lib/data.ts` 中的 typed data-access 函数。
- 导出功能在浏览器端生成文件，数据来源为 CloudBase 普通云函数 API 导出接口。

### CloudBase

- CloudBase Auth 负责用户、会话和 token。
- 用户角色和显示名在 `profiles` 集合：
  - `admin`
  - `auditor`
  - `editor`
  - `viewer`
- 业务集合：
  - `profiles`
  - `process_types`
  - `materials`
  - `curing_agents`
  - `experiments`
  - `records`
  - `audit_events`
- 复杂查询和写操作入口在 `backend/src/index.ts` 中实现，例如：
  - 实验列表过滤
  - 记录列表过滤
  - 固化剂使用次数
  - 实验建议
  - 仪表盘统计
  - 删除实验时级联删除记录
  - 导出 rowset
- API 是主要权限边界：
  - 已登录用户可读业务主数据、实验、记录、统计。
  - `admin`、`editor` 可写业务集合。
  - `admin`、`auditor` 可读审计日志。
  - 客户端不直接写 `audit_events`，由云函数写入。

## 部署

- CloudBase region：`ap-shanghai`
- CloudBase function：`shiyanjilu-api`
- CloudBase static hosting：`shiyanjilu`
- 生产 URL：`https://shiyanjilu-d0gqg419l4e71bc14-1257062913.tcloudbaseapp.com`
- GitHub Actions secrets 详见 `DEPLOYMENT.md`。

## 架构约定

### 数据流

1. 前端使用 CloudBase Web SDK 维护登录态。
2. 前端通过 `VITE_API_BASE_URL` 调用 CloudBase HTTP API，再由 HTTP API 调用普通云函数。
3. 云函数校验 CloudBase Auth 身份、读取 `profiles` 角色并执行权限边界。
4. 云函数读写 CloudBase 云数据库集合。
5. 前端业务字段保持 snake_case；不要在局部混用 camelCase 映射。

### 集合变更

所有集合、业务规则、seed 变更必须：

1. 更新 `backend/src/seed.ts` 或后端集合访问逻辑。
2. 按需更新 `frontend/src/lib/types.ts`。
3. 按需更新 `frontend/src/lib/data.ts`。
4. 跑 `backend npm run build`、`frontend npm run lint`、`frontend npm run build`。

不要重新引入 Supabase migrations、Postgres RLS 或 RPC。

### 认证与权限

- 登录使用 `cloudbaseAuth.signInWithPassword({ email, password })`。
- 退出使用 `cloudbaseAuth.signOut()`。
- `AuthUser.id` 是 CloudBase Auth uid 字符串。
- 角色读取自 `profiles.role`。
- 首个管理员：在 CloudBase Auth 创建用户后，将邮箱加入后端环境变量 `BOOTSTRAP_ADMIN_EMAILS`；首次访问 API 时自动创建 `admin` profile。
- 不要在前端硬编码越权逻辑；权限边界必须由云函数保证。

### 审计

- 审计由 `backend/src/index.ts` 在写操作后写入 `audit_events`。
- 客户端不直接写审计集合。
- 写操作需要保留 before/after/diff 信息，方便审计页面查询。

## 本地开发

### 后端

```powershell
cd backend
npm install
npm run build
```

初始化 CloudBase 集合：

```powershell
$env:CLOUDBASE_ENV_ID = "<cloudbase-env-id>"
$env:TENCENTCLOUD_SECRETID = "<secret-id>"
$env:TENCENTCLOUD_SECRETKEY = "<secret-key>"
npm run seed
```

### 前端

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev -- --host 0.0.0.0 --port 5173
```

默认本地地址：

```text
http://localhost:5173
```

## 验证命令

```powershell
cd backend
npm run build

cd ../frontend
npm run lint
npm run build
```

## 常见变更指引

### 新增业务集合或字段

1. 更新 CloudBase seed 或集合初始化说明。
2. 更新云函数校验、权限和审计逻辑。
3. 更新 `frontend/src/lib/types.ts`。
4. 更新 `frontend/src/lib/data.ts`。
5. 更新相关页面表单、列表、详情、导出逻辑。
6. 跑后端 build、前端 lint 和 build。

### 修改实验或记录逻辑

- 注意 `experiments.status` 与 `end_at` 的语义：只有 `status == "已结束"` 时 `end_at` 有意义，重新激活应清空。
- 新增记录时，“待开始”实验应自动转为“进行中”。
- 删除实验时应通过云函数处理 `final_record_id` 与 `records` 关系。
- `records.process_type_id` 可覆盖实验默认工艺类型；列表查询应继续使用云函数聚合结果。

### 修改导出

- 导出数据来源应为 CloudBase 普通云函数 rowset。
- 文件生成在浏览器端完成。
- 不要重新引入服务端文件生成 endpoint。

## 代码风格

- 前端使用函数组件和 hooks。
- TypeScript 保持严格可读，避免引入额外状态管理或 UI 框架，除非任务明确需要。
- 保持中文业务文案与现有页面一致。
- 不要混入无关重构；改动应贴近业务需求。
- 新增注释要解释非显然逻辑，不要描述显而易见的赋值或调用。
- 不要提交本地数据库、日志、虚拟环境、`node_modules`、`dist`、`backend/dist`、生产密钥或 CloudBase 临时文件。

## 注意事项

- 旧 Supabase/Postgres 路径已经删除；不要恢复旧 Supabase client 或 SQL migration 层。
- CloudBase 静态托管需要把 404 错误文档配置为 `index.html`，用于支持 React Router 子路由刷新。
- `frontend/.env` 只用于本地开发，不提交。
- `frontend/.env.production.example` 只提供变量名示例，不放真实密钥。
- GitHub Actions secrets 是生产部署凭据来源，不要写入仓库文件。
