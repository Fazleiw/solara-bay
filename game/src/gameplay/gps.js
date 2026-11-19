// The GPS: a route along the road graph from the player to the current destination, refreshed
// as the player moves, drawn on the minimap and the city map.

export function createGps(game) {
  const net = game.world.network;
  const state = { target: null, route: [], timer: 0, color: '#ffd23f' };

  function recompute() {
    const t = state.target;
    if (!t) { state.route = []; return; }
    const p = game.player;
    const start = net.nearestNode(p.x, p.z), goal = net.nearestNode(t.x, t.z);
    const ids = net.findRoute(start.id, goal.id);
    state.route = [{ x: p.x, z: p.z }, ...ids.map((id) => net.node(id)).map((n) => ({ x: n.x, z: n.z })), { x: t.x, z: t.z }];
  }

  return {
    state,
    setTarget(x, z, color = '#ffd23f') {
      state.target = { x, z };
      state.color = color;
      state.timer = 0;
      recompute();
    },
    clear() { state.target = null; state.route = []; },
    update(dt) {
      state.timer -= dt;
      if (state.timer <= 0) { state.timer = 1.0; recompute(); }
      else if (state.route.length) { state.route[0] = { x: game.player.x, z: game.player.z }; }
    },
  };
}
