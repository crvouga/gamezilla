import * as cdk from 'aws-cdk-lib';
import * as apprunner from 'aws-cdk-lib/aws-apprunner';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import * as path from 'node:path';

const REPO_ROOT = path.join(__dirname, '..', '..');

/** CDK `-c key=true` passes string `"true"`; cdk.json may use boolean `true`. */
function isContextFlagTrue(scope: Construct, key: string): boolean {
  const v = scope.node.tryGetContext(key);
  return v === true || v === 'true' || v === 1 || v === '1';
}

function createSpaDistribution(
  scope: Construct,
  id: string,
  bucket: s3.Bucket,
  props: {
    certificate?: acm.ICertificate;
    domainNames?: string[];
  }
): cloudfront.Distribution {
  const customTls =
    props.certificate !== undefined && props.domainNames !== undefined
      ? { certificate: props.certificate, domainNames: props.domainNames }
      : {};

  return new cloudfront.Distribution(scope, id, {
    defaultBehavior: {
      origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
      compress: true,
    },
    defaultRootObject: 'index.html',
    ...customTls,
    minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    errorResponses: [
      {
        httpStatus: 403,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
        ttl: cdk.Duration.minutes(0),
      },
      {
        httpStatus: 404,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
        ttl: cdk.Duration.minutes(0),
      },
    ],
  });
}

export class GamezillaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const customDomain = isContextFlagTrue(this, 'customDomain');

    let hostedZone: route53.HostedZone | undefined;
    let webCertificate: acm.Certificate | undefined;

    if (customDomain) {
      hostedZone = new route53.HostedZone(this, 'HostedZone', {
        zoneName: 'gamezilla.app',
      });
      webCertificate = new acm.Certificate(this, 'WebCertificate', {
        domainName: 'www.gamezilla.app',
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
    }

    const webBucket = new s3.Bucket(this, 'WebAppBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const webDistribution = createSpaDistribution(
      this,
      'WebDistribution',
      webBucket,
      customDomain && webCertificate
        ? {
            certificate: webCertificate,
            domainNames: ['www.gamezilla.app'],
          }
        : {}
    );

    if (customDomain && hostedZone) {
      void new route53.ARecord(this, 'WebAliasRecord', {
        zone: hostedZone,
        recordName: 'www',
        target: route53.RecordTarget.fromAlias(
          new route53targets.CloudFrontTarget(webDistribution)
        ),
      });
    }

    const simVizBucket = new s3.Bucket(this, 'SimVizBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const simVizDistribution = createSpaDistribution(
      this,
      'SimVizDistribution',
      simVizBucket,
      {}
    );

    const dockerAsset = new ecr_assets.DockerImageAsset(
      this,
      'SyncServerImage',
      {
        directory: REPO_ROOT,
        file: 'Dockerfile',
        exclude: [
          'aws',
          'node_modules',
          '.git',
          'dist',
          '.expo',
          'web-build',
          'ios',
          'android',
          '.sim-recordings',
          '.cursor',
        ],
      }
    );

    const ecrAccessRole = new iam.Role(this, 'AppRunnerEcrAccess', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSAppRunnerServicePolicyForECRAccess'
        ),
      ],
    });
    dockerAsset.repository.grantPull(ecrAccessRole);

    const syncService = new apprunner.CfnService(this, 'SyncServer', {
      serviceName: 'gamezilla-sync',
      sourceConfiguration: {
        autoDeploymentsEnabled: false,
        imageRepository: {
          imageIdentifier: dockerAsset.imageUri,
          imageConfiguration: {
            port: '8080',
          },
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
        unhealthyThreshold: 5,
      },
    });
    syncService.node.addDependency(dockerAsset);

    new cdk.CfnOutput(this, 'SyncServerUrl', {
      value: syncService.attrServiceUrl,
    });
    new cdk.CfnOutput(this, 'WebAppBucketName', {
      value: webBucket.bucketName,
    });
    new cdk.CfnOutput(this, 'SimVizBucketName', {
      value: simVizBucket.bucketName,
    });
    new cdk.CfnOutput(this, 'WebDistributionId', {
      value: webDistribution.distributionId,
    });
    new cdk.CfnOutput(this, 'SimVizDistributionId', {
      value: simVizDistribution.distributionId,
    });
    new cdk.CfnOutput(this, 'WebAppUrl', {
      value: `https://${webDistribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, 'SimVizUrl', {
      value: `https://${simVizDistribution.distributionDomainName}`,
    });

    if (customDomain && hostedZone) {
      const nameServers = hostedZone.hostedZoneNameServers;
      if (nameServers === undefined) {
        throw new Error('Hosted zone must expose name servers');
      }
      new cdk.CfnOutput(this, 'Route53Nameservers', {
        value: cdk.Fn.join(', ', nameServers),
        description:
          'Set these nameservers at your domain registrar (e.g. Squarespace)',
      });
    }
  }
}
