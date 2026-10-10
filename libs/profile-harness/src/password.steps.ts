import { expect } from 'bun:test';
import { returnToTabs } from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import {
  authenticateWithPassword,
  passwordErrorShown,
  setupPasswordAccount,
} from '@libs/harness/password-actions';
import { openProfileEdit, setUsername } from './profile-actions';

Given(
  '{actor} has a password account at {string} with password {string} and username {username}',
  async (
    w,
    ...[actor, email, password, username]: [Actor, string, string, string]
  ) => {
    await w.s.apply(setupPasswordAccount, actor, email, password);
    await w.s.apply(openProfileEdit, actor);
    await w.s.apply(setUsername, actor, username);
  }
);

When(
  '{actor} registers with email address {string} and password {string}',
  async (w, actor: Actor, email: string, password: string) => {
    await w.s.apply(authenticateWithPassword, actor, {
      email,
      password,
      registering: true,
    });
    await w.s.apply(returnToTabs, actor);
  }
);

When(
  '{actor} signs in with email address {string} and password {string}',
  async (w, actor: Actor, email: string, password: string) => {
    await w.s.apply(authenticateWithPassword, actor, {
      email,
      password,
      registering: false,
    });
  }
);

Then(
  '{actor} is told that the email address or password is incorrect',
  async (w, actor: Actor) => {
    expect(await w.s.read(passwordErrorShown, actor)).toContain(
      'The email address or password is incorrect.'
    );
  }
);
