# SiteAudit

A beautiful, production-ready web application for website auditing.

## Features

- **Real Supabase Auth** - Email/password, Google OAuth, magic links
- **Beautiful Dashboard** - Stats, recent activity, animations
- **Audit Creation** - Simple URL input with validation
- **Real-time Updates** - Loading experience with live updates
- **Detailed Reports** - Issue tracking with PDF export
- **Jobs History** - View and manage all past audits
- **Dark/Light Mode** - Full theme support
- **Fully Responsive** - Perfect on mobile, tablet, and desktop

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up Supabase:
   - Create project at [supabase.com](https://supabase.com)
   - Run `supabase/schema.sql` in SQL Editor
   - Enable Email and Google auth providers

3. Configure environment:
   ```bash
   cp .env.example .env
   # Add your Supabase URL and anon key
   ```

4. Start development:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

## Tech Stack

- React 18 + TypeScript
- Vite 5
- Tailwind CSS
- Supabase
- TanStack React Query
- React Hook Form + Zod
- Framer Motion
- Lucide Icons

## Deployment

Deploy to Vercel, Netlify, or Cloudflare Pages.

Don't forget to set environment variables!

## License

MIT
