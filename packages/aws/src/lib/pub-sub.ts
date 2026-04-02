import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { CdkDia, CdkDiaDecorator, CollapseTypes } from 'cdk-dia';
import { Construct } from 'constructs';
import { assertAwsEc2SecurityGroupDescription } from './cdk-aws-preconditions';

export const PUBSUB_DNS_NAMESPACE = 'app.local';
export const PUBSUB_SERVICE_NAME = 'emqx';

export interface PubSubBrokerProps {
  readonly vpc: ec2.IVpc;
  /** Security groups allowed to reach the MQTT broker on 1883 inside the VPC (e.g. worker, req-res). */
  readonly vpcClientSecurityGroups: ec2.ISecurityGroup[];
}

/**
 * MQTT pub/sub broker on Fargate + internal Cloud Map DNS + public NLB (MQTT 1883, WebSocket 8083).
 * Currently backed by EMQX 5; swappable with any MQTT-compatible broker.
 */
export class PubSubBroker extends Construct implements cdk.IInspectable {
  readonly ecsCluster: ecs.Cluster;
  /** Broker Fargate service (for CloudFormation dependsOn ordering). */
  readonly brokerService: ecs.FargateService;
  /** VPC-internal MQTT URL, e.g. mqtt://emqx.app.local:1883 */
  readonly internalMqttUrl: string;
  readonly publicNlbDnsName: string;

  inspect(inspector: cdk.TreeInspector): void {
    inspector.addAttribute('diagram:label', 'Pub/Sub Broker\n(ECS Fargate + NLB)');
    inspector.addAttribute('diagram:tier', 'compute');
    CdkDia.decorate(inspector,
      new CdkDiaDecorator().collapse(CollapseTypes.FORCE_NON_COLLAPSE));
  }

  constructor(scope: Construct, id: string, props: PubSubBrokerProps) {
    super(scope, id);

    const namespace = new servicediscovery.PrivateDnsNamespace(
      this,
      'Namespace',
      {
        name: PUBSUB_DNS_NAMESPACE,
        vpc: props.vpc,
      }
    );

    this.ecsCluster = new ecs.Cluster(this, 'EcsCluster', {
      vpc: props.vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    // CDK construct IDs (e.g. 'EmqxSg') are preserved to avoid CloudFormation resource replacement.
    const brokerSgDesc = 'Pub/sub MQTT broker';
    assertAwsEc2SecurityGroupDescription(brokerSgDesc, 'EmqxSg');
    const brokerSg = new ec2.SecurityGroup(this, 'EmqxSg', {
      vpc: props.vpc,
      description: brokerSgDesc,
    });
    brokerSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(1883),
      'MQTT TCP (NLB)'
    );
    brokerSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8083),
      'MQTT WebSocket (NLB)'
    );
    brokerSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(18083),
      'Dashboard (optional)'
    );

    const taskDef = new ecs.FargateTaskDefinition(this, 'EmqxTask', {
      memoryLimitMiB: 2048,
      cpu: 1024,
    });

    const emqxImage = new ecr_assets.DockerImageAsset(this, 'EmqxImage', {
      directory: path.join(__dirname, '..', '..', 'emqx-image'),
      platform: ecr_assets.Platform.LINUX_AMD64,
    });

    taskDef.addContainer('emqx', {
      image: ecs.ContainerImage.fromDockerImageAsset(emqxImage),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'emqx',
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
      portMappings: [
        { containerPort: 1883, protocol: ecs.Protocol.TCP },
        { containerPort: 8083, protocol: ecs.Protocol.TCP },
        { containerPort: 18083, protocol: ecs.Protocol.TCP },
      ],
      environment: {
        EMQX_NODE__NAME: 'emqx@127.0.0.1',
      },
      healthCheck: {
        command: ['CMD-SHELL', 'emqx ping || exit 1'],
        interval: cdk.Duration.seconds(10),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(30),
      },
    });

    this.brokerService = new ecs.FargateService(this, 'EmqxService', {
      cluster: this.ecsCluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      circuitBreaker: { rollback: true },
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [brokerSg],
      cloudMapOptions: {
        name: PUBSUB_SERVICE_NAME,
        cloudMapNamespace: namespace,
        dnsRecordType: servicediscovery.DnsRecordType.A,
      },
      enableExecuteCommand: true,
      healthCheckGracePeriod: cdk.Duration.seconds(60),
    });

    for (const clientSg of props.vpcClientSecurityGroups) {
      brokerSg.addIngressRule(
        clientSg,
        ec2.Port.tcp(1883),
        'MQTT from VPC clients'
      );
    }

    const nlb = new elbv2.NetworkLoadBalancer(this, 'Nlb', {
      vpc: props.vpc,
      internetFacing: true,
      crossZoneEnabled: true,
    });

    const listener1883 = nlb.addListener('Mqtt', {
      port: 1883,
      protocol: elbv2.Protocol.TCP,
    });
    listener1883.addTargets('Emqx1883', {
      port: 1883,
      protocol: elbv2.Protocol.TCP,
      targets: [
        this.brokerService.loadBalancerTarget({
          containerName: 'emqx',
          containerPort: 1883,
        }),
      ],
      deregistrationDelay: cdk.Duration.seconds(30),
      healthCheck: {
        protocol: elbv2.Protocol.TCP,
        port: '1883',
        interval: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
      },
    });

    const listener8083 = nlb.addListener('Ws', {
      port: 8083,
      protocol: elbv2.Protocol.TCP,
    });
    listener8083.addTargets('Emqx8083', {
      port: 8083,
      protocol: elbv2.Protocol.TCP,
      targets: [
        this.brokerService.loadBalancerTarget({
          containerName: 'emqx',
          containerPort: 8083,
        }),
      ],
      deregistrationDelay: cdk.Duration.seconds(30),
      healthCheck: {
        protocol: elbv2.Protocol.TCP,
        port: '8083',
        interval: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
      },
    });

    this.internalMqttUrl = `mqtt://${PUBSUB_SERVICE_NAME}.${PUBSUB_DNS_NAMESPACE}:1883`;
    this.publicNlbDnsName = nlb.loadBalancerDnsName;
  }
}
