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
import {
  assertAwsEc2SecurityGroupDescription,
  assertEcsHealthCheckTimers,
  assertFargateTaskResources,
  assertNlbTargetGroupHealthCheck,
  assertVpcSubnetSelection,
} from './cdk-aws-preconditions';

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

    assertVpcSubnetSelection(props.vpc, ec2.SubnetType.PRIVATE_WITH_EGRESS, 'PubSubBroker');

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

    const cpu = 2048;
    const memoryMiB = 4096;
    assertFargateTaskResources({ cpu, memoryMiB, context: 'PubSubBroker/EmqxTask' });

    const taskDef = new ecs.FargateTaskDefinition(this, 'EmqxTask', {
      memoryLimitMiB: memoryMiB,
      cpu,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    const emqxImage = new ecr_assets.DockerImageAsset(this, 'EmqxImage', {
      directory: path.join(__dirname, '..', '..', 'emqx-image'),
      platform: ecr_assets.Platform.LINUX_AMD64,
    });

    const hcInterval = 10;
    const hcTimeout = 5;
    const hcRetries = 3;
    const hcStartPeriod = 30;
    const hcGracePeriod = 60;
    assertEcsHealthCheckTimers({
      intervalSeconds: hcInterval,
      timeoutSeconds: hcTimeout,
      retries: hcRetries,
      startPeriodSeconds: hcStartPeriod,
      gracePeriodSeconds: hcGracePeriod,
      context: 'PubSubBroker/EmqxService',
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
        EMQX_LOG__CONSOLE__LEVEL: 'info',
        EMQX_LOG__CONSOLE__FORMATTER: 'text',
      },
      healthCheck: {
        command: [
          'CMD-SHELL',
          'curl -sf http://localhost:18083/status || exit 1',
        ],
        interval: cdk.Duration.seconds(hcInterval),
        timeout: cdk.Duration.seconds(hcTimeout),
        retries: hcRetries,
        startPeriod: cdk.Duration.seconds(hcStartPeriod),
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
      healthCheckGracePeriod: cdk.Duration.seconds(hcGracePeriod),
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

    nlb.connections.allowFromAnyIpv4(ec2.Port.tcp(1883), 'MQTT TCP');
    nlb.connections.allowFromAnyIpv4(ec2.Port.tcp(8083), 'MQTT WebSocket');
    nlb.connections.allowTo(
      this.brokerService,
      ec2.Port.tcp(1883),
      'NLB to broker MQTT'
    );
    nlb.connections.allowTo(
      this.brokerService,
      ec2.Port.tcp(8083),
      'NLB to broker WebSocket'
    );

    const nlbHcInterval = 10;
    const nlbHcHealthy = 2;
    const nlbHcUnhealthy = 2;
    assertNlbTargetGroupHealthCheck({
      protocol: 'TCP',
      intervalSeconds: nlbHcInterval,
      healthyThresholdCount: nlbHcHealthy,
      unhealthyThresholdCount: nlbHcUnhealthy,
      context: 'PubSubBroker/NlbTargetGroups',
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
        interval: cdk.Duration.seconds(nlbHcInterval),
        healthyThresholdCount: nlbHcHealthy,
        unhealthyThresholdCount: nlbHcUnhealthy,
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
        interval: cdk.Duration.seconds(nlbHcInterval),
        healthyThresholdCount: nlbHcHealthy,
        unhealthyThresholdCount: nlbHcUnhealthy,
      },
    });

    this.internalMqttUrl = `mqtt://${PUBSUB_SERVICE_NAME}.${PUBSUB_DNS_NAMESPACE}:1883`;
    this.publicNlbDnsName = nlb.loadBalancerDnsName;
  }
}
