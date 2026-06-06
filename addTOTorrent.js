// import { initDB } from "./db/db.js";
import { loginQB, addMagnet,moveTorrentToTop } from "./qbittorrent/qb.js";
import pool from "./db/pool.js";
import { delay } from "./delay.js";



export async function addToTorrent() {
  try {
   

const MIN_MOVIE_YEAR = 2025;

const result = await pool.query(`
  SELECT *
  FROM piratebay_movie_magnets
  WHERE sent_to_qbittorrent = FALSE
    AND (
      (
        media_type = 'tv'
        AND (
          size IS NULL
          OR CAST(size AS BIGINT) < 2147483648
        )
      )
      OR
      (
        media_type = 'movie'
        AND (
          size IS NULL
          OR CAST(size AS BIGINT) < 3221225472
        )
        AND CAST(
          substring(title FROM '(19|20)[0-9]{2}')
          AS INTEGER
        ) >= $1
      )
    )
  ORDER BY created_at ASC
`, [MIN_MOVIE_YEAR]);

    const rows = result.rows;
const episodeMap = new Map();

for (const row of rows) {
  if (row.media_type !== "tv") {
    episodeMap.set(`movie-${row.id}`, row);
    continue;
  }

  const match = row.title.match(/S(\d+)E(\d+)/i);

  if (!match) {
    episodeMap.set(`tv-${row.id}`, row);
    continue;
  }

const showName = row.title
  .replace(/S\d+E\d+.*/i, "")
  .trim()
  .toLowerCase();

const key = `${showName}-S${match[1]}E${match[2]}`;

  const existing = episodeMap.get(key);

  if (
    !existing ||
    Number(row.seeders) > Number(existing.seeders)
  ) {
    episodeMap.set(key, row);
  }
}

const filteredRows = [...episodeMap.values()];





    await loginQB();
    console.log("adding torrents from DB");

    for (const value of filteredRows) {
 try {

  const category =
  value.media_type === "tv"
    ? "qbit4tbTV"
    : "2tbEnglish";

await addMagnet(
  value.magnet,
  value.title,
  category
);

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
