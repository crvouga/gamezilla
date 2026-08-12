import type { BucketInfo } from './api-client';

export function BucketPicker(props: {
  readonly buckets: readonly BucketInfo[];
  readonly onOpen: (bucketId: string) => void;
}) {
  const { buckets, onOpen } = props;
  return (
    <div className="suite-page">
      <header>
        <h1>Simulation report</h1>
        <span className="meta">
          {buckets.length} bucket{buckets.length === 1 ? '' : 's'}
        </span>
      </header>
      {buckets.length === 0 ? (
        <p className="empty">No buckets configured.</p>
      ) : (
        <table className="suite-table">
          <thead>
            <tr>
              <th>Bucket</th>
              <th>Id</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.id} onClick={() => onOpen(b.id)}>
                <td className="test-id">{b.label}</td>
                <td className="meta">{b.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
