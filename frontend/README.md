# ShiYanJiLu Frontend

React + Vite frontend for the Supabase-backed experiment record system. Production is deployed to Cloudflare Pages.

## Local Development

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev -- --host 0.0.0.0 --port 5173
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`. For local
Supabase, run `supabase status` from the repository root and use the local
publishable/anon key.

## Build And Validate

```powershell
npm run lint
npm run build
```

## Production

The production build is uploaded from `dist` to Cloudflare Pages:

```powershell
npx --yes wrangler@4 pages deploy dist --project-name shiyanjilu --branch main
```

GitHub Actions runs the same build and deploy path on pushes to `main`.
