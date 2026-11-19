// The vehicles of Solara Bay, each with its own size, power, grip and toughness. Speeds are in
// metres per second (multiply by 3.6 for the km/h the speedometer shows).

export const VEHICLE_TYPES = {
  mirela: {
    id: 'mirela', name: 'Mirela Sedan', body: 'sedan',
    length: 4.6, width: 1.9, height: 1.45, wheelbase: 2.7, wheelRadius: 0.36,
    maxSpeed: 44, accel: 10, brake: 22, grip: 7.5, driftGrip: 1.6, steer: 0.58, mass: 1300, health: 1000,
    colors: ['#e8e4dc', '#c8102e', '#1f4e79', '#2d6a4f', '#f4a261', '#8d99ae', '#6d597a', '#f1faee', '#264653'],
    traffic: 5,
  },
  vantor: {
    id: 'vantor', name: 'Vantor RS', body: 'sports',
    length: 4.45, width: 1.98, height: 1.18, wheelbase: 2.6, wheelRadius: 0.37,
    maxSpeed: 64, accel: 16, brake: 28, grip: 8.8, driftGrip: 1.9, steer: 0.62, mass: 1250, health: 850,
    colors: ['#ff6b1a', '#ffd23f', '#e0115f', '#00b4d8', '#f8f9fa', '#7b2cbf'],
    traffic: 1,
  },
  haulden: {
    id: 'haulden', name: 'Haulden Ranchero', body: 'pickup',
    length: 5.2, width: 2.05, height: 1.8, wheelbase: 3.1, wheelRadius: 0.42,
    maxSpeed: 39, accel: 8.5, brake: 18, grip: 6.4, driftGrip: 1.5, steer: 0.52, mass: 2000, health: 1400,
    colors: ['#8b1e1e', '#3a5a40', '#e9c46a', '#495057', '#f8f9fa', '#1d3557'],
    traffic: 2,
  },
  cruzer: {
    id: 'cruzer', name: 'Cruzer Interceptor', body: 'police',
    length: 4.85, width: 1.96, height: 1.5, wheelbase: 2.85, wheelRadius: 0.37,
    maxSpeed: 54, accel: 13, brake: 25, grip: 8.2, driftGrip: 1.7, steer: 0.6, mass: 1500, health: 1300,
    colors: ['#f4f6f8'], police: true,
    traffic: 0.5,
  },
  solcab: {
    id: 'solcab', name: 'Solcab Taxi', body: 'taxi',
    length: 4.7, width: 1.9, height: 1.5, wheelbase: 2.75, wheelRadius: 0.36,
    maxSpeed: 41, accel: 9.5, brake: 21, grip: 7.2, driftGrip: 1.6, steer: 0.57, mass: 1350, health: 1050,
    colors: ['#ffc72c'], taxi: true,
    traffic: 1.5,
  },
  tessaro: {
    id: 'tessaro', name: 'Tessaro Shuttle', body: 'van',
    length: 5.6, width: 2.2, height: 2.4, wheelbase: 3.4, wheelRadius: 0.4,
    maxSpeed: 33, accel: 6.5, brake: 15, grip: 6.0, driftGrip: 1.4, steer: 0.48, mass: 2600, health: 1700,
    colors: ['#f1faee', '#a8dadc', '#457b9d', '#e63946'],
    traffic: 1.2,
  },
  zipline: {
    id: 'zipline', name: 'Zipline 600', body: 'bike',
    length: 2.1, width: 0.8, height: 1.1, wheelbase: 1.4, wheelRadius: 0.33,
    maxSpeed: 56, accel: 15, brake: 24, grip: 9.5, driftGrip: 2.4, steer: 0.7, mass: 260, health: 450,
    colors: ['#e63946', '#111111', '#2a9d8f', '#ffb703'], bike: true,
    traffic: 0.6,
  },
};

/** Traffic spawn weights, drawn from each type's `traffic` field. */
export const TRAFFIC_WEIGHTS = Object.values(VEHICLE_TYPES).map((t) => [t.id, t.traffic]);

export function pickTrafficType(rng) {
  const total = TRAFFIC_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [id, w] of TRAFFIC_WEIGHTS) {
    r -= w;
    if (r <= 0) return id;
  }
  return 'mirela';
}
