
# EduNav

A real-time, community-powered study space finder built for university students. EduNav helps students locate available study environments on campus without the guesswork — no more walking across campus only to find a full library.

## Overview

Campus study spaces are a shared resource under constant pressure. EduNav solves the information gap by letting students act as live sensors, updating space availability as they move through campus. An AI-powered matching layer (Gemini) translates natural language needs into the best available space recommendation based on real-time crowd data.

## Features

- **Live capacity tracking** — students check in and out, updating space availability in real time
- **AI Space Matcher** — describe what you need ("quiet room with AC and power") and get matched to the best available option
- **Verified community data** — institutional email login ensures updates come from real students
- **Issue reporting** — report broken facilities with photo support; AI categorizes the issue automatically
- **Faculty-level filtering** — browse by main libraries, faculty libraries, or specific amenities

## Tech Stack

- **Frontend** — React + Vite + Tailwind CSS
- **Backend** — Supabase (PostgreSQL + Realtime + Auth)
- **AI** — Google Gemini API
- **Hosting** — Vercel

## Getting Started

```bash
git clone https://github.com/yourusername/edunav.git
cd edunav
npm install
cp .env.example .env
npm run dev
```

Add your environment variables:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GEMINI_API_KEY=
```

## Status

Active development — built as part of the Google Developer Buildathon.
