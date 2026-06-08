import pool from "../db/pool.js";

function parseTitle(title) {

  const originalTitle = title;

  // Find year anywhere in title
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? parseInt(yearMatch[0]) : null;

  let searchTitle = title
    .replace(/\./g, " ")

    // remove season/episode info
    .replace(/\bS\d{1,2}E\d{1,2}\b.*$/i, "")
    .replace(/\bS\d{1,2}\b.*$/i, "")

    // remove quality tags
    .replace(
      /\b(2160p|1080p|720p|480p|WEBRip|WEB-DL|BluRay|HDRip|DVDRip|BRRip|x264|x265|HEVC|AAC|DDP5\.1|AMZN|NF)\b.*$/i,
      ""
    )

    // remove brackets
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")

    .replace(/\s+/g, " ")
    .replace(/[()[\]]/g, "")
    .trim();

  return {
    searchTitle,
    year,
    originalTitle
  };
}

function detectMediaType(title, dbMediaType) {

  const tvPatterns = [
    /\bS\d{1,2}E\d{1,2}\b/i,
    /\bE\d{1,2}\b/i,
    /\bSeason\s+\d+\b/i,
    /\bSeasons\s+\d+\b/i,
    /\bComplete\s+Series\b/i,
    /\bComplete\s+Season\b/i
  ];

  if (tvPatterns.some(p => p.test(title))) {
    return "show";
  }

  return dbMediaType === "tv"
    ? "show"
    : "movie";
}

export async function buildTraktCache() {

  console.log("========== BUILDING TRAKT CACHE ==========");

  const torrents = await pool.query(`
    SELECT
      id,
      title,
      media_type
    FROM piratebay_movie_magnets
    ORDER BY id
  `);

  console.log(`Found ${torrents.rowCount} torrents`);

  let cacheCreated = 0;
  let mappingsCreated = 0;

  for (const torrent of torrents.rows) {

const skipPatterns = [
  /\bpack\b/i,
  /\bboxset\b/i,
  /\bcollection\b/i,
  /\bbest pictures\b/i,
  /\b\d+\s+movies\b/i
];

if (skipPatterns.some(r => r.test(torrent.title))) {
  continue;
}



    const {
  searchTitle,
  year,
  originalTitle
} = parseTitle(torrent.title);

    if (!searchTitle) continue;

    let cacheId;

const existingCache = await pool.query(
  `
  SELECT id
  FROM trakt_cache
  WHERE LOWER(search_title) = LOWER($1)
    AND COALESCE(year,0) = COALESCE($2,0)
  LIMIT 1
  `,
  [searchTitle, year]
);

    if (existingCache.rowCount > 0) {

      cacheId = existingCache.rows[0].id;

    } else {



const traktType = detectMediaType(
  torrent.title,
  torrent.media_type
);

const listName =
  traktType === "show"
    ? "showsEnglish"
    : "Movie English";





const insertedCache = await pool.query(
  `
  INSERT INTO trakt_cache (
    search_title,
    original_title,
    year,
    trakt_type,
    list_name
  )
  VALUES (
    $1,
    $2,
    $3,
    $4,
    $5
  )
  RETURNING id
  `,
  [
    searchTitle,
    originalTitle,
    year,
    traktType,
    listName
  ]
);

      cacheId = insertedCache.rows[0].id;
      cacheCreated++;

      console.log(
        `[CACHE] ${searchTitle} -> cache_id=${cacheId}`
      );
    }

    const mappingExists = await pool.query(
      `
      SELECT 1
      FROM torrent_trakt_match
      WHERE torrent_id = $1
      LIMIT 1
      `,
      [torrent.id]
    );

    if (mappingExists.rowCount === 0) {

      await pool.query(
        `
        INSERT INTO torrent_trakt_match (
          torrent_id,
          cache_id
        )
        VALUES (
          $1,
          $2
        )
        `,
        [
          torrent.id,
          cacheId
        ]
      );

      mappingsCreated++;
    }
  }

  console.log("========== COMPLETE ==========");
  console.log(`Cache entries created: ${cacheCreated}`);
  console.log(`Mappings created: ${mappingsCreated}`);
}