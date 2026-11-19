// The pause-menu city map: the whole bay with district names, landmarks, mission blips, the
// GPS route and the player. Click anywhere on a road to set a custom waypoint.
import { DISTRICTS, MAP_BOUNDS, blockCenter } from '../world/cityLayout.js';
import { blipPosition, drawBlip, drawPlayerArrow, MAP_SCALE, worldToMap } from './mapRenderer.js';

const LABELS = [
  ['downtown', 5.5, 3.6], ['midtown', 3, 4], ['deco', 6, 7], ['residential', 1, 5], ['port', 4.5, 8.6], ['beach', 9.6, 5.6], ['island', 6.5, 0], ['park', 5, 6.15],
];

export function createMapScreen(game, canvas, mapCanvas, legend) {
  const ctx = canvas.getContext('2d');
  let view = { scale: 1, ox: 0, oy: 0 };
  let customWaypoint = null;

  function layout() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(200, rect.width * devicePixelRatio);
    canvas.height = Math.max(200, rect.height * devicePixelRatio);
    const s = Math.min(canvas.width / mapCanvas.width, canvas.height / mapCanvas.height);
    view = { scale: s, ox: (canvas.width - mapCanvas.width * s) / 2, oy: (canvas.height - mapCanvas.height * s) / 2 };
  }

  const toScreen = (x, z) => { const m = worldToMap(x, z); return { x: view.ox + m.x * view.scale, y: view.oy + m.y * view.scale }; };

  function draw() {
    if (canvas.width < 10) layout();
    ctx.fillStyle = '#163a52'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(mapCanvas, view.ox, view.oy, mapCanvas.width * view.scale, mapCanvas.height * view.scale);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `italic 900 ${Math.round(15 * devicePixelRatio)}px Arial Black, Arial`;
    for (const [key, i, j] of LABELS) {
      const c = blockCenter(i, j);
      const q = toScreen(c.x, c.z);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(DISTRICTS[key].name.toUpperCase(), q.x, q.y);
      ctx.fillStyle = '#fff'; ctx.fillText(DISTRICTS[key].name.toUpperCase(), q.x, q.y);
    }
    const route = game.gps.state.route;
    if (route.length > 1) {
      ctx.beginPath();
      route.forEach((pt, i) => { const q = toScreen(pt.x, pt.z); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
      ctx.lineWidth = 5 * devicePixelRatio; ctx.strokeStyle = game.gps.state.color; ctx.lineJoin = 'round'; ctx.stroke();
    }
    for (const blip of game.blips) {
      const b = blipPosition(blip);
      const q = toScreen(b.x, b.z);
      drawBlip(ctx, blip, q.x, q.y, 1.5 * devicePixelRatio, game.clock);
    }
    for (const unit of game.police.units) {
      const q = toScreen(unit.car.x, unit.car.z);
      drawBlip(ctx, { icon: 'police', size: 6 }, q.x, q.y, devicePixelRatio, game.clock);
    }
    const p = game.player;
    const q = toScreen(p.x, p.z);
    drawPlayerArrow(ctx, q.x, q.y, Math.PI - (p.vehicle ? p.vehicle.heading : p.human.heading), 12 * devicePixelRatio);
  }

  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (event.clientX - rect.left) * devicePixelRatio, my = (event.clientY - rect.top) * devicePixelRatio;
    const x = (mx - view.ox) / view.scale / MAP_SCALE + MAP_BOUNDS.minX;
    const z = (my - view.oy) / view.scale / MAP_SCALE + MAP_BOUNDS.minZ;
    setWaypoint(x, z);
    draw();
  });

  function setWaypoint(x, z) {
    clearWaypoint();
    customWaypoint = { x, z, color: '#c77dff', icon: 'square', size: 6, edge: true, label: 'Waypoint' };
    game.blips.add(customWaypoint);
    if (!game.missions.active?.current && !game.side.active) game.gps.setTarget(x, z, '#c77dff');
  }
  function clearWaypoint() {
    if (customWaypoint) game.blips.delete(customWaypoint);
    if (customWaypoint && game.gps.state.color === '#c77dff') game.gps.clear();
    customWaypoint = null;
  }

  legend.innerHTML = [
    ['#ffd23f', 'Story mission'], ['#ff9a3c', "Coco's Taco Run"], ['#7dffb3', 'Safehouse · save'], ['#ff5050', 'Bayside Arms'],
    ['#3ef2ff', "Tavo's Respray"], ['#ff6b6b', 'St. Marisol Medical'], ['#6fa8ff', 'Bay Police'], ['#c77dff', 'Your waypoint'],
  ].map(([c, t]) => `<div><i style="background:${c}"></i>${t}</div>`).join('') + '<p style="opacity:.7;font-size:13px;line-height:1.4;margin-top:14px">Click the map to set a waypoint. The GPS line follows the roads.</p>';

  return { draw, layout, setWaypoint, clearWaypoint, get waypoint() { return customWaypoint; } };
}
