import type { JSX } from 'solid-js';
import { ClientConfigScreenView } from './client-config-screen-view';
import { useClientConfig } from './use-client-config';

/** `/more/client-config`: wires `ClientConfigScreenView` to local SQLite. */
export function ClientConfigScreen(): JSX.Element {
  const state = useClientConfig();
  return (
    <ClientConfigScreenView
      status={state.isLoading() ? 'loading' : 'ready'}
      config={state.config()}
      rows={state.rows()}
    />
  );
}
