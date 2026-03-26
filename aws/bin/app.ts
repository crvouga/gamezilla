#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { GamezillaStack } from '../lib/gamezilla-stack';

const app = new cdk.App();

new GamezillaStack(app, 'GamezillaStack', {
  env: { region: 'us-east-1' },
});
