import "dotenv/config";
import { scrapePirateBayMovieMagnets } from "./extractHomePage.js";
import { addToTorrent  } from "./addTOTorrent.js";
import { delay } from "./delay.js";
import { deleteLargePirateBayTorrents } from "./qbittorrent/torrentCleanUp.js";
import {
  triggerHomeAssistantWebhook,
  triggerHomeAssistantWebhookWhenErrorOccurs
} from "./homeassistant/homeAssistantWebhook.js";
import { log } from "./timelog.js";
import { retry } from "./homeassistant/retryWrapper.js";
import { publishMessage } from "./queue/publishMessage.js";
import { initDB } from "./db/db.js";
import { saveMagnets } from "./db/saveMagnets.js";
import { isQBittorrentAvailable } from "./qbittorrent/qb.js";

async function main() {
  try {
    await log();

    console.log("Pirate Bay movie scraping process started");
    await publishMessage({
      message: "Pirate Bay movie scraping process started"
    });

    await initDB();
    console.log("db is ready");

    await delay(1000);

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

    await delay(1000);
    const result = await isQBittorrentAvailable();
    if(result){
      await addToTorrent();
      await delay(1000);
      await deleteLargePirateBayTorrents();
      await delay(1000);
      console.log("Process completed: movie magnets are saved in DB and added to qBittorrent");
      await retry(
        triggerHomeAssistantWebhook,
        { status: "success" },
        "homeassistant-success",
        5
      );
      
    }



    await publishMessage({
      message: "Pirate Bay movie scraping completed successfully"
    });

    await log();
  } catch (error) {
    console.error("Fatal error in main():");
    console.error(error);

    await publishMessage({
      message: "Fatal error in main()"
    });

    await retry(
      triggerHomeAssistantWebhookWhenErrorOccurs,
      { status: "error" },
      "homeassistant-error",
      5
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
  });
