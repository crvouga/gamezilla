/** @jsxImportSource @solidjs/web */

import { describe, expect, test } from 'bun:test';
import { type I18n, type Messages, setupI18n } from '@lingui/core';
import { Plural, Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import {
  I18nProvider,
  Trans as RuntimeTrans,
  useLingui as useRuntimeLingui,
} from '@pkgs/lingui-solid-client-ts/runtime';
import { render, screen } from '@solidjs/testing-library';
import type { JSX } from '@solidjs/web';
import { createSignal, flush } from 'solid-js';

const FRENCH: Messages = {
  greeting: 'Bonjour',
  welcome: 'Bienvenue, {name} !',
  terms: 'Lisez <0>les conditions</0> de {site}',
  layered: '<bold>Très <em>important</em></bold> : <br/>{count} restants',
};

const SPANISH: Messages = {
  greeting: 'Hola',
  welcome: 'Te damos la bienvenida, {name}.',
};

function english(): I18n {
  return setupI18n({ locale: 'en', messages: { en: {} } });
}

function french(): I18n {
  return setupI18n({ locale: 'fr', messages: { fr: FRENCH } });
}

function mount(i18n: I18n, ui: () => JSX.Element) {
  return render(() => <I18nProvider i18n={i18n}>{ui()}</I18nProvider>);
}

function Greeting(): JSX.Element {
  const { t } = useLingui();
  return (
    <p data-testid="greeting">{t({ id: 'greeting', message: 'Hello' })}</p>
  );
}

function Welcome(props: { readonly name: string }): JSX.Element {
  return (
    <p data-testid="welcome">
      <Trans id="welcome">Welcome, {{ name: props.name }}!</Trans>
    </p>
  );
}

describe('translations', () => {
  test('a message without a translation renders its source text', () => {
    mount(english(), () => (
      <>
        <Greeting />
        <Welcome name="Ada" />
      </>
    ));
    expect(screen.getByTestId('greeting')).toHaveTextContent('Hello');
    expect(screen.getByTestId('welcome')).toHaveTextContent('Welcome, Ada!');
  });

  test('a message renders the active locale translation', () => {
    mount(french(), () => (
      <>
        <Greeting />
        <Welcome name="Ada" />
      </>
    ));
    expect(screen.getByTestId('greeting')).toHaveTextContent('Bonjour');
    expect(screen.getByTestId('welcome')).toHaveTextContent('Bienvenue, Ada !');
  });

  test('a tagged template message interpolates its values', () => {
    function Unread(props: { readonly count: number }): JSX.Element {
      const { t } = useLingui();
      return <p data-testid="unread">{t`You have ${props.count} unread`}</p>;
    }
    const [count, setCount] = createSignal(2);
    mount(english(), () => <Unread count={count()} />);
    expect(screen.getByTestId('unread')).toHaveTextContent('You have 2 unread');
    setCount(5);
    flush();
    expect(screen.getByTestId('unread')).toHaveTextContent('You have 5 unread');
  });

  test('a plural picks the form for its value', () => {
    const [count, setCount] = createSignal(1);
    mount(english(), () => (
      <p data-testid="games">
        <Plural value={count()} one="# game" other="# games" />
      </p>
    ));
    expect(screen.getByTestId('games')).toHaveTextContent('1 game');
    setCount(3);
    flush();
    expect(screen.getByTestId('games')).toHaveTextContent('3 games');
  });
});

describe('Trans', () => {
  test('a value that changes updates the rendered message', () => {
    const [name, setName] = createSignal('Ada');
    mount(french(), () => <Welcome name={name()} />);
    setName('Grace');
    flush();
    expect(screen.getByTestId('welcome')).toHaveTextContent(
      'Bienvenue, Grace !'
    );
  });

  test('element children keep their elements around the translated text', () => {
    mount(french(), () => (
      <p data-testid="terms">
        <Trans id="terms">
          Read <a href="/terms">the terms</a> of {{ site: 'Example' }}
        </Trans>
      </p>
    ));
    const terms = screen.getByTestId('terms');
    expect(terms).toHaveTextContent('Lisez les conditions de Example');
    const link = terms.querySelector('a');
    expect(link).toHaveAttribute('href', '/terms');
    expect(link).toHaveTextContent('les conditions');
  });

  test('element children render in the source order without a translation', () => {
    mount(english(), () => (
      <p data-testid="terms">
        <Trans id="terms">
          Read <a href="/terms">the terms</a> of {{ site: 'Example' }}
        </Trans>
      </p>
    ));
    const terms = screen.getByTestId('terms');
    expect(terms).toHaveTextContent('Read the terms of Example');
    expect(terms.querySelector('a')).toHaveTextContent('the terms');
  });

  test('an element passed as a value renders in its placeholder', () => {
    mount(french(), () => (
      <p data-testid="welcome">
        <RuntimeTrans
          id="welcome"
          message="Welcome, {name}!"
          values={{ name: <strong data-testid="name">Ada</strong> }}
        />
      </p>
    ));
    expect(screen.getByTestId('welcome')).toHaveTextContent('Bienvenue, Ada !');
    expect(screen.getByTestId('name')).toHaveTextContent('Ada');
  });

  test('named components wrap, nest and stand alone', () => {
    mount(french(), () => (
      <p data-testid="layered">
        <RuntimeTrans
          id="layered"
          message="<bold>Very <em>important</em></bold>: <br/>{count} left"
          values={{ count: 3 }}
          components={{
            bold: (props) => <b>{props.children}</b>,
            em: (props) => <em>{props.children}</em>,
            br: () => <br />,
          }}
        />
      </p>
    ));
    const layered = screen.getByTestId('layered');
    expect(layered).toHaveTextContent('Très important : 3 restants');
    expect(layered.querySelector('b')).toHaveTextContent('Très important');
    expect(layered.querySelector('b > em')).toHaveTextContent('important');
    expect(layered.querySelectorAll('br')).toHaveLength(1);
  });

  test('a tag without a declared component keeps its text', () => {
    mount(english(), () => (
      <p data-testid="plain">
        <RuntimeTrans id="plain" message="Keep <0>this</0> text" />
      </p>
    ));
    expect(screen.getByTestId('plain')).toHaveTextContent('Keep this text');
  });
});

describe('I18nProvider', () => {
  test('activating another locale re-renders every translation', () => {
    const i18n = french();
    i18n.load('es', SPANISH);
    mount(i18n, () => (
      <>
        <Greeting />
        <Welcome name="Ada" />
      </>
    ));
    const greeting = screen.getByTestId('greeting');
    i18n.activate('es');
    flush();
    expect(greeting).toHaveTextContent('Hola');
    expect(screen.getByTestId('welcome')).toHaveTextContent(
      'Te damos la bienvenida, Ada.'
    );
    // The tree is updated in place, not mounted again.
    expect(screen.getByTestId('greeting')).toBe(greeting);
  });

  test('loading messages for the active locale re-renders the tree', () => {
    const i18n = setupI18n({ locale: 'fr', messages: { fr: {} } });
    mount(i18n, () => (
      <>
        <Greeting />
        <Welcome name="Ada" />
      </>
    ));
    expect(screen.getByTestId('greeting')).toHaveTextContent('Hello');
    i18n.load('fr', FRENCH);
    flush();
    expect(screen.getByTestId('greeting')).toHaveTextContent('Bonjour');
    expect(screen.getByTestId('welcome')).toHaveTextContent('Bienvenue, Ada !');
  });

  test('the hook exposes the instance that is active now', () => {
    function Locale(): JSX.Element {
      const lingui = useRuntimeLingui();
      return <p data-testid="locale">{lingui.i18n().locale}</p>;
    }
    const i18n = french();
    i18n.load('es', SPANISH);
    mount(i18n, () => <Locale />);
    expect(screen.getByTestId('locale')).toHaveTextContent('fr');
    i18n.activate('es');
    flush();
    expect(screen.getByTestId('locale')).toHaveTextContent('es');
  });

  test('nothing renders until a locale is active', () => {
    const i18n = setupI18n();
    let mounted = 0;
    function Counted(): JSX.Element {
      mounted += 1;
      return <Greeting />;
    }
    mount(i18n, () => <Counted />);
    expect(screen.queryByTestId('greeting')).toBeNull();
    expect(mounted).toBe(0);
    i18n.loadAndActivate({ locale: 'fr', messages: FRENCH });
    flush();
    expect(screen.getByTestId('greeting')).toHaveTextContent('Bonjour');
    expect(mounted).toBe(1);
  });

  test('a replaced instance takes over the tree and the old one is left alone', () => {
    const first = french();
    const second = setupI18n({ locale: 'es', messages: { es: SPANISH } });
    const [i18n, setI18n] = createSignal(first);
    render(() => (
      <I18nProvider i18n={i18n()}>
        <Greeting />
      </I18nProvider>
    ));
    expect(screen.getByTestId('greeting')).toHaveTextContent('Bonjour');
    setI18n(second);
    flush();
    expect(screen.getByTestId('greeting')).toHaveTextContent('Hola');
    first.load('fr', { greeting: 'Salut' });
    flush();
    expect(screen.getByTestId('greeting')).toHaveTextContent('Hola');
  });

  test('an unmounted tree stops listening to its instance', () => {
    const i18n = french();
    let renders = 0;
    function Counted(): JSX.Element {
      const { t } = useLingui();
      return (
        <p>
          {(() => {
            renders += 1;
            return t({ id: 'greeting', message: 'Hello' });
          })()}
        </p>
      );
    }
    const { unmount } = mount(i18n, () => <Counted />);
    const before = renders;
    unmount();
    i18n.load('fr', { greeting: 'Salut' });
    flush();
    expect(renders).toBe(before);
  });
});

describe('useLingui', () => {
  test('throws without a provider', () => {
    expect(() => render(() => <Greeting />)).toThrow();
    function Runtime(): JSX.Element {
      const lingui = useRuntimeLingui();
      return <p>{lingui.i18n().locale}</p>;
    }
    expect(() => render(() => <Runtime />)).toThrow();
  });
});
