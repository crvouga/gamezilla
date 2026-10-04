import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';
import type { TextVariant } from '@pkgs/ui-client/text';
import type { JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';

import { useProfileColumn } from './use-profile-column';

export type UserUsernameProps = {
  /** Profile entity id (account or install id). `null` renders nothing. */
  profileId: string | null;
  variant?: TextVariant | undefined;
  class?: string | undefined;
  numberOfLines?: number | undefined;
  /** When true, prefix with `@`. Default true. */
  withAt?: boolean | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * Renders the persisted username for a profile id from SQLite.
 * Returns `null` when no profile id is supplied; renders an empty `Text` when
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
          class={props.class}
          numberOfLines={props.numberOfLines}
          dataSet={props.dataSet}
        />
      )}
    </Show>
  );
}

function UserUsernameInner(props: {
  profileId: string;
  withAt: boolean;
  variant?: TextVariant | undefined;
  class?: string | undefined;
  numberOfLines?: number | undefined;
  dataSet?: ComponentDataSet | undefined;
}): JSX.Element {
  const username = useProfileColumn(() => props.profileId, 'username');
  const label = createMemo(() => {
    const value = username();
    return value === null || value.length === 0
      ? ''
      : props.withAt
        ? `@${value}`
        : value;
  });
  return (
    <p
      class="text min-w-0"
      classList={{
        textBodyBold: String(props.variant) === 'bodyBold',
        textCaption: String(props.variant) === 'caption',
        textLabel: String(props.variant) === 'label',
        textTitle: String(props.variant) === 'title',
        textSubtitle: String(props.variant) === 'subtitle',
        textHeading: String(props.variant) === 'heading',
        textNavigationTitle: String(props.variant) === 'navigationTitle',
        textLink: String(props.variant) === 'link',
        textMono: String(props.variant) === 'mono',
        'line-clamp-1': props.numberOfLines === 1,
        [String(props.class)]: true,
      }}
      style={
        props.numberOfLines !== undefined && props.numberOfLines > 1
          ? {
              display: '-webkit-box',
              '-webkit-box-orient': 'vertical',
              '-webkit-line-clamp': props.numberOfLines,
              overflow: 'hidden',
            }
          : undefined
      }
      {...dataAttrs(props.dataSet)}
    >
      {label()}
    </p>
  );
}
