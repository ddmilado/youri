# Deployment Guide - Fixing Blank Screen Issues

## The Problem

If you see a blank screen in production, it's almost certainly due to **missing environment variables**.

Vite apps require environment variables to be set **at build time** (not runtime). If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not available when you run `npm run build`, the app will now show a helpful error page instead of crashing with a blank screen.

## Solution: Set Environment Variables

### Option 1: Vercel

1. Go to your project settings
2. Navigate to **Environment Variables**
3. Add these variables:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. **Important**: Redeploy your app after adding variables

### Option 2: Netlify

1. Go to **Site settings** → **Environment variables**
2. Add the variables:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
3. **Important**: Trigger a new build after adding variables

### Option 3: Cloudflare Pages

1. Go to **Settings** → **Environment Variables**
2. Add for **Production** environment:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
3. **Important**: Redeploy after adding variables

### Option 4: Build Locally

If you're building locally and deploying static files:

1. Create `.env` file in project root:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Deploy the `dist` folder

## Getting Your Supabase Credentials

1. Go to [supabase.com](https://supabase.com)
2. Open your project
3. Go to **Project Settings** → **API**
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

## Troubleshooting

### Still seeing a blank screen?

1. **Check browser console** (F12) for errors
2. **Verify environment variables** are set in your hosting platform
3. **Ensure you triggered a rebuild** after adding variables
4. **Check the build logs** for any errors

### Seeing "Configuration Required" page?

This means the environment variables are missing. Follow the steps above to add them.

### Variables set but still not working?

- Environment variables must be prefixed with `VITE_`
- Variable names are case-sensitive
- You must rebuild/redeploy after adding them
- Check for typos in variable names

## Local Development

For local development, you can either:

1. Create a `.env` file (recommended):
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   npm run dev
   ```

2. Or use placeholder values to test the UI without Supabase:
   - The app will show the configuration error page
   - You can still see the UI by setting dummy values temporarily

## Important Notes

- **Never commit `.env` files** to git (already in `.gitignore`)
- **Don't expose your service role key** - only use the anon key
- Environment variables are baked into the build at build time
- Changes to env vars require a rebuild

## Quick Reference

```bash
# Local development
cp .env.example .env
# Add your credentials to .env
npm run dev

# Production build
# Set environment variables in your hosting platform
# Then deploy or rebuild

# Test production build locally
npm run build
npm run preview
```
