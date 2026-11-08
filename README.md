# Smart School Attendance System

Vue 3 + Tailwind CSS frontend with a Google Apps Script API over Google Sheets.

> Status: **Phase 1 and 2 complete** (project setup, shared layout, login, session auth, role guards, role dashboards shell, Apps Script auth backend). Phases 3 to 7 follow.

## Architecture

```
Browser (Vue 3 SPA)
   |  HTTPS, JSON (POST, text/plain to avoid CORS preflight)
   v
Google Apps Script Web App  (Code.gs)      <- the only thing that touches the Sheet
   |  SpreadsheetApp, LockService, CacheService
   v
Google Sheet (private, owned by the school account)
```

Key decisions

- **Backend is authoritative.** The frontend stores only an opaque session token. The role shown in the UI comes from the server response; every API call re-validates the token and role server-side. Editing localStorage cannot grant access.
- **Sheet is never public.** Only the Apps Script (running as the owner) reads it. Deploy the Web App as "Execute as: Me", "Who has access: Anyone". The script itself rejects any call without a valid session.
- **Repository pattern in the script** (`Repo.*`). All sheet access goes through it, so migrating to PostgreSQL later means swapping one layer.
- **Stable IDs** (`USR-xxxx`, `STU-xxxx`, ...) are used instead of row numbers.
- **Concurrency**: writes use `LockService.getScriptLock()` plus a duplicate check inside the lock.
- **Passwords**: salted, iterated SHA-256 in Apps Script (`iterations$salt$hash`). Apps Script has no bcrypt; for a larger deployment, move auth to a dedicated backend.
- **Demo vs production**: `VITE_APP_MODE=demo` uses an in-browser mock adapter with sample accounts. `production` calls the Apps Script URL. A visible banner shows demo mode.

## Folder structure

```
school-attendance/
├─ index.html
├─ package.json
├─ vite.config.js
├─ tailwind.config.js
├─ postcss.config.js
├─ .env.example
├─ apps-script/
│  └─ Code.gs                  # API + sheet setup + auth
└─ src/
   ├─ main.js
   ├─ App.vue
   ├─ style.css
   ├─ config/index.js          # env, roles, home routes
   ├─ api/
   │  ├─ client.js             # axios instance + response normalisation
   │  ├─ auth.js               # auth endpoints
   │  └─ demo.js               # demo-mode adapter (dev only)
   ├─ stores/
   │  ├─ auth.js               # session, user, login/logout
   │  └─ toast.js
   ├─ router/
   │  ├─ index.js
   │  └─ guards.js
   ├─ layouts/
   │  ├─ AuthLayout.vue
   │  └─ AppLayout.vue         # sidebar, topbar, mobile nav, breadcrumbs
   ├─ components/
   │  ├─ ui/ (BaseInput, BaseButton, ToastHost)
   │  └─ DemoBanner.vue
   └─ pages/
      ├─ auth/ (Login, ForgotPassword)
      ├─ dashboards/ (Admin, Teacher, Student)
      ├─ ChangePassword.vue
      ├─ Placeholder.vue       # for Phase 3-6 pages
      ├─ Unauthorized.vue
      └─ NotFound.vue
```

## Setup

### 1. Google Sheet + Apps Script
1. Create a new Google Sheet (private).
2. Extensions > Apps Script. Paste `apps-script/Code.gs`.
3. Run `setupSheets` once (creates all tabs with headers). Authorise when prompted.
4. Run `seedDevData` **only for development** (creates demo users). In production, create your first admin with `createInitialAdmin('username','Full Name','a-strong-password')` from the editor.
5. Deploy > New deployment > Web app. Execute as **Me**, access **Anyone**. Copy the `/exec` URL.

### 2. Frontend
```bash
cd school-attendance
cp .env.example .env      # set VITE_API_URL and VITE_APP_MODE
npm install
npm run dev
```

Demo mode accounts (password `demo1234`): `admin`, `teacher`, `student`.

### Deployment
`npm run build` and host `dist/` on any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages). Set `VITE_APP_MODE=production` and `VITE_API_URL` at build time. Neither value is a secret.

## Security notes
- No service account keys or secrets in the frontend.
- Login attempts are throttled per username (5 failures, 15 min lockout) via CacheService.
- Sessions (stored hashed in a hidden `Sessions` tab) expire after 8 hours and are revoked on logout / password change.
- Every login, logout, and password change is written to `Activity_Logs`.

## Roadmap
- Phase 3: student / teacher / class / user CRUD
- Phase 4: barcode/QR generation and camera scanning
- Phase 5: attendance submission + retrieval
- Phase 6: reports, charts, exports
- Phase 7: hardening and deployment docs
