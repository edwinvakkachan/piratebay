import axios from "axios";
import pool from "../db/pool.js";

async function getLastYtsId() {
  const result = await pool.query(
    "SELECT value FROM app_state WHERE key = 'last_yts_id'"
  );

  return result.rowCount
    ? parseInt(result.rows[0].value, 10)
    : 0;
}

async function setLastYtsId(id) {
  await pool.query(`
    INSERT INTO app_state(key, value)
    VALUES ('last_yts_id', $1)
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value
  `, [String(id)]);
}



export async function yts() {
  try {
    

  console.log('\n========== YTS SYNC START ==========');

  const lastKnownId = await getLastYtsId();

  console.log(`Last processed YTS ID: ${lastKnownId}`);

  let highestIdSeen = lastKnownId;
  let page = 1;
  let stop = false;

  let inserted = 0;

  while (!stop) {

    console.log(`Fetching page ${page}`);

    const res = await axios.get(
      `https://yts.bz/api/v2/list_movies.json?page=${page}`
    );

    const movies = res.data?.data?.movies || [];

    if (!movies.length) {
      console.log('No movies returned');
      break;
    }

    for (const movie of movies) {

      if (movie.id <= lastKnownId) {
        console.log(
          `Reached old movie ID ${movie.id}. Stopping.`
        );

        stop = true;
        break;
      }

      if (movie.id > highestIdSeen) {
        highestIdSeen = movie.id;
      }

      for (const torrent of movie.torrents) {

        const magnet =
          `magnet:?xt=urn:btih:${torrent.hash}` +
          `&dn=${encodeURIComponent(movie.title)}`;

        const exists = await pool.query(
          `SELECT 1
           FROM piratebay_movie_magnets
           WHERE magnet = $1
           LIMIT 1`,
          [magnet]
        );

        if (exists.rowCount > 0) continue;

       await pool.query(
  `INSERT INTO piratebay_movie_magnets (
      title,
      clean_title,
      year,
      imdb_id,
      magnet,
      source_url,
      size,
      seeders,
      leechers,
      created_at,
      sent_to_qbittorrent,
      media_type,
      skipped_duplicate
   )
   VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,
      NOW(),
      FALSE,
      'movie',
      FALSE
   )`,
  [
    `${movie.title} ${movie.year} ${torrent.quality}`,
    movie.title,
    movie.year,
    movie.imdb_code,
    magnet,
    movie.url,
    torrent.size_bytes.toString(),
    torrent.seeds,
    torrent.peers
  ]
);

        inserted++;
      }
    }

    page++;
  }

  if (highestIdSeen > lastKnownId) {
    await setLastYtsId(highestIdSeen);

    console.log(
      `Updated last_yts_id to ${highestIdSeen}`
    );
  }

  console.log(`Inserted: ${inserted}`);
  console.log('========== YTS SYNC COMPLETE ==========\n');

  } catch (error) {
    console.log('erron in yts()');
    console.log(error)
  }
}



