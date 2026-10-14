import { createSignal, type JSX } from 'solid-js';
import { Avatar } from './avatar';
import { FormScreen } from './form-screen';
import { ScreenExampleFrame } from './screen-example-frame';
import { TextInput } from './text-input';

export default function FormScreenExample(): JSX.Element {
  const [name, setName] = createSignal('Alex');
  const [saved, setSaved] = createSignal('Alex');
  return (
    <ScreenExampleFrame>
      <FormScreen
        screenId="example-form"
        breadcrumbs={[{ name: 'Edit profile' }]}
        cancel={{ label: 'Cancel', onClick: () => setName(saved()) }}
        submit={{
          label: 'Save',
          loadingLabel: 'Saving…',
          successLabel: 'Saved',
          errorLabel: 'Try again',
          operation: () => {
            setSaved(name());
            return Promise.resolve();
          },
          get disabled() {
            return name().trim().length === 0 || name() === saved();
          },
        }}
      >
        <Avatar size={96} />
        <TextInput label="Display name" value={name()} onChangeText={setName} />
        <p class="text textCaption">
          Save keeps you here. Cancel restores the saved name in this example.
        </p>
      </FormScreen>
    </ScreenExampleFrame>
  );
}
