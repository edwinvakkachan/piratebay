import { scrapePirateBayMovieMagnets } from "../extractHomePage.js";
import { saveMagnets } from "../db/saveMagnets.js";
import { retry } from "../homeassistant/retryWrapper.js";
import { triggerHomeAssistantWebhookWhenErrorOccurs } from "../homeassistant/homeAssistantWebhook.js";


export async function privatebay(){
    console.log('privatebay torrents scraping started');
        const torrents = await scrapePirateBayMovieMagnets();
    
        if (!torrents || torrents.length === 0) {
          console.log("No Pirate Bay movie magnets found.");
          await publishMessage({
            message: "No Pirate Bay movie magnets found."
          });
          await retry(
            triggerHomeAssistantWebhookWhenErrorOccurs,
            { status: "error" },
            "homeassistant-error",
            5
          );
          return;
        }
    
        console.log(`Saving ${torrents.length} Pirate Bay movie magnets`);
        await saveMagnets(torrents);
}