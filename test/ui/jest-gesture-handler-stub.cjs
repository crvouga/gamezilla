/**
 * Jest mock for react-native-gesture-handler under @test/ui.
 * Real RNGH GestureHandlerRootView calls native `install()` under Fabric;
 * product AppShell only needs a flex View host in RNTL.
 */
const React = require('react');
const { View } = require('react-native');
const path = require('node:path');

const actual = jest.requireActual(
  require.resolve('react-native-gesture-handler', {
    paths: [path.join(__dirname, '../..', 'apps/client')],
  })
);

module.exports = {
  ...actual,
  GestureHandlerRootView: ({ children, ...props }) =>
    React.createElement(View, { ...props, collapsable: false }, children),
};
