import { Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { createFocusTarget } from '@pkgs/ui-root-client-ts/focus';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from '@solidjs/web';
import { createEffect, createSignal, Show } from 'solid-js';
import type { GameLesson, LessonStep } from './game-lesson';

function Practice(props: {
  step: LessonStep;
  index: number;
  total: number;
  onNext: () => void;
  onRetry: () => void;
  onLeave: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const [syncKey, setSyncKey] = createSignal(0);
  const [position, setPosition] = createSignal(() => props.step.initial());
  const [status, setStatus] = createSignal<'playing' | 'refused' | 'complete'>(
    'playing'
  );
  const complete = () => status() === 'complete';
  const nextControl = createFocusTarget();
  createEffect(
    () => complete() && nextControl.mounted(),
    (ready) => {
      if (ready) nextControl.focus();
    }
  );
  const last = () => props.index + 1 === props.total;
  const act = (action: string) => {
    if (complete()) return;
    const next = props.step.play(position(), action);
    if (next === null) {
      setSyncKey((n) => n + 1);
      setStatus('refused');
      return;
    }
    setPosition(next);
    setStatus(
      (props.step.reachedGoal?.(next) ?? true) ? 'complete' : 'playing'
    );
  };
  return (
    <StackVertical gap="sm">
      <P variant="caption">
        <Trans>
          Step {props.index + 1} of {props.total}
        </Trans>
      </P>
      <P
        variant="bodyBold"
        role="status"
        dataSet={{ testid: 'practice-prompt' }}
      >
        {complete() ? props.step.success() : props.step.prompt()}
      </P>
      <Show when={status() === 'refused'}>
        <P role="status">
          <Trans>Try the move described above.</Trans>
        </P>
      </Show>
      <Show when={complete()}>
        <Button
          title={last() ? t`Replay lesson` : t`Next step`}
          onClick={props.onNext}
          focusTarget={nextControl.target}
          dataSet={{ testid: 'practice-next' }}
        />
      </Show>
      <StackVertical inert={complete()}>
        <props.step.Board
          position={position()}
          syncKey={syncKey()}
          complete={complete()}
          onAction={act}
          onLeave={props.onLeave}
        />
      </StackVertical>
      <StackHorizontal gap="sm" wrap>
        <Button
          variant="outline"
          title={t`Retry step`}
          onClick={props.onRetry}
          dataSet={{ testid: 'practice-retry' }}
        />
        <Button
          variant="ghost"
          title={t`Leave lesson`}
          onClick={props.onLeave}
          dataSet={{ testid: 'practice-leave' }}
        />
      </StackHorizontal>
    </StackVertical>
  );
}

export function GameHowToPlayView(props: {
  title: string;
  lesson: GameLesson;
  onLeave: () => void;
}): JSX.Element {
  const [attempt, setAttempt] = createSignal({ index: 0 });
  return (
    <EmbeddedScreen
      screenId="game-how-to-play"
      width="prose"
      compactInset="narrowest"
      title={<Trans>How to play {props.title}</Trans>}
      dataSet={{ testid: 'game-how-to-play' }}
    >
      <Show when={attempt()} keyed>
        {({ index }) => (
          <Practice
            step={props.lesson[index] ?? props.lesson[0]}
            index={index}
            total={props.lesson.length}
            onRetry={() => setAttempt({ index })}
            onNext={() =>
              setAttempt({ index: (index + 1) % props.lesson.length })
            }
            onLeave={props.onLeave}
          />
        )}
      </Show>
    </EmbeddedScreen>
  );
}
