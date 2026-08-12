/**
 * No-op for Expo Metro HMR `messageSocket`.
 * The real native module opens `ws://<dev-server>/message` at import time,
 * which leaves a TCPWRAP handle after Jest. jest-expo mocks
 * `expo/src/async-require/messageSocket`, but that does not intercept
 * Bun-nested copies or the `.native` platform file expo-router loads.
 */
module.exports = {};
