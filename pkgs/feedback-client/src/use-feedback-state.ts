import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';
import type { FeedbackController, FeedbackState } from './controller';
import type { RecordingState } from './recording-types';

export function useFeedbackState(
  controller: Accessor<FeedbackController>
): Accessor<FeedbackState> {
  const [state, setState] = createSignal<FeedbackState>();
  createEffect(() => {
    const service = controller();
    setState(service.state());
    onCleanup(service.subscribe(() => setState(service.state())));
  });
  return () => state() ?? controller().state();
}
export function useRecordingState(
  controller: Accessor<FeedbackController>
): Accessor<RecordingState> {
  const [state, setState] = createSignal<RecordingState>();
  createEffect(() => {
    const recorder = controller().recorder;
    setState(recorder.state());
    onCleanup(recorder.subscribe(() => setState(recorder.state())));
  });
  return () => state() ?? controller().recorder.state();
}
