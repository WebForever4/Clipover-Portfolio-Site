const fs = require("fs");
const { DISCORD_BOT_TOKEN: token, DISCORD_CHANNEL_ID: channel, DISCORD_GUILD_ID: guild } = process.env;

if (!token || !channel) {
  console.log("Discord secrets are not set yet, skipping.");
  process.exit(0);
}

const clean = s => String(s || "")
  .replace(/<a?:\w+:\d+>/g, "")
  .replace(/<@[!&]?\d+>/g, "")
  .replace(/<#\d+>/g, "")
  .replace(/@(everyone|here)/g, "")
  .trim();

(async () => {
  const res = await fetch(`https://discord.com/api/v10/channels/${channel}/messages?limit=20`, {
    headers: { Authorization: "Bot " + token }
  });
  if (!res.ok) {
    console.error("Discord returned", res.status, await res.text());
    process.exit(1);
  }
  const messages = await res.json();
  const updates = messages
    .map(m => ({
      id: m.id,
      date: m.timestamp,
      text: clean(m.content),
      url: guild ? `https://discord.com/channels/${guild}/${channel}/${m.id}` : ""
    }))
    .filter(u => u.text)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  fs.writeFileSync("updates.json", JSON.stringify({ updates }, null, 2) + "\n");
  console.log("Saved", updates.length, "updates.");
})();
