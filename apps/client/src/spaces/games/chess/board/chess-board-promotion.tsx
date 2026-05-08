import {
  Box,
  Button,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalRoot,
  Text,
} from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo, type ReactNode } from 'react';
import type { Move } from './chess-board-types';

const promotionOptions = [
  { key: 'q', label: <Trans>Queen</Trans> },
  { key: 'r', label: <Trans>Rook</Trans> },
  { key: 'b', label: <Trans>Bishop</Trans> },
  { key: 'n', label: <Trans>Knight</Trans> },
] as const satisfies readonly {
  key: NonNullable<Move['promotion']>;
  label: ReactNode;
}[];

export function ChessBoardPromotionModal(props: {
  visible: boolean;
  onPick: (p: NonNullable<Move['promotion']>) => void;
  onCancel: () => void;
}): ReactNode {
  const { visible, onPick, onCancel } = props;
  const { t } = useLingui();

  const items = useMemo(() => promotionOptions, []);

  return (
    <ModalRoot visible={visible} onRequestClose={onCancel}>
      <ModalBackdrop onPress={onCancel}>
        <ModalContent style={{ maxWidth: 520 }}>
          <ModalHeader title={t`Promote pawn`} />
          <ModalBody>
            <Box sx={{ gap: 3 }}>
              <Text
                variant="body"
                sx={{ color: 'textSecondary' }}
                label={<Trans>Choose a piece to promote to.</Trans>}
              />
              <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
                {items.map((it) => (
                  <Button
                    key={it.key}
                    title={it.label}
                    onPress={() => onPick(it.key)}
                  />
                ))}
                <Button
                  variant="outlined"
                  title={<Trans>Cancel</Trans>}
                  onPress={onCancel}
                />
              </Box>
            </Box>
          </ModalBody>
        </ModalContent>
      </ModalBackdrop>
    </ModalRoot>
  );
}
