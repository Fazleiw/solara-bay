// Seeded pseudo-random numbers (mulberry32). The whole game draws from `rng` so a fixed
// ?seed= reproduces the same traffic, pedestrians and police for the screenshot scenes; the
// city itself is built from its own fixed-seed generator so it never changes between runs.

export function createRandom(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
    reseed: (value) => { state = value >>> 0; },
  };
}

/** The game-wide generator for everything that moves. */
export const rng = createRandom(Date.now() & 0xffffffff);
