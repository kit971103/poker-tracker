// Verifiable seat draw.
// seed   = sha256("date|gameId|sorted names joined by \n|nonce") as hex
// rng    = sfc32 seeded with the first 16 bytes of the seed
// result = Fisher–Yates shuffle of [names..., empty seats...]; the button is then drawn among occupied seats.
// The nonce is random and generated at draw time, so the seed cannot be predicted beforehand;
// every input is shown afterwards, so anyone can recompute it. Re-draws are new rows, never overwrites.
//
// The two functions below are self-contained on purpose: the page ships their source
// (Function.prototype.toString) to the browser, so the "verify" button runs the exact same code.

export function seedInput(date: string, gameId: number | null, names: string[], nonce: string): string {
  return [date, gameId === null ? '' : String(gameId), [...names].sort().join('\n'), nonce].join('|');
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function drawSeats(seedHex: string, names: string[], seats: number): { result: (string | null)[]; button: number } {
  let a = parseInt(seedHex.slice(0, 8), 16) >>> 0;
  let b = parseInt(seedHex.slice(8, 16), 16) >>> 0;
  let c = parseInt(seedHex.slice(16, 24), 16) >>> 0;
  let d = parseInt(seedHex.slice(24, 32), 16) >>> 0;
  // sfc32
  const next = () => {
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) >>> 0;
    return t;
  };
  for (let i = 0; i < 12; i++) next();
  // unbiased integer in [0, n) by rejection sampling
  const below = (n: number) => {
    const limit = 4294967296 - (4294967296 % n);
    let x = next();
    while (x >= limit) x = next();
    return x % n;
  };
  const sorted = [...names].sort();
  const result: (string | null)[] = sorted.concat(Array(Math.max(0, seats - sorted.length)).fill(null));
  for (let i = result.length - 1; i > 0; i--) {
    const j = below(i + 1);
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  const occupied: number[] = [];
  result.forEach((n, i) => {
    if (n !== null) occupied.push(i + 1);
  });
  const button = occupied.length ? occupied[below(occupied.length)] : 1;
  return { result, button };
}
