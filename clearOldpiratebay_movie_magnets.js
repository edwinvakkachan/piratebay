import pool from "./db/pool.js";

export async function clearOldTaggedTorrentItems() {
  try {
    const result = await pool.query(`
      DELETE FROM piratebay_movie_magnets
      WHERE created_at < NOW() - INTERVAL '30 days'
    `);

    console.log(
      `Deleted ${result.rowCount} completed tagged torrent items older than 90 days.`
    );
  } catch (err) {
    console.error("Failed to clear old tagged torrent items:", err);
  }
}