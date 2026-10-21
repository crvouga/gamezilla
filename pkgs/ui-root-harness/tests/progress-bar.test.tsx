import { expect, test } from 'bun:test';
import { ProgressBar } from '@pkgs/ui-root-client/progress-bar';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

test('a labelled progress bar keeps its percentage and accessible value reactive', () => {
  const [progress, setProgress] = createSignal(0);
  renderUi(() => (
    <>
      <ProgressBar
        label="Uploading file"
        progress={progress()}
        description="Keep this screen open."
      />
      <button type="button" onClick={() => setProgress(0.45)}>
        Advance
      </button>
      <button type="button" onClick={() => setProgress(1)}>
        Finish
      </button>
    </>
  ));
  const bar = screen.getByRole('progressbar', { name: 'Uploading file' });
  expect(screen.getByText('0%')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Advance'));
  expect(bar).toHaveAttribute('aria-valuenow', '0.45');
  expect(screen.getByText('45%')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Finish'));
  expect(bar).toHaveAttribute('aria-valuenow', '1');
  expect(screen.getByText('100%')).toBeInTheDocument();
});

test('unknown progress does not claim a percentage', () => {
  renderUi(() => <ProgressBar label="Preparing file" />);
  const bar = screen.getByRole('progressbar', { name: 'Preparing file' });
  expect(bar).not.toHaveAttribute('aria-valuenow');
  expect(bar).toHaveAttribute('aria-busy', 'true');
  expect(screen.queryByText(/%/)).toBeNull();
});

test('a nonnumeric progress input never exposes an invalid accessible value', () => {
  // regression: progress-bar-nan-value
  renderUi(() => <ProgressBar label="Uploading file" progress={Number.NaN} />);
  expect(
    screen.getByRole('progressbar', { name: 'Uploading file' })
  ).toHaveAttribute('aria-valuenow', '0');
  expect(screen.getByText('0%')).toBeInTheDocument();
});

test('progress clamps to the unit range and exposes its bounds', () => {
  renderUi(() => <ProgressBar progress={1.4} label="Upload" />);
  const bar = screen.getByRole('progressbar', { name: 'Upload' });
  expect(bar).toHaveAttribute('aria-valuenow', '1');
  expect(bar).toHaveAttribute('aria-valuemin', '0');
  expect(bar).toHaveAttribute('aria-valuemax', '1');
  expect(screen.getByText('100%')).toBeInTheDocument();
});

test('an unlabelled bar is the bare track, with no percentage or description', () => {
  renderUi(() => <ProgressBar progress={0.5} description="Hidden copy" />);
  expect(screen.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '0.5'
  );
  expect(screen.queryByText(/%/)).toBeNull();
  expect(screen.queryByText('Hidden copy')).toBeNull();
});
