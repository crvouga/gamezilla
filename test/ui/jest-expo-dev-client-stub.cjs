/** No-op expo-dev-client surface for Jest (no native DevMenu module). */

async function registerDevMenuItems(_items) {
  return undefined;
}

module.exports = {
  __esModule: true,
  registerDevMenuItems,
  default: {
    registerDevMenuItems,
  },
};
