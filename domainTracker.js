import axios from "axios";
import pool from "./db/pool.js";
  // your existing DB connection


  
import { publishMessage } from "./queue/publishMessage.js";
import { retry } from "./homeassistant/retryWrapper.js";
import { triggerHomeAssistantWebhookWhenErrorOccurs } from "./homeassistant/homeAssistantWebhook.js";



// Get Final Redirect
async function getFinalUrl(url) {
  try {
    const response = await axios.get(url, {
      maxRedirects: 10,
      timeout: 10000
    });

    return response.request.res.responseUrl;

  } catch (err) {
    console.error("Request Error:", err.message);
    return null;
  }
}


// Extract Domain
function extractDomain(url) {
  return new URL(url).origin;
}


// Core Logic
export async function checkDomain() {
let result;
try {
     result = await pool.query(
      "SELECT value FROM settings WHERE key = $1",
      ["current_domain"]
    );
} catch (error) {
  console.error('current domain db check error',error);
         await retry(
    triggerHomeAssistantWebhookWhenErrorOccurs,
    { status: "error" },
    "homeassistant-error",
    5
  );

  process.exit(1);
}

  if (result.rows.length === 0) {
    console.log("☠️ No domain found in DB.");
        await publishMessage({
  message: "☠️ No domain found in DB."
});
    return;
  }

  const currentDomain = result.rows[0].value;

  console.log(`[${new Date().toISOString()}] Checking ${currentDomain}`);

  const finalUrl = await getFinalUrl(currentDomain);
  if (!finalUrl) return;

  const newDomain = extractDomain(finalUrl);

  if (newDomain !== currentDomain) {

  try {
      await pool.query(
        "UPDATE settings SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2",
        [newDomain, "current_domain"]
      );
  } catch (error) {
    console.error('checking old and new domain db error',error)
           await retry(
    triggerHomeAssistantWebhookWhenErrorOccurs,
    { status: "error" },
    "homeassistant-error",
    5
  );

  process.exit(1);
  }

    const message = `
🚨 *Domain Updated*

Old: ${currentDomain}
New: ${newDomain}
Time: ${new Date().toLocaleString()}
`;

            await publishMessage({
  message: message
});

    console.log("Domain updated in DB:", newDomain);

    return true;
  } else {

            await publishMessage({
  message: "✔️ Domain unchanged."
});
    console.log("✔️  Domain unchanged.");
    return false;
  }

}
