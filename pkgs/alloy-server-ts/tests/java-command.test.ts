import { expect, test } from 'bun:test';
import { javaCommand } from '@pkgs/alloy-server-ts/java-command';

// regression: alloy-macos-java-launcher
test('the pinned JVM wins over the macOS launcher without JAVA_HOME', () => {
  expect(
    javaCommand(
      {
        explicit: null,
        managed: '/mise/java/bin/java',
        onPath: '/usr/bin/java',
      },
      () => true
    )
  ).toBe('/mise/java/bin/java');
});

test('explicit Java remains authoritative and missing installations fail closed', () => {
  const candidates = {
    explicit: '/custom/bin/java',
    managed: '/mise/bin/java',
    onPath: '/usr/bin/java',
  };
  expect(javaCommand(candidates, () => true)).toBe('/custom/bin/java');
  expect(() =>
    javaCommand(candidates, (path) => path !== candidates.explicit)
  ).toThrow('JAVA_HOME');
  expect(
    javaCommand(
      { ...candidates, explicit: null },
      (path) => path === '/usr/bin/java'
    )
  ).toBe('/usr/bin/java');
  expect(() =>
    javaCommand({ ...candidates, explicit: null }, () => false)
  ).toThrow('no Java runtime');
});
