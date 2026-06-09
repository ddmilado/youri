

curl -i -X POST https://szlepolifltozkkrqudq.supabase.co/functions/v1/hermes-keyword-callback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 4a1e384d5004660ac5f009493ba6b0cc959efa545ba8947a598be49cfff373a4" \
  -d '{
    "search_id": "manual-test",
    "user_id": "74a9451d-7723-4cb5-ab82-30518541deab",
    "search_query": "manual callback test",
    "status": "success",
    "results": [
      {
        "company_name": "Manual Test Company",
        "website": "https://example.com",
        "company_description": "Manual callback test result."
      }
    ]
  }'

  Find 3 Dutch companies in food, health, wellness, fitness, supplements, beauty, or performance brands that sell internationally through a webshop and have an estimated EUR 500k+ revenue signal. Return callback results using the required schema.

  cd /Users/ram/Desktop/DevProjects/youri/hermes-wrapper

PORT=3001 \
HERMES_WEBHOOK_SECRET="fc3d03003bc7f16c2a34862455c4f33a207048bbc72d42f566e3d38975f7093f" \
HERMES_CALLBACK_TOKEN="YOUR_CALLBACK_TOKEN_THAT_ALREADY_WORKED" \
RESEARCH_COMMAND="node ./sample-research-command.js" \
npm start


PORT=3001 \
HERMES_WEBHOOK_SECRET="..." \
HERMES_CALLBACK_TOKEN="..." \
RESEARCH_COMMAND="THE_REAL_HERMES_COMMAND_HERE" \
npm start

cd /Users/ram/Desktop/DevProjects/youri/hermes-wrapper

PORT=3001 \
HERMES_WEBHOOK_SECRET="fc3d03003bc7f16c2a34862455c4f33a207048bbc72d42f566e3d38975f7093f" \
HERMES_CALLBACK_TOKEN="4a1e384d5004660ac5f009493ba6b0cc959efa545ba8947a598be49cfff373a4" \
RESEARCH_COMMAND="node ./hermes-research-command.js" \
npm start