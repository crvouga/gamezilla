/** @jsxImportSource @solidjs/web */

import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { useAppFrameGlobalStatus } from '../app-frame-chrome/index';
import { BackIconButton } from '../back-icon-button/index';
import { Button } from '../button/index';
import type { IconComponent } from '../create-icon/index';
import { IconButton } from '../icon-button/index';
import {
  CircleStopIcon,
  LogOutIcon,
  Minimize2Icon,
  ShareIcon,
  SquarePenIcon,
  UsersIcon,
} from '../icons';
import { spaceDataSet } from '../space-data-set';
import type { SpacePersonCapability } from '../space-person-actions';
import type { SpaceRole } from '../space-types';
import { ToastStack } from '../toast-stack/index';
import { useLayoutMode } from '../use-layout-mode';
import styles from './space-shell.module.css';

/**
 * The `data-testid` of each row-1 control, so harness bindings keep their
 * handles whichever screen draws the shell.
 */
export type SpaceShellTestIds = {
  back?: string | undefined;
  /** The screen's title (the `h1`). */
  title?: string | undefined;
  name?: string | undefined;
  people?: string | undefined;
  share?: string | undefined;
  rename?: string | undefined;
  leave?: string | undefined;
  end?: string | undefined;
  minimize?: string | undefined;
};

/** Row 1 of a space and what it opens, the same on every space screen. */
export type SpaceShellChrome = {
  /** The space's name: the title of a screen that names nothing itself. */
  spaceName: string;
  /**
   * What this screen is, in row 1: `Choose game`, `Chess`, `Game history`.
   * It changes with the screen; the space's name stands in when unset.
   */
  title?: string | undefined;
  onBack: () => void;
  /**
   * What back says it goes to; "Back to spaces" by default. A stage that
   * goes back inside the space names that place instead (`Back to Chess`).
   */
  backLabel?: string | undefined;
  onMembers: () => void;
  onInvite?: (() => void) | undefined;
  onRename?: (() => void) | undefined;
  onLeave?: (() => void) | undefined;
  onEnd?: (() => void) | undefined;
  onMinimize: () => void;
  /**
   * Under row 1: a refused change, the host gone offline. Rendered once;
   * nothing shows while it renders nothing.
   */
  notice?: JSX.Element | undefined;
  testIds?: SpaceShellTestIds | undefined;
};

/**
 * What a whole space screen (a template) needs beyond its game: row 1 and
 * what the space can do for a person.
 */
export type SpaceScreenChrome = SpaceShellChrome & {
  /**
   * A space action was chosen on a person (`SpacePersonActionId`:
   * `readyUp`, `removeFromSpace`, `inviteFriend`, …).
   */
  onPersonAction: (personId: string, action: string) => void;
  /** The optional person actions the product can carry out; none by default. */
  personCapabilities?: readonly SpacePersonCapability[] | undefined;
};

export type SpaceShellProps = SpaceShellChrome & {
  /** The viewer's role in the space. */
  role: SpaceRole;
  /** Row 2: what the space is doing now. */
  children: JSX.Element;
  /**
   * `heading` (default): the title is the screen's `h1`. `context`: the
   * screen in the stage brings its own heading (one not yet on a
   * template), so the title is plain text beside back and never the first
   * heading on the page.
   */
  nameAs?: 'heading' | 'context' | undefined;
  /**
   * `scroll` (default): the stage scrolls on its own when its content is
   * taller than the room left (choices, history, settings pages). `fixed`:
   * the content owns the room (a board over an action bar) and nothing
   * scrolls.
   */
  stage?: 'scroll' | 'fixed' | undefined;
  dataSet?: ComponentDataSet | undefined;
};

type BarButtonProps = {
  action: string;
  label: string;
  shortLabel?: string;
  icon: IconComponent;
  destructive?: boolean;
  testId?: string | undefined;
  onPress: (() => void) | undefined;
};

