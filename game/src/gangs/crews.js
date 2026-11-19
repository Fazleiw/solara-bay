// The rival crews of Solara Bay, their colours, their bosses and the turf each one holds:
// the Saltjaw Crew (Gideon Pike's dock gang, Ironwake Docks) and the Velvet Knives (Mara
// Velasco's neon racket, Deco Row). gangs/territory.js posts their soldiers on their turf.

export const CREWS = {
  saltjaw: {
    id: 'saltjaw', name: 'Saltjaw Crew', short: 'SALTJAW', color: '#ff4b4b', boss: 'pike', turf: ['port'],
    look: (r) => ({
      skin: r.pick(['#e0ac69', '#c68642', '#8d5524', '#f1c27d']),
      hair: '#1b1b1b', hairStyle: r.int(0, 2), shirt: r.pick(['#2b2b2b', '#3a1f1f', '#1f2a3a']),
      sleeves: '#7a1f1f', vest: r.chance(0.5) ? '#7a1f1f' : null, pants: '#1d1d24', shoes: '#111111',
      height: r.range(0.98, 1.08), hat: r.chance(0.5) ? '#7a1f1f' : null,
    }),
  },
  velvet: {
    id: 'velvet', name: 'Velvet Knives', short: 'VELVET', color: '#c04dff', boss: 'mara', turf: ['deco'],
    look: (r) => ({
      skin: r.pick(['#ffdbac', '#e0ac69', '#c68642', '#8d5524']),
      hair: r.pick(['#1b1b1b', '#5a2a82', '#d8d8d8']), hairStyle: r.int(0, 2), shirt: r.pick(['#5b1a8a', '#2a1240', '#7b2cbf']),
      sleeves: '#1a1024', vest: r.chance(0.4) ? '#e0115f' : null, pants: '#141018', shoes: '#f4f4f4',
      height: r.range(0.97, 1.06), hat: r.chance(0.3) ? '#e0115f' : null,
    }),
  },
};

/** The crew that holds a district, or null for neutral ground. */
export function crewForDistrict(district) {
  return Object.values(CREWS).find((c) => c.turf.includes(district)) ?? null;
}
