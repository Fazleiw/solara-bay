// A scripted driver that follows the road graph to a destination at a set pace, ignoring
// traffic lights: the Saltjaw courier and other mission drivers. It keeps to the right lane,
// slows for corners and backs out when stuck.
function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

export function attachRouteDriver(game, vehicle, targetX, targetZ, { speed = 16, look = null } = {}) {
  const net = game.world.network;
  const route = net.findRoute(net.nearestNode(vehicle.x, vehicle.z).id, net.nearestNode(targetX, targetZ).id).map((id) => net.node(id));
  const driver = {
    kind: 'route',
    vehicle,
    route,
    index: 0,
    arrived: false,
    stuck: 0,
    reverse: 0,
    look,
    eject(car) { car.ai = null; game.peds.fromEjectedDriver(car, driver.look ?? undefined); },
    update(dt) {
      const v = vehicle;
      const c = v.controls;
      if (v.destroyed || v.ai !== driver) return;
      let tx = targetX, tz = targetZ;
      if (driver.index < route.length) {
        const node = route[driver.index];
        const prev = driver.index > 0 ? route[driver.index - 1] : { x: v.x, z: v.z };
        const dx = node.x - prev.x, dz = node.z - prev.z;
        const len = Math.hypot(dx, dz) || 1;
        tx = node.x - (dz / len) * 3.5;
        tz = node.z + (dx / len) * 3.5;
        if (Math.hypot(node.x - v.x, node.z - v.z) < 11) driver.index += 1;
      }
      const remaining = Math.hypot(targetX - v.x, targetZ - v.z);
      if (driver.index >= route.length && remaining < 9) driver.arrived = true;
      const turn = wrap(Math.atan2(tx - v.x, tz - v.z) - v.heading);
      if (driver.reverse > 0) {
        driver.reverse -= dt;
        c.throttle = -1; c.steer = -Math.sign(turn); c.handbrake = false;
        return;
      }
      c.steer = Math.max(-1, Math.min(1, turn * 2.4));
      let target = speed;
      if (Math.abs(turn) > 0.4) target = Math.min(target, 8);
      if (driver.arrived) target = 0;
      c.throttle = Math.max(-1, Math.min(1, (target - v.fwdSpeed) * 0.4));
      c.handbrake = driver.arrived;
      if (target > 4 && Math.abs(v.fwdSpeed) < 0.7) driver.stuck += dt; else driver.stuck = 0;
      if (driver.stuck > 1.8) { driver.stuck = 0; driver.reverse = 1.2; }
    },
  };
  vehicle.driver = driver;
  vehicle.ai = driver;
  game.routeDrivers.add(driver);
  return driver;
}
