// Keyboard and mouse: held keys, keys pressed since the last frame, mouse movement under
// pointer lock, buttons and the wheel. Gameplay reads named actions, never raw key codes.

const BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  handbrake: ['Space'],
  enter: ['KeyF'],
  interact: ['KeyE'],
  horn: ['KeyH'],
  radio: ['KeyR'],
  reload: ['KeyR'],
  lights: ['KeyL'],
  map: ['KeyM'],
  pause: ['Escape', 'KeyP'],
  job: ['KeyT'],
  route: ['KeyV'],
  lookBack: ['KeyC'],
  weapon1: ['Digit1'],
  weapon2: ['Digit2'],
  weapon3: ['Digit3'],
  weapon4: ['Digit4'],
  weapon5: ['Digit5'],
  prevWeapon: ['KeyQ'],
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const state = {
    mouseDX: 0,
    mouseDY: 0,
    wheel: 0,
    fire: false,
    aim: false,
    firePressed: false,
    locked: false,
    enabled: true,
  };

  window.addEventListener('keydown', (event) => {
    if (!held.has(event.code)) pressed.add(event.code);
    held.add(event.code);
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());
  window.addEventListener('mousemove', (event) => {
    if (!state.locked) return;
    state.mouseDX += event.movementX;
    state.mouseDY += event.movementY;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (!state.locked && state.enabled) requestLock();
    if (event.button === 0) { state.fire = true; state.firePressed = true; }
    if (event.button === 2) state.aim = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.fire = false;
    if (event.button === 2) state.aim = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('wheel', (event) => { state.wheel += Math.sign(event.deltaY); }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) { state.fire = false; state.aim = false; }
  });

  function requestLock() {
    try {
      const result = canvas.requestPointerLock();
      if (result && result.catch) result.catch(() => {});
    } catch { /* pointer lock refused: mouse look waits for the next click */ }
  }

  return {
    state,
    requestLock,
    releaseLock: () => { if (document.pointerLockElement) document.exitPointerLock(); },
    down: (action) => BINDINGS[action].some((code) => held.has(code)),
    pressed: (action) => BINDINGS[action].some((code) => pressed.has(code)),
    axis: (negative, positive) => (BINDINGS[positive].some((c) => held.has(c)) ? 1 : 0) - (BINDINGS[negative].some((c) => held.has(c)) ? 1 : 0),
    /** Clears the per-frame edges (presses, mouse delta, wheel); call once at the end of each frame. */
    endFrame() {
      pressed.clear();
      state.mouseDX = 0;
      state.mouseDY = 0;
      state.wheel = 0;
      state.firePressed = false;
    },
    /** Clears one-shot presses after the first simulation step of a frame, keeping held keys. */
    consumePresses() {
      pressed.clear();
      state.firePressed = false;
      state.wheel = 0;
    },
    /** Scripted input for screenshot scenes and tests. */
    simulate(codes) { held.clear(); codes.forEach((c) => held.add(c)); },
    /** A scripted single key press. */
    tap(code) { pressed.add(code); },
    bindings: BINDINGS,
  };
}
