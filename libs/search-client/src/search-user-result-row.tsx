import { Handles } from '@libs/test-ids-shared/handles';
import { UserSearchResultRow } from '@libs/user-search-client/user-search-result-row';
import type { UserSearchResult } from '@libs/user-search-shared/user-search-types';
import { MENU_ROW_PX_STEP } from '@pkgs/ui-root-client/menu-row';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { spacingScale } from '@pkgs/ui-root-shared/scale';
import { type JSX, Show } from 'solid-js';

import { useSearchResultSlots } from './search-result-slots';

export function SearchUserResultRow(props: {
  readonly user: UserSearchResult;
}): JSX.Element {
  const slots = useSearchResultSlots();
  const edgePx = spacingScale(MENU_ROW_PX_STEP);

  return (
    <div {...dataAttrs({ testid: Handles.searchResultRow })}>
      <div
        class="box self-stretch"
        {...dataAttrs({
          testid: Handles.searchUserResult(props.user.username),
        })}
        style={{
          'padding-left': `${edgePx}px`,
          'padding-right': `${edgePx}px`,
        }}
      >
        <Show
          when={slots.userRow}
          fallback={<UserSearchResultRow user={props.user} />}
        >
          {(userRow) => userRow()(props.user)}
        </Show>
      </div>
    </div>
  );
}
