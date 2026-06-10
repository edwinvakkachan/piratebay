
import pool from "../db/pool.js";




function extractSeasonEpisode(title) {
  const match = title.match(/S(\d+)E(\d+)/i);

  if (!match) {
    return {
      season: null,
      episode: null
    };
  }

  return {
    season: parseInt(match[1], 10),
    episode: parseInt(match[2], 10)
  };
}

export async function extractEpisodeAndSeasonDetails(imdb_id){

const shows = await pool.query(`
    SELECT *
FROM piratebay_movie_magnets
WHERE imdb_id = $1
  `,[
    imdb_id
  ]);

for (const show of shows.rows){

    const { season, episode } =
  extractSeasonEpisode(show.title);
await pool.query(`
  UPDATE piratebay_movie_magnets
  SET season = $1,
      episode = $2
  WHERE id = $3
`, [
  season,
  episode,
  show.id
]);
  
}

}