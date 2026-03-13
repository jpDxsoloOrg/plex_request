# Plex Request - Claude Instructions

## Project Overview
Serverless media request app on AWS. Users search for movies/TV shows and request they be added to Plex. Admins approve requests, which triggers Radarr (movies) or Sonarr (TV shows) to download the media. Built with React + TypeScript + Tailwind v4 + shadcn/ui frontend, Node.js 22 Lambda backend, DynamoDB, Cognito auth.

## Repository
- **Repo**: https://github.com/jpDxsoloOrg/plex_request
- **Branch strategy**: `main` (production), `feat/*` (features), `fix/*` (bug fixes)
- **Plan document**: `docs/plans/implementation-plan.md` — the full architecture and design reference

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui (dark theme) + React Router
- **Backend**: Node.js 22 + TypeScript + Serverless Framework + DynamoDB
- **Auth**: AWS Cognito (self-registration, email verification, admin group)
- **External APIs**: Radarr v3 (:7878), Sonarr v3 (:8989), SABnzbd (:38080) — all at `http://jpcoder.duckdns.org`
- **Icons**: Lucide React | **Toasts**: Sonner | **CN utility**: clsx + tailwind-merge

## Code Style
- TypeScript for all code — no `any`, use specific types or `unknown`
- Functional React components with hooks (no class components)
- Async/await (no .then chains)
- Descriptive variable names (no single letters except loop indices)
- No inline styles — use Tailwind utility classes
- shadcn/ui components for all UI primitives

## Issue Execution Order

Work through issues in the order below. Each row is a step — complete all issues in a step before moving to the next. Issues within the same step can be worked in parallel.

### Foundation (must be first)

| Step | Issues | Description |
|------|--------|-------------|
| 1 | #11, #12, #13 | **Project Scaffolding** — backend setup, frontend setup, shared config (ESLint, Prettier, CI/CD) |
| 2 | #14, #15 | **Cognito Setup** — User Pool config in serverless.yml + Lambda authorizer |
| 3 | #21 | **Data Model** — DynamoDB Requests table with GSIs |

### Backend APIs (depends on Foundation)

| Step | Issues | Description |
|------|--------|-------------|
| 4 | #16, #18, #22 | **Core APIs** — Auth endpoints, Search API (Radarr/Sonarr proxy), Request CRUD |
| 5 | #24 | **Admin API** — List requests by status, update status, dashboard stats |
| 6 | #27, #28 | **Integration Clients** — Radarr + Sonarr TypeScript client libraries |
| 7 | #29, #30 | **Approval Flow + Settings API** — Auto-add to Radarr/Sonarr on approve, admin settings CRUD + test connection |

### Frontend (depends on Foundation + backend APIs it consumes)

| Step | Issues | Description |
|------|--------|-------------|
| 8 | #32, #33, #34, #35 | **Frontend Shell** — Tailwind/shadcn init, app layout, shared components, routing |
| 9 | #17 | **Frontend Auth** — Auth context, login/register/confirm pages, protected routes |
| 10 | #19, #20 | **Search UI** — Search page with poster grid + media detail page |
| 11 | #23 | **My Requests UI** — Request list with status badges |
| 12 | #25, #26 | **Admin UI** — Dashboard + request queue |
| 13 | #31 | **Settings UI** — Radarr/Sonarr config page with test connection |

### Deployment & Polish

| Step | Issues | Description |
|------|--------|-------------|
| 14 | #36, #37, #38, #39 | **Deployment** — S3/CloudFront, env strategy, GitHub Actions, secrets management |
| 15 | #40, #41, #42 | **UX Polish** — Loading skeletons, toast notifications, empty states, error boundaries, pagination |

### Stretch Goal (only after everything above is complete)

| Step | Issues | Description |
|------|--------|-------------|
| 16 | #43, #44, #45 | **SABnzbd Integration** — Client library, download status API, frontend progress bars |

## Epics Reference

