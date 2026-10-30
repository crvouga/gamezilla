/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, type JSX, Match, Show, Switch } from 'solid-js';
import { ChipGroup } from '../chip-group/index';
import { NumberStepper } from '../number-stepper/index';

/** One value of a choice. */
export type GameOptionChoice = {
  value: string;
  label: JSX.Element;
  /** Shipped as the chip's `data-testid`. */
  testId?: string | undefined;
};

/** A line under a count: a `hint` (the range) or an `error`. */
export type GameOptionMessage = {
  text: JSX.Element;
  tone?: 'hint' | 'error' | undefined;
};

type GameOptionCommon = {
  label: string;
  /** Show the chosen value as text: the viewer cannot change it. */
  readOnly?: boolean | undefined;
  /**
   * Shipped as the control's `data-testid` (the stepper derives
   * `-decrease`, `-increase` and `-value` from it).
   */
  testId?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export type GameOptionChoiceField = GameOptionCommon & {
  kind: 'choice';
  options: readonly GameOptionChoice[];
  value: string;
  onChange: (value: string) => void;
};

export type GameOptionCountField = GameOptionCommon & {
  kind: 'count';
  value: number;
  min: number;
  max: number;
  step?: number | undefined;
  onChange: (value: number) => void;
  message?: GameOptionMessage | null | undefined;
};

export type GameOptionFieldProps = GameOptionChoiceField | GameOptionCountField;

function testIdSet(testId: string | undefined): ComponentDataSet | undefined {
  return testId === undefined ? undefined : { testid: testId };
}

/** The setting and its value as a row of text. */
function ReadOnlyOption(props: {
  label: string;
  value: JSX.Element;
}): JSX.Element {
  return (
    <div class="box flex-row items-center justify-between gap-3 py-1 min-h-11 min-w-0">
      <span class="text textLabel min-w-0">{props.label}</span>
      <span class="text textBody text-text-secondary min-w-0 truncate">
        {props.value}
      </span>
    </div>
  );
}

function ChoiceOption(props: { field: GameOptionChoiceField }): JSX.Element {
  const chosen = () =>
    props.field.options.find((option) => option.value === props.field.value)
      ?.label;
  return (
    <Show
      when={props.field.readOnly !== true}
      fallback={<ReadOnlyOption label={props.field.label} value={chosen()} />}
    >
      <ChipGroup
        label={props.field.label}
        options={props.field.options.map((option) => ({
          key: option.value,
          label: option.label,
          testid: option.testId,
        }))}
        selected={props.field.value}
        onSelect={(value) => props.field.onChange(value)}
        dataSet={testIdSet(props.field.testId)}
      />
    </Show>
  );
}

function CountOption(props: { field: GameOptionCountField }): JSX.Element {
  const messageId = `game-option-message-${createUniqueId()}`;
  return (
    <Show
      when={props.field.readOnly !== true}
      fallback={
        <ReadOnlyOption
          label={props.field.label}
          value={String(props.field.value)}
        />
      }
    >
      <div class="box gap-1 min-w-0">
        <NumberStepper
          label={props.field.label}
          value={props.field.value}
          min={props.field.min}
          max={props.field.max}
          step={props.field.step}
          onChange={(value) => props.field.onChange(value)}
          aria-describedby={props.field.message ? messageId : undefined}
          dataSet={testIdSet(props.field.testId)}
        />
        <Show when={props.field.message}>
          {(message) => (
            <p
              id={messageId}
              class="text textCaption"
              classList={{ 'text-destructive': message().tone === 'error' }}
              data-tone={message().tone ?? 'hint'}
            >
              {message().text}
            </p>
          )}
        </Show>
      </div>
    </Show>
  );
}

/**
 * `GameOptionField` -- one setting of a game while it is set up.
 *
 * - `kind: 'choice'`: one of a few named values, as a single-select
 *   `ChipGroup` (a radio group).
 * - `kind: 'count'`: a number in a range, as a `NumberStepper`, with an
 *   optional `message` under it (the range, or why a value is not allowed).
 *
 * `readOnly` is for someone who may see the settings but not change them:
 * the setting's name and its chosen value as text, no control. Every word is
 * the caller's.
 *
 * @example
 * ```tsx
 * <GameOptionField kind="choice" label="Board" value={size()} onChange={setSize}
 *   options={[{ value: '7', label: '7 × 7' }, { value: '9', label: '9 × 9' }]} />
 * <GameOptionField kind="count" label="Points to win" value={points()} min={1} max={99}
 *   onChange={setPoints} message={{ text: 'From 1 to 99' }} />
 * ```
 */
export function GameOptionField(props: GameOptionFieldProps): JSX.Element {
  return (
    <div
      class="box min-w-0"
      {...dataAttrs({ component: 'GameOptionField', ...props.dataSet })}
      data-kind={props.kind}
      data-readonly={props.readOnly === true ? 'true' : undefined}
    >
      <Switch>
        <Match when={props.kind === 'choice' ? props : undefined}>
          {(field) => <ChoiceOption field={field()} />}
        </Match>
        <Match when={props.kind === 'count' ? props : undefined}>
          {(field) => <CountOption field={field()} />}
        </Match>
      </Switch>
    </div>
  );
}
