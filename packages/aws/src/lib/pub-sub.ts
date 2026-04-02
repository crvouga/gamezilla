import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { CdkDia, CdkDiaDecorator, CollapseTypes } from 'cdk-dia';
import { Construct } from 'constructs';
import { assertAwsEc2SecurityGroupDescription } from './cdk-aws-preconditions';

export const EMQX_DNS_NAMESPACE = 'app.local';
export const EMQX_SERVICE_NAME = 'emqx';

export interface EmqxClusterProps {
  readonly vpc: ec2.IVpc;
  /** Security groups allowed to reach EMQX on 1883 inside the VPC (e.g. worker, App Runner connector). */
  readonly vpcClientSecurityGroups: ec2.ISecurityGroup[];
}

/**
 * EMQX 5 on Fargate + internal Cloud Map DNS + public NLB (MQTT 1883, WebSocket 8083).
 */
export class EmqxCluster extends Construct implements cdk.IInspectable {
  readonly ecsCluster: ecs.Cluster;
  /** EMQX broker task service (for CloudFormation dependsOn ordering). */
  readonly emqxService: ecs.FargateService;
  /** e.g. mqtt://emqx.app.local:1883 */
  readonly internalMqttUrl: string;
  readonly publicNlbDnsName: string;

  inspect(inspector: cdk.TreeInspector): void {
    inspector.addAttribute('diagram:label', 'EMQX Pub/Sub\n(ECS Fargate + NLB)');
    inspector.addAttribute('diagram:tier', 'compute');
    CdkDia.decorate(inspector,
      new CdkDiaDecorator().collapse(CollapseTypes.FORCE_NON_COLLAPSE));
  }

  constructor(scope: Construct, id: string, props: EmqxClusterProps) {
    super(scope, id);

    const namespace = new servicediscovery.PrivateDnsNamespace(
      this,
      'Namespace',
      {
        name: EMQX_DNS_NAMESPACE,
        vpc: props.vpc,
      }
    );

    this.ecsCluster = new ecs.Cluster(this, 'EcsCluster', {
      vpc: props.vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    const emqxSgDesc = 'EMQX broker';
    assertAwsEc2SecurityGroupDescription(emqxSgDesc, 'EmqxSg');
    const emqxSg = new ec2.SecurityGroup(this, 'EmqxSg', {
      vpc: props.vpc,
      description: emqxSgDesc,
    });
    emqxSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(1883),
      'MQTT TCP (NLB)'
    );
    emqxSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8083),
      'MQTT WebSocket (NLB)'
    );
    emqxSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(18083),
      'Dashboard (optional)'
    );

    const taskDef = new ecs.FargateTaskDefinition(this, 'EmqxTask', {
      memoryLimitMiB: 2048,
      cpu: 1024,
    });

    taskDef.addContainer('emqx', {
      image: ecs.ContainerImage.fromRegistry('emqx/emqx:5.8.0'),
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
    });

    this.emqxService = new ecs.FargateService(this, 'EmqxService', {
      cluster: this.ecsCluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      circuitBreaker: { rollback: true },
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [emqxSg],
      cloudMapOptions: {
        name: EMQX_SERVICE_NAME,
        cloudMapNamespace: namespace,
        dnsRecordType: servicediscovery.DnsRecordType.A,
      },
    });

    for (const clientSg of props.vpcClientSecurityGroups) {
      emqxSg.addIngressRule(
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
        this.emqxService.loadBalancerTarget({
          containerName: 'emqx',
          containerPort: 1883,
        }),
      ],
      healthCheck: {
        protocol: elbv2.Protocol.TCP,
        port: '1883',
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
        this.emqxService.loadBalancerTarget({
          containerName: 'emqx',
          containerPort: 8083,
        }),
      ],
      healthCheck: {
        protocol: elbv2.Protocol.TCP,
        port: '8083',
      },
    });

    this.internalMqttUrl = `mqtt://${EMQX_SERVICE_NAME}.${EMQX_DNS_NAMESPACE}:1883`;
    this.publicNlbDnsName = nlb.loadBalancerDnsName;
  }
}