function BarButton(props: BarButtonProps): JSX.Element {
  const mode = useLayoutMode();
  const dataSet = () => spaceDataSet({ action: props.action }, props.testId);
  return (
    <Show when={props.onPress} keyed>
      {(press) => (
        <Show
          when={mode() === 'wide'}
          fallback={
            <IconButton
              label={props.label}
              size={44}
              tooltip="default"
              tooltipPlacement={props.action === 'minimize' ? 'left' : 'bottom'}
              onClick={press}
              dataSet={dataSet()}
            >
              <props.icon
                size={24}
                color={props.destructive ? 'destructive' : 'icon'}
              />
            </IconButton>
          }
        >
          <Button
            title={props.shortLabel ?? props.label}
            aria-label={props.label}
            icon={props.icon}
            intent={props.destructive ? 'danger' : 'neutral'}
            variant="ghost"
            onClick={press}
            dataSet={dataSet()}
          />
        </Show>
      )}
    </Show>
  );
}

function SpaceTools(props: SpaceShellProps): JSX.Element {
  const { t } = useLingui();
  return (
    <div class={styles['tools']} data-space-row="tools">
      <BarButton
        action="people"
        label={t`People in this space`}
        shortLabel={t`People`}
        icon={UsersIcon}
        onPress={props.onMembers}
        testId={props.testIds?.people}
      />
      <BarButton
        action="share"
        label={t`Share`}
        icon={ShareIcon}
        onPress={props.onInvite}
        testId={props.testIds?.share}
      />
      <BarButton
        action="rename"
        label={t`Rename`}
        icon={SquarePenIcon}
        onPress={props.onRename}
        testId={props.testIds?.rename}
      />
      <BarButton
        action="leave"
        label={t`Leave space`}
        shortLabel={t`Leave`}
        icon={LogOutIcon}
        destructive
        onPress={props.onLeave}
        testId={props.testIds?.leave}
      />
      <BarButton
        action="end"
        label={t`End space`}
        shortLabel={t`End`}
        icon={CircleStopIcon}
        destructive
        onPress={props.onEnd}
        testId={props.testIds?.end}
      />
      <BarButton
        action="minimize"
        label={t`Minimize space`}
        shortLabel={t`Minimize`}
        icon={Minimize2Icon}
        onPress={props.onMinimize}
        testId={props.testIds?.minimize}
      />
    </div>
  );
}

function ActionsRow(props: SpaceShellProps): JSX.Element {
  const { t } = useLingui();
  const globalStatus = useAppFrameGlobalStatus();
  const title = () => props.title ?? props.spaceName;
  const sameName = () => title() === props.spaceName;
  const titleText = () => (
    <span data-testid={sameName() ? props.testIds?.name : undefined}>
      {title()}
    </span>
  );
  return (
    <header class={styles['actions']} data-space-row="actions">
      <div class={styles['context']}>
        <BackIconButton
          label={props.backLabel ?? t`Back to spaces`}
          size={44}
          onClick={() => props.onBack()}
          dataSet={spaceDataSet({ action: 'back' }, props.testIds?.back)}
        />
        <div class={styles['where']}>
          <Show
            when={props.nameAs === 'context'}
            fallback={
              <h1
                class="text textHeading truncate"
                data-testid={props.testIds?.title}
              >
                {titleText()}
              </h1>
            }
          >
            <p
              class="text textHeading truncate"
              data-testid={props.testIds?.title}
            >
              {titleText()}
            </p>
          </Show>
          <Show when={props.spaceName && !sameName()}>
            <p
              class="text textCaption truncate"
              data-testid={props.testIds?.name}
            >
              {props.spaceName}
            </p>
          </Show>
        </div>
        {globalStatus()}
      </div>
      <SpaceTools {...props} />
    </header>
  );
}

/** The shared space bar over a scrollable page or a fixed game stage. */
export function SpaceShell(props: SpaceShellProps): JSX.Element {
  const mode = useLayoutMode();
  return (
    <div
      class={styles['shell']}
      data-role={props.role}
      data-layout={mode()}
      {...dataAttrs({ component: 'SpaceShell', ...props.dataSet })}
    >
      <ActionsRow {...props} />
      {/* A notice comes and goes (a refused change, the host away): it
          floats over the screen, never a row that pushes the stage. */}
      <ToastStack dataSet={{ component: 'SpaceNotice' }}>
        {props.notice}
      </ToastStack>
      <main
        class={styles['stage']}
        data-space-row="stage"
        data-scroll={props.stage ?? 'scroll'}
      >
        {props.children}
      </main>
    </div>
  );
}
