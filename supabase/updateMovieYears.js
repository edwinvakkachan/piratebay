import pool from "../db/pool.js";



async function extractYear(title) {
  if (!title) return null;

  const currentYear = new Date().getFullYear() + 2;

  // Remove common release info
  const cleaned = title.replace(
    /\b(S\d{1,2}E\d{1,2}|720p|1080p|2160p|WEB[- ]DL|WEBRip|BluRay|HDTV|x264|x265|H264|H265|HEVC|AMZN|NF|EZTV)\b/gi,
    " "
  );

  const matches = [...cleaned.matchAll(/\b(19\d{2}|20\d{2})\b/g)];

  if (!matches.length) return null;

  return Number(matches[matches.length - 1][1]);
}

export async function updateMovieYears() {
  try {
    console.log("================================");
    console.log("🎬 Updating Movie Years");
    console.log("================================");


const movies = await pool.query(`
    SELECT id,original_title
        FROM trakt_cache
    WHERE imdb_id IS NOT NULL
      AND   year IS NULL

    `);


for (const movie of movies.rows){

    const year = await extractYear(movie.original_title);
    if (year) {
        await pool.query(
            `UPDATE trakt_cache 
            SET year = $1, 
                trakt_type = 'movie'
            WHERE id = $2`,
            [year, movie.id]
        );
        console.log(`${movie.original_title} updated ${year}`)
    }
}


    console.log(`✅ Updated ${movies.rowCount} movies`);
  } catch (err) {
    console.error("❌ Failed to update movie years:", err);
  }
}