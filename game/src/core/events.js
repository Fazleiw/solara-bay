// A tiny event bus. Systems announce what happened (a shot, a death, a crash, a carjacking)
// and others react (the wanted level, fleeing pedestrians, missions, the HUD) without
// importing each other.

export function createEventBus() {
  const handlers = new Map();
  return {
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(fn);
      return () => handlers.get(name).delete(fn);
    },
    emit(name, payload) {
      const set = handlers.get(name);
      if (!set) return;
      for (const fn of [...set]) fn(payload);
    },
  };
}
