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
 *   body={t`Clients sync on the next sync tick.`}
 * />
 * <SuccessState variant="compact" title={t`Saved`} />
 * ```
 */

import type { ReactNode } from 'react';

import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Box } from '../box';
import { Button } from '../button';
import { CircleCheckIcon, type IconComponent } from '../icons';
import { StateBlock, type StateBlockVariant } from '../state-block';
import { Text } from '../text';

export type SuccessStateAction = {
  label: ReactNode;
  onPress: () => void;
};

export type SuccessStateProps = {
  /** Defaults to the design-system check-in-circle icon. */
  icon?: IconComponent;
  title: ReactNode;
  body?: ReactNode;
  /** Optional CTA below the body. */
  action?: SuccessStateAction;
  /** Layout density. Defaults to `'fill'`. */
  variant?: StateBlockVariant;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

const ICON_SIZE_FILL = 32;
const ICON_SIZE_COMPACT = 20;
const DEFAULT_ICON = CircleCheckIcon;

export function SuccessState({
  icon = DEFAULT_ICON,
  title,
  body,
  action,
  variant = 'fill',
  dataSet,
}: SuccessStateProps): ReactNode {
  if (variant === 'compact') {
    return (
      <SuccessStateCompact
        icon={icon}
        title={title}
        body={body}
        action={action}
        dataSet={dataSet}
      />
    );
  }
  return (
    <SuccessStateFill
      icon={icon}
      title={title}
      body={body}
      action={action}
      dataSet={dataSet}
    />
  );
}

function SuccessStateFill({
  icon,
  title,
  body,
  action,
  dataSet,
}: {
  icon: IconComponent;
  title: ReactNode;
  body: ReactNode;
  action: SuccessStateAction | undefined;
  dataSet: ComponentDataSet | undefined;
}) {
  const theme = useTheme();
  const Icon = icon;
  return (
    <StateBlock variant="fill" {...componentDataSet('SuccessState', dataSet)}>
      <Icon size={ICON_SIZE_FILL} color={theme.colors.success} />
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
  dataSet,
}: {
  icon: IconComponent;
  title: ReactNode;
  body: ReactNode;
  action: SuccessStateAction | undefined;
  dataSet: ComponentDataSet | undefined;
}) {
  const theme = useTheme();
  const Icon = icon;
  return (
    <Box
      {...componentDataSet('SuccessState', dataSet)}
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
        <Icon size={ICON_SIZE_COMPACT} color={theme.colors.success} />
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
