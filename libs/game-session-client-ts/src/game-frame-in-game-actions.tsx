import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { t } from '@lingui/core/macro';
import type {
  SpaceGameAction,
  SpaceGameResult,
} from '@pkgs/ui-root-client-ts/space-types';
import type { FramePlaceProps } from './game-frame-screen-view';
import type { FramePlay } from './game-frame-view-types';

type Props = FramePlaceProps;

/** A choice sent to the room; a refusal is told by the frame's own error. */
function send(props: Props, input: CustomGameInput): () => void {
  return () => {
    void props.onChoose(input).catch(() => undefined);
  };
}

/** The versus card still counts in: the game has not reached the board. */
function counting(props: Props): boolean {
  return props.overlay.kind === 'versus';
}

/** An answer the game waits for: a draw offered, a win to claim. */
function answers(props: Props, play: FramePlay): SpaceGameAction[] {
  const shown: SpaceGameAction[] = [];
  if (play.canAnswerDraw)
    shown.push(
      {
        id: 'agree',
        label: t`Accept draw`,
        emphasis: 'primary',
        onPress: send(props, { operation: 'agree' }),
        testId: 'custom-game-agree',
      },
      {
        id: 'reject',
        label: t`Decline draw`,
        onPress: send(props, { operation: 'reject' }),
        testId: 'custom-game-reject',
      }
    );
  if (play.canClaimWin)
    shown.push({
      id: 'claim-win',
      label: t`Claim the win`,
      emphasis: 'primary',
      onPress: send(props, { operation: 'claimWin' }),
      testId: 'custom-game-claim-win',
    });
  return shown;
}

/**
 * What playing needs now: the board's own actions, taking the viewer's
 * side back from a stand-in, and an answer the game waits for.
 */
export function frameLiveActions(props: Props): readonly SpaceGameAction[] {
  const reclaim: SpaceGameAction[] =
    props.table.near?.reclaim === true
      ? [
          {
            id: 'reclaim',
            label: t`Take back my side`,
            emphasis: 'primary',
            onPress: send(props, { operation: 'reclaim' }),
            testId: 'custom-game-reclaim',
          },
        ]
      : [];
  return [
    ...props.play.boardActions,
    ...reclaim,
    ...answers(props, props.play),
  ];
}

/** Offering a draw: now, again after the next move, or once reconnected. */
function offer(props: Props, play: FramePlay): SpaceGameAction[] {
  if (play.heldOfferDraw)
    return [
      {
        id: 'offer',
        label: t`Offer draw`,
        disabled: true,
        onPress: () => undefined,
        testId: 'custom-game-offer-draw-held',
      },
    ];
  if (!play.canOfferDraw && !play.offerAgainLater) return [];
  return [
    {
      id: 'offer',
      label: play.canOfferDraw
        ? t`Offer draw`
        : t`Offer draw after your next move`,
      disabled: !play.canOfferDraw || counting(props),
      onPress: send(props, { operation: 'offer' }),
      testId: 'custom-game-offer',
    },
  ];
}

/**
 * The viewer's standing in the game: offering a draw, and, confirmed
 * first, resigning or cancelling it for everyone. Held back, never hidden,
 * while the connection is away.
 */
export function frameStandingActions(props: Props): readonly SpaceGameAction[] {
  const play = props.play;
  const resign: SpaceGameAction[] = [];
  if (play.canResign || play.heldResign)
    resign.push({
      id: 'resign',
      label: t`Resign`,
      tone: 'destructive',
      disabled: play.heldResign || counting(props),
      onPress: () => props.onConfirm('resign'),
      testId: play.heldResign
        ? 'custom-game-resign-held'
        : 'custom-game-resign',
    });
  const cancel: SpaceGameAction[] = play.canCancel
    ? [
        {
          id: 'cancel',
          label: t`Cancel game`,
          tone: 'destructive',
          onPress: () => props.onConfirm('cancel'),
          testId: 'custom-game-cancel',
        },
      ]
    : [];
  return [...offer(props, play), ...resign, ...cancel];
}

/**
 * What comes next once the game is over. Someone who played (or may set up
 * the next game) is offered the rematch and a new game with other
 * choices; a player who may not start one leaves (the space's own note
 * says the host starts the rematch); someone watching goes back.
 */
function nextActions(props: Props): readonly SpaceGameAction[] {
  if (!props.next.plays)
    return [
      {
        id: 'back',
        label: t`Back to the space`,
        emphasis: 'primary',
        onPress: () => props.onBack(),
        testId: 'custom-game-back',
      },
    ];
  if (!props.next.canCreate)
    return [
      {
        id: 'back',
        label: t`Leave the game`,
        onPress: () => props.onBack(),
        testId: 'custom-game-back',
      },
    ];
  return [
    {
      id: 'rematch',
      label: t`Rematch`,
      emphasis: 'primary',
      onPress: send(props, { operation: 'rematch' }),
      testId: 'custom-game-rematch',
    },
    {
      id: 'new',
      label: t`New game`,
      onPress: send(props, { operation: 'create' }),
      testId: 'custom-game-new',
    },
  ];
}

/**
 * Under the outcome: how the game ended (`Black wins by resignation.`),
 * then the game's note (`Host starts the rematch.`).
 */
function outcomeDetail(props: Props): string | undefined {
  const detail = [props.status?.description ?? '', props.result?.note ?? '']
    .filter((part) => part !== '')
    .join(' ');
  return detail === '' ? undefined : detail;
}

/** The game is over: its outcome in the status line, and what comes next. */
export function frameInGameResult(props: Props): SpaceGameResult {
  return {
    status: props.result?.headline ?? t`Game over`,
    detail: outcomeDetail(props),
    actions: nextActions(props),
  };
}
