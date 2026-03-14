# Production CI/CD + Self-Hosted Supabase Setup

This guide sets up a complete production deployment for this repository:

- Node.js API managed by PM2
- Self-hosted Supabase stack on Docker Compose
- Nginx reverse proxy
- Automatic deploy from GitHub Actions on push to `main`
- Automatic migration execution on deploy

---

## 0) Files Added/Updated in Repo

This repository now includes:

- `.github/workflows/deploy.yml`
- `deploy.sh`
- `ecosystem.config.cjs`
- `infra/supabase/docker-compose.yml`
- `infra/supabase/kong.yml`
- `infra/supabase/.env.example`
- `infra/nginx/node-app.conf`
- `.env.example` (updated for self-hosted Supabase)

Also note:

- App already loads env vars using `dotenv` (`src/config/db.js` and `src/config/config.js`).
- `npm start` is already present in `package.json`.
- Migrations currently live in `database/migrations/`.
  - Deployment script syncs them into `supabase/migrations/` before running CLI migration.

---

## 1) Prepare VPS (Ubuntu)

Assume fresh Ubuntu VPS, login with sudo user:

```bash
ssh <user>@<SERVER_IP>
```

Update system:

```bash
sudo apt update && sudo apt upgrade -y
```

Install required packages:

```bash
sudo apt install -y git curl ca-certificates gnupg lsb-release ufw nginx rsync
```

---

## 2) Install Node.js (NVM) + PM2

Install NVM:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
```

Install Node.js 20 LTS:

```bash
nvm install 20
nvm use 20
nvm alias default 20
node -v
npm -v
```

Install PM2 globally:

```bash
npm install -g pm2
pm2 -v
```

---

## 3) Install Docker + Docker Compose Plugin

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Allow current user to run docker without sudo:

```bash
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

---

## 4) Clone Project

```bash
mkdir -p ~/convoy-backend
cd ~/convoy-backend
git clone <YOUR_GITHUB_REPO_URL> .
```

---

## 5) Configure Environment Variables

### 5.1 App env

```bash
cp .env.example .env
nano .env
```

Set production values at minimum:

- `NODE_ENV=production`
- `PORT=3000`
- `SUPABASE_URL=http://localhost:8000`
- `SUPABASE_ANON_KEY=<anon_jwt>`
- `SUPABASE_SERVICE_ROLE_KEY=<service_role_jwt>`
- `DATABASE_URL=postgresql://postgres:<db_password>@localhost:5432/postgres`
- `JWT_SECRET=<same_secret_used_for_supabase_jwt_signing>`

### 5.2 Supabase compose env

```bash
cp infra/supabase/.env.example infra/supabase/.env
nano infra/supabase/.env
```

Set:

- `POSTGRES_PASSWORD`
- `JWT_SECRET` (strong, same secret family used to sign anon/service tokens)
- `SECRET_KEY_BASE` (strong random)
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PUBLIC_URL=http://<SERVER_IP>:8000`
- `API_EXTERNAL_URL=http://<SERVER_IP>:8000`

> Keep app `.env` and `infra/supabase/.env` consistent for URL/keys.

---

## 6) Generate Supabase JWT Keys (anon + service role)

Use the same `JWT_SECRET` that Supabase services use.

On VPS inside project:

```bash
node -e "const jwt=require('jsonwebtoken'); const s=process.env.JWT_SECRET||'replace_me'; console.log('ANON=',jwt.sign({role:'anon',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+60*60*24*365*10},s)); console.log('SERVICE_ROLE=',jwt.sign({role:'service_role',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+60*60*24*365*10},s));"
```

Paste these values into:

- `.env` (`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- `infra/supabase/.env` (`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)

---

## 7) Start Self-Hosted Supabase (Docker)

```bash
docker compose --env-file infra/supabase/.env -f infra/supabase/docker-compose.yml up -d
docker compose --env-file infra/supabase/.env -f infra/supabase/docker-compose.yml ps
```

Check gateway:

```bash
curl http://localhost:8000
```

Studio is available through the gateway on port `8000` (for server-local/admin use).
For secure access from your machine, prefer SSH tunnel:

```bash
ssh -L 8000:localhost:8000 <user>@<SERVER_IP>
```

Then open:

```text
http://localhost:8000
```

---

## 8) Install Supabase CLI on VPS

Deployment uses `npx supabase`, so global install is optional, but recommended:

```bash
npm install -g supabase
supabase --version
```

---

## 9) Run Initial Migrations

From project root:

