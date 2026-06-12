# Cloudflare + Supabase Deployment

本项目部署为：

- Supabase：Auth、Postgres、RLS、RPC、migrations。
- Cloudflare Pages：托管 `frontend/dist` 静态前端。
- GitHub Actions：推送 `main` 或手动触发时，先部署 Supabase migrations，再构建并发布 Pages。

## Current Production

- Supabase project ref：`tvcfwcjgqkmjsxrnlham`
- Supabase URL：`https://tvcfwcjgqkmjsxrnlham.supabase.co`
- Cloudflare account id：`42d55b20061b8fcaed0fbf389a55e7d4`
- Cloudflare Pages project：`shiyanjilu`
- Cloudflare Pages URL：`https://shiyanjilu.pages.dev`

## 1. Supabase project

当前生产项目已经创建。只有在需要重建环境时，才执行创建新项目命令。

创建新项目：

```powershell
supabase projects create shiyanjilu --org-id shwzkquehzcmwwebkhqf --db-password "<strong-db-password>" --region "<region>"
```

已有项目或 Dashboard 创建项目后，在仓库根目录执行：

```powershell
supabase link --project-ref tvcfwcjgqkmjsxrnlham --password "<strong-db-password>"
supabase db push --password "<strong-db-password>" --yes
```

获取前端需要的 publishable/anon key：

```powershell
supabase projects api-keys --project-ref tvcfwcjgqkmjsxrnlham
```

生产环境首个管理员需要先在 Supabase Auth 创建用户，再执行：

```sql
update public.profiles
set role = 'admin', display_name = '管理员'
where email = '<admin-email>';
```

## 2. Cloudflare Pages project

当前生产 Pages project 已经创建。只有在需要重建或手动发布时，才需要本机登录 Cloudflare：

```powershell
cd frontend
npx --yes wrangler@4 login
```

重建 Pages 项目：

```powershell
npx --yes wrangler@4 pages project create shiyanjilu --production-branch main
```

首次手动发布可执行：

```powershell
$env:VITE_SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:VITE_SUPABASE_ANON_KEY = "<supabase-publishable-or-anon-key>"
npm ci
npm run build
npx --yes wrangler@4 pages deploy dist --project-name shiyanjilu --branch main
```

Cloudflare Pages 会自动使用 `frontend/public/_redirects` 支持 React Router 的 SPA fallback。

## 3. 配置 GitHub Actions secrets

在 GitHub 仓库中设置以下 secrets：

```powershell
gh secret set SUPABASE_ACCESS_TOKEN
gh secret set SUPABASE_PROJECT_REF --body "<project-ref>"
gh secret set SUPABASE_DB_PASSWORD

gh secret set VITE_SUPABASE_URL --body "https://<project-ref>.supabase.co"
gh secret set VITE_SUPABASE_ANON_KEY --body "<supabase-publishable-or-anon-key>"

gh secret set CLOUDFLARE_ACCOUNT_ID --body "<cloudflare-account-id>"
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_PAGES_PROJECT_NAME --body "shiyanjilu"
```

Cloudflare API token 至少需要 Cloudflare Pages edit 权限；如果要在同一自动化中绑定自定义域名，还需要对应 zone 的 DNS edit 权限。

## 4. 配置 Supabase Auth URL

Cloudflare Pages 发布后，在 Supabase Dashboard 设置：

- Site URL：`https://shiyanjilu.pages.dev`
- Redirect URLs：`https://shiyanjilu.pages.dev/*`

如果后续绑定自定义域名，也把自定义域名加入 Redirect URLs。

## 5. 自动部署

推送到 `main` 会触发 `.github/workflows/deploy.yml`：

1. `supabase db push --yes`
2. `npm ci`
3. `npm run lint`
4. `npm run build`
5. `wrangler pages deploy dist`

也可以在 GitHub Actions 页面手动运行 `Deploy` workflow。
