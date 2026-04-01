import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export interface AppDatabaseProps {
  readonly vpc: ec2.IVpc;
  /** Clients that may connect to the database (add ingress on 5432). */
  readonly allowedClients: ec2.ISecurityGroup[];
}

/** Default database name — matches the stock PostgreSQL template DB. */
const DEFAULT_DB_NAME = 'postgres';

/**
 * Aurora PostgreSQL Serverless v2 cluster (writer only, small capacity range).
 */
export class AppDatabase extends Construct {
  readonly cluster: rds.DatabaseCluster;
  readonly connections: ec2.Connections;

  constructor(scope: Construct, id: string, props: AppDatabaseProps) {
    super(scope, id);

    this.cluster = new rds.DatabaseCluster(this, 'Cluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_6,
      }),
      writer: rds.ClusterInstance.serverlessV2('writer'),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 4,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      credentials: rds.Credentials.fromGeneratedSecret('app', {
        secretName: 'app/aurora-credentials',
      }),
      defaultDatabaseName: DEFAULT_DB_NAME,
      storageEncrypted: true,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });

    this.connections = this.cluster.connections;
    for (const sg of props.allowedClients) {
      this.cluster.connections.allowDefaultPortFrom(
        sg,
        'Postgres from app clients'
      );
    }
  }
}
