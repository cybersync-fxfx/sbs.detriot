# SBS (Server Based Security)

SBS is a full-stack web application designed for DDoS protection management. Users can register, download a unique agent installer, run it on their Ubuntu server, and manage their server security from a web dashboard.

## Tech Stack
- **Backend**: Node.js + Express
- **Auth**: Supabase Auth
- **Real-time**: WebSocket
- **Database**: Supabase PostgreSQL
- **Frontend**: Single HTML file with Vanilla JS + Chart.js

## Quick Start (Local)

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   SUPABASE_URL="your-supabase-url"
   SUPABASE_ANON_KEY="your-supabase-anon-key"
   ```

3. **Database Setup:**
   Execute the contents of `supabase_setup.sql` in your Supabase project's SQL Editor to create the required tables, triggers, and security policies.

4. **Start the Server:**
   ```bash
   npm start
   ```

5. **Login:**
   Open `http://localhost:3000` in your browser and register a new account.

## Deployment Guide (Production)

### 1. Prerequisites
You need a server (e.g., Ubuntu 22.04) with Node.js 20.x, NPM, and Nginx installed.

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
sudo npm install -g pm2
```

### 2. Setup Project
Clone the repository and install dependencies.
```bash
git clone <your-repo-url> /opt/sbs
cd /opt/sbs
npm install
```

### 3. Start with PM2
Create your `.env` file in `/opt/sbs/.env` with your Supabase credentials, then start the server.
```bash
pm2 start server.js --name "sbs-panel"
pm2 save
pm2 startup
```

### 4. Nginx Reverse Proxy Config (with WebSocket Support)
Create an Nginx configuration file (`/etc/nginx/sites-available/sbs`):

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400; # Keep WS connections alive
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/sbs /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. SSL / HTTPS (Certbot)
Run Certbot to automatically configure SSL for your domain:
```bash
sudo certbot --nginx -d yourdomain.com
```

---

## API Examples

### Authenticate
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
# Returns: {"token": "eyJ...", "user": {...}}
```

### Send Command to Agent
```bash
curl -X POST http://localhost:3000/api/command \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"cmd": "nft list ruleset"}'
```

---

## Troubleshooting

- **Agent shows "NO AGENT"**: Ensure the agent is running on the target server. Check logs using `journalctl -u sbs-agent -f`.
- **WebSocket disconnects frequently**: Ensure your Nginx configuration includes the `proxy_read_timeout` and `Upgrade` headers.
- **Supabase Authentication Issues**: Make sure the `supabase_setup.sql` script was run successfully and `.env` has the correct `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- **Agent fails to download**: Verify that you are logged in and your session is active.
