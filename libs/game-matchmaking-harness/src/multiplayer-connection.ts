import { partition, restoreActorConnection } from '@libs/harness/actions';
import { pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import { chooseOfflineCommand } from '@libs/harness/offline-gestures';
import { multiplayerClient } from './multiplayer-client';

/** Ask the ordinary query transport to observe the changed network. */
export const refreshMultiplayerConnection = scenarioAction({
  name: 'refreshMultiplayerConnection',
  act: async (s, actor: string) => {
    const { engine } = await multiplayerClient(s, actor);
    let drained = false;
    void engine.refreshQueries().then(() => {
      drained = true;
    });
    await pollUntil(s, async () => (drained ? true : null), {
      maxMs: 5000,
      stepMs: 1,
      description: 'multiplayer connection refresh',
    });
  },
});

/** Change one device's real HTTP and push reachability; leave its peers alone. */
export const setMultiplayerConnection = scenarioAction({
  name: 'setMultiplayerConnection',
  act: async (s, actor: string, online: boolean) => {
    if (!s.session.caps.has('partition')) {
      await chooseOfflineCommand(s, actor, !online);
      return;
    }
    const change = online
      ? s.session.network.heal.bind(s.session.network)
      : s.session.network.partition.bind(s.session.network);
    change(s.harness.loadBalancer.id, actor);
    if (online) {
      await Promise.resolve(restoreActorConnection.act(s, `${actor}:events`));
      await Promise.resolve(restoreActorConnection.act(s, actor));
      const { env } = await multiplayerClient(s, actor);
      let refreshed = false;
      void env
        .createAuthClient(env.server)
        .session.refresh()
        .finally(() => {
          refreshed = true;
        });
      await pollUntil(s, async () => (refreshed ? true : null), {
        maxMs: 5000,
        stepMs: 1,
        description: 'multiplayer returning session',
      });
    } else {
      await Promise.resolve(partition.act(s, actor));
      await Promise.resolve(partition.act(s, `${actor}:events`));
    }
    await Promise.resolve(refreshMultiplayerConnection.act(s, actor));
  },
});
