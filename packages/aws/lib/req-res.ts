import * as apprunner from 'aws-cdk-lib/aws-apprunner';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export interface ReqResProps {
  readonly dockerAsset: ecr_assets.DockerImageAsset;
  readonly vpc: ec2.IVpc;
  readonly database: rds.DatabaseCluster;
  /** mqtt://emqx.app.local:1883 (VPC-internal). */
  readonly internalMqttUrl: string;
  readonly vpcConnectorSubnets: ec2.ISubnet[];
  readonly vpcConnectorSecurityGroups: ec2.ISecurityGroup[];
}

export class ReqRes extends Construct {
  readonly service: apprunner.CfnService;

  constructor(scope: Construct, id: string, props: ReqResProps) {
    super(scope, id);

    const dbSecret = props.database.secret;
    if (!dbSecret) {
      throw new Error('ReqRes: Aurora cluster must have a generated secret');
    }

    const ecrAccessRole = new iam.Role(this, 'EcrAccess', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSAppRunnerServicePolicyForECRAccess'
        ),
      ],
    });
    props.dockerAsset.repository.grantPull(ecrAccessRole);

    const instanceRole = new iam.Role(this, 'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
      description: 'ReqRes runtime access (Secrets Manager, etc.)',
    });
    dbSecret.grantRead(instanceRole);

    const vpcConnector = new apprunner.CfnVpcConnector(this, 'VpcConnector', {
      vpcConnectorName: 'req-res-vpc-connector',
      subnets: props.vpcConnectorSubnets.map((s) => s.subnetId),
      securityGroups: props.vpcConnectorSecurityGroups.map(
        (sg) => sg.securityGroupId
      ),
    });

    this.service = new apprunner.CfnService(this, 'Service', {
      sourceConfiguration: {
        autoDeploymentsEnabled: false,
        imageRepository: {
          imageIdentifier: props.dockerAsset.imageUri,
          imageConfiguration: {
            port: '8080',
            runtimeEnvironmentVariables: [
              {
                name: 'DATABASE_HOST',
                value: props.database.clusterEndpoint.hostname,
              },
              { name: 'DATABASE_PORT', value: '5432' },
              { name: 'DATABASE_NAME', value: 'postgres' },
              { name: 'PUBSUB_URL', value: props.internalMqttUrl },
              { name: 'PORT', value: '8080' },
              { name: 'NODE_ENV', value: 'production' },
            ],
            runtimeEnvironmentSecrets: [
              {
                name: 'DATABASE_USERNAME',
                value: cdk.Fn.join('', [dbSecret.secretArn, ':username::']),
              },
              {
                name: 'DATABASE_PASSWORD',
                value: cdk.Fn.join('', [dbSecret.secretArn, ':password::']),
              },
            ],
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
        instanceRoleArn: instanceRole.roleArn,
      },
      healthCheckConfiguration: {
        protocol: 'HTTP',
        path: '/health',
        interval: 10,
        timeout: 5,
        healthyThreshold: 1,
        unhealthyThreshold: 8,
      },
      networkConfiguration: {
        egressConfiguration: {
          egressType: 'VPC',
          vpcConnectorArn: vpcConnector.attrVpcConnectorArn,
        },
        ingressConfiguration: {
          isPubliclyAccessible: true,
        },
      },
    });
    this.service.node.addDependency(props.dockerAsset);
    this.service.node.addDependency(vpcConnector);
  }
}
