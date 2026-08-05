import { Stack } from '../stack';
import { Spinner } from './spinner';
import { ExampleRoot } from '../explorer/example-root';

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
