import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BaseSetupCommand } from './base-command';
import { ensureAwsEnvCredentials, getTfPackageRoot, runLocal, runLocalCapture } from './shared';
import { PROJECT_CONFIG } from '../project-config';

export class TfBackendCommand extends BaseSetupCommand {
  readonly id = 'tf-backend';
  readonly summary = 'Create S3 + DynamoDB for remote Terraform state';

  async execute(): Promise<void> {
    const { region } = PROJECT_CONFIG.aws;
    const { bucket, dynamodbTable } = PROJECT_CONFIG.tfBackend;

    this.ensureS3Bucket(bucket, region);
    this.ensureDynamoDbTable(dynamodbTable, region);

    ensureAwsEnvCredentials();
    this.migrateStateIfNeeded();
  }

  private ensureS3Bucket(bucket: string, region: string): void {
    if (this.s3BucketExists(bucket, region)) {
      console.log(`✓ S3 bucket "${bucket}" already exists`);
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

    console.log(`✓ S3 bucket "${bucket}" created with versioning + encryption`);
  }

  private s3BucketExists(bucket: string, region: string): boolean {
    try {
      runLocalCapture('aws', ['s3api', 'head-bucket', '--bucket', bucket, '--region', region]);
      return true;
    } catch {
      return false;
    }
  }

  private ensureDynamoDbTable(table: string, region: string): void {
    if (this.dynamoDbTableExists(table, region)) {
      console.log(`✓ DynamoDB table "${table}" already exists`);
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

    console.log(`✓ DynamoDB table "${table}" created`);
  }

  private dynamoDbTableExists(table: string, region: string): boolean {
    try {
      runLocalCapture('aws', ['dynamodb', 'describe-table', '--table-name', table, '--region', region]);
      return true;
    } catch {
      return false;
    }
  }

  private migrateStateIfNeeded(): void {
    const { region } = PROJECT_CONFIG.aws;
    const { bucket, key } = PROJECT_CONFIG.tfBackend;
    const tfRoot = getTfPackageRoot();
    const localState = join(tfRoot, 'terraform.tfstate');

    if (existsSync(localState) && !this.s3StateExists(bucket, key, region)) {
      console.log('Uploading local terraform.tfstate to S3...');
      runLocal('aws', ['s3', 'cp', localState, `s3://${bucket}/${key}`, '--region', region]);
      console.log('✓ State uploaded to S3');
    }

    console.log('Initializing S3 backend...');
    runLocal('terraform', ['init', '-input=false', '-reconfigure'], { cwd: tfRoot });
    console.log('✓ Terraform backend configured');
  }

  private s3StateExists(bucket: string, key: string, region: string): boolean {
    try {
      runLocalCapture('aws', ['s3api', 'head-object', '--bucket', bucket, '--key', key, '--region', region]);
      return true;
    } catch {
      return false;
    }
  }
}
