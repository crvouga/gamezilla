import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';
import { PatchDbApp } from './patchdb-app';
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

    const gamezillaZone = customDomain
      ? new route53.HostedZone(this, 'HostedZone', {
          zoneName: 'gamezilla.app',
        })
      : undefined;

    const webCertificate =
      gamezillaZone && !customDomainBootstrap
        ? new acm.Certificate(this, 'WebCertificate', {
            domainName: 'www.gamezilla.app',
            validation: acm.CertificateValidation.fromDns(gamezillaZone),
          })
        : undefined;

    const patchdbZone = customDomain
      ? new route53.HostedZone(this, 'PatchDbHostedZone', {
          zoneName: 'patchdb.dev',
        })
      : undefined;

    const patchdbCertificate =
      patchdbZone && !customDomainBootstrap
        ? new acm.Certificate(this, 'PatchDbCertificate', {
            domainName: 'patchdb.dev',
            validation: acm.CertificateValidation.fromDns(patchdbZone),
          })
        : undefined;

    const webApp = new WebApp(this, 'WebApp', {
      hostedZone: gamezillaZone,
      certificate: webCertificate,
    });

    const patchDbApp = new PatchDbApp(this, 'PatchDbApp', {
      hostedZone: patchdbZone,
      certificate: patchdbCertificate,
    });

    const syncServer = new SyncServer(this, 'SyncServer');

    this.addOutputs({
      webApp,
      patchDbApp,
      syncServer,
      gamezillaZone,
      patchdbZone,
    });
  }

  private addOutputs({
    webApp,
    patchDbApp,
    syncServer,
    gamezillaZone,
    patchdbZone,
  }: {
    webApp: WebApp;
    patchDbApp: PatchDbApp;
    syncServer: SyncServer;
    gamezillaZone: route53.HostedZone | undefined;
    patchdbZone: route53.HostedZone | undefined;
  }): void {
    new cdk.CfnOutput(this, 'SyncServerUrl', {
      value: syncServer.service.attrServiceUrl,
    });
    new cdk.CfnOutput(this, 'WebAppBucketName', {
      value: webApp.bucket.bucketName,
    });
    new cdk.CfnOutput(this, 'PatchDbAppBucketName', {
      value: patchDbApp.bucket.bucketName,
    });
    new cdk.CfnOutput(this, 'WebDistributionId', {
      value: webApp.distribution.distributionId,
    });
    new cdk.CfnOutput(this, 'PatchDbAppDistributionId', {
      value: patchDbApp.distribution.distributionId,
    });
    new cdk.CfnOutput(this, 'WebAppUrl', {
      value: `https://${webApp.distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, 'PatchDbAppUrl', {
      value: `https://${patchDbApp.distribution.distributionDomainName}`,
    });

    this.addNameserverOutput(gamezillaZone, 'Route53Nameservers',
      'Set these nameservers at your domain registrar for gamezilla.app');
    this.addNameserverOutput(patchdbZone, 'PatchDbNameservers',
      'Set these nameservers at your domain registrar for patchdb.dev');
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
