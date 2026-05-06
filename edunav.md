# EduNav — Product Requirements Document

**Version:** 1.0  
**Date:** April 2026  
**Status:** Active Development  
**Buildathon:** Google Developer Buildathon — Rooted in Reality

---

## 1. Problem Statement

At large, resource-constrained institutions like the University of Lagos, students have no reliable way to know whether a study space is available before physically walking there. This results in wasted time, physical exhaustion in extreme weather, and disrupted study momentum. The problem is compounded by space hoarding, unreported maintenance issues, and zero infrastructure for real-time feedback.

---

## 2. Solution Overview

EduNav is a lightweight, mobile-first web application that serves as a real-time, community-verified study space intelligence tool. Students act as live sensors — checking in and out of spaces — while an AI layer (Gemini) handles natural language matching and issue categorization.

---

## 3. Goals

- Give students real-time visibility into campus study space availability
- Replace physical scouting with a 10-second app lookup
- Use AI to match students to spaces based on their specific current needs
- Create a structured feedback channel for facility issues
- Keep the product lightweight enough to work on slow mobile connections

---

## 4. Non-Goals (MVP)

- No native mobile app (web only)
- No admin dashboard for campus management (post-MVP)
- No booking or reservation system
- No push notifications (post-MVP)
- No integration with existing university portals

---

## 5. Target Users

**Primary:** University of Lagos undergraduate students  
**Secondary:** Campus facility managers (post-MVP)

---

## 6. Core Features

### 6.1 Real-Time Capacity Tracking
Students check in and out of spaces via a single tap. Capacity updates propagate instantly to all active users via Supabase Realtime subscriptions.

### 6.2 AI Space Matcher (Gemini)
A natural language input bar on the dashboard. The student describes their need ("quiet room with AC and power near Engineering") and the app passes the query + current space state data to Gemini, which returns a ranked list of best-matching spaces with reasoning.

### 6.3 Verified Identity Layer
Supabase Auth with institutional email enforcement. Only verified UNILAG student emails can create accounts, minimizing prank check-ins and false data.

### 6.4 Issue Reporting
Students can flag a space issue (broken AC, no power, dirty, locked). Optional photo upload — Gemini Vision categorizes the issue automatically before submission.

### 6.5 Live Activity Feed
A real-time ticker showing recent campus activity ("Someone checked into AKT Underground · 2 min ago"). Powered by Supabase Realtime on the checkins table.

---

## 7. Spaces

**Main Libraries**
- Main Library
- Library Learning Commons
- AKT - Underground Library
- Engineering Quadrangle
- Science Quadrangle - Porters Lounge

**Faculty Libraries**
- Faculty of Arts Library
- Faculty of Management Sciences Library
- Faculty of Engineering Library (Boulos)
- Faculty of Environmental Sciences Library
- Faculty of Science Library
- Faculty of Social Sciences Library

---

## 8. Screens

### Screen 1 — Landing Page (pre-login)
Public-facing marketing page. Hero section with mixed-weight headline, dot-grid background texture, CTA to sign in, and a scrolling strip of live space names with status dots.

### Screen 2 — Main Dashboard (post-login)
Single scrollable page containing:
- AI Space Matcher card (prominent black card, full width)
- Filter chips (All, Available Now, Main Libraries, Faculty Libraries, Has AC, Has Power, Quiet)
- Space cards grid (2-col desktop, 1-col mobile)
- Live Activity Feed (bottom)

### Screen 3 — Profile Page
Student avatar, name, matric number, faculty, check-in history, and submitted reports.

---

## 9. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | React + Vite + Tailwind CSS | Fast build, familiar DX |
| Auth | Supabase Auth | Email-based, easy to restrict to UNILAG domain |
| Database | Supabase (PostgreSQL) | Relational, reliable, integrates with auth |
| Realtime | Supabase Realtime | Live capacity updates without a custom WebSocket server |
| AI | Google Gemini API | Space matching + issue categorization via Vision |
| Hosting | Vercel | One-command deploy, auto HTTPS |

---

## 10. Database Schema

### `spaces`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
name          text NOT NULL
location      text
total_capacity integer NOT NULL
current_count  integer DEFAULT 0
amenities     jsonb DEFAULT '{}'
  -- { ac: bool, wifi: bool, power: bool, quiet: bool }
status        text DEFAULT 'open'
  -- 'open' | 'closed' | 'maintenance'
created_at    timestamptz DEFAULT now()
```

### `checkins`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id     uuid REFERENCES auth.users(id)
space_id    uuid REFERENCES spaces(id)
type        text NOT NULL -- 'in' | 'out'
created_at  timestamptz DEFAULT now()
```

