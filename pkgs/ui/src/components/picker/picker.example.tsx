/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { Box } from '../box';
import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { Picker, type PickerOption } from './index';

function Swatch(props: { color: string }): JSX.Element {
  return (
    <Box
      sx={{
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: props.color,
      }}
    />
  );
}

/** Built inside the component: `preview` is JSX and needs the theme context. */
function options(): readonly PickerOption[] {
  return [
    { value: 'a', label: 'Alpha', preview: <Swatch color="#c084fc" /> },
    { value: 'b', label: 'Bravo', preview: <Swatch color="#38bdf8" /> },
    { value: 'c', label: 'Charlie', preview: <Swatch color="#4ade80" /> },
  ];
}

export default function PickerExample(): JSX.Element {
  const [v, setV] = createSignal('a');
  const OPTIONS = options();

  return (
    <ExampleRoot>
      <Picker
        label="With preview thumbs"
        options={OPTIONS}
        value={v()}
        onValueChange={setV}
      />
      <Text
        variant="caption"
        sx={{ opacity: 0.75 }}
        label={`Selected: ${v()}`}
      />
    </ExampleRoot>
  );
}
