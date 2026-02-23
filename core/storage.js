(function bootstrapStorage(global) {
  const ns = (global.Minigames = global.Minigames || {});
  const STORAGE_PREFIX = 'minigames';

  function storageKey(gameName, suffix) {
    return `${STORAGE_PREFIX}:${gameName}:${suffix}`;
  }

  function loadJSON(key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return defaultValue;
      }
      return JSON.parse(raw);
    } catch (error) {
      console.warn(`Failed to load JSON from localStorage key: ${key}`, error);
      return defaultValue;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`Failed to save JSON to localStorage key: ${key}`, error);
      return false;
    }
  }

  ns.storageKey = storageKey;
  ns.loadJSON = loadJSON;
  ns.saveJSON = saveJSON;
})(window);
