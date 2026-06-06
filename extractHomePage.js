import axios from "axios";
import { load } from "cheerio";
import { getSearchUrl } from "./getBaseUrlFromDB.js";
import { delay } from "./delay.js";
import { publishMessage } from "./queue/publishMessage.js";

function toAbsoluteUrl(href, baseUrl) {
  if (!href) return null;
  return href.startsWith("http") ? href : new URL(href, baseUrl).href;
}

function parseCount(value) {
  const count = Number.parseInt(String(value || "").replace(/[^\d]/g, ""), 10);
  return Number.isNaN(count) ? null : count;
}

function extractSize(text) {
  const match =
    text.match(/Size\s+([0-9.]+\s*(KiB|MiB|GiB|TiB|KB|MB|GB|TB))/i) ||
    text.match(/\b([0-9.]+\s*(KiB|MiB|GiB|TiB|KB|MB|GB|TB))\b/i);

  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

function extractTitle($, magnetElement, row) {
  const titleFromRow = row
    .find("a.detLink, a[href*='/torrent/'], a[href*='/description.php']")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  if (titleFromRow) return titleFromRow;

  return $(magnetElement)
    .closest("tr, li, div")
    .text()
    .replace(/\s+/g, " ")
    .trim() || "Pirate Bay movie";
}

function extractSourceUrl($, row, searchUrl) {
  const rawHref = row
    .find("a.detLink, a[href*='/torrent/'], a[href*='/description.php']")
    .first()
    .attr("href");

  return toAbsoluteUrl(rawHref, searchUrl);
}

function extractSeedStats($, row) {
  const numericCells = row
    .find("td")
    .map((_, cell) => parseCount($(cell).text()))
    .get()
    .filter((value) => value !== null);

  if (numericCells.length >= 2) {
    return {
      seeders: numericCells[numericCells.length - 2],
      leechers: numericCells[numericCells.length - 1]
    };
  }

  return { seeders: null, leechers: null };
}

export async function scrapePirateBayMovieMagnets() {
  try {
    const searchUrl = await getSearchUrl();

    console.log(`Current Pirate Bay movie search URL is: ${searchUrl}`);
    await publishMessage({
      message: `Current Pirate Bay movie search URL is: ${searchUrl}`
    });

    const { data } = await axios.get(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      },
      timeout: 10000
    });

    const $ = load(data);
    const torrentsByMagnet = new Map();

    $("a[href^='magnet:?']").each((_, element) => {
      const magnet = $(element).attr("href");
      if (!magnet) return;

      const row = $(element).closest("tr, li, div");
      const rowText = row.text().replace(/\s+/g, " ").trim();
      const { seeders, leechers } = extractSeedStats($, row);

      torrentsByMagnet.set(magnet, {
        title: extractTitle($, element, row),
        magnet,
        sourceUrl: extractSourceUrl($, row, searchUrl),
        size: extractSize(rowText),
        seeders,
        leechers
      });
    });

    const torrents = [...torrentsByMagnet.values()];
    console.log(`Total Pirate Bay movie magnets found: ${torrents.length}`);
    await delay(1000, true);
    return torrents;
  } catch (error) {
    console.error("Pirate Bay movie scrape error:", error.message);
    return [];
  }
}
