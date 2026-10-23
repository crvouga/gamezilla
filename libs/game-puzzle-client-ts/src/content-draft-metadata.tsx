import type { ContentBody } from '@libs/game-puzzle-shared-ts/content-types';
import { useLingui } from '@lingui/solid/macro';
import { FormField } from '@pkgs/ui-root-client-ts/form-field';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { Textarea } from '@pkgs/ui-root-client-ts/textarea';
import type { JSX } from 'solid-js';

export function ContentDraftMetadata(props: {
  body: ContentBody;
  disabled: boolean;
  onChange: (body: ContentBody) => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical gap="md">
      <TextInput
        label={t`Title`}
        value={props.body.title}
        maxLength={160}
        disabled={props.disabled}
        onChangeText={(title) => props.onChange({ ...props.body, title })}
        dataSet={{ testid: 'content-title' }}
      />
      <FormField label={t`Description`}>
        {() => (
          <Textarea
            value={props.body.description}
            maxLength={4_000}
            disabled={props.disabled}
            onValueChange={(description) =>
              props.onChange({ ...props.body, description })
            }
            testId="content-description"
          />
        )}
      </FormField>
      <TextInput
        label={t`Difficulty (optional)`}
        value={props.body.difficulty}
        maxLength={80}
        disabled={props.disabled}
        onChangeText={(difficulty) =>
          props.onChange({ ...props.body, difficulty })
        }
        dataSet={{ testid: 'content-difficulty' }}
      />
    </StackVertical>
  );
}
