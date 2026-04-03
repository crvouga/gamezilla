import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { CdkDia, CdkDiaDecorator, CollapseTypes } from 'cdk-dia';
import { Construct } from 'constructs';

export interface AppVpcProps {
  readonly natGateways?: number;
}

/**
 * Shared VPC: public + private subnets with NAT (default single NAT for cost).
 */
export class AppVpc extends Construct implements cdk.IInspectable {
  readonly vpc: ec2.Vpc;

  inspect(inspector: cdk.TreeInspector): void {
    inspector.addAttribute('diagram:label', 'VPC');
    inspector.addAttribute('diagram:tier', 'network');
    CdkDia.decorate(inspector,
      new CdkDiaDecorator().collapse(CollapseTypes.FORCE_COLLAPSE));
  }

  constructor(scope: Construct, id: string, props: AppVpcProps = {}) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: props.natGateways ?? 1,
      subnetConfiguration: [
        {
          name: 'public-subnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'private-subnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // VPC endpoints for Fargate in private subnets — avoids NAT gateway
    // bottleneck for ECR image pulls, log shipping, and ECS Exec (SSM).
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });
    this.vpc.addInterfaceEndpoint('EcrDockerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
    });
    this.vpc.addInterfaceEndpoint('EcrApiEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
    });
    this.vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
    });
    this.vpc.addInterfaceEndpoint('SsmEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
    });
    this.vpc.addInterfaceEndpoint('SsmMessagesEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
    });
  }
}
