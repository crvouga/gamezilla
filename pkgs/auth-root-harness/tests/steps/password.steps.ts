import { expect } from 'bun:test';
import {
  registeredPasswordAccount,
  registerPassword,
  setupPasswordAccount,
  signInPassword,
} from '@pkgs/auth-root-harness/password-actions';
import { lastOutcome, signedInUser } from '@pkgs/auth-root-harness/system';
import { device, Given, Then, When } from './world';

Given(
  '{actor} has registered with email address {string} and password {string}',
  async (w, actor: string, email: string, password: string) => {
    await w.s.apply(setupPasswordAccount, device(w, actor), email, password);
    const id = await w.s.read(registeredPasswordAccount, email);
    expect(id).not.toBeNull();
    w.accounts.set(actor, id!);
  }
);
Given('{actor} has no password account', async () => {});
When(
  '{actor} signs in with email address {string} and password {string}',
  async (w, actor: string, email: string, password: string) => {
    await w.s.apply(signInPassword, device(w, actor), email, password);
  }
);
When(
  '{actor} registers with email address {string} and password {string}',
  async (w, actor: string, email: string, password: string) => {
    await w.s.apply(registerPassword, device(w, actor), email, password);
  }
);
Then(
  '{actor} is signed into her registered account',
  async (w, actor: string) => {
    const id = await w.s.read(signedInUser, device(w, actor));
    expect(id).not.toBeNull();
    if (w.accounts.has(actor)) expect(id).toBe(w.accounts.get(actor) ?? null);
  }
);
Then(
  '{actor} is told that the email address or password is incorrect',
  async (w, actor: string) => {
    expect(await w.s.read(lastOutcome, device(w, actor))).toMatchObject({
      kind: 'failed',
      message: 'The email address or password is incorrect.',
    });
  }
);
Then(
  '{actor} is told that registration could not be completed',
  async (w, actor: string) => {
    expect(await w.s.read(lastOutcome, device(w, actor))).toMatchObject({
      kind: 'failed',
      message: 'Registration could not be completed.',
    });
  }
);
