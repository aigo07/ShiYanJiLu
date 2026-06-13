# CloudBase Deployment

本项目部署为：

- CloudBase：Auth、云数据库、普通云函数。
- CloudBase 静态托管：托管 `frontend/dist` 静态前端。
- GitHub Actions：推送 `main` 或手动触发时，先部署 CloudBase 后端，再构建并发布静态托管。

## Current Production

- CloudBase env id：`shiyanjilu-d0gqg419l4e71bc14`
- CloudBase region：`ap-shanghai`
- CloudBase function：`shiyanjilu-api`
- CloudBase HTTP API base URL：`https://shiyanjilu-d0gqg419l4e71bc14.api.tcloudbasegateway.com`
- CloudBase static hosting URL：`https://shiyanjilu-d0gqg419l4e71bc14-1257062913.tcloudbaseapp.com`

## 1. CloudBase Environment

在腾讯云 CloudBase 控制台创建环境，地域使用 `ap-shanghai`（上海）。启用：

- 登录认证：邮箱/密码登录。
- 云数据库集合：由 `backend npm run seed` 自动创建。
- 普通云函数：由 GitHub Actions 按 `backend/cloudbaserc.json` 部署 `shiyanjilu-api`。
- 静态托管：发布 `frontend/dist`。

本地初始化集合和 seed：

```powershell
cd backend
$env:CLOUDBASE_ENV_ID = "<cloudbase-env-id>"
$env:TENCENTCLOUD_SECRETID = "<secret-id>"
$env:TENCENTCLOUD_SECRETKEY = "<secret-key>"
npm ci
npm run build
npm run seed
```

首个管理员：

```powershell
$env:BOOTSTRAP_ADMIN_EMAILS = "admin@example.com"
```

该邮箱用户首次登录并访问 API 后，`profiles` 集合会自动创建 `admin` 角色记录。后续角色可在 `profiles` 集合中调整为 `admin`、`auditor`、`editor` 或 `viewer`。

## 2. CloudBase Function

本地手动部署：

```powershell
cd backend
$env:CLOUDBASE_ENV_ID = "<cloudbase-env-id>"
$env:TENCENTCLOUD_SECRETID = "<secret-id>"
$env:TENCENTCLOUD_SECRETKEY = "<secret-key>"
$env:BOOTSTRAP_ADMIN_EMAILS = "admin@example.com"
npm ci
npm run build
npx --yes @cloudbase/cli fn deploy shiyanjilu-api --yes
```

前端通过 CloudBase HTTP API 调用普通云函数，`VITE_API_BASE_URL` 写环境 API 网关基础域名：

```text
https://<cloudbase-env-id>.api.tcloudbasegateway.com
```

国内上海环境 `shiyanjilu-d0gqg419l4e71bc14` 对应：

```text
https://shiyanjilu-d0gqg419l4e71bc14.api.tcloudbasegateway.com
```

`backend/cloudbaserc.json` 会把函数固定为普通云函数，并随部署写入运行时环境变量：

- `CLOUDBASE_ENV_ID`
- `BOOTSTRAP_ADMIN_EMAILS`

## 3. CloudBase Static Hosting

本地手动发布前端：

```powershell
cd frontend
$env:VITE_CLOUDBASE_ENV_ID = "shiyanjilu-d0gqg419l4e71bc14"
$env:VITE_CLOUDBASE_REGION = "ap-shanghai"
$env:VITE_API_BASE_URL = "https://shiyanjilu-d0gqg419l4e71bc14.api.tcloudbasegateway.com"
$env:VITE_CLOUDBASE_FUNCTION_NAME = "shiyanjilu-api"
npm ci
npm run lint
npm run build
npx --yes @cloudbase/cli hosting deploy dist -e shiyanjilu-d0gqg419l4e71bc14 --yes
```

React Router 使用 History mode。CloudBase 静态托管需要把错误文档配置为 `index.html`，否则直接刷新或访问子路由会返回对象存储 404。可在控制台进入：

```text
https://tcb.cloud.tencent.com/dev?envId=shiyanjilu-d0gqg419l4e71bc14#/static-hosting
```

检查网站配置：

- 默认首页：`index.html`
- 错误文档：`index.html`

## 4. GitHub Actions Secrets

在 GitHub 仓库中设置以下 secrets：

```powershell
gh secret set TENCENTCLOUD_SECRETID --body "<secret-id>"
gh secret set TENCENTCLOUD_SECRETKEY
gh secret set CLOUDBASE_ENV_ID --body "shiyanjilu-d0gqg419l4e71bc14"
gh secret set CLOUDBASE_REGION --body "ap-shanghai"
gh secret set BOOTSTRAP_ADMIN_EMAILS --body "admin@example.com"

gh secret set VITE_CLOUDBASE_ENV_ID --body "shiyanjilu-d0gqg419l4e71bc14"
gh secret set VITE_CLOUDBASE_REGION --body "ap-shanghai"
gh secret set VITE_CLOUDBASE_ACCESS_KEY --body "<cloudbase-publishable-key>"
gh secret set VITE_API_BASE_URL --body "https://shiyanjilu-d0gqg419l4e71bc14.api.tcloudbasegateway.com"
gh secret set VITE_CLOUDBASE_FUNCTION_NAME --body "shiyanjilu-api"
```

`VITE_CLOUDBASE_ACCESS_KEY` 是 CloudBase publishable key，不是腾讯云 SecretKey。可通过 CloudBase MCP `manageAppAuth(action="ensurePublishableKey")` 或控制台获取。

## 5. Automatic Deployment

推送到 `main` 会触发 `.github/workflows/deploy.yml`：

1. `npm ci` in `backend`
2. `npm run build`
3. `npm run seed`
4. `tcb fn deploy shiyanjilu-api --yes`
5. `npm ci` in `frontend`
6. `npm run lint`
7. `npm run build`
8. `tcb hosting deploy dist`

也可以在 GitHub Actions 页面手动运行 `Deploy` workflow。
