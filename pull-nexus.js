const fs = require("fs");

const key = process.env.NEXUS_API_KEY;
if (!key) {
  console.log("NEXUS_API_KEY is not set yet, skipping.");
  process.exit(0);
}

const BUILT_IN = [
  "https://www.nexusmods.com/peopleplayground/mods/257",
  "https://www.nexusmods.com/peopleplayground/mods/216",
  "https://www.nexusmods.com/peopleplayground/mods/256",
  "https://www.nexusmods.com/peopleplayground/mods/181",
  "https://www.nexusmods.com/peopleplayground/mods/156"
];

function readJson(path, fallback) {
  try { return JSON.parse(fs.readFileSync(path, "utf8")); } catch { return fallback; }
}

const urls = [...BUILT_IN, ...(readJson("mods.json", {}).mods || []).map(m => m.url)];
const found = new Map();
for (const u of urls) {
  const m = /nexusmods\.com\/([^/]+)\/mods\/(\d+)/.exec(u || "");
  if (m) found.set(m[1] + "/" + m[2], { game: m[1], id: m[2] });
}

const previous = readJson("mod-stats.json", {});
const stats = { ...(previous.stats || {}) };

(async () => {
  let failed = 0;
  for (const [k, { game, id }] of found) {
    const res = await fetch(`https://api.nexusmods.com/v1/games/${game}/mods/${id}.json`, {
      headers: { apikey: key, accept: "application/json", "Application-Name": "clipover-site", "Application-Version": "1.0" }
    });
    if (!res.ok) {
      console.error(k, "failed with status", res.status);
      failed++;
      continue;
    }
    const j = await res.json();
    stats[k] = { downloads: j.mod_downloads, unique: j.mod_unique_downloads, endorsements: j.endorsement_count };
  }
  if (found.size && failed === found.size) process.exit(1);
  if (JSON.stringify(stats) === JSON.stringify(previous.stats || {})) {
    console.log("No changes.");
    return;
  }
  fs.writeFileSync("mod-stats.json", JSON.stringify({ updated: new Date().toISOString(), stats }, null, 2) + "\n");
  console.log("Saved stats for", Object.keys(stats).length, "mods.");
})();
