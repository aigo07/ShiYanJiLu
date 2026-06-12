# Supabase

This app now uses Supabase Auth, Postgres, RLS, and RPC as the backend.

## Production

- Project ref: `tvcfwcjgqkmjsxrnlham`
- Project URL: `https://tvcfwcjgqkmjsxrnlham.supabase.co`
- Frontend URL: `https://shiyanjilu.pages.dev`

## Local Development

Install the Supabase CLI, then run from the repository root:

```powershell
supabase start
supabase db reset
```

Create a user in Supabase Studio (`http://localhost:54323`) or with the CLI/API.
The `profiles` row is created automatically with role `viewer`. Promote the first
admin in SQL:

```sql
update public.profiles
set role = 'admin', display_name = '管理员'
where email = 'admin@example.com';
```

Copy `frontend/.env.example` to `frontend/.env` and set:

```powershell
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local publishable/anon key from supabase status>
```

Then start the frontend:

```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

## Remote Deployment

Link and deploy migrations:

```powershell
supabase link --project-ref tvcfwcjgqkmjsxrnlham
supabase db push --yes
```

Set the frontend production environment variables to the Supabase project URL and
anon key. Do not edit production schema manually in the Dashboard; add a migration
under `supabase/migrations/` instead.
