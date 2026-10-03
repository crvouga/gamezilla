import { Trans } from '@lingui/solid/macro';
import { type JSX, Show } from 'solid-js';
import { CustomGameAction } from './custom-game-action';
import { CustomGameConfirm } from './custom-game-confirm';
import type { CustomGameScreenModel } from './use-custom-game-screen';

export function CustomGameActive(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  const offer = (): string => props.model.current()?.drawOfferedBy ?? '';
  const twoPeople = (): boolean =>
    props.model.current()?.white.kind === 'person' &&
    props.model.current()?.black.kind === 'person';
  return (
    <div class="box gap-3">
      <Show when={offer() !== ''}>
        <p role="status">
          <Trans>A draw has been offered.</Trans>
        </p>
      </Show>
      <Show when={props.model.mySide() !== null && props.model.canPlay()}>
        <div class="box flex-row gap-2 flex-wrap">
          <CustomGameConfirm model={props.model} operation="resign" />
          <Show when={twoPeople() && offer() === ''}>
            <CustomGameAction
              title={<Trans>Offer draw</Trans>}
              testId="chess-custom-offer"
              operation={() => props.model.choose({ operation: 'offer' })}
            />
          </Show>
          <Show when={offer() !== '' && offer() !== props.model.myId()}>
            <CustomGameAction
              title={<Trans>Agree draw</Trans>}
              testId="chess-custom-agree"
              operation={() => props.model.choose({ operation: 'agree' })}
            />
            <CustomGameAction
              title={<Trans>Decline draw</Trans>}
              testId="chess-custom-reject"
              operation={() => props.model.choose({ operation: 'reject' })}
            />
          </Show>
        </div>
      </Show>
    </div>
  );
}
