/** @jsxImportSource solid-js */
import { Trans, useLingui } from '@lingui/solid/macro';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

export default function TextInputExample(): JSX.Element {
  const { t } = useLingui();
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');

  return (
    <ExampleRoot>
      <SchemePreview>
        <div class="box flex-col gap-3">
          <TextInput
            label={<Trans>Name</Trans>}
            placeholder={t`John Doe`}
            value={name()}
            onChangeText={setName}
            helperText={t`Your full name`}
          />

          <TextInput
            label={<Trans>Email</Trans>}
            placeholder={t`you@example.com`}
            value={email()}
            onChangeText={setEmail}
            type="email"
            autocapitalize="none"
          />

          <TextInput
            label={<Trans>Error state</Trans>}
            placeholder={t`Type something…`}
            value=""
            onChangeText={() => undefined}
            error={t`This field is required`}
          />

          <TextInput
            label={<Trans>Disabled</Trans>}
            placeholder={t`Cannot edit`}
            value="Read-only value"
            onChangeText={() => undefined}
            disabled
          />
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
