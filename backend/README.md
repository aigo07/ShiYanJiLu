# Backend (FastAPI)

## Quick start (dev)

## One-command dev start (Windows)

From the repo root:

```powershell
# If PowerShell blocks scripts in this session:
Set-ExecutionPolicy -Scope Process Bypass

cd C:\NotOneDrive\Other\Shiyanjilu
.\start-dev.ps1
```

Stop (also from repo root):

```powershell
cd C:\NotOneDrive\Other\Shiyanjilu
.\stop-dev.ps1
```

### 1) Create venv and install deps

```powershell
cd C:\NotOneDrive\Other\Shiyanjilu\backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -U pip
.\.venv\Scripts\pip install -r requirements.txt
```

### 2) Configure env

Copy `.env.example` to `.env` and edit if needed.

Recommended auth settings for HTTPS (public internet):

- `COOKIE_SECURE=true`
- `COOKIE_SAMESITE=lax` (or `none` if you must do cross-site)

### 3) Start Postgres (Docker)

```powershell
cd C:\NotOneDrive\Other\Shiyanjilu
docker compose up -d db
```

### Optional: Start log stack (Loki + Promtail + Grafana)

This is optional but recommended for **single-machine log search**.

```powershell
cd C:\NotOneDrive\Other\Shiyanjilu
docker compose --profile logging up -d loki promtail grafana
```

Grafana: `http://127.0.0.1:3000` → Explore → Loki

### 4) Run migrations + start API

```powershell
cd C:\NotOneDrive\Other\Shiyanjilu\backend
.\.venv\Scripts\alembic upgrade head
.\.venv\Scripts\python -m scripts.seed_db
.\.venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check: `GET /health`

### Create initial admin user (required)

Set an admin username/password and create (or reset) the admin user:

```powershell
cd C:\NotOneDrive\Other\Shiyanjilu\backend
$env:ADMIN_USERNAME = "admin"
$env:ADMIN_PASSWORD = "change-me"
$env:ADMIN_DISPLAY_NAME = "管理员"
.\.venv\Scripts\python.exe -m scripts.create_admin
```

Then open the frontend and login via `/login`.

### Audit log retention (optional)

Purge audit events older than N days (default 30):

```powershell
cd C:\NotOneDrive\Other\Shiyanjilu\backend
$env:AUDIT_RETENTION_DAYS = "30"
.\.venv\Scripts\python.exe -m scripts.purge_audit_events
```

### Linux: schedule daily purge (cron)

Example (run every day at 02:30). Adjust paths to your deployment directory/venv.

```bash
crontab -e
```

```bash
30 2 * * * cd /opt/shiyanjilu/backend && AUDIT_RETENTION_DAYS=30 ./.venv/bin/python -m scripts.purge_audit_events >> /var/log/shiyanjilu/audit_purge.log 2>&1
```

### Linux: schedule daily purge (systemd timer)

If you prefer systemd-managed scheduling/logging, create:

- `/etc/systemd/system/shiyanjilu-audit-purge.service`

```ini
[Unit]
Description=Shiyanjilu audit log purge

[Service]
Type=oneshot
WorkingDirectory=/opt/shiyanjilu/backend
Environment=AUDIT_RETENTION_DAYS=30
ExecStart=/opt/shiyanjilu/backend/.venv/bin/python -m scripts.purge_audit_events
```

- `/etc/systemd/system/shiyanjilu-audit-purge.timer`

```ini
[Unit]
Description=Run Shiyanjilu audit purge daily

[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now shiyanjilu-audit-purge.timer
```

### Seeding curing agents (optional)

`seed_db` seeds **process_types** + **materials** only.

To seed/replace **curing_agents** from `raw_data/catalysts.json`:

```powershell
cd C:\NotOneDrive\Other\Shiyanjilu\backend
.\.venv\Scripts\python -m scripts.seed_curing_agents
```

