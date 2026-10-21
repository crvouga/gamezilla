import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import { usernameLabel } from '@libs/moderation-shared-ts/display';
import type { HeadingSize } from '@pkgs/ui-root-client-ts/heading';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import type { TextRole } from '@pkgs/ui-root-client-ts/text';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import type {
  TextAlign,
  TextLines,
} from '@pkgs/ui-root-client-ts/text-classes';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { createMemo, Match, Show, Switch } from 'solid-js';

import { AccountAutomationLabel } from './account-automation-label';
import { useProfileColumn } from './use-profile-column';

/** A text role, or a display size when the name is a profile's heading. */
export type UsernameRole = TextRole | Exclude<HeadingSize, 'label'>;

export type UserUsernameProps = {
  /** Profile entity id (account or install id). `null` renders nothing. */
  profileId: string | null;
  /** Default `body`. A display size renders the name as the identity heading. */
  variant?: UsernameRole | undefined;
  /** Clamp to this many lines; a clamped name is a block, otherwise inline. */
  numberOfLines?: TextLines | undefined;
  align?: TextAlign | undefined;
  /** When true, prefix with `@` (never on a masked alias). Default true. */
  withAt?: boolean | undefined;
  /** Only `testid` is written (as `data-testid` on the name). */
  dataSet?: ComponentDataSet | undefined;
};

const HEADING_SIZES: ReadonlySet<UsernameRole> = new Set<UsernameRole>([
  'title',
  'heading',
  'subtitle',
  'navigationTitle',
]);

function headingSize(role: UsernameRole | undefined): HeadingSize | null {
  return role !== undefined && HEADING_SIZES.has(role)
    ? (role as HeadingSize)
    : null;
}

function textRole(role: UsernameRole | undefined): TextRole {
  return role === undefined || HEADING_SIZES.has(role)
    ? 'body'
    : (role as TextRole);
}

function testIdOf(dataSet: ComponentDataSet | undefined): string | undefined {
  const testid = dataSet?.['testid'];
  return typeof testid === 'string' ? testid : undefined;
}

/**
 * Renders the persisted username for a profile id from SQLite, as the
 * moderation policy lets others see it (a masked name shows its alias).
 * Returns `null` when no profile id is supplied; renders an empty text when
 * the row hasn't synced (so layout positioning stays stable).
 */
export function UserUsername(props: UserUsernameProps): JSX.Element {
  const profileId = () => (props.profileId === null ? null : props.profileId);
  return (
    <Show when={profileId()} keyed>
      {(id) => (
        <UserUsernameInner
          profileId={id}
          withAt={props.withAt ?? true}
          variant={props.variant}
          numberOfLines={props.numberOfLines}
          align={props.align}
          dataSet={props.dataSet}
        />
      )}
    </Show>
  );
}

type InnerProps = Omit<UserUsernameProps, 'profileId' | 'withAt'> & {
  profileId: string;
  withAt: boolean;
};

function UserUsernameInner(props: InnerProps): JSX.Element {
  const username = useProfileColumn(() => props.profileId, 'username');
  const moderation = useModeration();
  const label = createMemo(() =>
    usernameLabel(moderation(), username(), props.profileId, {
      withAt: props.withAt,
    })
  );
  const testId = () => testIdOf(props.dataSet);
  return (
    <Switch
      fallback={
        <>
          <Text variant={textRole(props.variant)} testId={testId()}>
            {label()}
          </Text>
          <AccountAutomationLabel profileId={props.profileId} />
        </>
      }
    >
      <Match when={headingSize(props.variant)}>
        {(size) => (
          <StackHorizontal align="center" justify="center" gap="xs">
            <H2
              size={size()}
              lines={props.numberOfLines}
              align={props.align}
              testId={testId()}
            >
              {label()}
            </H2>
            <AccountAutomationLabel profileId={props.profileId} />
          </StackHorizontal>
        )}
      </Match>
      <Match when={props.numberOfLines !== undefined}>
        <StackHorizontal align="center" gap="xs">
          <P
            variant={textRole(props.variant)}
            lines={props.numberOfLines}
            align={props.align}
            testId={testId()}
          >
            {label()}
          </P>
          <AccountAutomationLabel profileId={props.profileId} />
        </StackHorizontal>
      </Match>
    </Switch>
  );
}
