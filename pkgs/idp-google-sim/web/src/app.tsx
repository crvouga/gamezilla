/**
 * The browser host.
 *
 * The URL decides which route renders, but never which markup: every route
 * renders the same {@link Screen} tree the server rendered, seeded from the
 * boot-state JSON. Step transitions go through `/rpc/*` and then either swap
 * the state in place (no document load) or hand the browser a real navigation
 * back to the relying party.
 *
 * Router primitives (`useNavigate`, `useSearchParams`) only work inside a
 * `<Route>`, so everything that needs them lives in {@link ScreenHost}; the
 * signals stay in {@link App} so they survive a route re-match.
 */

import { Route, Router, useNavigate, useSearchParams } from '@solidjs/router';
import {
  createEffect,
  createSignal,
  type JSX,
  onMount,
  type Setter,
} from 'solid-js';
import { render } from 'solid-js/web';

import {
  type IdpScreenOutcome,
  type IdpScreenState,
  requestIdOf,
  titleOf,
  urlOf,
} from '../../src/shared/screen-state';
import { createScreenActions } from './actions';
import { readBootState } from './boot-state';
import { focusScreen } from './dom';
import { createIdpRpc, type IdpRpcClient } from './rpc';
import { Screen } from './screen';
import { syncScreenFromUrl } from './sync';
import './styles.css';

/** `?request_id=` from the router, or `null` when the URL carries none. */
function useUrlRequestId(): () => string | null {
  const [params] = useSearchParams();
  return () => {
    const raw = params['request_id'];
    return typeof raw === 'string' ? raw : null;
  };
}

type HostProps = {
  readonly state: IdpScreenState;
  readonly busy: boolean;
  readonly client: IdpRpcClient;
  readonly setState: Setter<IdpScreenState>;
  readonly setBusy: Setter<boolean>;
};

function ScreenHost(props: HostProps): JSX.Element {
  const navigate = useNavigate();
  const urlRequestId = useUrlRequestId();
  let syncedRequestId: string | null = null;

  const apply = (outcome: IdpScreenOutcome): void => {
    if (outcome.kind === 'redirect') {
      window.location.assign(outcome.location);
      return;
    }
    props.setState(outcome.state);
    window.__idpSpaSteps = (window.__idpSpaSteps ?? 0) + 1;
    const stepUrl = urlOf(outcome.state);
    if (stepUrl !== null) navigate(stepUrl, { replace: false });
    focusScreen();
  };

  const actions = createScreenActions({
    client: props.client,
    requestId: () => requestIdOf(props.state) ?? '',
    apply,
    setBusy: (value) => props.setBusy(value),
    openDocument: (url) => window.location.assign(url),
  });

  // The one case where the URL has the last word: a step URL whose
  // `request_id` is not the screen the server rendered.
  createEffect(() => {
    const urlId = urlRequestId();
    if (urlId === null || urlId === syncedRequestId) return;
    syncedRequestId = urlId;
    if (urlId === requestIdOf(props.state)) return;
    void syncScreenFromUrl({
      urlRequestId: urlId,
      current: props.state,
      client: props.client,
      apply,
      setBusy: (value) => props.setBusy(value),
    });
  });

  onMount(focusScreen);

  return <Screen state={props.state} actions={actions} busy={props.busy} />;
}

function App(): JSX.Element {
  const [state, setState] = createSignal<IdpScreenState>(readBootState());
  const [busy, setBusy] = createSignal(false);
  const client = createIdpRpc();

  createEffect(() => {
    document.title = titleOf(state());
  });

  onMount(() => {
    document.documentElement.dataset['idpSpa'] = 'ready';
  });

  const host = (): JSX.Element => (
    <ScreenHost
      state={state()}
      busy={busy()}
      client={client}
      setState={setState}
      setBusy={setBusy}
    />
  );

  return (
    <Router>
      <Route path="/o/oauth2/v2/auth" component={host} />
      <Route path="/o/oauth2/v2/auth/password" component={host} />
      <Route path="/o/oauth2/v2/auth/create" component={host} />
      <Route path="*" component={host} />
    </Router>
  );
}

const root = document.getElementById('idp-root');
if (root === null) throw new Error('idp: missing #idp-root');
// The shell already contains the same markup, and Solid's `render` *appends*
// to a non-empty container — clearing keeps the SPA the only copy, so the
// form the human sees is the one with the submit handlers on it.
root.textContent = '';
render(() => <App />, root);
