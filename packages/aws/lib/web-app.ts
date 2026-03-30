import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { createSpaDistribution } from './spa-distribution';

export interface WebAppProps {
  customDomain?: boolean;
  customDomainBootstrap?: boolean;
}

export class WebApp extends Construct {
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;
  readonly hostedZone?: route53.HostedZone;

  constructor(scope: Construct, id: string, props: WebAppProps = {}) {
    super(scope, id);

    this.hostedZone = props.customDomain
      ? new route53.HostedZone(this, 'HostedZone', {
          zoneName: 'gamezilla.app',
        })
      : undefined;

    const certificate =
      this.hostedZone && !props.customDomainBootstrap
        ? new acm.Certificate(this, 'Certificate', {
            domainName: 'gamezilla.app',
            subjectAlternativeNames: ['www.gamezilla.app'],
            validation: acm.CertificateValidation.fromDns(this.hostedZone),
          })
        : undefined;

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
      certificate
        ? {
            certificate,
            domainNames: ['www.gamezilla.app', 'gamezilla.app'],
          }
        : {}
    );

    if (this.hostedZone && certificate) {
      const cfTarget = route53.RecordTarget.fromAlias(
        new route53targets.CloudFrontTarget(this.distribution)
      );
      void new route53.ARecord(this, 'WwwAliasRecord', {
        zone: this.hostedZone,
        recordName: 'www',
        target: cfTarget,
      });
      void new route53.ARecord(this, 'ApexAliasRecord', {
        zone: this.hostedZone,
        target: cfTarget,
      });
    }
  }
}
