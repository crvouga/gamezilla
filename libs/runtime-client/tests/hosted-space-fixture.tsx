import { useMyId } from '@libs/auth-client/use-current-user';
import { defineSubClient } from '@libs/sub-client/client';
import sql from '@pkgs/sql-root-shared/sql';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { createResource, type JSX, Show } from 'solid-js';

/** Seed before the product's session queries mount; no open room transport. */
function HostedSpaceFixture(props: {
  readonly children: JSX.Element;
  readonly recovered: boolean;
}): JSX.Element {
  const engine = useSyncEngine();
  const myId = useMyId();
  const [ready] = createResource(async () => {
    await engine.db.run(sql`
      INSERT INTO spaces (
        id, host_id, host_member_id, host_account_id, visibility,
        created_at, ended_at, hosting_limit_reached, deleted_at
      ) VALUES (
        ${'existing-space'}, ${'host-device'}, ${myId()}, ${myId()}, ${'public'},
        ${'2026-10-14T09:38:05.000Z'}, ${null}, ${props.recovered}, ${null}
      )
    `);
    return true;
  });
  return <Show when={ready()}>{props.children}</Show>;
}

export function hostedSpaceFixture(recovered: boolean) {
  return defineSubClient({
    name: 'hosted-space-fixture',
    routes: [],
    session: (props) => (
      <HostedSpaceFixture recovered={recovered}>
        {props.children}
      </HostedSpaceFixture>
    ),
  });
}
