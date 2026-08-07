import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { Spinner } from './spinner';

export default function SpinnerExample() {
  return (
    <ExampleRoot>
      <Stack direction="horizontal" spacing={4} align="center">
        <Spinner size="small" />
        <Spinner size="large" />
        <Spinner color="success" size="large" />
        <Spinner color="destructive" size="large" />
      </Stack>
    </ExampleRoot>
  );
}
