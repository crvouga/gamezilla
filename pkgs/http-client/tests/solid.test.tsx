/** @jsxImportSource solid-js */
import { createAlwaysAvailableOrigin } from '@pkgs/http-client/origin-availability';
import {
  createOriginAvailabilitySnapshot,
  HttpClientProvider,
  OriginAvailabilityProvider,
  useHttpClient,
} from '@pkgs/http-client/solid';
import type { HttpClient } from '@pkgs/http-client/types';
import { render, screen } from '@solidjs/testing-library';
import { describe, expect, test } from 'vitest';

describe('http-client solid bindings', () => {
  test('provides the injected client', () => {
    const client = {
      fetch: () => Promise.resolve(new Response('ok')),
    } as unknown as HttpClient;
    let seen: HttpClient | undefined;
    function Probe() {
      seen = useHttpClient();
      return <span />;
    }
    render(() => (
      <HttpClientProvider value={client}>
        <Probe />
      </HttpClientProvider>
    ));
    expect(seen).toBe(client);
  });

  test('snapshot falls back to always-available without a provider', () => {
    function Probe() {
      const snapshot = createOriginAvailabilitySnapshot();
      return <output>{snapshot().phase}</output>;
    }
    render(() => <Probe />);
    expect(screen.getByRole('status')).toHaveTextContent('available');
  });

  test('snapshot reads the provided availability', () => {
    const availability = createAlwaysAvailableOrigin({
      healthUrl: 'https://api/health',
    });
    function Probe() {
      const snapshot = createOriginAvailabilitySnapshot();
      return <output>{snapshot().healthUrl}</output>;
    }
    render(() => (
      <OriginAvailabilityProvider value={availability}>
        <Probe />
      </OriginAvailabilityProvider>
    ));
    expect(screen.getByRole('status')).toHaveTextContent('https://api/health');
  });
});
