/** @jsxImportSource solid-js */
/**
 * Generic demo app used only by this package's tests — built from `@pkgs/ui`
 * so the driver is exercised against real design-system DOM (data-testid on
 * wrappers, surface-stack portals, ScreenBase chrome). No product concepts.
 */

import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client/solid';
import type { HarnessClockBundle } from '@pkgs/clock-shared/harness-clock';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { Button } from '@pkgs/ui-root-client/button';
import { ModalBackdrop } from '@pkgs/ui-root-client/modal-backdrop';
import { ModalContent } from '@pkgs/ui-root-client/modal-content';
import {
  ModalBody,
  ModalButton,
  ModalFooter,
  ModalHeader,
} from '@pkgs/ui-root-client/modal-parts';
import { ModalRoot } from '@pkgs/ui-root-client/modal-root';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import { SurfaceStackProvider } from '@pkgs/ui-root-client/surface-stack';
import { TextInput } from '@pkgs/ui-root-client/text-input';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import { createSignal, type JSX, Show } from 'solid-js';

const COMPACT = { width: 390, height: 844 };

/** Lingui + harness clock + theme, like `pkgs/ui-root-harness/tests/render.tsx`. */
export function DemoProviders(props: {
  harness: HarnessClockBundle;
  children: JSX.Element;
}): JSX.Element {
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  return (
    <I18nProvider i18n={i18n}>
      <ClockProvider clock={props.harness.clock} timers={props.harness.timers}>
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
        <div class="box gap-3" data-testid="login-form">
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
          <p class="text" data-testid="count">
            {String(count())}
          </p>
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
          <div class="box" data-testid="hidden-note" hidden>
            <p class="text">{'never shown'}</p>
          </div>
          <HelpDialog open={help()} onClose={() => setHelp(false)} />
        </div>
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
        <div class="box" data-testid="home">
          <p class="text" data-testid="welcome">{`Welcome ${props.email}`}</p>
          <Button
            title="Log out"
            onClick={props.onLogout}
            dataSet={{ testid: 'logout' }}
          />
        </div>
      )}
    />
  );
}

export function DemoApp(props: { harness: HarnessClockBundle }): JSX.Element {
  const [user, setUser] = createSignal<string | null>(null);
  return (
    <DemoProviders harness={props.harness}>
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

/** Fresh virtual clock per test plus a pump that flushes due harness timers. */
export function createDemoClock(): HarnessClockBundle & {
  pump: () => Promise<void>;
} {
  const harness = createHarnessClock();
  return {
    ...harness,
    pump: async () => {
      harness.clock.advance(1);
      await Promise.resolve();
    },
  };
}
