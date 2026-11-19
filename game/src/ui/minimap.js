// The circular radar: the city map turned so the camera's view is up, zooming out with speed,
// with the GPS route, mission and landmark blips (pinned to the rim when off-screen), police
// cars and officers flashing red and blue, the police search area, a north marker and the
// player arrow.
import { blipPosition, drawBlip, drawPlayerArrow, MAP_SCALE, worldToMap } from './mapRenderer.js';

export function createMinimap(game, canvas, mapCanvas) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const R = size / 2;
  let zoom = 1.6;

  function project(dx, dz, angle, scale) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const x = dx * scale, y = dz * scale;
    return { x: R + x * c - y * s, y: R + x * s + y * c };
  }

  function draw() {
    const p = game.player;
    const yaw = game.camera.state.yaw;
    const angle = yaw - Math.PI; // rotates the camera's forward to screen-up
    const speed = p.vehicle ? Math.abs(p.vehicle.fwdSpeed) : 0;
    const targetZoom = p.vehicle ? 1.35 - Math.min(0.6, speed / 60) : 1.7;
    zoom += (targetZoom - zoom) * 0.05;
    const scale = (zoom * size) / 432; // canvas px per map px
    const worldScale = scale * MAP_SCALE;
    const pos = worldToMap(p.x, p.z);

    ctx.save();
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath(); ctx.arc(R, R, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#1f5f8a'; ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.drawImage(mapCanvas, -pos.x, -pos.y);
    ctx.restore();

    // Police search area while evading.
    const w = game.wanted;
    if (w.level > 0 && w.evading) {
      const c = project(w.state.lastSeenX - p.x, w.state.lastSeenZ - p.z, angle, worldScale);
      ctx.beginPath(); ctx.arc(c.x, c.y, 70 * worldScale, 0, Math.PI * 2);
      ctx.fillStyle = Math.floor(game.clock * 2) % 2 ? 'rgba(255,40,60,0.18)' : 'rgba(40,90,255,0.18)';
      ctx.fill();
    }
    // GPS route.
    const route = game.gps.state.route;
    if (route.length > 1) {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const [width, colour] of [[12, 'rgba(0,0,0,0.55)'], [7, game.gps.state.color]]) {
        ctx.beginPath();
        route.forEach((pt, i) => { const q = project(pt.x - p.x, pt.z - p.z, angle, worldScale); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
        ctx.lineWidth = width; ctx.strokeStyle = colour; ctx.stroke();
      }
    }
    // Police units.
    for (const unit of game.police.units) {
      const q = project(unit.car.x - p.x, unit.car.z - p.z, angle, worldScale);
      if (Math.hypot(q.x - R, q.y - R) < R - 6) drawBlip(ctx, { icon: 'police', size: 9 }, q.x, q.y, 1, game.clock);
    }
    for (const cop of game.police.cops) {
      if (!cop.human.alive) continue;
      const q = project(cop.human.x - p.x, cop.human.z - p.z, angle, worldScale);
      if (Math.hypot(q.x - R, q.y - R) < R - 6) drawBlip(ctx, { icon: 'police', size: 6 }, q.x, q.y, 1, game.clock);
    }
    if (game.police.helicopter) {
      const hq = project(game.police.helicopter.x - p.x, game.police.helicopter.z - p.z, angle, worldScale);
      drawBlip(ctx, { icon: 'police', size: 12 }, hq.x, hq.y, 1, game.clock + 0.1);
    }
    // Nearby Sun Medallions.
    for (const m of game.collectibles.live) {
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      if (d > 55) continue;
      const q = project(m.x - p.x, m.z - p.z, angle, worldScale);
      drawBlip(ctx, { icon: 'dot', color: '#ffcc33', size: 6 }, q.x, q.y);
    }
    // Mission and landmark blips, pinned to the rim when far.
    for (const blip of game.blips) {
      const b = blipPosition(blip);
      let q = project(b.x - p.x, b.z - p.z, angle, worldScale);
      const dx = q.x - R, dy = q.y - R, d = Math.hypot(dx, dy);
      const rim = R - 16;
      if (d > rim) {
        if (!blip.edge) continue;
        q = { x: R + (dx / d) * rim, y: R + (dy / d) * rim };
      }
      drawBlip(ctx, blip, q.x, q.y, 1.6, game.clock);
    }
    ctx.restore();

    // Rim, north marker and the player.
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(10,12,22,0.9)';
    ctx.beginPath(); ctx.arc(R, R, R - 3, 0, Math.PI * 2); ctx.stroke();
    const n = project(0, -1, angle, 1);
    const nx = R + (n.x - R) * (R - 18), ny = R + (n.y - R) * (R - 18);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(nx, ny, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '900 18px Arial Black, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny + 1);
    const heading = p.vehicle ? p.vehicle.heading : p.human.heading;
    // A heading h faces (sin h, cos h) in the world; turned by `angle` on screen.
    drawPlayerArrow(ctx, R, R, Math.PI - heading + angle, 16);
  }

  return { draw };
}
