import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { createSpaDistribution } from './spa-distribution';

export interface PatchDbAppProps {
  hostedZone?: route53.IHostedZone;
  certificate?: acm.ICertificate;
}

export class PatchDbApp extends Construct {
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: PatchDbAppProps = {}) {
    super(scope, id);

    this.bucket = new s3.Bucket(this, 'Bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.distribution = createSpaDistribution(
      this,
      'Distribution',
      this.bucket,
      props.certificate
        ? { certificate: props.certificate, domainNames: ['patchdb.dev'] }
        : {}
    );

    if (props.hostedZone && props.certificate) {
      void new route53.ARecord(this, 'AliasRecord', {
        zone: props.hostedZone,
        target: route53.RecordTarget.fromAlias(
          new route53targets.CloudFrontTarget(this.distribution)
        ),
      });
    }
  }
}
