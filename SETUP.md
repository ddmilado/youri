# SiteAudit Setup Guide

## 1. Prerequisites
- Node.js 18+
- npm 9+
- Supabase project

## 2. Install Dependencies
```bash
npm install
```

## 3. Supabase Setup
1. Create a project at [supabase.com](https://supabase.com)
2. Open SQL Editor and run `supabase/schema.sql`
3. Enable Email and Google providers in Authentication settings
4. (Optional) Deploy the included Edge Function for mock processing:
   ```bash
   npm install -g supabase
   supabase functions deploy process-audit
   ```

## 4. Environment Variables
```bash
cp .env.example .env
```
Fill with your Supabase credentials.

## 5. Development
```bash
npm run dev
```
App runs on `http://localhost:5173`.

## 6. Production Build
```bash
npm run build
```

## 7. Deployment
Upload `dist` folder to Vercel/Netlify/Cloudflare Pages. Remember to configure environment variables.
