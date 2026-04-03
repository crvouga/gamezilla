import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import { CdkDia, CdkDiaDecorator, CollapseTypes } from 'cdk-dia';
import { Construct } from 'constructs';
import { assertFargateTaskResources, assertVpcSubnetSelection } from './cdk-aws-preconditions';
import type { PubSubBroker } from './pub-sub';

export interface WorkerServiceProps {
  readonly vpc: ec2.IVpc;
  readonly cluster: ecs.ICluster;
  readonly dockerAsset: ecr_assets.DockerImageAsset;
  readonly database: rds.DatabaseCluster;
  readonly pubSub: PubSubBroker;
  readonly taskSecurityGroup: ec2.ISecurityGroup;
}

/**
 * Worker service: competing-consumer subscriber on the pub/sub broker.
 * Same container image as ReqRes; different entrypoint command.
 */
export class WorkerService extends Construct implements cdk.IInspectable {
  readonly service: ecs.FargateService;

  inspect(inspector: cdk.TreeInspector): void {
    inspector.addAttribute('diagram:label', 'Worker\n(ECS Fargate)');
    inspector.addAttribute('diagram:tier', 'compute');
    CdkDia.decorate(inspector,
      new CdkDiaDecorator().collapse(CollapseTypes.FORCE_NON_COLLAPSE));
  }

  constructor(scope: Construct, id: string, props: WorkerServiceProps) {
    super(scope, id);

    assertVpcSubnetSelection(props.vpc, ec2.SubnetType.PRIVATE_WITH_EGRESS, 'WorkerService');
    const cpu = 256;
    const memoryMiB = 512;
    assertFargateTaskResources({ cpu, memoryMiB, context: 'WorkerService/Task' });

    const taskDef = new ecs.FargateTaskDefinition(this, 'Task', {
      memoryLimitMiB: memoryMiB,
      cpu,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    const dbSecret = props.database.secret;
    if (!dbSecret) {
      throw new Error('WorkerService: database secret is required');
    }

    taskDef.addContainer('worker', {
      image: ecs.ContainerImage.fromDockerImageAsset(props.dockerAsset),
      command: ['bun', 'run', 'packages/app/src/worker.ts'],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'worker',
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        PORT: '8080',
        DATABASE_HOST: props.database.clusterEndpoint.hostname,
        DATABASE_PORT: '5432',
        DATABASE_NAME: 'postgres',
        PUBSUB_URL: props.pubSub.internalMqttUrl,
        NODE_ENV: 'production',
      },
      secrets: {
        DATABASE_USERNAME: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
        DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
      },
    });

    this.service = new ecs.FargateService(this, 'Service', {
      cluster: props.cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.taskSecurityGroup],
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      circuitBreaker: { rollback: true },
    });

    this.service.node.addDependency(props.dockerAsset);
    cdk.Tags.of(this.service).add('Project', 'app');
    cdk.Tags.of(this.service).add('Service', 'worker');
  }
}
