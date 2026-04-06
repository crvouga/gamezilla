import { ok, heading } from '../fmt';
import { runCapture } from '../subprocess';
import { PROJECT_CONFIG } from '../../project-config';

const OLD_BUCKET = 'gamezilla-terraform-state';
const OLD_DYNAMODB_TABLE = 'gamezilla-terraform-lock';

export function teardownOldTfBackend(): void {
  const { region } = PROJECT_CONFIG.aws;

  heading('Tear down old S3 state backend');

  deleteS3Bucket(OLD_BUCKET, region);
  deleteDynamoDbTable(OLD_DYNAMODB_TABLE, region);
}

function deleteS3Bucket(bucket: string, region: string): void {
  if (!s3BucketExists(bucket, region)) {
    ok(`S3 bucket "${bucket}" already gone`);
    return;
  }

  console.log(`Emptying S3 bucket "${bucket}" (including old versions)...`);
  runCapture('aws', [
    's3api', 'list-object-versions',
    '--bucket', bucket,
    '--region', region,
    '--output', 'json',
    '--query', 'Versions[].{Key:Key,VersionId:VersionId}',
  ]);

  try {
    runCapture('aws', ['s3', 'rm', `s3://${bucket}`, '--recursive', '--region', region]);
  } catch {
    // bucket may already be empty
  }

  deleteAllObjectVersions(bucket, region);

  console.log(`Deleting S3 bucket "${bucket}"...`);
  runCapture('aws', ['s3api', 'delete-bucket', '--bucket', bucket, '--region', region]);
  ok(`S3 bucket "${bucket}" deleted`);
}

function deleteAllObjectVersions(bucket: string, region: string): void {
  const raw = runCapture('aws', [
    's3api', 'list-object-versions',
    '--bucket', bucket,
    '--region', region,
    '--output', 'json',
  ]);

  const data = JSON.parse(raw) as {
    Versions?: { Key: string; VersionId: string }[];
    DeleteMarkers?: { Key: string; VersionId: string }[];
  };

  const objects = [
    ...(data.Versions ?? []).map(v => ({ Key: v.Key, VersionId: v.VersionId })),
    ...(data.DeleteMarkers ?? []).map(d => ({ Key: d.Key, VersionId: d.VersionId })),
  ];

  if (objects.length === 0) return;

  const deletePayload = JSON.stringify({ Objects: objects, Quiet: true });
  runCapture('aws', [
    's3api', 'delete-objects',
    '--bucket', bucket,
    '--region', region,
    '--delete', deletePayload,
  ]);
  ok(`Deleted ${objects.length} object version(s) / delete marker(s)`);
}

function s3BucketExists(bucket: string, region: string): boolean {
  try {
    runCapture('aws', ['s3api', 'head-bucket', '--bucket', bucket, '--region', region]);
    return true;
  } catch {
    return false;
  }
}

function deleteDynamoDbTable(table: string, region: string): void {
  if (!dynamoDbTableExists(table, region)) {
    ok(`DynamoDB table "${table}" already gone`);
    return;
  }

  console.log(`Deleting DynamoDB table "${table}"...`);
  runCapture('aws', ['dynamodb', 'delete-table', '--table-name', table, '--region', region]);

  console.log('Waiting for table deletion...');
  try {
    runCapture('aws', ['dynamodb', 'wait', 'table-not-exists', '--table-name', table, '--region', region]);
  } catch {
    // wait may timeout but table is still being deleted
  }
  ok(`DynamoDB table "${table}" deleted`);
}

function dynamoDbTableExists(table: string, region: string): boolean {
  try {
    runCapture('aws', ['dynamodb', 'describe-table', '--table-name', table, '--region', region]);
    return true;
  } catch {
    return false;
  }
}
