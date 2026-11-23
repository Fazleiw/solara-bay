// Gold Coast Getaway's two short, resettable route checks. Kept as plain state transitions so
// the mission and its regression test use the same rules without adding another game system.
export const TAVO_HOLD_SECONDS = 4;
export const COCO_UNSEEN_SECONDS = 3;

export function freshEscapeProgress(route) {
  return { route, tavoHold: 0, cocoUnseen: 0, cocoClear: false };
}

export function switchEscapeRoute(state) {
  return freshEscapeProgress(state.route === 'tavo' ? 'coco' : 'tavo');
}

export function stepEscapeProgress(state, dt, conditions) {
  if (state.route === 'tavo') {
    state.tavoHold = conditions.inTavoBay && conditions.inVehicle && conditions.slow
      ? Math.min(TAVO_HOLD_SECONDS, state.tavoHold + dt)
      : 0;
  } else {
    if (conditions.seen) {
      state.cocoUnseen = 0;
    } else if (!state.cocoClear && conditions.inCocoCover) {
      state.cocoUnseen = Math.min(COCO_UNSEEN_SECONDS, state.cocoUnseen + dt);
      state.cocoClear = state.cocoUnseen >= COCO_UNSEEN_SECONDS;
    }
  }
  return state;
}
