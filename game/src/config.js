// Solara Bay: shared tuning constants. Every distance is in metres, every time in seconds.
// The city is a 10 x 10 grid of blocks; roads run on the grid lines between them.

export const GAME_TITLE = 'Solara Bay';
export const SAVE_KEY = 'solarabay.save.v1';
export const SETTINGS_KEY = 'solarabay.settings.v1';

/** Fixed simulation step: the world advances in 1/60 s ticks. */
export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;

/** City grid: block pitch = block + road. */
export const GRID = {
  cols: 10,
  rows: 10,
  pitch: 70,
  road: 14,
  sidewalk: 4,
  origin: -350, // x/z of grid line 0
  laneOffset: 3.5,
};
export const BLOCK_SIZE = GRID.pitch - GRID.road; // 56 m including sidewalks
export const WATER_LEVEL = -1.4;
export const CITY_SEED = 20261119;

/** Real seconds per in-game hour. */
export const HOUR_SECONDS = 60;

export const PLAYER = {
  radius: 0.4,
  walkSpeed: 4.2,
  sprintSpeed: 7.6,
  jumpSpeed: 6.2,
  gravity: 19,
  maxHealth: 100,
  maxArmor: 100,
  enterRange: 4.2,
};

export const POPULATION = {
  traffic: 24,
  trafficSpawnMin: 70,
  trafficSpawnMax: 160,
  trafficDespawn: 210,
  peds: 30,
  pedSpawnMin: 25,
  pedSpawnMax: 95,
  pedDespawn: 130,
};

/** Wanted level tuning: how many units chase at each star level. */
export const WANTED = {
  maxStars: 5,
  copCars: [0, 1, 2, 3, 4, 5],
  sightRange: 75,
  evadeBase: 9,
  evadePerStar: 2.5,
  roadblockFromStar: 3,
  helicopterFromStar: 4,
};

export const COLORS = {
  sunsetPink: '#ff5f8f',
  sunsetOrange: '#ff9a3c',
  sunsetGold: '#ffd166',
  neonCyan: '#3ef2ff',
  neonMagenta: '#ff3ec8',
  mint: '#7dffb3',
};