| Epic | Issue | Sub-Issues |
|------|-------|------------|
| Project Scaffolding | #1 | #11, #12, #13 |
| Authentication | #2 | #14, #15, #16, #17 |
| Media Search | #3 | #18, #19, #20 |
| Request System | #4 | #21, #22, #23 |
| Admin Dashboard & Queue | #5 | #24, #25, #26 |
| Radarr & Sonarr Integration | #6 | #27, #28, #29, #30, #31 |
| Frontend Shell & UI | #7 | #32, #33, #34, #35 |
| Deployment & CI/CD | #8 | #36, #37, #38, #39 |
| UX Polish | #9 | #40, #41, #42 |
| SABnzbd (Stretch) | #10 | #43, #44, #45 |

## Working on Issues

When starting work on an issue:
1. Create a feature branch: `feat/<short-description>` (e.g., `feat/backend-setup`)
2. Read the issue body for detailed task checklists
3. Reference the full plan at `docs/plans/implementation-plan.md` for architecture details
4. Commit with conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
5. Create a PR back to `main` when the issue is complete

## Key Files (once created)

| Purpose | Path |
|---------|------|
| Infrastructure | `backend/serverless.yml` |
| DynamoDB helpers | `backend/lib/dynamodb.ts` |
| HTTP response helpers | `backend/lib/response.ts` |
| Radarr client | `backend/lib/integrations/radarr.ts` |
| Sonarr client | `backend/lib/integrations/sonarr.ts` |
| SABnzbd client | `backend/lib/integrations/sabnzbd.ts` |
| Lambda functions | `backend/functions/<feature>/*.ts` |
| API client (frontend) | `frontend/src/services/api.ts` |
| TypeScript types | `frontend/src/types/index.ts` |
| Auth context | `frontend/src/context/AuthContext.tsx` |
| Shared components | `frontend/src/components/` |
| Admin components | `frontend/src/components/admin/` |
| shadcn/ui components | `frontend/src/components/ui/` |

## Environment Variables

Service connections are defined in `.env` (gitignored) and `.env.example` (committed):
```
RADARR_BASE_URL=http://jpcoder.duckdns.org:7878
RADARR_API_KEY=
SONARR_BASE_URL=http://jpcoder.duckdns.org:8989
SONARR_API_KEY=
SABNZBD_BASE_URL=http://jpcoder.duckdns.org:38080
SABNZBD_API_KEY=
```

## Deployment

### Environment

| Component | URL / Resource |
|-----------|---------------|
| **Frontend** | https://plex.jpdxsolo.com/ |
| **Backend API** | https://w6fn8e41qf.execute-api.us-east-1.amazonaws.com |
| **S3 Bucket** | `plex-request-api-devtest-frontend` |
| **CloudFront ID** | `EIYHZFZ7PKY0J` (`d12olgsb7r1u46.cloudfront.net`) |
| **Serverless Stage** | `devtest` |
| **AWS Profile** | `league-szn` |
| **Cognito User Pool** | `us-east-1_5QNT47Ud7` |
| **Cognito Client ID** | `6plp7icdstc1vtk7dahkrbnmpe` |

### Deploy Commands

```bash
# Backend
cd backend && npx serverless deploy --stage devtest --aws-profile league-szn

# Frontend
cd frontend && npm run build -- --mode devtest && aws s3 sync dist s3://plex-request-api-devtest-frontend --profile league-szn --delete

# CloudFront cache invalidation
aws cloudfront create-invalidation --distribution-id EIYHZFZ7PKY0J --paths "/*" --profile league-szn

# Full deployment (backend + frontend + invalidation)
cd backend && npx serverless deploy --stage devtest --aws-profile league-szn && cd ../frontend && npm run build -- --mode devtest && aws s3 sync dist s3://plex-request-api-devtest-frontend --profile league-szn --delete && aws cloudfront create-invalidation --distribution-id EIYHZFZ7PKY0J --paths "/*" --profile league-szn
```

## Local Development
```bash
# Backend: start DynamoDB Local + serverless-offline
docker run -p 8000:8000 amazon/dynamodb-local
cd backend && npm run offline  # port 3001

# Frontend: start Vite dev server
cd frontend && npm run dev  # port 3000
```
