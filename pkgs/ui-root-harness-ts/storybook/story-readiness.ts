import type { Channel } from 'storybook/internal/channels';
import {
  PLAY_FUNCTION_THREW_EXCEPTION,
  STORY_FINISHED,
  STORY_RENDER_PHASE_CHANGED,
  type StoryFinishedPayload,
} from 'storybook/internal/core-events';

type Phase = { storyId: string; newPhase: string };

/** Wait for native play completion, including when args rerender during play. */
export function trackStoryReadiness(
  canvas: HTMLElement,
  storyId: string,
  channel: Pick<Channel, 'on' | 'off'>
): () => void {
  let playing = false;
  // The initial loading phase precedes mounting this decorator.
  let inFlight = 1;
  canvas.removeAttribute('data-story-ready');
  canvas.removeAttribute('data-story-status');
  canvas.removeAttribute('data-story-error');
  const playError = (error: { message?: string }): void => {
    canvas.setAttribute(
      'data-story-error',
      error.message ?? 'Storybook play failed'
    );
  };
  const phase = (event: Phase): void => {
    if (event.storyId !== storyId) return;
    if (event.newPhase === 'loading') {
      inFlight += 1;
      canvas.removeAttribute('data-story-ready');
    }
    if (event.newPhase === 'playing') playing = true;
    if (event.newPhase === 'played') playing = false;
    if (event.newPhase === 'errored' || event.newPhase === 'aborted') {
      canvas.setAttribute('data-story-status', 'error');
      canvas.removeAttribute('data-story-ready');
    }
  };
  const finished = (event: StoryFinishedPayload): void => {
    if (event.storyId !== storyId) return;
    inFlight = Math.max(0, inFlight - 1);
    if (event.status === 'error') {
      if (!canvas.hasAttribute('data-story-error')) {
        const failed = event.reporters
          .filter((report) => report.status === 'failed')
          .map((report) => report.type);
        canvas.setAttribute(
          'data-story-error',
          `${failed.join(', ') || 'Storybook'} reporter failed`
        );
      }
      canvas.setAttribute('data-story-status', 'error');
      canvas.removeAttribute('data-story-ready');
      return;
    }
    if (
      inFlight > 0 ||
      playing ||
      canvas.getAttribute('data-story-status') === 'error'
    )
      return;
    canvas.setAttribute('data-story-status', 'success');
    canvas.setAttribute('data-story-ready', 'true');
  };
  channel.on(PLAY_FUNCTION_THREW_EXCEPTION, playError);
  channel.on(STORY_RENDER_PHASE_CHANGED, phase);
  channel.on(STORY_FINISHED, finished);
  return () => {
    channel.off(PLAY_FUNCTION_THREW_EXCEPTION, playError);
    channel.off(STORY_RENDER_PHASE_CHANGED, phase);
    channel.off(STORY_FINISHED, finished);
  };
}
