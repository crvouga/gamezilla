/** @jsxImportSource solid-js */
/**
 * Generic demo app used only by this package's tests — built from `@pkgs/ui`
 * so the driver is exercised against real design-system DOM (data-testid on
 * wrappers, surface-stack portals, ScreenBase chrome). No product concepts.
 */

import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { createSimClock, type SimClockBundle } from '@pkgs/clock/sim-clock';
import { ClockProvider } from '@pkgs/clock/solid';
import {
  Box,
  Button,
  ModalBackdrop,
  ModalBody,
  ModalButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalRoot,
  ScreenBase,
  SurfaceStackProvider,
  Text,
  TextInput,
  ThemeProvider,
} from '@pkgs/ui';
import { createSignal, type JSX, Show } from 'solid-js';

const COMPACT = { width: 390, height: 844 };

/** Lingui + sim clock + theme, like `pkgs/ui/tests/support/render.tsx`. */
export function DemoProviders(props: {
  sim: SimClockBundle;
  children: JSX.Element;
}): JSX.Element {
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  return (
    <I18nProvider i18n={i18n}>
      <ClockProvider clock={props.sim.clock} timers={props.sim.timers}>
        <ThemeProvider colorScheme="light" fixedLayout={COMPACT}>
          <SurfaceStackProvider>{props.children}</SurfaceStackProvider>
        </ThemeProvider>
      </ClockProvider>
    </I18nProvider>
  );
}

function HelpDialog(props: {
  open: boolean;
  onClose: () => void;
}): JSX.Element {
  return (
    <ModalRoot
      visible={props.open}
      onRequestClose={props.onClose}
      dataSet={{ testid: 'help-dialog' }}
    >
      <ModalBackdrop onClick={props.onClose}>
        <ModalContent>
          <ModalHeader title="Help" />
          <ModalBody message="Use your email to sign in." />
          <ModalFooter>
            <ModalButton
              label="Got it"
              onClick={props.onClose}
              dataSet={{ testid: 'help-close' }}
            />
          </ModalFooter>
        </ModalContent>
      </ModalBackdrop>
    </ModalRoot>
  );
}

function LoginScreen(props: { onLogin: (email: string) => void }): JSX.Element {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [count, setCount] = createSignal(0);
  const [help, setHelp] = createSignal(false);
  const submit = (): void => {
    if (email().length > 0 && password().length > 0) props.onLogin(email());
  };
  return (
    <ScreenBase
      screenId="login"
      breadcrumbs={[{ name: 'Sign in' }]}
      scroll
      content={() => (
        <Box class="gap-3" dataSet={{ testid: 'login-form' }}>
          <TextInput
            label="Email"
            value={email()}
            onChangeText={setEmail}
            onSubmitEditing={submit}
            dataSet={{ testid: 'email' }}
          />
          <TextInput
            label="Password"
            value={password()}
            onChangeText={setPassword}
            secureTextEntry
            dataSet={{ testid: 'password' }}
          />
          <Button
            title="Submit"
            onClick={submit}
            dataSet={{ testid: 'submit' }}
          />
          <Text label={String(count())} dataSet={{ testid: 'count' }} />
          <Button
            title="Increment"
            onClick={() => setCount((c) => c + 1)}
            dataSet={{ testid: 'inc' }}
          />
          <Button
            title="Help"
            onClick={() => setHelp(true)}
            dataSet={{ testid: 'open-help' }}
          />
          <Box hidden dataSet={{ testid: 'hidden-note' }}>
            <Text label="never shown" />
          </Box>
          <HelpDialog open={help()} onClose={() => setHelp(false)} />
        </Box>
      )}
    />
  );
}

function HomeScreen(props: {
  email: string;
  onLogout: () => void;
}): JSX.Element {
  return (
    <ScreenBase
      screenId="home"
      breadcrumbs={[{ name: 'Home' }]}
      content={() => (
        <Box dataSet={{ testid: 'home' }}>
          <Text
            label={`Welcome ${props.email}`}
            dataSet={{ testid: 'welcome' }}
          />
          <Button
            title="Log out"
            onClick={props.onLogout}
            dataSet={{ testid: 'logout' }}
          />
        </Box>
      )}
    />
  );
}

export function DemoApp(props: { sim: SimClockBundle }): JSX.Element {
  const [user, setUser] = createSignal<string | null>(null);
  return (
    <DemoProviders sim={props.sim}>
      <Show
        when={user()}
        fallback={<LoginScreen onLogin={(email) => setUser(email)} />}
      >
        {(email) => (
          <HomeScreen email={email()} onLogout={() => setUser(null)} />
        )}
      </Show>
    </DemoProviders>
  );
}

/** Fresh virtual clock per test plus a pump that flushes due sim timers. */
export function createDemoClock(): SimClockBundle & {
  pump: () => Promise<void>;
} {
  const sim = createSimClock();
  return {
    ...sim,
    pump: async () => {
      sim.clock.advance(1);
      await Promise.resolve();
    },
  };
}
