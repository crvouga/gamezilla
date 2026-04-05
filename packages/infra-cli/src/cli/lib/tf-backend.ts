import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok } from '../fmt';
import { runLocal, runCapture } from '../subprocess';
import { TF_PACKAGE_ROOT } from '../paths';
import { PROJECT_CONFIG } from '../../project-config';
import { ensureAwsEnvCredentials } from './aws-creds';

export function ensureTfBackend(): void {
  const { region } = PROJECT_CONFIG.aws;
  const { bucket, dynamodbTable } = PROJECT_CONFIG.tfBackend;

  ensureS3Bucket(bucket, region);
  ensureDynamoDbTable(dynamodbTable, region);
  ensureAwsEnvCredentials();
  migrateStateIfNeeded();
}

function ensureS3Bucket(bucket: string, region: string): void {
  if (s3BucketExists(bucket, region)) {
    ok(`S3 bucket "${bucket}" already exists`);
    return;
  }

  console.log(`Creating S3 bucket "${bucket}"...`);

  const createArgs = ['s3api', 'create-bucket', '--bucket', bucket, '--region', region];
  if (region !== 'us-east-1') {
    createArgs.push('--create-bucket-configuration', `LocationConstraint=${region}`);
  }
  runLocal('aws', createArgs);

  runLocal('aws', [
    's3api', 'put-bucket-versioning',
    '--bucket', bucket,
    '--versioning-configuration', 'Status=Enabled',
    '--region', region,
  ]);

  runLocal('aws', [
    's3api', 'put-bucket-encryption',
    '--bucket', bucket,
    '--server-side-encryption-configuration',
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}',
    '--region', region,
  ]);

  runLocal('aws', [
    's3api', 'put-public-access-block',
    '--bucket', bucket,
    '--public-access-block-configuration',
    'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true',
    '--region', region,
  ]);

  ok(`S3 bucket "${bucket}" created with versioning + encryption`);
}

function s3BucketExists(bucket: string, region: string): boolean {
  try {
    runCapture('aws', ['s3api', 'head-bucket', '--bucket', bucket, '--region', region]);
    return true;
  } catch {
    return false;
  }
}

function ensureDynamoDbTable(table: string, region: string): void {
  if (dynamoDbTableExists(table, region)) {
    ok(`DynamoDB table "${table}" already exists`);
    return;
  }

  console.log(`Creating DynamoDB table "${table}"...`);
  runLocal('aws', [
    'dynamodb', 'create-table',
    '--table-name', table,
    '--attribute-definitions', 'AttributeName=LockID,AttributeType=S',
    '--key-schema', 'AttributeName=LockID,KeyType=HASH',
    '--billing-mode', 'PAY_PER_REQUEST',
    '--region', region,
  ]);

  runLocal('aws', [
    'dynamodb', 'wait', 'table-exists',
    '--table-name', table,
    '--region', region,
  ]);

  ok(`DynamoDB table "${table}" created`);
}

function dynamoDbTableExists(table: string, region: string): boolean {
  try {
    runCapture('aws', ['dynamodb', 'describe-table', '--table-name', table, '--region', region]);
    return true;
  } catch {
    return false;
  }
}

function migrateStateIfNeeded(): void {
  const { region } = PROJECT_CONFIG.aws;
  const { bucket, key } = PROJECT_CONFIG.tfBackend;
  const localState = join(TF_PACKAGE_ROOT, 'terraform.tfstate');

  if (existsSync(localState) && !s3StateExists(bucket, key, region)) {
    console.log('Uploading local terraform.tfstate to S3...');
    runLocal('aws', ['s3', 'cp', localState, `s3://${bucket}/${key}`, '--region', region]);
    ok('State uploaded to S3');
  }

  console.log('Initializing S3 backend...');
  runLocal('terraform', ['init', '-input=false', '-reconfigure'], { cwd: TF_PACKAGE_ROOT });
  ok('Terraform backend configured');
}

function s3StateExists(bucket: string, key: string, region: string): boolean {
  try {
    runCapture('aws', ['s3api', 'head-object', '--bucket', bucket, '--key', key, '--region', region]);
    return true;
  } catch {
    return false;
  }
}
