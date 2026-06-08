import axios from "axios";
import pool from "../db/pool.js";


function sizeToBytes(sizeStr) {
  const [value, unit] = sizeStr.split(' ');

  const num = parseFloat(value);

  switch (unit.toUpperCase()) {
    case 'GB':
      return Math.round(num * 1024 * 1024 * 1024);
    case 'MB':
      return Math.round(num * 1024 * 1024);
    case 'KB':
      return Math.round(num * 1024);
    default:
      return Math.round(num);
  }
}

export async function yts() {
  let page = 1;

  while (true) {
    const res = await axios.get(
      `https://yts.bz/api/v2/list_movies.json?page=${page}`
    );

    const movies = res.data?.data?.movies || [];

    if (!movies.length) break;

    for (const movie of movies) {
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

const sizeBytes = sizeToBytes(torrent.size);

        await pool.query(
          `INSERT INTO piratebay_movie_magnets (
            title,
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
            $1,$2,$3,$4,$5,$6,
            NOW(),
            FALSE,
            'movie',
            FALSE
          )`,
          [
            `${movie.title} ${movie.year} ${torrent.quality}`,
            magnet,
            movie.url,
            sizeBytes.toString(),
            torrent.seeds,
            torrent.peers
          ]
        );
      }
    }

    console.log(
      `Page ${page}: inserted ${movies.length} movies`
    );

    page++;
  }
}

export async function shouldRunYts() {
  const result = await pool.query(
    "SELECT value FROM app_state WHERE key = 'last_yts_run'"
  );

  if (result.rowCount === 0) {
    return true;
  }

  const lastRun = new Date(result.rows[0].value);
  const diffHours = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60);

  return diffHours >= 24;
}

export async function updateYtsRunTime() {
  await pool.query(`
    INSERT INTO app_state(key, value)
    VALUES ('last_yts_run', NOW()::text)
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value
  `);
}