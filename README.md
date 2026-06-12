# ShiYanJiLu

客户调样合成实验记录系统 MVP。

当前架构：

- Frontend：React + TypeScript + Vite
- Backend：Supabase Auth + Postgres + RLS + RPC/Data API
- Hosting：Cloudflare Pages
- CI/CD：GitHub Actions

生产地址：

- Cloudflare Pages：https://shiyanjilu.pages.dev
- Supabase project：`tvcfwcjgqkmjsxrnlham`

## Local Development

启动本地 Supabase：

```powershell
supabase start
supabase db reset
supabase status
```

复制前端环境变量：

```powershell
cd frontend
Copy-Item .env.example .env
```

把 `supabase status` 里的本地 URL 和 publishable/anon key 写入 `frontend/.env`：

```powershell
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local-publishable-or-anon-key>
```

启动前端：

```powershell
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

本地地址：

```text
http://localhost:5173
```

创建 Supabase Auth 用户后，可在 SQL Editor 提升首个管理员：

```sql
update public.profiles
set role = 'admin', display_name = '管理员'
where email = 'admin@example.com';
```

## Validation

```powershell
supabase db reset

cd frontend
npm run lint
npm run build
```

## Deployment

部署到 Supabase + Cloudflare Pages 的完整流程见 [DEPLOYMENT.md](DEPLOYMENT.md)。

推送到 `main` 后，GitHub Actions 会：

1. 执行 Supabase migrations。
2. 安装前端依赖。
3. 运行 lint 和 build。
4. 发布 `frontend/dist` 到 Cloudflare Pages。

数据库 schema、RLS、trigger、RPC、seed 都应通过 `supabase/migrations/` 管理，不在 Dashboard 直接修改生产 schema。
