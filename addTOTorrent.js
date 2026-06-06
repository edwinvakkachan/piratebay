// import { initDB } from "./db/db.js";
import { loginQB, addMagnet,moveTorrentToTop } from "./qbittorrent/qb.js";
import pool from "./db/pool.js";
import { delay } from "./delay.js";



export async function addToTorrent() {
  try {
   

    const result = await pool.query(`
      SELECT * FROM piratebay_movie_magnets
      WHERE created_at >= NOW() - INTERVAL '3 hours'
      ORDER BY created_at DESC
    `);

    const rows = result.rows;

    await loginQB();
    console.log("adding torrents from DB");

    for (const value of rows) {
      await addMagnet(value.magnet, value.title);
    }

    console.log("adding complete");
 await delay(1000);
 await moveTorrentToTop();
  } catch (error) {
    console.error(error);
  }
}
