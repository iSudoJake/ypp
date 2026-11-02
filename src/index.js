import "dotenv/config";
import { Client, Events } from "yapin.js";
import { registerCommands } from "./commands.js";

// help: true adds a built-in /help that lists every command by category
const client = new Client({ commands: { help: true } });

client.on(Events.CommandError, (error, ctx) => {
  console.error(`/${ctx.command.path} failed for ${ctx.author?.username}:`, error);
});

registerCommands(client);

// Token: your own bot -> YAPIN_TOKEN. On Yapin's bot hosting the hosting token
// (YAPPER_BOT_TOKEN) is picked up automatically.
await client.login(process.env.YAPIN_TOKEN);
console.log("Yap++ Bucks bot is running.");
