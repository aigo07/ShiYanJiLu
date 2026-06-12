# AGENTS.md

本文件面向在本仓库中工作的 AI/自动化代理。修改代码前先阅读本文件，并以更近目录中的 `AGENTS.md` 为优先规则。

## 项目概览

ShiYanJiLu 是一个“客户调样合成实验记录系统”MVP。当前生产架构为：

- 前端：React + TypeScript + Vite，部署到 Cloudflare Pages。
- 后端能力：Supabase Auth + Postgres + RLS + RPC/Data API。
- 数据库变更：使用 Supabase CLI migrations，不在 Dashboard 直接改 schema。
- 部署自动化：GitHub Actions 推送 `main` 时先执行 Supabase migrations，再构建并发布 Cloudflare Pages。

旧 FastAPI、Alembic、本地 PostgreSQL、Cookie session、CSRF 和 nginx `/api` 反向代理路径已经移除；不要在新代码或文档中继续引用。

## 目录职责

- `frontend/`：Vite React 应用。
  - `src/main.tsx`：React Router 路由入口和登录保护。
  - `src/app/`：应用壳层、主导航和布局样式。
  - `src/pages/`：页面级组件；大部分业务 UI 在这里。
  - `src/components/`：复用弹窗、图表等组件。
  - `src/lib/supabase.ts`：Supabase client，读取 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。
  - `src/lib/auth.tsx`：认证上下文，使用 Supabase Auth session，并从 `profiles` 读取角色和显示名。
  - `src/lib/data.ts`：业务数据访问层，集中封装 Supabase table/RPC 调用。
  - `src/lib/exportFiles.ts`：前端 CSV/ZIP 导出工具。
  - `src/lib/types.ts`：前端共享类型，保持 snake_case，与 Supabase schema/RPC 结果一致。
- `supabase/`：Supabase 本地项目配置和 migrations。
  - `config.toml`：本地 Supabase CLI 配置。
  - `migrations/`：生产 schema 的唯一来源。
  - `README.md`：本地 Supabase 开发说明。
- `.github/workflows/deploy.yml`：生产部署 workflow。
- `DEPLOYMENT.md`：Cloudflare + Supabase 部署和 secrets 说明。
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
- 页面不要直接拼旧 `/api/...` 路径；使用 `src/lib/data.ts` 中的 typed data-access 函数。
- 导出功能在浏览器端生成文件，不调用服务端导出 endpoint。

### Supabase

- Supabase Auth 负责用户、会话和 token。
- 用户角色和显示名在 `public.profiles`：
  - `admin`
  - `auditor`
  - `editor`
  - `viewer`
- 业务表：
  - `profiles`
  - `process_types`
  - `materials`
  - `curing_agents`
  - `experiments`
  - `records`
  - `audit_events`
- 复杂查询和写操作入口使用 SQL RPC，例如：
  - `list_experiments`
  - `list_records`
  - `curing_agents_with_usage`
  - `experiment_suggestions`
  - `dashboard_stats`
  - `delete_experiment`
  - export rowset RPC
- RLS 是主要权限边界：
  - 已登录用户可读业务主数据、实验、记录、统计。
  - `admin`、`editor` 可写业务表。
  - `admin`、`auditor` 可读审计日志。
  - `audit_events` 禁止客户端直接写，由触发器写入。

### 部署

- Cloudflare Pages project：`shiyanjilu`
- 生产 URL：`https://shiyanjilu.pages.dev`
- Supabase project ref：`tvcfwcjgqkmjsxrnlham`
- Supabase URL：`https://tvcfwcjgqkmjsxrnlham.supabase.co`
- GitHub Actions secrets 详见 `DEPLOYMENT.md`。

## 架构约定

### 数据流

1. 前端使用 Supabase client 直接访问 PostgREST/RPC。
2. Supabase Auth 在浏览器中维护 session。
3. RLS policy 和 SQL function 执行业务权限、校验和审计。
4. 前端业务字段保持 snake_case；不要在局部混用 camelCase 映射。

### Schema 变更

所有数据库结构、policy、trigger、RPC、seed 变更必须：

