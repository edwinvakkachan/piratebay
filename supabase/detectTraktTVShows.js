import pool from "../db/pool.js";

async  function detectTraktType(title) {
  if (!title) return null;

  const t = title.trim();

  // TV Show patterns
  if (/\bS\d{1,2}E\d{1,3}\b/i.test(t)) {
    return "tv";
  }

  if (/\bSeason\s+\d+\b/i.test(t)) {
    return "tv";
  }

  if (/\bEpisode\s+\d+\b/i.test(t)) {
    return "tv";
  }

  // Movie patterns
  if (/\b(19\d{2}|20\d{2})\b.*\b(720p|1080p|2160p)\b/i.test(t)) {
    return "movie";
  }

  return null;
}

export async function detectTraktTVShows(){
try {
    console.log("================================");
    console.log("🎬 Detecting tv shows from the tabel trac_catch");
    console.log("================================");
const shows = await pool.query(`
  SELECT id, original_title
  FROM trakt_cache
  WHERE imdb_id IS NOT NULL
    AND trakt_type IS NULL
`);


for (const show of shows.rows) {
  const type = await detectTraktType(show.original_title);

  if (!type) continue;

  await pool.query(
    `
    UPDATE trakt_cache
    SET trakt_type = $1
    WHERE id = $2
    `,
    [type, show.id]
  );

  console.log(`${show.original_title} to tv`)
}
} catch (error) {
    console.log(error)
}


}