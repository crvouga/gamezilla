import { ExampleRoot } from './example-root';
import { LinearProgress } from './linear-progress';

export default function LinearProgressExample() {
  return (
    <ExampleRoot>
      <LinearProgress
        label="Uploading file"
        progress={0.45}
        description="Keep this screen open until the upload finishes."
      />
      <LinearProgress label="Upload complete" progress={1} />
      <LinearProgress
        label="Preparing file"
        description="The amount of work is not known yet."
      />
    </ExampleRoot>
  );
}
