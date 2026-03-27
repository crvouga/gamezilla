import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';
import { SimViz } from './sim-viz';
import { SyncServer } from './sync-server';
import { WebApp } from './web-app';

/** CDK `-c key=true` passes string `"true"`; cdk.json may use boolean `true`. */
function isContextFlagTrue(scope: Construct, key: string): boolean {
  const v = scope.node.tryGetContext(key);
  return v === true || v === 'true' || v === 1 || v === '1';
}

export class GamezillaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const customDomain = isContextFlagTrue(this, 'customDomain');
    /**
     * When true with customDomain: create hosted zone + output NS only.
     * Skip ACM and www on CloudFront until Route 53 nameservers are delegated
     * at the registrar; otherwise ACM DNS validation never completes.
     */
    const customDomainBootstrap = isContextFlagTrue(
      this,
      'customDomainBootstrap'
    );

    let hostedZone: route53.HostedZone | undefined;
    let webCertificate: acm.Certificate | undefined;

    if (customDomain) {
      hostedZone = new route53.HostedZone(this, 'HostedZone', {
        zoneName: 'gamezilla.app',
      });
      if (!customDomainBootstrap) {
        webCertificate = new acm.Certificate(this, 'WebCertificate', {
          domainName: 'www.gamezilla.app',
          validation: acm.CertificateValidation.fromDns(hostedZone),
        });
      }
    }

    const webApp = new WebApp(this, 'WebApp', {
      hostedZone,
      certificate: webCertificate,
    });

    const simViz = new SimViz(this, 'SimViz');

    const syncServer = new SyncServer(this, 'SyncServer');

    new cdk.CfnOutput(this, 'SyncServerUrl', {
      value: syncServer.service.attrServiceUrl,
    });
    new cdk.CfnOutput(this, 'WebAppBucketName', {
      value: webApp.bucket.bucketName,
    });
    new cdk.CfnOutput(this, 'SimVizBucketName', {
      value: simViz.bucket.bucketName,
    });
    new cdk.CfnOutput(this, 'WebDistributionId', {
      value: webApp.distribution.distributionId,
    });
    new cdk.CfnOutput(this, 'SimVizDistributionId', {
      value: simViz.distribution.distributionId,
    });
    new cdk.CfnOutput(this, 'WebAppUrl', {
      value: `https://${webApp.distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, 'SimVizUrl', {
      value: `https://${simViz.distribution.distributionDomainName}`,
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