### `reports`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id     uuid REFERENCES auth.users(id)
space_id    uuid REFERENCES spaces(id)
issue_type  text -- 'broken_ac' | 'no_power' | 'dirty' | 'locked' | 'overcrowded' | 'other'
description text
photo_url   text
created_at  timestamptz DEFAULT now()
```

### `profiles`
```sql
id          uuid PRIMARY KEY REFERENCES auth.users(id)
full_name   text
matric_no   text
faculty     text
avatar_url  text
created_at  timestamptz DEFAULT now()
```

---

## 11. Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                  │
│                                                      │
│  React + Vite + Tailwind                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │ Landing  │ │Dashboard │ │   Profile Page        │ │
│  │  Page    │ │          │ │                       │ │
│  └──────────┘ └────┬─────┘ └──────────────────────┘ │
│                    │                                  │
│         ┌──────────┼──────────────┐                  │
│         ▼          ▼              ▼                   │
│  Supabase SDK  Supabase      Gemini API              │
│  (Auth)        Realtime      (direct fetch)          │
└────────┬───────────┬──────────────┬──────────────────┘
         │           │              │
         ▼           ▼              ▼
  ┌─────────────────────────┐  ┌──────────────┐
  │        SUPABASE          │  │  GOOGLE AI   │
  │                          │  │  STUDIO      │
  │  ┌──────────────────┐   │  │              │
  │  │   PostgreSQL DB   │   │  │  gemini-2.0  │
  │  │  - spaces         │   │  │  -flash      │
  │  │  - checkins       │   │  │              │
  │  │  - reports        │   │  │  gemini-     │
  │  │  - profiles       │   │  │  2.0-flash   │
  │  └──────────────────┘   │  │  (vision)    │
  │                          │  └──────────────┘
  │  ┌──────────────────┐   │
  │  │  Realtime Engine  │   │
  │  │  (WebSocket)      │   │
  │  └──────────────────┘   │
  │                          │
  │  ┌──────────────────┐   │
  │  │  Auth (JWT)       │   │
  │  └──────────────────┘   │
  └──────────────────────────┘
```

---

## 12. Data Flow

### Check-In Flow
1. Student taps "Check In" on a space card
2. Frontend calls `supabase.from('checkins').insert({ user_id, space_id, type: 'in' })`
3. A Supabase database trigger increments `spaces.current_count`
4. Supabase Realtime broadcasts the `spaces` row update
5. All connected clients receive the update and re-render the capacity bar — no page refresh

### AI Space Matcher Flow
1. Student types a natural language query into the matcher input
2. Frontend fetches all current space data from Supabase
3. Constructs a prompt: current space data (JSON) + user query
4. Sends to Gemini API via `fetch` directly from the browser
5. Gemini returns ranked recommendations with reasoning
6. Frontend renders the result as a card list below the input

### Issue Report Flow
1. Student opens report modal, optionally attaches a photo
2. If photo attached: convert to base64 and send to Gemini Vision with constrained issue categories
3. Gemini returns issue type (e.g. "broken_ac" or "overcrowded")
4. Frontend pre-fills the issue type field
5. Frontend uploads the photo to Supabase Storage and stores the resulting URL in `reports.photo_url`
6. Student confirms and submits — inserts into `reports` table

---

## 13. Key Technical Decisions

**Why Gemini called from frontend directly?**  
For a one-day buildathon MVP, adding a backend solely to proxy the Gemini API key adds deployment complexity without user-facing benefit. The API key is scoped and can be restricted by HTTP referrer in Google AI Studio. Post-MVP, a FastAPI backend layer can be introduced.

**Why Supabase over Firebase?**  
Supabase provides a familiar Postgres relational model which is more appropriate for structured campus data. The team already has Supabase deployment experience, reducing friction on a tight timeline.

**Why Vite over Next.js?**  
No SSR requirements for this MVP — all content is behind auth and rendered client-side. Vite is simpler to configure and faster to scaffold.

---

## 14. Environment Variables

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GEMINI_API_KEY=
```

---

## 15. MVP Build Order

1. Supabase project setup — schema, RLS policies, seed spaces data
2. Auth flow — sign up, login, UNILAG email restriction
3. Dashboard — space cards with static data
4. Supabase Realtime — live capacity updates
5. Check-in / Check-out logic + database trigger
6. Gemini Space Matcher
7. Issue Report flow
8. Landing page
9. Profile page
10. Deploy to Vercel

---

## 16. Post-MVP Roadmap

- Admin dashboard for facility managers
- Push notifications for space availability alerts
- Space reservation/booking system
- Crowd prediction using historical check-in data
- Native mobile app (React Native)
- Integration with university student portal

---

## 17. Success Metrics (Buildathon Demo)

- Live check-in updates visible across two browser windows simultaneously
- Gemini matcher returns relevant space recommendations for 3 different query types
- Issue report successfully categorized by Gemini Vision
- Full flow completable in under 60 seconds from landing to check-in
