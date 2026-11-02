import { CURRENCY, fmt, fmtDuration } from "./config.js";
import { rateCommand } from "./rate.js";
import * as eco from "./economy.js";

const GLOBAL = process.env.GLOBAL_ECONOMY === "true";

// Which economy this command belongs to.
function scope(ctx) {
  if (GLOBAL) return "global";
  const id = ctx.server?.id ?? ctx.message?.serverId;
  return id ? String(id) : "global";
}

// Who ran it (also keeps their name fresh for the leaderboard).
function me(ctx) {
  const name = ctx.author?.displayName ?? ctx.author?.username ?? null;
  return { s: scope(ctx), u: String(ctx.authorId), name };
}

export function registerCommands(client) {
  // "all" or a whole number above 0
  client.commands.types.register(
    "amount",
    (text) => {
      if (text.toLowerCase() === "all") return "all";
      const n = Number(text.replace(/[,_]/g, ""));
      return Number.isSafeInteger(n) && n > 0 ? n : undefined;
    },
    { message: "Use a whole number greater than 0, or `all`." }
  );

  // Per-server economies only make sense inside a server.
  const def = (command) =>
    client.commands.register({
      category: "Economy",
      serverOnly: !GLOBAL,
      cooldown: 2,
      ...command,
    });

  def({
    name: "balance",
    description: `Check a ${CURRENCY} balance`,
    options: [{ name: "user", type: "user", description: "Whose balance (default: you)" }],
    examples: ["/balance", "/balance @someone"],
    async run(ctx) {
      const { s, u, name } = me(ctx);
      const target = ctx.values.user;
      const id = target ? String(target.id) : u;
      const label = target ? (target.displayName ?? target.username ?? "Their") : "Your";
      const a = eco.account(s, id, target ? (target.username ?? undefined) : name);
      await ctx.reply(
        `**${label} balance**\n` +
          `Wallet: ${fmt(a.wallet)}\n` +
          `Bank: ${fmt(a.bank)}\n` +
          `Total: ${fmt(a.wallet + a.bank)}`
      );
    },
  });

  def({
    name: "daily",
    description: `Claim your daily ${CURRENCY}`,
    async run(ctx) {
      const { s, u, name } = me(ctx);
      eco.account(s, u, name);
      const r = eco.daily(s, u);
      if (!r.ok) return ctx.error(`Already claimed. Come back in ${fmtDuration(r.wait)}.`);
      await ctx.reply(`You claimed your daily ${fmt(r.amount)}.`);
    },
  });

  def({
    name: "work",
    description: `Work a shift for some ${CURRENCY}`,
    async run(ctx) {
      const { s, u, name } = me(ctx);
      eco.account(s, u, name);
      const r = eco.work(s, u);
      if (!r.ok) return ctx.error(`You're tired. Rest for ${fmtDuration(r.wait)}.`);
      await ctx.reply(`You worked a shift and earned ${fmt(r.amount)}.`);
    },
  });

  def({
    name: "pay",
    description: `Send ${CURRENCY} to someone`,
    options: [
      { name: "user", type: "user", required: true, description: "Who to pay" },
      { name: "amount", type: "amount", required: true, description: "How much, or all" },
    ],
    examples: ["/pay @someone 5"],
    async run(ctx) {
      const { s, u, name } = me(ctx);
      const { user, amount } = ctx.values;
      eco.account(s, u, name);
      eco.account(s, String(user.id), user.username ?? undefined);
      const r = eco.pay(s, u, String(user.id), amount);
      if (!r.ok) return ctx.error(r.error);
      await ctx.reply(`Sent ${fmt(r.amount)} to ${user.displayName ?? user.username}.`);
    },
  });

  def({
    name: "deposit",
    description: "Move money from your wallet to your bank",
    options: [{ name: "amount", type: "amount", required: true }],
    async run(ctx) {
      const { s, u, name } = me(ctx);
      eco.account(s, u, name);
      const r = eco.deposit(s, u, ctx.values.amount);
      if (!r.ok) return ctx.error(r.error);
      await ctx.reply(`Deposited ${fmt(r.amount)}.`);
    },
  });

  def({
    name: "withdraw",
    description: "Move money from your bank to your wallet",
    options: [{ name: "amount", type: "amount", required: true }],
    async run(ctx) {
      const { s, u, name } = me(ctx);
      eco.account(s, u, name);
      const r = eco.withdraw(s, u, ctx.values.amount);
      if (!r.ok) return ctx.error(r.error);
      await ctx.reply(`Withdrew ${fmt(r.amount)}.`);
    },
  });

  def({
    name: "leaderboard",
    description: "Richest users",
    aliases: ["top", "lb"],
    async run(ctx) {
      const rows = eco.leaderboard(scope(ctx));
      if (!rows.length) return ctx.error("Nobody has an account yet. Try `/daily`.");
      await ctx.reply(
        "**Richest users**\n" +
          rows.map((r, i) => `${i + 1}. ${r.username ?? r.user_id}: ${fmt(r.total)}`).join("\n")
      );
    },
  });

  def({
    name: "shop",
    description: "See what's for sale",
    async run(ctx) {
      const items = eco.listItems(scope(ctx));
      if (!items.length) return ctx.error("The shop is empty.");
      await ctx.reply(
        "**Shop**\n" +
          items
            .map((i) => `${i.name}: ${fmt(i.price)}${i.description ? ` - ${i.description}` : ""}`)
            .join("\n")
      );
    },
  });

  def({
    name: "buy",
    description: "Buy an item from the shop",
    options: [
      { name: "item", required: true, description: "Item name" },
      { name: "quantity", type: "integer", min: 1, default: 1 },
    ],
    examples: ["/buy sword 2"],
    async run(ctx) {
      const { s, u, name } = me(ctx);
      eco.account(s, u, name);
      const r = eco.buy(s, u, ctx.values.item, ctx.values.quantity);
      if (!r.ok) return ctx.error(r.error);
      await ctx.reply(`Bought ${r.qty}x ${r.item} for ${fmt(r.cost)}.`);
    },
  });

  def({
    name: "inventory",
    description: "See what you own",
    aliases: ["inv"],
    async run(ctx) {
      const { s, u } = me(ctx);
      const items = eco.inventory(s, u);
      if (!items.length) return ctx.error("Your inventory is empty.");
      await ctx.reply("**Inventory**\n" + items.map((i) => `${i.qty}x ${i.item}`).join("\n"));
    },
  });

  def({
    name: "rate",
    description: `What 1 ${CURRENCY.slice(0, -1)} is worth in a real currency`,
    options: [{ name: "symbol", required: true, description: "Currency symbol, like USD or EUR" }],
    examples: ["/rate USD", "/rate EUR"],
    async run(ctx) {
      await ctx.reply(await rateCommand(ctx.values.symbol));
    },
  });

  def({
    name: "additem",
    description: "Owner only: add or update a shop item",
    ownerOnly: true,
    options: [
      { name: "name", required: true, description: "One-word item name" },
      { name: "price", type: "integer", min: 1, required: true },
      { name: "description", rest: true },
    ],
    examples: ["/additem sword 5 A very sharp sword"],
    async run(ctx) {
      const { name, price, description } = ctx.values;
      eco.addItem(scope(ctx), name, price, description ?? "");
      await ctx.reply(`Shop item \`${name.toLowerCase()}\` set to ${fmt(price)}.`);
    },
  });

  def({
    name: "removeitem",
    description: "Owner only: remove a shop item",
    ownerOnly: true,
    options: [{ name: "name", required: true }],
    async run(ctx) {
      const { name } = ctx.values;
      if (!eco.removeItem(scope(ctx), name)) return ctx.error(`There's no item called \`${name}\`.`);
      await ctx.reply(`Removed \`${name.toLowerCase()}\`.`);
    },
  });
}
