import { describe, expect, test } from 'bun:test';

const authorizer = (await import(
  '../tofu/modules/pubsub/authorizer/index.mjs'
)) as { iotWireTopic(topic: string): string };

describe('iot authorizer wire topics', () => {
  test('uses the same slash topics as the publisher', () => {
    expect(authorizer.iotWireTopic('user:actor1')).toBe('user/actor1');
    expect(authorizer.iotWireTopic('system:client_config')).toBe(
      'system/client_config'
    );
    expect(authorizer.iotWireTopic('room:space_a')).toBe('room/space_a');
    expect(authorizer.iotWireTopic('health-ping')).toBe('health-ping');
  });
});
