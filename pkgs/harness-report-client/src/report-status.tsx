import { useLingui } from '@lingui/solid/macro';
import { Badge, type BadgeIntent } from '@pkgs/ui-root-client/badge';

export function ReportStatus(props: { readonly status: string }) {
  const { t } = useLingui();
  const labels = () => ({
    passed: t`Passed`,
    failed: t`Failed`,
    running: t`Running`,
    skipped: t`Skipped`,
    'not-run': t`Not run`,
  });
  const intent = (): BadgeIntent => {
    if (props.status === 'failed') return 'destructive';
    if (props.status === 'passed') return 'success';
    if (props.status === 'running') return 'info';
    return 'neutral';
  };
  return (
    <Badge
      intent={intent()}
      size="sm"
      label={
        labels()[props.status as keyof ReturnType<typeof labels>] ??
        props.status
      }
    />
  );
}
