// Shared types, constants and pure calculations.

export type Env = {
  DB: D1Database;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  DEV_ALLOW_INSECURE?: string;
};

export type Player = {
  id: number;
  name: string;
  nickname: string | null;
  rep_hand: string | null;
};

export type Game = {
  id: number;
  name: string;
  date: string;
  base_buyin: number;
  cash: number;
  bb_size: number;
  memo: string | null;
  include_dashboard: number;
  status: 'open' | 'closed';
  host_player_id: number | null;
  diff_mode: 'host' | 'ratio' | null;
  diff_chips: number;
  closed_by: string | null;
  closed_at: string | null;
};

export type GameRow = {
  game_id: number;
  player_id: number;
  buyin: number;
  chips: string | null; // JSON chip counts by denomination, e.g. {"1":7,"5":2,"100":25}; NULL for migrated history
  end_chips: number | null;
  adj: number;
  memo: string | null;
  sort_order: number;
  name: string;
  nickname: string | null;
};

export type NameMode = 'nick' | 'real';
export type Unit = 'chips' | 'bb';

// Hard-coded chip set (decided: 1 白 / 5 綠 / 10 藍 / 50 紅 / 100 黑)
export const DENOMS = [
  { key: 'c1', value: 1, label: '白', bg: '#f4f4f0', fg: '#1c1917', ring: '#a8a29e' },
  { key: 'c5', value: 5, label: '綠', bg: '#15803d', fg: '#ffffff', ring: '#14532d' },
  { key: 'c10', value: 10, label: '藍', bg: '#1d4ed8', fg: '#ffffff', ring: '#1e3a8a' },
  { key: 'c50', value: 50, label: '紅', bg: '#b91c1c', fg: '#ffffff', ring: '#7f1d1d' },
  { key: 'c100', value: 100, label: '黑', bg: '#18181b', fg: '#ffffff', ring: '#52525b' },
] as const;
export type DenomKey = (typeof DENOMS)[number]['key'];

export const SYSTEM_PLAYER_ID = 0;

export function displayName(p: { name: string; nickname: string | null }, mode: NameMode): string {
  return mode === 'real' ? p.name : p.nickname || p.name;
}

/** Chip counts keyed by denomination value as a string ("1", "5", "10", "50", "100"). */
export type ChipCounts = Partial<Record<string, number>>;

