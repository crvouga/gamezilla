import { expect } from 'bun:test';
import {
  feedbackOffered,
  feedbackShown,
  setupCancellationFeedback,
  shareCancellationFeedback,
  showSavedCancellationFeedback,
  teamFeedback,
} from '@libs/billing-harness-ts/cancellation-feedback';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';

Given(
  '{actor} has shared cancellation feedback with reason {string} and comment {string}',
  async (w, actor: Actor, reason: string, comment: string) => {
    await w.s.apply(setupCancellationFeedback, actor, reason, comment);
  }
);
When(
  '{actor} shares cancellation feedback with reason {string} and comment {string}',
  async (w, actor: Actor, reason: string, comment: string) => {
    await w.s.apply(shareCancellationFeedback, actor, reason, comment);
  }
);
Then(
  '{actor} sees their cancellation feedback with reason {string} and comment {string}',
  async (w, actor: Actor, reason: string, comment: string) => {
    await w.s.apply(showSavedCancellationFeedback, actor);
    expect(await w.s.read(feedbackShown, actor)).toEqual({
      reason,
      comment,
      shared: true,
    });
  }
);
Then(
  '{actor} has not shared cancellation feedback',
  async (w, actor: Actor) => {
    expect(await w.s.read(teamFeedback, actor)).toEqual({
      reason: '',
      comment: '',
      shared: false,
    });
  }
);
Then(
  '{actor} is not offered to share cancellation feedback',
  async (w, actor: Actor) => {
    expect(await w.s.read(feedbackOffered, actor)).toBe(false);
  }
);
Then(
  "the team can see {actor}'s cancellation feedback with reason {string} and comment {string}",
  async (w, actor: Actor, reason: string, comment: string) => {
    const answer = await w.s.until((s) => teamFeedback(s, actor), {
      maxMs: 30_000,
      pred: (answer) => answer.shared,
    });
    expect(answer).toEqual({ reason, comment, shared: true });
  }
);
Then(
  "{actor} cannot see {actor}'s cancellation feedback",
  async (w, observer: Actor, _owner: Actor) => {
    expect(await w.s.read(feedbackShown, observer)).toBeNull();
  }
);
