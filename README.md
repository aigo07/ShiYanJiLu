# ShiYanJiLu

客户调样合成实验记录系统 MVP。

当前架构：

- Frontend：React + TypeScript + Vite
- Backend：CloudBase Auth + CloudBase 云数据库 + CloudBase 普通云函数
- Hosting：CloudBase 静态托管
- CI/CD：GitHub Actions

CloudBase 云函数配置由 `backend/cloudbaserc.json` 管理，包括函数类型、入口、运行时、内存、超时和运行时环境变量。前端通过 CloudBase HTTP API 调用普通云函数。

生产地址：

- CloudBase 静态托管：https://shiyanjilu-d0gqg419l4e71bc14-1257062913.tcloudbaseapp.com
- CloudBase region：`ap-shanghai`

## Local Development

安装后端依赖并构建：

```powershell
cd backend
npm install
npm run build
```

复制前端环境变量：

```powershell
cd ..\frontend
Copy-Item .env.example .env
```

填写 `frontend/.env`：

```powershell
VITE_CLOUDBASE_ENV_ID=<cloudbase-env-id>
VITE_CLOUDBASE_REGION=ap-shanghai
VITE_CLOUDBASE_ACCESS_KEY=<cloudbase-publishable-key>
VITE_API_BASE_URL=https://<cloudbase-env-id>.api.tcloudbasegateway.com
VITE_CLOUDBASE_FUNCTION_NAME=shiyanjilu-api
```

`VITE_CLOUDBASE_ACCESS_KEY` 是 CloudBase publishable key，不是腾讯云 SecretKey。

启动前端：

```powershell
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

本地地址：

```text
http://localhost:5173
```

首次管理员：在 CloudBase Auth 创建用户后，把邮箱加入后端环境变量 `BOOTSTRAP_ADMIN_EMAILS`，该用户首次访问 API 时会创建为 `admin`。后续可直接在 `profiles` 集合调整角色。

## Validation

```powershell
cd backend
npm run build

cd ..\frontend
npm run lint
npm run build
```

## Deployment

部署到 CloudBase 后端 + CloudBase 静态托管的完整流程见 [DEPLOYMENT.md](DEPLOYMENT.md)。

推送到 `main` 后，GitHub Actions 会：

1. 构建 CloudBase 普通云函数。
2. 初始化 CloudBase 云数据库集合和 `process_types` seed。
3. 部署 `shiyanjilu-api` 普通云函数。
4. 安装前端依赖。
5. 运行 lint 和 build。
6. 发布 `frontend/dist` 到 CloudBase 静态托管。
