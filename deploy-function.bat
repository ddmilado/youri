@echo off
REM Deploy the run-workflow Edge Function to Supabase
echo Deploying run-workflow Edge Function...
supabase functions deploy run-workflow

echo.
echo Deployment complete!
echo.
echo Function URL: https://szlepolifltozkkrqudq.supabase.co/functions/v1/run-workflow
echo.
echo To test the function, run:
echo supabase functions invoke run-workflow --body "{\"input_as_text\":\"software companies Germany site:.de\",\"user_id\":\"test-user-id\"}"
