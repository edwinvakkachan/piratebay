// import { initDB } from "./db/db.js";
import { loginQB, addMagnet,moveTorrentToTop } from "./qbittorrent/qb.js";
import pool from "./db/pool.js";
import { delay } from "./delay.js";



export async function addToTorrent() {
  try {
   

    const result = await pool.query(`
     SELECT *
FROM piratebay_movie_magnets
WHERE sent_to_qbittorrent = FALSE
ORDER BY created_at ASC
    `);

    const rows = result.rows;

    await loginQB();
    console.log("adding torrents from DB");

    for (const value of rows) {
 try {
  await addMagnet(value.magnet, value.title);

  await pool.query(
    `UPDATE piratebay_movie_magnets
     SET sent_to_qbittorrent = TRUE
     WHERE id = $1`,
    [value.id]
  );
} catch (error) {
  console.error(`Failed to add: ${value.title}`);
}
    }

    console.log("adding complete");
 await delay(1000);
 await moveTorrentToTop();
  } catch (error) {
    console.error(error);
  }
}
