# Yap++ Bucks economy bot

A Yapin' bot with its own currency, **Yap++ Bucks (YB)**. 1 YB is worth 1,000,000 USD.
Built on [yapin.js](https://github.com/yapin-js/yapin.js).

## Setup (PowerShell)

```powershell
cd yap-economy-bot
npm install yapin.js dotenv better-sqlite3
copy .env.example .env
notepad .env        # paste your bot token
npm start
```

Needs Node 18.17 or newer. Get a token in Yapin' under **Settings -> Developer**
(type a name, press Create, copy it from the Token tab; it's shown once).

## Commands

| Command | What it does |
| --- | --- |
| `/balance [user]` | Wallet, bank and total |
| `/daily` | 25 YB every 24 hours |
| `/work` | 1-5 YB every hour |
| `/pay <user> <amount\|all>` | Send YB to someone |
| `/deposit` / `/withdraw <amount\|all>` | Move YB between wallet and bank |
| `/leaderboard` | Top 10 by wallet + bank |
| `/shop`, `/buy <item> [qty]`, `/inventory` | Shop and items |
| `/rate <symbol>` | What 1 YB is worth in a real currency, e.g. `/rate EUR` |
| `/additem <name> <price> [desc]`, `/removeitem <name>` | Bot owner only |
| `/help` | Built in, lists everything |

## Files

- `src/index.js` starts the client
- `src/commands.js` every command, with typed options (yapin.js parses and validates them)
- `src/economy.js` all money logic (SQLite transactions, integer balances)
- `src/rate.js` the `/rate` command
- `src/config.js` amounts, cooldowns, currency name
- `src/db.js` SQLite schema (stored in `data/economy.db`)

## Notes

- Economies are per server. Set `GLOBAL_ECONOMY=true` for one shared economy (commands
  then also work in DMs).
- `/additem` and `/removeitem` use yapin.js's `ownerOnly`, so they work for the bot
  owner set in Settings -> Developer. Shop item names are one word.
- If a user's name shows up as a raw ID on the leaderboard, their name field isn't
  `displayName` or `username`; change `me()` in `src/commands.js`.