1. 新增 Supabase migration。
2. 按需更新 `frontend/src/lib/types.ts`。
3. 按需更新 `frontend/src/lib/data.ts`。
4. 跑 `supabase db reset` 验证空库可重建。

不要通过 Dashboard 直接修改生产 schema；Dashboard 只用于查看、创建 Auth 用户、调整 Auth URL 等运维操作。

### 认证与权限

- 登录使用 `supabase.auth.signInWithPassword({ email, password })`。
- 退出使用 `supabase.auth.signOut()`。
- `AuthUser.id` 是 Supabase Auth UUID 字符串。
- `AuthUser.username` 当前使用 email。
- 角色读取自 `public.profiles.role`。
- 首个管理员：先创建 Supabase Auth 用户，再用 SQL 更新 `profiles.role = 'admin'`。

### 审计

- 审计由数据库 trigger/function 写入 `audit_events`。
- 客户端不直接写审计表。
- 写操作需要保留足够的 before/after/diff 信息，方便审计页面查询。

## 本地开发

### Supabase

需要 Supabase CLI 和可用容器运行时。本机可以使用 Docker，也可以使用 Podman 提供的 Docker 兼容 socket。

```powershell
supabase start
supabase db reset
supabase status
```

从 `supabase status` 获取本地 URL 和 publishable/anon key，写入 `frontend/.env`：

```powershell
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local-publishable-or-anon-key>
```

本地 Studio：

```text
http://127.0.0.1:54323
```

创建本地管理员：

```sql
update public.profiles
set role = 'admin', display_name = '管理员'
where email = 'admin@example.com';
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
supabase db reset

cd frontend
npm run lint
npm run build
```

## 部署

生产部署通过 GitHub Actions 执行：

1. `supabase db push --yes`
2. `npm ci`
3. `npm run lint`
4. `npm run build`
5. `wrangler pages deploy dist`

手动发布和 secrets 说明见 `DEPLOYMENT.md`。

## 常见变更指引

### 新增业务表或字段

1. 新增 Supabase migration。
2. 更新 RLS policy、trigger、RPC。
3. 更新 `frontend/src/lib/types.ts`。
4. 更新 `frontend/src/lib/data.ts`。
5. 更新相关页面表单、列表、详情、导出逻辑。
6. 跑本地 `supabase db reset`、`npm run lint`、`npm run build`。

### 修改实验或记录逻辑

- 注意 `experiments.status` 与 `end_at` 的语义：只有 `status == "已结束"` 时 `end_at` 有意义，重新激活应清空。
- 新增记录时，“待开始”实验应自动转为“进行中”。
- 删除实验时应通过 `delete_experiment` RPC 处理 `final_record_id` 与 `records` 外键关系。
- `records.process_type_id` 可覆盖实验默认工艺类型；列表查询应继续使用 RPC 的聚合结果。

### 修改认证或角色

- 同时检查 Supabase migration、RLS policy、`frontend/src/lib/auth.tsx` 和 `frontend/src/lib/data.ts`。
- 不要在前端硬编码越权逻辑；权限边界必须由 RLS/RPC 保证。
- 新角色需要更新 `Role` 类型、RLS/RPC、页面权限展示和文档。

### 修改导出

- 导出数据来源应为 Supabase RPC rowset。
- 文件生成在浏览器端完成。
- 不要重新引入服务端 `/exports` endpoint。

## 代码风格

- 前端使用函数组件和 hooks。
- TypeScript 保持严格可读，避免引入额外状态管理或 UI 框架，除非任务明确需要。
- 保持中文业务文案与现有页面一致。
- 不要混入无关重构；改动应贴近业务需求。
- 新增注释要解释非显然逻辑，不要描述显而易见的赋值或调用。
- 不要提交本地数据库、日志、虚拟环境、`node_modules`、`dist`、`supabase/.temp` 或生产密钥。

## 注意事项

- 旧 FastAPI/Alembic/backend 路径已经删除；不要恢复旧 `/api` fetch 层。
- Cloudflare Pages 使用 `frontend/public/_redirects` 支持 React Router fallback。
- `frontend/.env` 只用于本地开发，不提交。
- `frontend/.env.production.example` 只提供变量名示例，不放真实密钥。
- GitHub Actions secrets 是生产部署凭据来源，不要写入仓库文件。
