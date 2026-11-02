// /rate logic. Needs Node 18+ (built-in fetch).

import { USD_PER_YB } from "./config.js";

const API_URL = "https://open.er-api.com/v6/latest/USD"; // free, no key
const CACHE_MS = 60 * 60 * 1000;

let cache = { rates: null, fetchedAt: 0 };

async function getRates() {
  if (cache.rates && Date.now() - cache.fetchedAt < CACHE_MS) return cache.rates;
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.result !== "success") throw new Error("API returned failure");
    cache = { rates: data.rates, fetchedAt: Date.now() };
  } catch (err) {
    if (!cache.rates) throw err; // fall back to stale rates if we have any
  }
  return cache.rates;
}

function money(n, code) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${code}`;
  }
}

export async function rateCommand(symbolArg) {
  const code = String(symbolArg || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    return "Give me a 3-letter currency symbol, like `/rate USD` or `/rate EUR`.";
  }

  let rates;
  try {
    rates = await getRates();
  } catch {
    return "Couldn't fetch exchange rates right now. Try again in a bit.";
  }

  const perUsd = rates[code];
  if (!perUsd) return `I don't know the currency \`${code}\`.`;

  const ybInCode = USD_PER_YB * perUsd;
  const codeInYb = 1 / ybInCode;

  return (
    `1 Yap++ Buck = **${money(ybInCode, code)}**\n` +
    `1 ${code} = ${codeInYb.toExponential(3)} Yap++ Bucks`
  );
}
