import { useLingui } from '@lingui/react/macro';
import { componentRegistry, RegisterCommand, useRouter } from '@pkgs/ui-rn';

export function UiComponentsCommands() {
  const { t } = useLingui();
  const router = useRouter();
  return (
    <>
      {componentRegistry.map((c) => {
        const componentName = c.name;
        return (
          <RegisterCommand
            key={`ui:${componentName}`}
            id={`ui:${componentName}`}
            title={t`Open ${componentName} example`}
            category={t`UI Components`}
            run={async () => {
              router.push(`/ui/${encodeURIComponent(componentName)}`);
            }}
          />
        );
      })}
    </>
  );
}