```bash
mkdir -p supabase/migrations
rsync -a --delete database/migrations/ supabase/migrations/
npx supabase db push --db-url "$DATABASE_URL"
```

This applies SQL migrations to your self-hosted Postgres.

---

## 10) Start Node API with PM2

Install dependencies and start app:

```bash
npm ci
mkdir -p ~/convoy-backend/logs
pm2 startOrRestart ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

Run the printed `pm2 startup` command with sudo once.

Verify:

```bash
pm2 status
curl http://localhost:3000/health
```

---

## 11) Configure Nginx Reverse Proxy

Copy config:

```bash
sudo cp infra/nginx/node-app.conf /etc/nginx/sites-available/node-app
sudo ln -s /etc/nginx/sites-available/node-app /etc/nginx/sites-enabled/node-app
sudo rm -f /etc/nginx/sites-enabled/default
```

Validate and reload:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

Verify:

```bash
curl http://<SERVER_IP>/health
```

---

## 12) CI/CD with GitHub Actions

Workflow file is already present:

- `.github/workflows/deploy.yml`

Trigger:

- push to `main`

Pipeline actions:

1. Checkout code
2. Setup Node
3. Install dependencies
4. Run tests (if configured)
5. SSH to VPS
6. Run `deploy.sh`

---

## 13) GitHub Secrets Setup

In GitHub repo:

- Settings -> Secrets and variables -> Actions -> New repository secret

Add:

- `SERVER_HOST` = VPS public IP
- `SERVER_USER` = deploy user (non-root recommended)
- `SERVER_SSH_KEY` = private SSH key content
- `PROJECT_PATH` = `/root/convoy-backend` (recommended absolute path; `~/convoy-backend` is also supported by current deploy script)

### Generate SSH keys for deploy

On your local machine:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/convoy_deploy_key
```

Add public key to VPS user:

```bash
ssh-copy-id -i ~/.ssh/convoy_deploy_key.pub <user>@<SERVER_IP>
```

Copy private key into GitHub secret:

```bash
cat ~/.ssh/convoy_deploy_key
```

Paste full private key as `SERVER_SSH_KEY`.

---

## 14) Deployment Flow (What Happens on Push)

On `main` push:

1. GitHub Actions connects to VPS over SSH
2. `deploy.sh` runs:
   - fetch/reset latest code
   - install dependencies
   - sync `database/migrations` -> `supabase/migrations`
   - pull/update Supabase containers
   - run `supabase db push`
   - restart PM2 app
3. App becomes live on server IP behind Nginx

---

## 15) Security Hardening

### Firewall (UFW)

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw --force enable
sudo ufw status
```

### Disable root SSH login (recommended)

```bash
sudo nano /etc/ssh/sshd_config
```

Set:

```text
PermitRootLogin no
PasswordAuthentication no
```

Then:

```bash
sudo systemctl restart ssh
```

---

## 16) Logging + Monitoring

PM2:

```bash
pm2 logs
pm2 monit
pm2 status
```

Docker/Supabase:

```bash
docker compose --env-file infra/supabase/.env -f infra/supabase/docker-compose.yml logs -f
docker compose --env-file infra/supabase/.env -f infra/supabase/docker-compose.yml ps
```

Nginx:

```bash
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

---

## 17) Backup Strategy (Daily PostgreSQL backup)

Create backup dir:

```bash
mkdir -p /var/backups/postgres
```

Test one backup:

```bash
docker exec supabase-db pg_dump -U postgres -d postgres > /var/backups/postgres/backup-$(date +\%F).sql
```

Add cron (daily at 2:30 AM):

```bash
crontab -e
```

Add:

```cron
30 2 * * * docker exec supabase-db pg_dump -U postgres -d postgres > /var/backups/postgres/backup-$(date +\%F).sql
```

Optional retention cleanup (keep 14 days):

```cron
45 2 * * * find /var/backups/postgres -type f -name "backup-*.sql" -mtime +14 -delete
```

---

## 18) First Deployment Checklist

1. VPS dependencies installed (Node, Docker, PM2, Nginx)
2. Repo cloned at `~/convoy-backend`
3. `.env` configured
4. `infra/supabase/.env` configured
5. Supabase containers up
6. Migration command succeeds
7. PM2 app running
8. Nginx proxy active
9. GitHub Actions secrets set
10. Push to `main` and verify workflow/deployment

---

## 19) Verification Commands

```bash
curl http://localhost:3000/health
curl http://<SERVER_IP>/health
pm2 status
docker compose --env-file infra/supabase/.env -f infra/supabase/docker-compose.yml ps
```

If all pass, CI/CD is production-ready.

