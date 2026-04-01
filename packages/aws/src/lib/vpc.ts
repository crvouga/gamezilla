import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface AppVpcProps {
  readonly natGateways?: number;
}

/**
 * Shared VPC: public + private subnets with NAT (default single NAT for cost).
 */
export class AppVpc extends Construct {
  readonly vpc: ec2.Vpc;

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
  }
}
