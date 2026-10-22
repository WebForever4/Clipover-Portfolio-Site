const fs = require("fs");
const { DISCORD_BOT_TOKEN: token, DISCORD_WISHES_CHANNEL_ID: channel } = process.env;
if (!token || !channel) { console.log("Wishes secrets are not set yet, skipping."); process.exit(0); }

const readJson = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fb; } };
const settings = readJson("settings.json", {});
const W = settings.wishes || {};
const removed = new Set(settings.removedWishes || []);

/* Same word filter as the site, so the blocked list you edit in Settings applies here too. */
const norm = t => String(t).toLowerCase().replace(/[0@]/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/[5$]/g, "s").replace(/7/g, "t");
function blocked(text) {
  if (W.blockLinks !== false && /(https?:\/\/|www\.|\.(com|net|org|gg|io|ru|xyz)\b|discord\.gg)/i.test(text)) return true;
  const n = norm(text), words = n.split(/[^a-z]+/).filter(Boolean), squashed = n.replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
  return (W.words || []).map(x => norm(x.trim()).replace(/[^a-z ]/g, "")).filter(Boolean).some(b => {
    if (b.includes(" ")) return n.includes(b);
    const bs = b.replace(/(.)\1+/g, "$1");
    return words.includes(b) || (bs.length >= 4 && squashed.includes(bs));
  });
}
const clean = s => String(s || "").replace(/<a?:\w+:\d+>/g, "").replace(/<@[!&]?\d+>/g, "").replace(/<#\d+>/g, "").replace(/@(everyone|here)/g, "").trim();

(async () => {
  const res = await fetch(`https://discord.com/api/v10/channels/${channel}/messages?limit=100`, { headers: { Authorization: "Bot " + token } });
  if (!res.ok) { console.error("Discord returned", res.status, await res.text()); process.exit(1); }
  const fresh = (await res.json()).filter(m => m.webhook_id).map(m => {
    const t = clean(m.content), i = t.indexOf(": ");
    return { id: m.id, name: (i > 0 ? t.slice(0, i) : "A friend").slice(0, 30), text: (i > 0 ? t.slice(i + 2) : t).slice(0, 200), date: m.timestamp };
  }).filter(w => w.text);
  const previous = readJson("wishes.json", {}).wishes || [];
  const byId = new Map([...previous, ...fresh].map(w => [w.id, w]));
  const wishes = [...byId.values()].filter(w => !removed.has(w.id) && !blocked(w.name + " " + w.text)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200);
  if (JSON.stringify(wishes) === JSON.stringify(previous)) { console.log("No changes."); return; }
  fs.writeFileSync("wishes.json", JSON.stringify({ wishes }, null, 2) + "\n");
  console.log("Saved", wishes.length, "wishes.");
})();
