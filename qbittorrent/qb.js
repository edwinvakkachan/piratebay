import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import dotenv from "dotenv";
dotenv.config();
import { delay } from "../delay.js";

const jar = new CookieJar();

export const qb = wrapper(axios.create({
  baseURL: process.env.QBITIP,
  jar,
  withCredentials: true
}));

export async function loginQB() {
  await qb.post("/api/v2/auth/login", 
    new URLSearchParams({
      username: process.env.QBITUSER,
      password: process.env.QBITPASS
    })
  );
}

export async function addMagnet(magnet, title = "") {

  const today = new Date().toISOString().split("T")[0]; 
  const params = new URLSearchParams({
    urls: magnet,
    category: "movies",
    tags: `piratebay,movies,category-200,auto,${today}`
  });

  if (title) {
    params.set("rename", title);
  }

  await qb.post("/api/v2/torrents/add",
    params
  );
}

export async function moveTorrentToTop() {
  const today = new Date().toISOString().split("T")[0];

  const { data: torrents } = await qb.get("/api/v2/torrents/info");

  // Get ALL torrents added today (by tag)
  const addedTorrents = torrents.filter(t =>
    t.tags && t.tags.includes(today)
  );

  if (addedTorrents.length === 0) {
    console.log("❌ No torrents found to move.");
    return;
  }

  // Collect all hashes
  const hashes = addedTorrents.map(t => t.hash).join("|");

  await delay(2000);

  await qb.post(
    "/api/v2/torrents/topPrio",
    new URLSearchParams({
      hashes
    })
  );

  console.log(`✅ Moved ${addedTorrents.length} torrents to top.`);
}
