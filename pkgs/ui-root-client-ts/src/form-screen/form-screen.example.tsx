import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { FormScreen } from '@pkgs/ui-root-client-ts/form-screen';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createSignal, type JSX } from 'solid-js';
import { ScreenExampleFrame } from '../../storybook/fixtures/screen-example-frame';

export default function FormScreenExample(): JSX.Element {
  const [name, setName] = createSignal('Alex');
  const [saved, setSaved] = createSignal('Alex');
  const [rejectNext, setRejectNext] = createSignal(false);
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
            if (rejectNext()) {
              setRejectNext(false);
              return Promise.reject(new Error('Example save refused'));
            }
            setSaved(name());
            return Promise.resolve();
          },
          get disabled() {
            return name().trim().length === 0 || name() === saved();
          },
        }}
      >
        <Avatar size={96} />
        <TextInput
          label="Display name"
          value={name()}
          onChangeText={setName}
          required
        />
        <Button
          title={rejectNext() ? 'Next save will fail' : 'Preview a save error'}
          intent="neutral"
          variant="outline"
          onClick={() => setRejectNext(true)}
          disabled={rejectNext()}
        />
        <p class="text textCaption">
          Press Enter or Save. You stay here after success; errors keep your
          draft for another attempt. Cancel restores the saved name in this
          example.
        </p>
      </FormScreen>
    </ScreenExampleFrame>
  );
}
