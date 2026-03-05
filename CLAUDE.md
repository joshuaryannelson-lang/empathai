# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EmpathAI is an AI-powered therapy practice management platform. It serves multiple personas: Practice Managers, Therapists, Patients, and Admins. The system surfaces at-risk cases, automates session prep, and tracks practice health through a Therapist Health Score (THS).

## Tech Stack

- **Framework**: Next.js 16 with App Router (React 19)
- **Language**: TypeScript (strict mode)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS v4 with PostCSS
- **Linting**: ESLint 9 with next/core-web-vitals and next/typescript configs

## Commands

- `npm run dev` — Start development server (localhost:3000)
- `npm run build` — Production build
- `npm run lint` — Run ESLint
- `npm start` — Start production server

## Architecture

### API Routes (`app/api/`)

All API routes are Next.js Route Handlers using `export const dynamic = "force-dynamic"`. They follow a consistent response envelope: `{ data, error }` using helpers from `lib/route-helpers.ts` (`ok()`, `bad()`).

Key API domains:
- **Cases** (`/api/cases/[id]/...`) — Core entity linking patients to therapists. Sub-routes for check-ins, goals, timeline, session-prep, AI summary, context, and assignment.
- **Therapists** (`/api/therapists/[id]/...`) — Therapist profiles, care dashboards, case signals.
- **Practices** (`/api/practices/[id]/...`) — Practice-level views: therapist overview, at-risk cases, THS, summary.
- **Patients** (`/api/patients/...`) — Patient profiles and patient-facing check-in flow (`/api/patient/[caseId]/checkin`).
- **Admin** (`/api/admin/...`) — Overview, stats, AI briefing, seed data (demo data generation).

### Shared Libraries (`lib/`)

- `supabase.ts` — Lazy-proxy Supabase clients (avoids build-time env var errors). Exports `supabase` (anon) and `supabaseAdmin` (service role).
- `route-helpers.ts` — `ok()`, `bad()`, `getIdFromContext()` for route handlers with async params.
- `constants.ts` — Enums for buckets (`low_scores`, `missing_checkins`, `unassigned`), signals (`AT_RISK`, `MISSING_CHECKIN`, `MONITOR`, `OK`), and case statuses.
- `week.ts` — Date utilities for Monday-aligned weekly buckets (UTC-based).

### Pages (`app/`)

- `/` — Landing page with persona selector and guided demo walkthrough
- `/dashboard/manager` — Multi-practice manager view
- `/dashboard/therapists/[id]/care` — Therapist caseload/care dashboard
- `/cases/[id]` — Individual case detail (has separate `ui.tsx` client component)
- `/patient` — Patient-facing portal
- `/admin`, `/admin/therapists`, `/admin/patients`, `/admin/dev` — Admin console
- `/practices/[id]/...` — Practice-specific views (health-score, therapist-overview, at-risk)
- `/analytics` — Analytics dashboard

### Key Patterns

- **Week-based data**: Most dashboards accept a `week_start` query param (YYYY-MM-DD, Monday-aligned). Use `toMondayISO()` from `lib/week.ts`.
- **Path alias**: `@/*` maps to the project root (e.g., `import { supabase } from "@/lib/supabase"`).
- **Dynamic route params**: Next.js 16 uses `Promise<{ id: string }>` for route params — use `getIdFromContext()` helper.
- **Client state**: Persona/practice/therapist selection stored in `localStorage` (keys: `selected_persona`, `selected_practice_id`, `selected_therapist_id`, `selected_manager_mode`).

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for admin operations)
