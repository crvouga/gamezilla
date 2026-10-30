import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { Button } from '../button/index';
import type { IconComponent } from '../create-icon/index';
import {
  type EmptyStateAction,
  emptyStateActionDataSet,
} from '../empty-state/index';
import { Notice } from '../notice/index';

export type ActionNoticeProps = {
  readonly title: JSX.Element;
  readonly body?: JSX.Element;
  readonly icon?: IconComponent | undefined;
  readonly action?: EmptyStateAction | undefined;
  readonly dataSet?: ComponentDataSet | undefined;
};

/** An inline explanation and a quiet way forward, beside existing content. */
export function ActionNotice(props: ActionNoticeProps): JSX.Element {
  return (
    <Notice
      icon={props.icon}
      dataSet={{ component: 'ActionNotice', ...props.dataSet }}
    >
      <div class="box min-w-0 gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div class="box flex-1 min-w-0 gap-1">
          <p class="text textLabel">{props.title}</p>
          <Show when={props.body !== undefined && props.body !== null}>
            <p class="text textCaption text-text-secondary">{props.body}</p>
          </Show>
        </div>
        <Show when={props.action}>
          {(action) => (
            <div class="box shrink-0 self-start">
              <Button
                title={action().label}
                onClick={() => action().onClick()}
                intent="neutral"
                variant="outline"
                size="sm"
                dataSet={emptyStateActionDataSet(props.dataSet)}
              />
            </div>
          )}
        </Show>
      </div>
    </Notice>
  );
}
