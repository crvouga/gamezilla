import * as apprunner from 'aws-cdk-lib/aws-apprunner';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'node:path';

const REPO_ROOT = path.join(__dirname, '..', '..', '..');

export class ReqRes extends Construct {
  readonly service: apprunner.CfnService;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const dockerAsset = new ecr_assets.DockerImageAsset(this, 'Image', {
      directory: REPO_ROOT,
      file: 'Dockerfile',
      // App Runner only runs linux/amd64; default Docker on Apple Silicon is arm64 → failed health checks.
      platform: ecr_assets.Platform.LINUX_AMD64,
      exclude: [
        'packages/aws/**',
        'packages/patch-db-app/**',
        'node_modules',
        '.git',
        'dist',
        'packages/app/dist',
        'packages/patch-db-app/dist',
        '.expo',
        'web-build',
        'ios',
        'android',
        '.sim-recordings',
        '.cursor',
      ],
    });

    const ecrAccessRole = new iam.Role(this, 'EcrAccess', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSAppRunnerServicePolicyForECRAccess'
        ),
      ],
    });
    dockerAsset.repository.grantPull(ecrAccessRole);

    this.service = new apprunner.CfnService(this, 'Service', {
      sourceConfiguration: {
        autoDeploymentsEnabled: false,
        imageRepository: {
          imageIdentifier: dockerAsset.imageUri,
          imageConfiguration: { port: '8080' },
          imageRepositoryType: 'ECR',
        },
        authenticationConfiguration: {
          accessRoleArn: ecrAccessRole.roleArn,
        },
      },
      instanceConfiguration: {
        cpu: '256',
        memory: '512',
      },
      healthCheckConfiguration: {
        protocol: 'HTTP',
        path: '/health',
        interval: 10,
        timeout: 5,
        healthyThreshold: 1,
        /** Bun + SQLite migrate cold start can exceed 5 quick failures on first deploy. */
        unhealthyThreshold: 8,
      },
    });
    this.service.node.addDependency(dockerAsset);
  }
}
