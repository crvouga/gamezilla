/**
 * Jest setupAfterEnv for @pkgs/chess-board black-box UI tests.
 */
jest.useRealTimers();

require('react-native-reanimated/mock').setUpTests();

const origError = console.error.bind(console);
console.error = (...args) => {
  const text = args
    .map((a) =>
      typeof a === 'string' ? a : a instanceof Error ? a.message : ''
    )
    .join(' ');
  if (text.includes('not wrapped in act(...)')) return;
  origError(...args);
};
