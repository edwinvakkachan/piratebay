import 'dotenv/config';
import { extractPage } from "./extractMagnetLink/extractMagnetLink.js";
import { scrapeMalayalamLinks } from "./extractHomePage.js";
import { addToTorrent} from "./addTOTorrent.js";
import { checkDomain } from "./domainTracker.js";
import { delay } from "./delay.js";
import { triggerHomeAssistantWebhook,triggerHomeAssistantWebhookWhenErrorOccurs } from "./homeassistant/homeAssistantWebhook.js";
import { insertLinkIfNew } from "./db/db.js";
import { log } from "./timelog.js";
import { retry } from "./homeassistant/retryWrapper.js";
import { publishMessage } from "./queue/publishMessage.js";
import { initDB } from "./db/db.js";




async function main() {
  try {

await log();
    console.log("🚀  tamilrockers scraping Process started");
           
    await publishMessage({
  message: "🚀  tamilrockers scraping Process started"
});
    await initDB();

    console.log('db is ready');

   const result = await checkDomain();

    if(result){
      console.log('♻️♻️♻️since domain changed, no logs will be displayed');
       await publishMessage({
message: `♻️♻️♻️ since domain changed, no logs will be displayed`
});
    }

   await delay(1000)

    const links = await scrapeMalayalamLinks();

    // console.log(links)



    if (!links || links.size === 0) {
      console.log("💥 No links found.");
              await publishMessage({
  message: "💥 No links found."
});
      await retry(
  triggerHomeAssistantWebhookWhenErrorOccurs,
  { status: "error" },
  "homeassistant-error",
  5
);
      return;
    }

    
    console.log(`💤💤💤 it will take 5 minutes to complete `);



    for (const value of links) {
  try {
    const isNew = await insertLinkIfNew(value);

    if (!isNew) {
      // console.log("⏩ Skipping already processed:", value);
      continue;
    }

if(!result){

  console.log("🫛 🆕 New link:", value);
      await publishMessage({
message: `🆕 🫛 New link: ${value}`
});

}


    await extractPage(value);

  } catch (err) {
    console.error(`Error processing link: ${value}`);
    console.error(err.message);
            await publishMessage({
  message: "❌ Error processing link "
});
  }
}


   await delay(1000);
    await addToTorrent();

    await delay(1000)

    console.log("🆗 Process completed and links are saved in db and added inside the torrent");
  
    await retry(
  triggerHomeAssistantWebhook,
  { status: "success" },
  "homeassistant-success",
  5
);


            await publishMessage({
  message: 'tramil rockers scraping completed successfully 💯'
});

await log();

process.exit(0)

  } catch (error) {
    console.error("Fatal error in main():");
    console.error(error);

            await publishMessage({
  message: "❌  Fatal error in main():"
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