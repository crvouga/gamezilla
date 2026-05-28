/**
 * `SuccessState` -- canonical post-action success block.
 *
 * The success counterpart to {@link ErrorState}: same layout contract,
 * same density variants, paired with the `success` color ramp. Use after
 * a confirm flow completes ("Saved", "Server config updated"), or as a
 * standalone full-screen confirmation between steps.
 *
 * @example
 * ```tsx
 * <SuccessState
 *   title={t`Server config updated`}
 *   body={t`Clients sync on the next PatchDB tick.`}
 * />
 * <SuccessState variant="compact" title={t`Saved`} />
 * ```
 */

import type { ReactNode } from 'react';

import { useTheme } from '../../theme';
import { Box } from '../box';
import { Button } from '../button';
import { borderRadius } from '../../theme/scale';
import { IconSymbol, type IconSymbolName } from '../symbol-icon';
import { StateBlock, type StateBlockVariant } from '../state-block';
import { Text } from '../text';

export type SuccessStateAction = {
  label: ReactNode;
  onPress: () => void;
};

export type SuccessStateProps = {
  /** Defaults to the design-system check-in-circle icon. */
  icon?: IconSymbolName;
  title: ReactNode;
  body?: ReactNode;
  /** Optional CTA below the body. */
  action?: SuccessStateAction;
  /** Layout density. Defaults to `'fill'`. */
  variant?: StateBlockVariant;
};

const ICON_SIZE_FILL = 32;
const ICON_SIZE_COMPACT = 20;
const DEFAULT_ICON: IconSymbolName = 'check.circle.fill';

export function SuccessState({
  icon = DEFAULT_ICON,
  title,
  body,
  action,
  variant = 'fill',
}: SuccessStateProps): ReactNode {
  if (variant === 'compact') {
    return (
      <SuccessStateCompact icon={icon} title={title} body={body} action={action} />
    );
  }
  return (
    <SuccessStateFill icon={icon} title={title} body={body} action={action} />
  );
}

function SuccessStateFill({
  icon,
  title,
  body,
  action,
}: {
  icon: IconSymbolName;
  title: ReactNode;
  body: ReactNode;
  action: SuccessStateAction | undefined;
}) {
  const theme = useTheme();
  return (
    <StateBlock variant="fill">
      <IconSymbol
        name={icon}
        size={ICON_SIZE_FILL}
        color={theme.colors.success}
      />
      <Text
        variant="bodyBold"
        sx={{ color: 'success' }}
        style={{ textAlign: 'center' }}
        label={title}
      />
      {body !== undefined && body !== null ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          style={{ textAlign: 'center' }}
          label={body}
        />
      ) : null}
      {action !== undefined ? (
        <Button
          title={action.label}
          intent="primary"
          size="sm"
          onPress={action.onPress}
        />
      ) : null}
    </StateBlock>
  );
}

function SuccessStateCompact({
  icon,
  title,
  body,
  action,
}: {
  icon: IconSymbolName;
  title: ReactNode;
  body: ReactNode;
  action: SuccessStateAction | undefined;
}) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 3,
        p: 3,
        borderWidth: 1,
        borderColor: 'success',
        background: 'successSurface',
        borderRadius: borderRadius.md,
      }}
    >
      <Box sx={{ pt: 0.5 }}>
        <IconSymbol
          name={icon}
          size={ICON_SIZE_COMPACT}
          color={theme.colors.success}
        />
      </Box>
      <Box sx={{ flex: 1, gap: 1 }}>
        <Text variant="bodyBold" sx={{ color: 'success' }} label={title} />
        {body !== undefined && body !== null ? (
          <Text variant="caption" sx={{ color: 'success' }} label={body} />
        ) : null}
        {action !== undefined ? (
          <Box sx={{ mt: 1, alignItems: 'flex-start' }}>
            <Button
              title={action.label}
              intent="primary"
              size="sm"
              onPress={action.onPress}
            />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
