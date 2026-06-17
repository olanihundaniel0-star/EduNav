# EduNav

A real-time, community-powered study space finder built for university students. EduNav helps students locate available study environments on campus without the guesswork — no more walking across campus only to find a full library.

## Overview

Campus study spaces are a shared resource under constant pressure. EduNav solves the information gap by letting students act as live sensors, updating space availability as they move through campus. An AI-powered matching layer (Google Gemini) translates natural language needs into the best available space recommendation based on real-time crowd data.

## Features

- **Live capacity tracking** — students check in and out, instantly updating space availability via Supabase Realtime subscriptions.
- **AI Space Matcher (with fallbacks)** — describe what you need ("quiet room with AC and power") and get matched to the best available option using Gemini 2.5 Flash-lite. Includes a robust local regex fallback if API rate limits are hit.
- **Community-Driven Amenity Voting** — beyond capacity, users vote on whether amenities (WiFi, Power, Quiet) are currently working. The system uses a 2-hour sliding window algorithm to determine the real-time truth based on a 60% positive threshold.
- **Issue reporting with Vision AI** — report broken facilities with photo support; Gemini Vision automatically analyzes the image and categorizes the issue.
- **Google OAuth Login** — secure authentication via Supabase ensuring data comes from real users.

## Tech Stack

- **Frontend** — React + Vite + Tailwind CSS.
- **Backend & Auth** — Supabase (PostgreSQL + Realtime + Google OAuth).
- **AI** — Google Gemini API (gemini-2.5-flash-lite).
- **Hosting** — Vercel.

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

Active development — originally built as part of the Google Developer Buildathon.
