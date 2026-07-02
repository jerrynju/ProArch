// ULID: 48-bit timestamp + 80-bit randomness, Crockford base32.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

let lastTime = 0;
let lastRand: number[] = [];

function encodeTime(time: number): string {
  let out = '';
  for (let i = 9; i >= 0; i--) {
    out = ALPHABET[time % 32] + out;
    time = Math.floor(time / 32);
  }
  return out;
}

export function ulid(now: number = Date.now()): string {
  // Monotonic within the same millisecond so sort order stays stable.
  if (now === lastTime) {
    for (let i = 15; i >= 0; i--) {
      lastRand[i] = (lastRand[i] + 1) % 32;
      if (lastRand[i] !== 0) break;
    }
  } else {
    lastTime = now;
    lastRand = Array.from({ length: 16 }, () => Math.floor(Math.random() * 32));
  }
  return encodeTime(now) + lastRand.map((v) => ALPHABET[v]).join('');
}

export function isUlid(s: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{10,26}$/.test(s);
}
