/**
 * One `<Switch>` over {@link IdpScreenState} — the only place markup is chosen.
 *
 * The server renders this tree into HTML and the browser app renders the same
 * tree into a live document, so the two views cannot drift: nothing here reads
 * `location`, `document` or `fetch`, and every route component takes its state
 * as a prop.
 */

import { Match, Switch } from 'solid-js';

import type {
  IdpScreenState,
  IdpScreenStateOf,
  ScreenActions,
} from '../../src/shared/screen-state';
import { IdpUiRoot } from './components/ui-root';
import { ChooserScreen } from './routes/chooser-screen';
import { ConsentScreen } from './routes/consent-screen';
import { CreateAccountScreen } from './routes/create-account-screen';
import { ErrorScreen } from './routes/error-screen';
import { IdentifierScreen } from './routes/identifier-screen';
import { PasswordScreen } from './routes/password-screen';

export type ScreenProps = {
  readonly state: IdpScreenState;
  readonly actions: ScreenActions;
  readonly busy: boolean;
};

/** The arm of the union for `kind`, or `undefined` when it is another screen. */
function pick<K extends IdpScreenState['kind']>(
  state: IdpScreenState,
  kind: K
): IdpScreenStateOf<K> | undefined {
  return state.kind === kind ? (state as IdpScreenStateOf<K>) : undefined;
}

export function Screen(props: ScreenProps) {
  return (
    <IdpUiRoot>
      <ScreenSwitch {...props} />
    </IdpUiRoot>
  );
}

function ScreenSwitch(props: ScreenProps) {
  return (
    <Switch>
      <Match when={pick(props.state, 'identifier')}>
        {(state) => (
          <IdentifierScreen
            state={state()}
            actions={props.actions}
            busy={props.busy}
          />
        )}
      </Match>
      <Match when={pick(props.state, 'password')}>
        {(state) => (
          <PasswordScreen
            state={state()}
            actions={props.actions}
            busy={props.busy}
          />
        )}
      </Match>
      <Match when={pick(props.state, 'chooser')}>
        {(state) => (
          <ChooserScreen
            state={state()}
            actions={props.actions}
            busy={props.busy}
          />
        )}
      </Match>
      <Match when={pick(props.state, 'create-account')}>
        {(state) => (
          <CreateAccountScreen
            state={state()}
            actions={props.actions}
            busy={props.busy}
          />
        )}
      </Match>
      <Match when={pick(props.state, 'consent')}>
        {(state) => (
          <ConsentScreen
            state={state()}
            actions={props.actions}
            busy={props.busy}
          />
        )}
      </Match>
      <Match when={pick(props.state, 'error')}>
        {(state) => <ErrorScreen state={state()} />}
      </Match>
    </Switch>
  );
}
