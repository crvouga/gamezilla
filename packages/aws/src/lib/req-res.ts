import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import { CdkDia, CdkDiaDecorator, CollapseTypes } from 'cdk-dia';
import { Construct } from 'constructs';
import { assertApplicationLoadBalancerTargetGroupHealthCheckCounts } from './cdk-aws-preconditions';

export interface ReqResProps {
  readonly dockerAsset: ecr_assets.DockerImageAsset;
  readonly database: rds.DatabaseCluster;
  /** VPC-internal MQTT broker URL, e.g. mqtt://host:1883. */
  readonly internalMqttUrl: string;
  readonly cluster: ecs.ICluster;
  readonly taskSecurityGroup: ec2.ISecurityGroup;
}

/**
 * Stateless req-res HTTP API (Patch DB). Public ALB + CloudFront for HTTPS.
 * Shares compute cluster with the worker; ALB alone is HTTP-only on the default hostname.
 */
export class ReqRes extends Construct implements cdk.IInspectable {
  readonly loadBalancedService: ecs_patterns.ApplicationLoadBalancedFargateService;
  readonly distribution: cloudfront.Distribution;

  inspect(inspector: cdk.TreeInspector): void {
    inspector.addAttribute('diagram:label', 'Req-Res Server\n(ECS Fargate + ALB + CloudFront)');
    inspector.addAttribute('diagram:tier', 'compute');
    CdkDia.decorate(inspector,
      new CdkDiaDecorator().collapse(CollapseTypes.FORCE_NON_COLLAPSE));
  }

  constructor(scope: Construct, id: string, props: ReqResProps) {
    super(scope, id);

    const dbSecret = props.database.secret;
    if (!dbSecret) {
      throw new Error('ReqRes: Aurora cluster must have a generated secret');
    }

    this.loadBalancedService =
      new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'AlbService', {
        cluster: props.cluster,
        memoryLimitMiB: 512,
        cpu: 256,
        runtimePlatform: {
          cpuArchitecture: ecs.CpuArchitecture.X86_64,
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        },
        desiredCount: 1,
        minHealthyPercent: 100,
        maxHealthyPercent: 200,
        circuitBreaker: { rollback: true },
        publicLoadBalancer: true,
        assignPublicIp: false,
        taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [props.taskSecurityGroup],
        listenerPort: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        taskImageOptions: {
          image: ecs.ContainerImage.fromDockerImageAsset(props.dockerAsset),
          command: ['bun', 'run', 'packages/app/src/req-res.ts'],
          containerPort: 8080,
          environment: {
            DATABASE_HOST: props.database.clusterEndpoint.hostname,
            DATABASE_PORT: '5432',
            DATABASE_NAME: 'postgres',
            PUBSUB_URL: props.internalMqttUrl,
            PORT: '8080',
            NODE_ENV: 'production',
          },
          secrets: {
            DATABASE_USERNAME: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
            DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
          },
          logDriver: ecs.LogDrivers.awsLogs({
            streamPrefix: 'req-res',
            logRetention: logs.RetentionDays.ONE_WEEK,
          }),
        },
        // Long grace: async boot connects Aurora + MQTT after listen; peers may still be warming.
        healthCheckGracePeriod: cdk.Duration.seconds(420),
      });

    const healthyThresholdCount = 2;
    const unhealthyThresholdCount = 8;
    assertApplicationLoadBalancerTargetGroupHealthCheckCounts({
      healthyThresholdCount,
      unhealthyThresholdCount,
      context: 'ReqRes/ALB target group',
    });
    this.loadBalancedService.targetGroup.configureHealthCheck({
      path: '/health',
      healthyHttpCodes: '200',
      interval: cdk.Duration.seconds(10),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount,
      unhealthyThresholdCount,
    });

    this.loadBalancedService.node.addDependency(props.dockerAsset);
    cdk.Tags.of(this.loadBalancedService.service).add('Project', 'app');
    cdk.Tags.of(this.loadBalancedService.service).add('Service', 'req-res');

    this.distribution = new cloudfront.Distribution(this, 'PublicApi', {
      comment: 'Req res: HTTPS via CloudFront, origin ECS/ALB',
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(
          this.loadBalancedService.loadBalancer,
          {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
            httpPort: 80,
          }
        ),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Prefer creating the ECS service before the distribution so the first
    // origin requests are less likely to race an empty target group (post-deploy
    // still retries until HTTP succeeds).
    this.distribution.node.addDependency(this.loadBalancedService.service);
  }
}
