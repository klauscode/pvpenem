ENEM Arena Frontend Outline (React)

This folder contains skeleton components describing the UI structure and state flows. These are placeholders to guide implementation.

Key components:

- App: Routing and global providers (Auth, Socket).
- AuthPage: Login and Registration forms.
- HomePage: Dashboard with user stats and Play button.
- MatchmakingQueue: Shows queue status and allows cancel.
- BattleScreen: Timer, question display, answer submission via Socket.IO, live scores.
- ResultsScreen: Shows final results, ELO change, and KP earned.

State management:
- Auth state: JWT + user profile (Context or Redux).
- Socket: Connect with token, handle events (match_found, battle_start, answer_result, opponent_score_update, battle_complete).
- Battle state: currentQuestion, myScore, opponentScore, remainingTime, inQueue.
Deployment (free hosting)
- Vercel (recommended):
  - Set env: `VITE_WS_URL=https://<your-backend-domain>` and optionally `VITE_API_BASE=https://<your-backend-domain>`.
  - Option A (env-only): No rewrites needed; client calls will use `VITE_API_BASE`.
  - Option B (rewrites): Edit `vercel.json`, replace `enem-arena-backend.example.com` with your backend domain.
  - Build: Vercel will use root `client/` (build `npm run build`, output `dist`).

- Netlify:
  - Set env: `VITE_WS_URL=https://<your-backend-domain>` and optionally `VITE_API_BASE=https://<your-backend-domain>`.
  - If not using `VITE_API_BASE`, keep relative fetch paths and use redirects: edit `public/_redirects` to point to backend domain.
  - Publish dir: `dist`.

Backend (Render)
- Root: `server/` with start: `npm start`.
- Env:
  - `JWT_SECRET=<random>`
  - `CORS_ORIGIN=*` (or your Vercel/Netlify URL)
  - Optional `MONGODB_URI` for persistence; otherwise uses in-memory.

