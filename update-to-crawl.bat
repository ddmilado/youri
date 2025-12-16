@echo off
echo Updating Firecrawl from scrape to crawl...

REM This is a guide - you'll need to manually update line 80-115 in:
REM c:\Users\user\Desktop\yourintai\supabase\functions\run-workflow\index.ts

REM Replace the scrape API call (line 89):
REM FROM: https://api.firecrawl.dev/v1/scrape
REM TO:   https://api.firecrawl.dev/v1/crawl

REM And add crawl polling logic after starting the crawl

echo.
echo Please make the following changes in run-workflow/index.ts:
echo.
echo 1. Change line 89 from '/v1/scrape' to '/v1/crawl'
echo 2. Change line 96-99 to include: limit: 10, scrapeOptions: {...}
echo 3. Add crawl polling logic (see updated code below)
echo.
echo Then redeploy: supabase functions deploy run-workflow
