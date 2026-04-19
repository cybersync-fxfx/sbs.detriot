# Workspace Index

Indexed on 2026-04-19.

## Overview

This repository is a full-stack SBS ("Server Based Security") project for managing DDoS protection agents.

- Root app: Node.js + Express + `ws`
- Auth/data layer: Supabase Auth + PostgreSQL
- Frontend app: React 19 + Vite
- Deployment model: Express serves the built frontend from `frontend/dist`

## Runtime Shape

1. Browser loads the React dashboard from the Express server.
2. React calls `/api/*` endpoints on the same origin.
3. Express uses Supabase for auth, profile storage, and admin operations.
4. Remote SBS agents poll for commands, post stats, and push results back through the backend.
5. Dashboard and terminal pages receive live updates over WebSocket.

## Main Entry Points

- [package.json](C:\Users\cyber\Documents\GitHub\sbs.detriot\package.json): root runtime and backend dependencies
- [server.js](C:\Users\cyber\Documents\GitHub\sbs.detriot\server.js): Express API, WebSocket server, agent installer generation, tunnel actions
- [frontend/package.json](C:\Users\cyber\Documents\GitHub\sbs.detriot\frontend\package.json): React/Vite frontend scripts
- [frontend/src/main.jsx](C:\Users\cyber\Documents\GitHub\sbs.detriot\frontend\src\main.jsx): React bootstrap
- [frontend/src/App.jsx](C:\Users\cyber\Documents\GitHub\sbs.detriot\frontend\src\App.jsx): auth gate + route table

## Backend Surface

- Auth routes:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/me`
  - `POST /api/me/regenerate-key`
- Admin routes:
  - `GET /api/admin/users`
  - `POST /api/admin/approve`
  - `POST /api/admin/reject`
- Agent/user operation routes:
  - `GET /api/agent/download`
  - `POST /api/agent/register`
  - `POST /api/agent/stats`
  - `GET /api/agent/commands`
  - `POST /api/agent/command-result`
  - `POST /api/command`
  - `POST /api/agent/tunnel/create`
  - `DELETE /api/agent/tunnel/remove`
  - `GET /api/agent/tunnel/status`
- WebSocket:
  - authenticated connection on the same server
  - used for stats updates, agent connection events, and command results

## Frontend Routes

- [frontend/src/pages/Auth.jsx](C:\Users\cyber\Documents\GitHub\sbs.detriot\frontend\src\pages\Auth.jsx): login and registration
- [frontend/src/pages/Dashboard.jsx](C:\Users\cyber\Documents\GitHub\sbs.detriot\frontend\src\pages\Dashboard.jsx): live metrics, charts, logs, tunnel status
- [frontend/src/pages/Terminal.jsx](C:\Users\cyber\Documents\GitHub\sbs.detriot\frontend\src\pages\Terminal.jsx): remote command execution
- [frontend/src/pages/Firewall.jsx](C:\Users\cyber\Documents\GitHub\sbs.detriot\frontend\src\pages\Firewall.jsx): firewall rule commands
- [frontend/src/pages/Blocklist.jsx](C:\Users\cyber\Documents\GitHub\sbs.detriot\frontend\src\pages\Blocklist.jsx): IP blocking commands
- [frontend/src/pages/Install.jsx](C:\Users\cyber\Documents\GitHub\sbs.detriot\frontend\src\pages\Install.jsx): agent installer download flow
- [frontend/src/pages/ApiKeys.jsx](C:\Users\cyber\Documents\GitHub\sbs.detriot\frontend\src\pages\ApiKeys.jsx): agent ID, API key, key regeneration
- [frontend/src/pages/Settings.jsx](C:\Users\cyber\Documents\GitHub\sbs.detriot\frontend\src\pages\Settings.jsx): tunnel removal/settings actions
- [frontend/src/components/Layout.jsx](C:\Users\cyber\Documents\GitHub\sbs.detriot\frontend\src\components\Layout.jsx): shared shell/navigation

## Database And Infra Files

- [supabase_setup.sql](C:\Users\cyber\Documents\GitHub\sbs.detriot\supabase_setup.sql): `user_profiles` table, RLS, signup trigger, `verify_agent` RPC
- [setup-guard.sh](C:\Users\cyber\Documents\GitHub\sbs.detriot\setup-guard.sh): Linux guard host bootstrap, nftables setup, sudoers entry
- [tunnel-manager.sh](C:\Users\cyber\Documents\GitHub\sbs.detriot\tunnel-manager.sh): GRE tunnel add/remove/list helper

## Utility And Legacy Files

- [data.json](C:\Users\cyber\Documents\GitHub\sbs.detriot\data.json): sample local user data; appears legacy relative to current Supabase flow
- [fix.js](C:\Users\cyber\Documents\GitHub\sbs.detriot\fix.js): one-off text replacement utility for `frontend/index.html`
- [.agents/skills](C:\Users\cyber\Documents\GitHub\sbs.detriot\.agents\skills): local Codex skill metadata, not app runtime code

## Local Development Notes

- Root start command: `npm start`
- Frontend scripts live in `frontend/`: `npm run dev`, `npm run build`, `npm run preview`
- Express serves `frontend/dist`, so production-like local runs expect the frontend to be built first
- `frontend/vite.config.js` currently has no API proxy; frontend code assumes same-origin `/api/*`

## Excluded From This Index

- `.git/`
- `node_modules/`
- `frontend/node_modules/`
- `frontend/dist/`
