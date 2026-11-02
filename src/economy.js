// All money logic. Every balance change happens inside a SQLite transaction,
// and balances are integers, so nothing can be duplicated or go negative.

import { db } from "./db.js";
import {
  STARTING_WALLET,
  DAILY_AMOUNT,
  DAILY_COOLDOWN_MS,
  WORK_MIN,
  WORK_MAX,
  WORK_COOLDOWN_MS,
  LEADERBOARD_SIZE,
  fmt,
} from "./config.js";

const insertUser = db.prepare(
  "INSERT OR IGNORE INTO users (server_id, user_id, username, wallet) VALUES (?, ?, ?, ?)"
);
const setName = db.prepare(
  "UPDATE users SET username = ? WHERE server_id = ? AND user_id = ?"
);
const selectUser = db.prepare(
  "SELECT * FROM users WHERE server_id = ? AND user_id = ?"
);

/** Get (and create if needed) an account. Pass username to keep it fresh. */
export function account(serverId, userId, username) {
  insertUser.run(serverId, userId, username ?? null, STARTING_WALLET);
  if (username) setName.run(username, serverId, userId);
  return selectUser.get(serverId, userId);
}

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function makeClaim(column, cooldownMs, roll) {
  const update = db.prepare(
    `UPDATE users SET wallet = wallet + ?, ${column} = ? WHERE server_id = ? AND user_id = ?`
  );
  return db.transaction((serverId, userId) => {
    const a = account(serverId, userId);
    const now = Date.now();
    const wait = a[column] + cooldownMs - now;
    if (wait > 0) return { ok: false, wait };
    const amount = roll();
    update.run(amount, now, serverId, userId);
    return { ok: true, amount };
  });
}

export const daily = makeClaim("last_daily", DAILY_COOLDOWN_MS, () => DAILY_AMOUNT);
export const work = makeClaim("last_work", WORK_COOLDOWN_MS, () =>
  randInt(WORK_MIN, WORK_MAX)
);

const moveToBank = db.prepare(
  "UPDATE users SET wallet = wallet - ?, bank = bank + ? WHERE server_id = ? AND user_id = ?"
);
const moveToWallet = db.prepare(
  "UPDATE users SET bank = bank - ?, wallet = wallet + ? WHERE server_id = ? AND user_id = ?"
);

export const deposit = db.transaction((serverId, userId, amount) => {
  const a = account(serverId, userId);
  const n = amount === "all" ? a.wallet : amount;
  if (n <= 0) return { ok: false, error: "You have nothing to deposit." };
  if (n > a.wallet)
    return { ok: false, error: `You only have ${fmt(a.wallet)} in your wallet.` };
  moveToBank.run(n, n, serverId, userId);
  return { ok: true, amount: n };
});

export const withdraw = db.transaction((serverId, userId, amount) => {
  const a = account(serverId, userId);
  const n = amount === "all" ? a.bank : amount;
  if (n <= 0) return { ok: false, error: "You have nothing to withdraw." };
  if (n > a.bank)
    return { ok: false, error: `You only have ${fmt(a.bank)} in your bank.` };
  moveToWallet.run(n, n, serverId, userId);
  return { ok: true, amount: n };
});

const takeWallet = db.prepare(
  "UPDATE users SET wallet = wallet - ? WHERE server_id = ? AND user_id = ?"
);
const giveWallet = db.prepare(
  "UPDATE users SET wallet = wallet + ? WHERE server_id = ? AND user_id = ?"
);

export const pay = db.transaction((serverId, fromId, toId, amount) => {
  if (fromId === toId) return { ok: false, error: "You can't pay yourself." };
  const a = account(serverId, fromId);
  account(serverId, toId);
  const n = amount === "all" ? a.wallet : amount;
  if (n <= 0) return { ok: false, error: "You have nothing to send." };
  if (n > a.wallet)
    return { ok: false, error: `You only have ${fmt(a.wallet)} in your wallet.` };
  takeWallet.run(n, serverId, fromId);
  giveWallet.run(n, serverId, toId);
  return { ok: true, amount: n };
});

export function leaderboard(serverId) {
  return db
    .prepare(
      `SELECT user_id, username, wallet + bank AS total
       FROM users WHERE server_id = ?
       ORDER BY total DESC LIMIT ?`
    )
    .all(serverId, LEADERBOARD_SIZE);
}

// ---- shop -----------------------------------------------------------------

export function listItems(serverId) {
  return db
    .prepare("SELECT * FROM items WHERE server_id = ? ORDER BY price ASC")
    .all(serverId);
}

export function addItem(serverId, name, price, description) {
  db.prepare(
    `INSERT INTO items (server_id, name, price, description) VALUES (?, ?, ?, ?)
     ON CONFLICT (server_id, name) DO UPDATE SET price = excluded.price, description = excluded.description`
  ).run(serverId, name.toLowerCase(), price, description);
}

export function removeItem(serverId, name) {
  return (
    db
      .prepare("DELETE FROM items WHERE server_id = ? AND name = ?")
      .run(serverId, name.toLowerCase()).changes > 0
  );
}

export const buy = db.transaction((serverId, userId, name, qty) => {
  const item = db
    .prepare("SELECT * FROM items WHERE server_id = ? AND name = ?")
    .get(serverId, name.toLowerCase());
  if (!item) return { ok: false, error: `There's no item called \`${name}\`.` };

  const a = account(serverId, userId);
  const cost = item.price * qty;
  if (cost > a.wallet)
    return {
      ok: false,
      error: `That costs ${fmt(cost)} and you only have ${fmt(a.wallet)} in your wallet.`,
    };

  takeWallet.run(cost, serverId, userId);
  db.prepare(
    `INSERT INTO inventory (server_id, user_id, item, qty) VALUES (?, ?, ?, ?)
     ON CONFLICT (server_id, user_id, item) DO UPDATE SET qty = qty + excluded.qty`
  ).run(serverId, userId, item.name, qty);
  return { ok: true, item: item.name, qty, cost };
});

export function inventory(serverId, userId) {
  return db
    .prepare(
      "SELECT item, qty FROM inventory WHERE server_id = ? AND user_id = ? ORDER BY item"
    )
    .all(serverId, userId);
}
