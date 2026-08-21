import "dotenv/config";
import { delay } from "./delay.js";
import {
  triggerHomeAssistantWebhook,
  triggerHomeAssistantWebhookWhenErrorOccurs
} from "./homeassistant/homeAssistantWebhook.js";
import { log } from "./timelog.js";
import { retry } from "./homeassistant/retryWrapper.js";
import { publishMessage } from "./queue/publishMessage.js";
import { initDB } from "./db/db.js";
import { yts } from "./yts/yts.js";
import { eztv } from "./eztv/eztv.js";
import { buildTraktCache } from "./traktv/traktv.js";
import { piratebayTv,piratebaymovie } from "./piratebay/piratebay.js";
import { populateMetadataFromOMDb } from "./omdb/populateMetadataFromOMDb.js";
import { extractEpisodeAndSeasonDetails } from "./addingtorrents/extractEpisodeAndSeasonDetails.js.js";
import { updateMovieYears } from "./supabase/updateMovieYears.js";
import { detectTraktTVShows } from "./supabase/detectTraktTVShows.js";
import { clearOldTaggedTorrentItems } from "./clearOldpiratebay_movie_magnets.js";



async function main() {
  try {
    await log();

    console.log("Pirate Bay movie scraping process started");


    await initDB();
    console.log("db is ready");

    await delay(1000);
    await piratebayTv();
    await delay(1000);
    await piratebaymovie();
    await delay(1000);
    await yts();
    await delay(1000);
    await eztv();



  await buildTraktCache();
  await updateMovieYears();
  await detectTraktTVShows();
  await populateMetadataFromOMDb(); 
  await extractEpisodeAndSeasonDetails();

  await clearOldTaggedTorrentItems();


   console.log('testing finished');
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
