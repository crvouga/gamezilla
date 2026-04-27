import { RegisterCommand, componentRegistry } from '@gamezilla/lib/ui';
import { useRouter } from 'expo-router';

export function UiComponentsCommands() {
  const router = useRouter();
  return (
    <>
      {componentRegistry.map((c) => (
        <RegisterCommand
          key={`ui:${c.name}`}
          id={`ui:${c.name}`}
          title={`Open ${c.name} example`}
          category="UI Components"
          run={async () => {
            router.push(`/ui/${encodeURIComponent(c.name)}`);
          }}
        />
      ))}
    </>
  );
}
