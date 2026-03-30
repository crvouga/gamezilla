import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';
import { PatchDbApp } from './patch-db-app';
import { SyncServer } from './sync-server';
import { WebApp } from './web-app';

const RESOURCE_TAGS = {
  Project: 'gamezilla',
  ManagedBy: 'cdk',
  Environment: 'production',
} as const;

/** CDK `-c key=true` passes string `"true"`; cdk.json may use boolean `true`. */
function isContextFlagTrue(scope: Construct, key: string): boolean {
  const v = scope.node.tryGetContext(key);
  return v === true || v === 'true' || v === 1 || v === '1';
}

export class GamezillaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, {
      ...props,
      terminationProtection: true,
    });

    for (const [k, v] of Object.entries(RESOURCE_TAGS)) {
      cdk.Tags.of(this).add(k, v);
    }

    const customDomain = isContextFlagTrue(this, 'customDomain');
    /**
     * When true with customDomain: create hosted zone + output NS only.
     * Skip ACM and CloudFront aliases until Route 53 nameservers are
     * delegated at the registrar; otherwise ACM DNS validation never completes.
     */
    const customDomainBootstrap = isContextFlagTrue(
      this,
      'customDomainBootstrap'
    );

    const webApp = new WebApp(this, 'WebApp', {
      customDomain,
      customDomainBootstrap,
    });

    const patchDbApp = new PatchDbApp(this, 'PatchDbApp', {
      customDomain,
      customDomainBootstrap,
    });

    const syncServer = new SyncServer(this, 'SyncServer');

    this.addOutputs({ webApp, patchDbApp, syncServer });
  }

  private addOutputs({
    webApp,
    patchDbApp,
    syncServer,
  }: {
    webApp: WebApp;
    patchDbApp: PatchDbApp;
    syncServer: SyncServer;
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

    this.addNameserverOutput(
      webApp.hostedZone,
      'Route53Nameservers',
      'Set these nameservers at your domain registrar for gamezilla.app'
    );
    this.addNameserverOutput(
      patchDbApp.hostedZone,
      'PatchDbNameservers',
      'Set these nameservers at your domain registrar for patchdb.dev'
    );
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
