#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { PROJECT_CONFIG } from '../project-config';
import { GamezillaStack } from '../lib/gamezilla-stack';

const app = new cdk.App();

new GamezillaStack(app, PROJECT_CONFIG.stack.name, {
  env: { region: PROJECT_CONFIG.aws.region },
});
