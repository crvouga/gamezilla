/** @jsxImportSource solid-js */
/**
 * Tells the person, where the change lives, about a change that showed at
 * once on this device and was then refused, so the device undid it (a
 * rename made offline under rules that changed meanwhile, say). Without it
 * the change would just quietly revert. It is a quiet inline `Notice` in the
 * screen's own flow — never a banner or a floating note over every screen —
 * and it stays until the person dismisses it, which acknowledges the refusal
 * here and wherever it is kept.
 *
 * - `RefusedChangeNotice` shows the oldest unheard refusal among the given
 *   changes (the space screen passes the space's changes, and so on).
 * - `OtherRefusedChanges` lists every refusal no screen tells in context,
 *   for Settings › Sync.
 */

import { Handles } from '@libs/test-ids-shared/handles';
import { useUnheardRefusals } from '@pkgs/sync-engine-client/use-unheard-refusals';
import type { WriteRefusal } from '@pkgs/sync-engine-client/write-outcome-reads';
import { Notice } from '@pkgs/ui-root-client/notice';
import { P } from '@pkgs/ui-root-client/text';
import {
  type Accessor,
  createMemo,
  createSignal,
  For,
  type JSX,
  Show,
} from 'solid-js';
import {
  isRefusedChangeToldInContext,
  useRefusedChangeCopy,
} from './refused-change-copy';

export type RefusedChanges = {
  /** The unheard refusals this place tells, oldest first. */
  readonly refusals: Accessor<readonly WriteRefusal[]>;
  /** Puts one away: hidden here at once, and acknowledged. */
  readonly dismiss: (refusal: WriteRefusal) => void;
};

/** The unheard refusals whose change `tells` names, live. */
export function useRefusedChanges(
  tells: (mutationName: string | null) => boolean
): RefusedChanges {
  const unheard = useUnheardRefusals();
  const [dismissed, setDismissed] = createSignal<ReadonlySet<string>>(
    new Set()
  );
  const refusals = createMemo(() =>
    unheard
      .refusals()
      .filter(
        (refusal) =>
          tells(refusal.mutationName) && !dismissed().has(refusal.mutationId)
      )
  );
  return {
    refusals,
    dismiss: (refusal) => {
      setDismissed((prev) => new Set([...prev, refusal.mutationId]));
      void unheard.acknowledge(refusal);
    },
  };
}

/** One refused change: what was not saved, why, and a way to put it away. */
export function RefusedChangeCard(props: {
  readonly refusal: WriteRefusal;
  readonly onDismiss: () => void;
}): JSX.Element {
  const copy = useRefusedChangeCopy();
  return (
    <Notice
      tone="warning"
      onDismiss={() => props.onDismiss()}
      dataSet={{
        testid: Handles.refusedChange,
        mutation: props.refusal.mutationName ?? '',
        code: props.refusal.code,
      }}
    >
      <P variant="label" tone="inherit">
        {copy.title(props.refusal.mutationName)}
      </P>
      <P variant="inherit" tone="inherit">
        {copy.detail(props.refusal.code)}
      </P>
    </Notice>
  );
}

/** The oldest unheard refusal among `mutations`, or nothing. */
export function RefusedChangeNotice(props: {
  readonly mutations: readonly string[];
}): JSX.Element {
  const changes = useRefusedChanges(
    (name) => name !== null && props.mutations.includes(name)
  );
  return (
    <Show when={changes.refusals()[0]} keyed>
      {(refusal) => (
        <RefusedChangeCard
          refusal={refusal}
          onDismiss={() => changes.dismiss(refusal)}
        />
      )}
    </Show>
  );
}

/** Every unheard refusal no screen tells in context, each dismissible. */
export function OtherRefusedChanges(): JSX.Element {
  const changes = useRefusedChanges(
    (name) => !isRefusedChangeToldInContext(name)
  );
  return (
    <For each={changes.refusals()}>
      {(refusal) => (
        <RefusedChangeCard
          refusal={refusal}
          onDismiss={() => changes.dismiss(refusal)}
        />
      )}
    </For>
  );
}
