// Solara Bay, an entry for make.fun's gta6-01 bounty (Node 22, standard library only).
//
// The game is this directory's game/ folder: an original open-world crime game on a sun-soaked
// coast, plain static files that desktop Chrome loads offline. game/index.html boots the ES
// modules under game/src/: city generation with palm boulevards and nine districts, vehicles,
// traffic and pedestrians, the Bay Police (wanted level, named units, helicopter, roadblocks,
// witnesses), rival crews, combat, eight story chapters with side jobs, respect ranks and garage
// upgrades, the HUD and minimap, HDR bloom with wet night roads, and procedural radio and sound.
// three.js is vendored as game/vendor/three.module.min.js.
//
// This program hands it in: it copies game/ and screenshots/ (four playable Chrome captures,
// ordered as shots.json lists them) from
// beside this file to /output and writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
// Solara Bay's screenshots are the four frames of real play listed in shots.json; warn if one is missing.
const shotList: { name: string }[] = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const missing = shotList.filter((shot) => !existsSync(join(here, 'screenshots', shot.name)));
if (missing.length) console.warn(`solara-bay: missing screenshots: ${missing.map((shot) => shot.name).join(', ')}`);
if (shotList.length > 4) console.warn(`solara-bay: shots.json lists ${shotList.length} screenshots; the gate takes 3 or 4`);

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
