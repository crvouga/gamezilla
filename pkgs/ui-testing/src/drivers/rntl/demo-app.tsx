import { createElement, type ReactElement, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { AppHarness } from '../../bootstrap/app-harness';

/**
 * Generic demo app used only by this package's tests.
 * Intentionally free of any product-domain concepts.
 */
export function DemoApp(): ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [count, setCount] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);

  if (loggedIn) {
    return createElement(
      View,
      { testID: 'home' },
      createElement(Text, { testID: 'welcome' }, `Welcome ${email}`),
      createElement(
        Pressable,
        { testID: 'logout', onPress: () => setLoggedIn(false) },
        createElement(Text, null, 'Log out')
      )
    );
  }

  return createElement(
    ScrollView,
    { testID: 'login-scroll' },
    createElement(Text, { accessibilityRole: 'header' }, 'Sign in'),
    createElement(TextInput, {
      testID: 'email',
      value: email,
      onChangeText: setEmail,
      accessibilityLabel: 'Email',
      placeholder: 'Email',
    }),
    createElement(TextInput, {
      testID: 'password',
      value: password,
      onChangeText: setPassword,
      accessibilityLabel: 'Password',
      secureTextEntry: true,
    }),
    createElement(
      Pressable,
      {
        testID: 'submit',
        accessibilityRole: 'button',
        onPress: () => {
          if (email.length > 0 && password.length > 0) {
            setLoggedIn(true);
          }
        },
      },
      createElement(Text, null, 'Submit')
    ),
    createElement(Text, { testID: 'count' }, String(count)),
    createElement(
      Pressable,
      { testID: 'inc', onPress: () => setCount((c) => c + 1) },
      createElement(Text, null, 'Increment')
    )
  );
}

export const demoHarness: AppHarness = {
  createRoot: () => createElement(DemoApp),
};