/** Parse the `chips` JSON column; anything malformed is treated as "not counted". */
export function parseChips(json: string | null): ChipCounts {
  if (!json) return {};
  try {
    const o = JSON.parse(json);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    const out: ChipCounts = {};
    for (const d of DENOMS) {
      const v = o[String(d.value)];
      if (Number.isInteger(v) && v >= 0) out[String(d.value)] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Total chip value, or null when no denomination has been entered. */
export function chipTotal(counts: ChipCounts): number | null {
  let any = false;
  let sum = 0;
  for (const d of DENOMS) {
    const v = counts[String(d.value)];
    if (v !== undefined) {
      any = true;
      sum += v * d.value;
    }
  }
  return any ? sum : null;
}

/** Net result in chips for one row (end + adjustment - buy-in). */
export function net(r: { end_chips: number | null; adj: number; buyin: number }): number {
  return (r.end_chips ?? 0) + r.adj - r.buyin;
}

export function dollarsPerChip(g: Pick<Game, 'cash' | 'base_buyin'>): number {
  return g.base_buyin > 0 ? g.cash / g.base_buyin : 0;
}

/**
 * Allocate a chip imbalance so that the game sums to zero.
 * diff = sum(end) - sum(buyin). The adjustments sum to -diff.
 *  - host:  the host takes the whole adjustment.
 *  - ratio: winners share it pro-rata to their winnings (largest-remainder rounding).
 *           Falls back to host when nobody is up.
 */
export function allocateDiff(
  rows: { player_id: number; buyin: number; end_chips: number }[],
  mode: 'host' | 'ratio',
  hostId: number,
): { diff: number; adj: Map<number, number>; usedMode: 'host' | 'ratio' } {
  const diff = rows.reduce((s, r) => s + r.end_chips - r.buyin, 0);
  const adj = new Map<number, number>(rows.map((r) => [r.player_id, 0]));
  if (diff === 0) return { diff, adj, usedMode: mode };
  const target = -diff;

  const winners = rows
    .map((r) => ({ id: r.player_id, w: r.end_chips - r.buyin }))
    .filter((x) => x.w > 0);
  const totalW = winners.reduce((s, x) => s + x.w, 0);

  if (mode === 'host' || totalW === 0) {
    adj.set(hostId, target);
    return { diff, adj, usedMode: 'host' };
  }

  const sign = Math.sign(target);
  const abs = Math.abs(target);
  const shares = winners.map((x) => {
    const exact = (abs * x.w) / totalW;
    return { id: x.id, base: Math.floor(exact), frac: exact - Math.floor(exact), w: x.w };
  });
  let rest = abs - shares.reduce((s, x) => s + x.base, 0);
  shares.sort((a, b) => b.frac - a.frac || b.w - a.w);
  for (const s of shares) {
    if (rest <= 0) break;
    s.base += 1;
    rest -= 1;
  }
  for (const s of shares) adj.set(s.id, sign * s.base);
  return { diff, adj, usedMode: 'ratio' };
}

export function vancouverToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export const fmt = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const signed = (n: number, digits = 0) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n), digits);

export const money = (n: number) => (n > 0 ? '+$' : n < 0 ? '−$' : '$') + fmt(Math.abs(n), 2);

// ---------------------------------------------------------------- head-to-head

export type H2HGame = { game_id: number; a: number; b: number };
export type H2HCell = { n: number; diff: number; wins: number; losses: number; games: H2HGame[] };

/**
 * Pairwise comparison over co-attended games only.
 * diff(A,B) = Σ (net_A − net_B) / 2 — antisymmetric by construction, and equal to A's own result
 * in a heads-up game (net_B = −net_A). wins = games where A finished ahead of B.
 */
export function headToHead(rows: { game_id: number; player_id: number; v: number }[]): Map<string, H2HCell> {
  const byGame = new Map<number, { player_id: number; v: number }[]>();
  for (const r of rows) {
    if (!byGame.has(r.game_id)) byGame.set(r.game_id, []);
    byGame.get(r.game_id)!.push(r);
  }
  const out = new Map<string, H2HCell>();
  const cell = (a: number, b: number) => {
    const k = `${a}:${b}`;
    let c = out.get(k);
    if (!c) out.set(k, (c = { n: 0, diff: 0, wins: 0, losses: 0, games: [] }));
    return c;
  };
  for (const [game_id, ps] of byGame) {
    for (const x of ps)
      for (const y of ps) {
        if (x.player_id === y.player_id) continue;
        const c = cell(x.player_id, y.player_id);
        c.n++;
        c.diff += (x.v - y.v) / 2;
        if (x.v > y.v) c.wins++;
        else if (x.v < y.v) c.losses++;
        c.games.push({ game_id, a: x.v, b: y.v });
      }
  }
  return out;
}
// ---------------------------------------------------------------- settlement

/**
 * Convert dollar amounts to integer cents so that rounding never breaks a zero sum:
 * each value is floored, then the leftover cents go to the largest remainders.
 */
export function toCents(dollars: number[]): number[] {
  const exact = dollars.map((d) => d * 100);
  const base = exact.map((x) => Math.floor(x + 1e-9));
  let rest = Math.round(exact.reduce((s, x) => s + x, 0)) - base.reduce((s, x) => s + x, 0);
  const order = exact.map((x, i) => ({ i, f: x - base[i] })).sort((a, b) => b.f - a.f);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) base[order[k].i] += 1;
  return base;
}

export type Transfer = { from: number; to: number; cents: number };

/**
 * Min cash flow, greedy: pair the largest debtor with the largest creditor until all are settled.
 * Every step zeroes at least one balance, so the result has at most n - 1 transfers.
 * Not guaranteed globally minimal (that problem is NP-hard) but fine for a home game.
 * `unsettled` is the sum of the input; anything but 0 means the chips were miscounted.
 */
export function settle(balances: { id: number; cents: number }[]): { transfers: Transfer[]; unsettled: number } {
  const unsettled = balances.reduce((s, b) => s + b.cents, 0);
  const debt = balances.filter((b) => b.cents < 0).map((b) => ({ id: b.id, v: -b.cents }));
  const cred = balances.filter((b) => b.cents > 0).map((b) => ({ id: b.id, v: b.cents }));
  const transfers: Transfer[] = [];
  const top = (a: { v: number }[]) => a.reduce((m, x, i) => (x.v > a[m].v ? i : m), 0);
  while (debt.length && cred.length) {
    const di = top(debt);
    const ci = top(cred);
    const amt = Math.min(debt[di].v, cred[ci].v);
    transfers.push({ from: debt[di].id, to: cred[ci].id, cents: amt });
    debt[di].v -= amt;
    cred[ci].v -= amt;
    if (debt[di].v === 0) debt.splice(di, 1);
    if (cred[ci].v === 0) cred.splice(ci, 1);
  }
  return { transfers, unsettled };
}

export const dollars = (cents: number) => '$' + fmt(cents / 100, 2);
