import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { OnColorProvider, useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { ButtonSurfaceFill } from '../button/button-surface-fill';
import {
  MUTATION_FEEDBACK_ICONS,
  resolveMutationPressableRender,
  type ButtonFeedback,
  type ButtonIntent,
  type MutationPressableFace,
  type MutationPressableInput,
} from '../button/mutation-pressable-face';
import { Pressable } from '../pressable';
import { Spinner } from '../spinner';
import { PlusIcon, type IconComponent } from '../icons';
import { Text } from '../text';

const FAB_SIZE = 56;
const FAB_ICON_SIZE = 24;
const FAB_HORIZONTAL_PADDING = 16;
const FAB_CONTENT_GAP = 8;
const SURFACE_ANDROID_ELEVATION = 2;

export type FloatingActionButtonProps = {
  onPress?: () => void;
  onRetry?: () => void;
  disabled?: boolean;
  loading?: boolean;
  feedback?: ButtonFeedback;
  accessibilityLabel: LocalizedString;
  icon?: IconComponent;
  intent?: ButtonIntent;
  /** When set, renders an extended pill FAB with icon + label. */
  label?: ReactNode;
  loadingLabel?: ReactNode;
  successLabel?: ReactNode;
  errorLabel?: ReactNode;
};

function buildPressableInput(
  props: FloatingActionButtonProps
): MutationPressableInput {
  const {
    intent = 'primary',
    disabled = false,
    loading = false,
    feedback,
    onPress,
    onRetry,
  } = props;
  return {
    intent,
    variant: 'solid',
    disabled,
    loading,
    ...(feedback !== undefined ? { feedback } : {}),
    ...(onPress !== undefined ? { onPress } : {}),
    ...(onRetry !== undefined ? { onRetry } : {}),
  };
}

function FabLabelText({
  label,
  foregroundColor,
}: {
  label: ReactNode;
  foregroundColor: string;
}) {
  return (
    <Text
      variant="bodyBold"
      style={{
        color: foregroundColor,
        fontSize: 15,
        lineHeight: 20,
        fontWeight: '600',
      }}
      label={label}
    />
  );
}

function labelForPhase(
  phase: ButtonFeedback,
  labels: {
    label?: ReactNode;
    loadingLabel?: ReactNode;
    successLabel?: ReactNode;
    errorLabel?: ReactNode;
  }
): ReactNode | undefined {
  switch (phase) {
    case 'loading':
      return labels.loadingLabel ?? labels.label;
    case 'success':
      return labels.successLabel ?? labels.label;
    case 'error':
      return labels.errorLabel ?? labels.label;
    default:
      return labels.label;
  }
}

function FabContent({
  phase,
  icon,
  foregroundColor,
  label,
  loadingLabel,
  successLabel,
  errorLabel,
}: {
  phase: ButtonFeedback;
  icon: IconComponent;
  foregroundColor: string;
  label?: ReactNode;
  loadingLabel?: ReactNode;
  successLabel?: ReactNode;
  errorLabel?: ReactNode;
}): ReactNode {
  const text = labelForPhase(phase, {
    label,
    loadingLabel,
    successLabel,
    errorLabel,
  });
  const showText = label !== undefined && text !== undefined;
  const Icon = icon;

  if (phase === 'loading') {
    return (
      <>
        <Spinner color={foregroundColor} size={FAB_ICON_SIZE} />
        {showText ? (
          <FabLabelText label={text} foregroundColor={foregroundColor} />
        ) : null}
      </>
    );
  }

  if (phase === 'success' || phase === 'error') {
    const FeedbackIcon = MUTATION_FEEDBACK_ICONS[phase];
    return (
      <>
        <FeedbackIcon size={FAB_ICON_SIZE} color={foregroundColor} />
        {showText ? (
          <FabLabelText label={text} foregroundColor={foregroundColor} />
        ) : null}
      </>
    );
  }

  return (
    <>
      <Icon size={FAB_ICON_SIZE} color={foregroundColor} />
      {showText ? (
        <FabLabelText label={text} foregroundColor={foregroundColor} />
      ) : null}
    </>
  );
}

function resolveFabShadow(
  face: MutationPressableFace,
  themeElevation: { boxShadow?: string; elevation?: number } | undefined
): { boxShadow?: string; elevation?: number } | undefined {
  if (face.surfaceShadow !== undefined) {
    return {
      boxShadow: face.surfaceShadow,
      ...(Platform.OS === 'android'
        ? { elevation: SURFACE_ANDROID_ELEVATION }
        : {}),
    };
  }
  return themeElevation;
}

function fabContainerStyle(args: {
  extended: boolean;
  face: MutationPressableFace;
  shadow: { boxShadow?: string; elevation?: number } | undefined;
}) {
  const hasGradient = args.face.gradient !== undefined;
  return {
    height: FAB_SIZE,
    minHeight: FAB_SIZE,
    borderRadius: borderRadius.full,
    backgroundColor: hasGradient ? 'transparent' : args.face.backgroundColor,
    borderColor: args.face.borderColor,
    borderWidth: args.face.borderWidth,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: FAB_CONTENT_GAP,
    overflow: 'hidden' as const,
    ...(args.extended
      ? { paddingHorizontal: FAB_HORIZONTAL_PADDING }
      : { width: FAB_SIZE }),
    ...(args.shadow?.boxShadow ? { boxShadow: args.shadow.boxShadow } : {}),
    ...(args.shadow?.elevation !== undefined
      ? { elevation: args.shadow.elevation }
      : undefined),
  };
}

export function FloatingActionButton(props: FloatingActionButtonProps) {
  const {
    accessibilityLabel,
    icon = PlusIcon,
    label,
    loadingLabel,
    successLabel,
    errorLabel,
  } = props;
  const extended = label !== undefined;
  const theme = useTheme();
  const { phase, face, nonInteractive, handlePress } =
    resolveMutationPressableRender(theme, buildPressableInput(props));
  const elevationLevel = theme.colorScheme === 'light' ? 2 : 0;
  const themeShadow =
    face.withElevation && elevationLevel > 0
      ? theme.elevation(elevationLevel as 2)
      : undefined;
  const shadow = resolveFabShadow(face, themeShadow);

  return (
    <Pressable
      onPress={handlePress}
      disabled={nonInteractive}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      sx={{ borderRadius: borderRadius.full, overflow: 'hidden' }}
      style={fabContainerStyle({ extended, face, shadow })}
    >
      {face.gradient !== undefined ? (
        <ButtonSurfaceFill
          top={face.gradient.top}
          bottom={face.gradient.bottom}
          borderRadius={borderRadius.full}
        />
      ) : null}
      <OnColorProvider
        value={{
          fg: face.foregroundColor,
          fgMuted: face.foregroundColor,
          icon: face.foregroundColor,
        }}
      >
        <FabContent
          phase={phase}
          icon={icon}
          foregroundColor={face.foregroundColor}
          {...(label !== undefined ? { label } : {})}
          {...(loadingLabel !== undefined ? { loadingLabel } : {})}
          {...(successLabel !== undefined ? { successLabel } : {})}
          {...(errorLabel !== undefined ? { errorLabel } : {})}
        />
      </OnColorProvider>
    </Pressable>
  );
}
