// Save games and settings in localStorage. Storage may be unavailable (private windows), so
// every access is guarded and the game simply runs without persistence then.
import { SAVE_KEY, SETTINGS_KEY } from '../config.js';

export const DEFAULT_SETTINGS = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  mouseSensitivity: 1,
  invertY: false,
  shadows: true,
  drawDistance: 1,
  showFps: false,
};

function readJson(key) {
  try {
    const text = window.localStorage.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  const data = readJson(SAVE_KEY);
  return data && data.version === 1 ? data : null;
}

export function saveGame(snapshot) {
  return writeJson(SAVE_KEY, { version: 1, savedAt: Date.now(), ...snapshot });
}

export function deleteSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* nothing to clear */ }
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...(readJson(SETTINGS_KEY) ?? {}) };
}

export function saveSettings(settings) {
  writeJson(SETTINGS_KEY, settings);
}
