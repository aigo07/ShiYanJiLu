# ShiYanJiLu Frontend

React + Vite frontend for the CloudBase-backed experiment record system. Production is deployed to CloudBase static hosting.

## Local Development

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev -- --host 0.0.0.0 --port 5173
```

Set `VITE_CLOUDBASE_ENV_ID`, `VITE_CLOUDBASE_REGION`, optional `VITE_CLOUDBASE_ACCESS_KEY`, and `VITE_API_BASE_URL` in `.env`. `VITE_API_BASE_URL` is the CloudBase HTTP API gateway base URL, for example `https://<env-id>.api.tcloudbasegateway.com`.

## Build And Validate

```powershell
npm run lint
npm run build
```

## Production

The production build is uploaded from `dist` to CloudBase static hosting:

```powershell
npx --yes @cloudbase/cli hosting deploy dist -e shiyanjilu-d0gqg419l4e71bc14 --yes
```

GitHub Actions runs the same build and deploy path on pushes to `main`.
