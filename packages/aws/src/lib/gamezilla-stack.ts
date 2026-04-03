import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as path from 'node:path';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';
import {
  AssertNlbSecurityGroupRules,
  AssertEcsServiceHealthCheckConfig,
  AssertSecurityGroupHasRules,
} from './cdk-aspects';
import { assertAwsEc2SecurityGroupDescription } from './cdk-aws-preconditions';
import { AppDatabase } from './database';
import { AppVpc } from './vpc';
import { WorkerService } from './worker';
import { PubSubBroker } from './pub-sub';
import { ReqRes } from './req-res';
import { WebApp } from './web-app';

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..');

const RESOURCE_TAGS = {
  Project: 'app',
  ManagedBy: 'cdk',
  Environment: 'production',
} as const;

/** CDK `-c key=true` passes string `"true"`; cdk.json may use boolean `true`. */
function isContextFlagTrue(scope: Construct, key: string): boolean {
  const v = scope.node.tryGetContext(key);
  return v === true || v === 'true' || v === 1 || v === '1';
}

export class GamezillaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, {
      ...props,
      terminationProtection: true,
    });

    for (const [k, v] of Object.entries(RESOURCE_TAGS)) {
      cdk.Tags.of(this).add(k, v);
    }

    cdk.Aspects.of(this).add(new AssertNlbSecurityGroupRules());
    cdk.Aspects.of(this).add(new AssertEcsServiceHealthCheckConfig());
    cdk.Aspects.of(this).add(new AssertSecurityGroupHasRules());

    const customDomain = isContextFlagTrue(this, 'customDomain');
    const customDomainBootstrap = isContextFlagTrue(
      this,
      'customDomainBootstrap'
    );

    const webApp = new WebApp(this, 'WebApp', {
      customDomain,
      customDomainBootstrap,
    });

    const appVpc = new AppVpc(this, 'AppVpc');
    const reqResTaskSgDesc = 'Req-res tasks - reach Aurora and pub/sub broker';
    assertAwsEc2SecurityGroupDescription(reqResTaskSgDesc, 'ReqResTaskSg');
    const reqResTaskSg = new ec2.SecurityGroup(this, 'ReqResTaskSg', {
      vpc: appVpc.vpc,
      description: reqResTaskSgDesc,
      allowAllOutbound: true,
    });
    const workerSgDesc = 'Worker tasks';
    assertAwsEc2SecurityGroupDescription(workerSgDesc, 'WorkerSg');
    const workerSg = new ec2.SecurityGroup(this, 'WorkerSg', {
      vpc: appVpc.vpc,
      description: workerSgDesc,
      allowAllOutbound: true,
    });

    const database = new AppDatabase(this, 'Database', {
      vpc: appVpc.vpc,
      allowedClients: [reqResTaskSg, workerSg],
    });

    const dockerAsset = new ecr_assets.DockerImageAsset(this, 'AppImage', {
      directory: REPO_ROOT,
      file: 'Dockerfile',
      platform: ecr_assets.Platform.LINUX_AMD64,
      exclude: [
        'packages/aws/**',
        'packages/local/**',
        'node_modules',
        '.git',
        'dist',
        'packages/app/dist',
        '.expo',
        'web-build',
        'ios',
        'android',
        '.sim-recordings',
        '.cursor',
      ],
    });

    // CDK construct ID 'Emqx' is preserved to avoid CloudFormation resource replacement.
    const pubSub = new PubSubBroker(this, 'Emqx', {
      vpc: appVpc.vpc,
      vpcClientSecurityGroups: [reqResTaskSg, workerSg],
    });

    const worker = new WorkerService(this, 'Worker', {
      vpc: appVpc.vpc,
      cluster: pubSub.ecsCluster,
      dockerAsset,
      database: database.cluster,
      pubSub,
      taskSecurityGroup: workerSg,
    });

    worker.service.node.addDependency(pubSub.brokerService);

    const reqRes = new ReqRes(this, 'ReqRes', {
      dockerAsset,
      database: database.cluster,
      internalMqttUrl: pubSub.internalMqttUrl,
      cluster: pubSub.ecsCluster,
      taskSecurityGroup: reqResTaskSg,
    });

    // Req-res needs the pub/sub broker (and Cloud Map DNS) reachable before MQTT connectAsync can finish.
    reqRes.loadBalancedService.service.node.addDependency(pubSub.brokerService);

    this.addOutputs({ webApp, reqRes, database, pubSub });
  }

  private addOutputs({
    webApp,
    reqRes,
    database,
    pubSub,
  }: {
    webApp: WebApp;
    reqRes: ReqRes;
    database: AppDatabase;
    pubSub: PubSubBroker;
  }): void {
    new cdk.CfnOutput(this, 'ReqResUrl', {
      value: `https://${reqRes.distribution.distributionDomainName}`,
      description:
        'Patch DB req-res base URL (HTTPS via CloudFront; path /patch-db)',
    });
    new cdk.CfnOutput(this, 'DatabaseClusterEndpoint', {
      value: database.cluster.clusterEndpoint.hostname,
      description: 'Aurora PostgreSQL writer hostname',
    });
    new cdk.CfnOutput(this, 'PubSubInternalMqttUrl', {
      value: pubSub.internalMqttUrl,
      description: 'VPC-internal MQTT URL for req-res / worker',
    });
    new cdk.CfnOutput(this, 'PubSubPublicNlbDns', {
      value: pubSub.publicNlbDnsName,
      description:
        'Public NLB DNS: mqtt://host:1883 and tcp :8083 for WebSocket',
    });
    new cdk.CfnOutput(this, 'WebAppBucketName', {
      value: webApp.bucket.bucketName,
    });
    new cdk.CfnOutput(this, 'WebDistributionId', {
      value: webApp.distribution.distributionId,
    });
    new cdk.CfnOutput(this, 'WebAppUrl', {
      value: `https://${webApp.distribution.distributionDomainName}`,
    });
    this.addNameserverOutput(
      webApp.hostedZone,
      'Route53Nameservers',
      'Set these nameservers at your domain registrar for gamezilla.app'
    );
  }

  private addNameserverOutput(
    zone: route53.HostedZone | undefined,
    outputId: string,
    description: string
  ): void {
    if (!zone) return;
    const nameServers = zone.hostedZoneNameServers;
    if (nameServers === undefined) {
      throw new Error(`${outputId}: hosted zone must expose name servers`);
    }
    new cdk.CfnOutput(this, outputId, {
      value: cdk.Fn.join(', ', nameServers),
      description,
    });
  }
}
