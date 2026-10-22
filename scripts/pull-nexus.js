const fs = require("fs");

const key = process.env.NEXUS_API_KEY;
if (!key) {
  console.log("NEXUS_API_KEY is not set yet, skipping.");
  process.exit(0);
}

const GAME = "peopleplayground";
const API = "https://api.nexusmods.com/v1";
const headers = { apikey: key, accept: "application/json", "Application-Name": "clipover-site", "Application-Version": "2.0" };

/* Mods that are always listed, even if they are not yours (credit is kept on the site). */
const BUILT_IN = [257, 216, 256, 181, 156].map(id => ({ game: GAME, id }));

const readJson = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fb; } };

async function api(path) {
  const res = await fetch(API + path, { headers });
  if (!res.ok) { const e = new Error(path + " failed with status " + res.status); e.status = res.status; throw e; }
  return res.json();
}

const iso = t => (t ? new Date(t * 1000).toISOString() : "");
const toEntry = m => {
  const game = m.domain_name || GAME;
  return {
    key: game + "/" + m.mod_id,
    title: m.name || "",
    desc: m.summary || "",
    author: m.author || "",
    url: `https://www.nexusmods.com/${game}/mods/${m.mod_id}`,
    image: m.picture_url || "",
    version: m.version || "",
    downloads: m.mod_downloads || 0,
    unique: m.mod_unique_downloads || 0,
    endorsements: m.endorsement_count || 0,
    created: m.created_time || iso(m.created_timestamp),
    updated: m.updated_time || iso(m.updated_timestamp)
  };
};
const live = m => m && (!m.status || m.status === "published") && m.available !== false;

(async () => {
  const previous = readJson("nexus-mods.json", {});
  const prev = new Map((previous.mods || []).map(m => [m.key, m]));
  const out = new Map();
  let failed = 0;

  /* 1. Mods you listed by hand: the built-ins above and any Nexus links added to mods.json. */
  const wanted = new Map(BUILT_IN.map(b => [b.game + "/" + b.id, b]));
  for (const m of readJson("mods.json", {}).mods || []) {
    const hit = /nexusmods\.com\/([^/]+)\/mods\/(\d+)/.exec(m.url || "");
    if (hit) wanted.set(hit[1] + "/" + hit[2], { game: hit[1], id: Number(hit[2]) });
  }

  /* 2. Mods found on your account. Nexus has no "my files" endpoint, so ask who the key belongs to,
        then check your tracked mods and the newest added/updated mods for the game. */
  let me = null;
  try { me = await api("/users/validate.json"); } catch (e) { console.error("Could not read account:", e.message); failed++; }
  const mine = m => me && ((m.user && m.user.member_id === me.user_id) || m.uploaded_by === me.name);

  const found = [];
  if (me) {
    for (const path of ["/games/" + GAME + "/mods/latest_added.json", "/games/" + GAME + "/mods/latest_updated.json"]) {
      try { found.push(...(await api(path))); } catch (e) { console.error(e.message); }
    }
    try {
      const tracked = await api("/user/tracked_mods.json");
      for (const t of tracked) if (t.domain_name === GAME) wanted.set(GAME + "/" + t.mod_id, { game: GAME, id: Number(t.mod_id), discovered: true });
    } catch (e) { console.error(e.message); }
  }
  for (const m of found) if (live(m) && mine(m)) out.set((m.domain_name || GAME) + "/" + m.mod_id, toEntry({ ...m, domain_name: m.domain_name || GAME }));

  /* 3. Fetch full details for everything wanted. Discovered mods are only kept if they are yours. */
  for (const [k, w] of wanted) {
    try {
      const m = await api(`/games/${w.game}/mods/${w.id}.json`);
      if (!live(m)) continue;
      if (w.discovered && !mine(m)) continue;
      out.set(k, toEntry(m));
    } catch (e) {
      console.error(k, e.message);
      failed++;
      if (prev.has(k)) out.set(k, prev.get(k));
    }
  }

  /* Copy each mod's Nexus thumbnail into the repo (mod-thumbs/) so it is served from your own site. */
  fs.mkdirSync("mod-thumbs", { recursive: true });
  for (const e of out.values()) {
    if (!/^https?:/.test(e.image || "")) continue;
    const old = prev.get(e.key);
    if (old && old.imageSrc === e.image && old.image && fs.existsSync(old.image)) { e.imageSrc = old.imageSrc; e.image = old.image; continue; }
    try {
      const r = await fetch(e.image);
      if (!r.ok) throw new Error("status " + r.status);
      const ct = r.headers.get("content-type") || "";
      const file = `mod-thumbs/${e.key.replace("/", "-")}.${ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg"}`;
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      e.imageSrc = e.image; e.image = file;
    } catch (err) { console.error("thumbnail", e.key, err.message); }
  }

  if (!out.size && failed) process.exit(1);
  const mods = [...out.values()].sort((a, b) => (b.created || "").localeCompare(a.created || ""));
  if (JSON.stringify(mods) === JSON.stringify(previous.mods || [])) { console.log("No changes."); return; }
  fs.writeFileSync("nexus-mods.json", JSON.stringify({ updated: new Date().toISOString(), mods }, null, 2) + "\n");
  console.log("Saved", mods.length, "mods.");
})();
