# LBYCPG3 SocialNet App - Profile Manager

A Social Network Profile Manager App built with **HTML**, **CSS**, **Bootstrap 5**, and **Supabase** for the LBYCPG3 Online Technologies Laboratory (Lab Activity 7 - Part I).

## Features

- **Profile Management:** Add, lookup, and delete profiles
- **Profile Display:** View profile picture, name, status, favorite quote, and friends list
- **Edit Profile:** Update status, quote, and profile picture
- **Friends Management:** Add and remove friends (bidirectional relationships)
- **Persistent Storage:** All data stored in Supabase PostgreSQL database
- **Responsive Layout:** Three-panel desktop layout that stacks vertically on mobile

## Tech Stack

- HTML5 + CSS3
- Bootstrap 5.3 (via CDN)
- Supabase (Backend-as-a-Service)
- Vanilla JavaScript (async/await)

## Setup

1. Create a free Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL blocks from the lab guide to create `profiles` and `friends` tables
3. Replace `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `js/app.js` with your credentials
4. Open with VS Code Live Server or deploy to Vercel

## Author

Bianca Louise V. Manganaan  
LBYCPG3 - De La Salle University Manila
