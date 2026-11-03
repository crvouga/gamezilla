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
import { createMemo, Match, Switch } from 'solid-js';
import { AccountAutomationBadge } from './account-automation-badge';

/** A text role, or a display size when the name is a profile's heading. */
export type UsernameRole = TextRole | Exclude<HeadingSize, 'label'>;

export type UserUsernameViewProps = {
  /** Profile entity id (account or install id): the masked alias's seed. */
  readonly profileId: string;
  /** The stored username, or null while the row has not synced. */
  readonly username: string | null;
  /** Server-controlled: the account is synthetic, so it carries a Bot badge. */
  readonly isBot: boolean;
  /** Default `body`. A display size renders the name as the identity heading. */
  readonly variant?: UsernameRole | undefined;
  /** Clamp to this many lines; a clamped name is a block, otherwise inline. */
  readonly numberOfLines?: TextLines | undefined;
  readonly align?: TextAlign | undefined;
  /** When true, prefix with `@` (never on a masked alias). Default true. */
  readonly withAt?: boolean | undefined;
  /** Only `testid` is written (as `data-testid` on the name). */
  readonly dataSet?: ComponentDataSet | undefined;
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
 * A known username as the moderation policy lets others see it (a masked
 * name shows its alias), with the Bot badge for synthetic accounts. An
 * unsynced name renders as empty text so layout stays stable.
 */
export function UserUsernameView(props: UserUsernameViewProps): JSX.Element {
  const moderation = useModeration();
  const label = createMemo(() =>
    usernameLabel(moderation(), props.username, props.profileId, {
      withAt: props.withAt ?? true,
    })
  );
  const testId = () => testIdOf(props.dataSet);
  const badge = () => (
    <AccountAutomationBadge profileId={props.profileId} isBot={props.isBot} />
  );
  return (
    <Switch
      fallback={
        <>
          <Text variant={textRole(props.variant)} testId={testId()}>
            {label()}
          </Text>
          {badge()}
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
            {badge()}
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
          {badge()}
        </StackHorizontal>
      </Match>
    </Switch>
  );
}
