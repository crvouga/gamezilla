/** In-memory AsyncStorage for Jest (official mock shape, no native module). */

const store = new Map();

const AsyncStorage = {
  setItem: async (key, value) => {
    store.set(String(key), String(value));
  },
  getItem: async (key) => {
    const value = store.get(String(key));
    return value === undefined ? null : value;
  },
  removeItem: async (key) => {
    store.delete(String(key));
  },
  mergeItem: async (key, value) => {
    const prev = store.get(String(key));
    const merged =
      prev === undefined
        ? value
        : JSON.stringify({ ...JSON.parse(prev), ...JSON.parse(value) });
    store.set(String(key), String(merged));
  },
  clear: async () => {
    store.clear();
  },
  getAllKeys: async () => [...store.keys()],
  multiGet: async (keys) =>
    keys.map((key) => [key, store.get(String(key)) ?? null]),
  multiSet: async (pairs) => {
    for (const [key, value] of pairs) store.set(String(key), String(value));
  },
  multiRemove: async (keys) => {
    for (const key of keys) store.delete(String(key));
  },
  multiMerge: async (pairs) => {
    for (const [key, value] of pairs) {
      await AsyncStorage.mergeItem(key, value);
    }
  },
  flushGetRequests: () => undefined,
};

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
module.exports.__esModule = true;
