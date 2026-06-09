import pool from "../db/pool.js";
import axios from "axios";
import { radarrSonnarToTorrent } from "../qbittorrent/qb.js";







export async function sendMissingRadarrSonarrToQbit() {
  console.log("========================================");
  console.log("🚀 Radarr/Sonarr → qBittorrent Started");
  console.log("========================================");

  try {


  const wantedResult = await pool.query(`
  SELECT *
  FROM radarrsonarr
  WHERE removed = FALSE
    AND source = 'radarr'
    AND COALESCE(size_on_disk,0) = 0
    AND EXISTS (
      SELECT 1
      FROM unnest(tag_names) AS tag
      WHERE LOWER(tag) = 'sitescrapemovies'
    )
  ORDER BY title
`);

    console.log(
      `📚 Found ${wantedResult.rows.length} missing movies/shows`
    );

    let added = 0;
    let notFound = 0;

    for (const item of wantedResult.rows) {
      console.log("");
      console.log(
        `🔍 Searching: ${item.title} (${item.source})`
      );

const torrentResult = await pool.query(`
  SELECT *
  FROM piratebay_movie_magnets
  WHERE LOWER(title) LIKE LOWER($1)
    AND media_type = 'movie'
    AND CAST(size AS BIGINT) < 3221225472
    AND sent_to_qbittorrent = FALSE
    AND COALESCE(skipped_duplicate,FALSE) = FALSE
  ORDER BY seeders DESC
  LIMIT 1
`, [`%${item.title}%`]);

      if (torrentResult.rows.length === 0) {
        console.log(`❌ No torrent found`);
        notFound++;
        continue;
      }

      const torrent = torrentResult.rows[0];

      console.log(
        `✅ Match Found`
      );
      console.log(
        `   Torrent : ${torrent.title}`
      );
      console.log(
        `   Seeders : ${torrent.seeders}`
      );
      console.log(
        `   Size    : ${(
          Number(torrent.size) /
          1024 /
          1024 /
          1024
        ).toFixed(2)} GB`
      );

      try {
        await radarrSonnarToTorrent(torrent.magnet)

        await pool.query(`
          UPDATE piratebay_movie_magnets
          SET sent_to_qbittorrent = TRUE
          WHERE id = $1
        `, [torrent.id]);

        console.log("📥 Sent to qBittorrent");

        added++;
      } catch (err) {
        console.error(
          `❌ qBittorrent Error:`,
          err.message
        );
      }
    }

    console.log("");
    console.log("========================================");
    console.log(`✅ Added     : ${added}`);
    console.log(`❌ Not Found : ${notFound}`);
    console.log("🏁 Completed");
    console.log("========================================");

  } catch (err) {
    console.error(
      "❌ Radarr/Sonarr Sync Failed:",
      err.message
    );
  }
}