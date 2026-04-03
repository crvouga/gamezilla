/**
 * CDK Aspects that run at synth time and validate the construct tree.
 * Catches networking misconfigurations that would otherwise only surface
 * as silent runtime failures (e.g. NLB health checks blocked by empty SGs).
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import type { IConstruct } from 'constructs';

/**
 * CDK SecurityGroup stores rules in `directIngressRules` / `directEgressRules`
 * arrays that are lazily rendered into the CfnSecurityGroup during synthesis.
 * At aspect-visit time the CfnSecurityGroup properties are tokens, so we read
 * the L2 arrays directly. These are CDK internals — not part of the public API
 * — but there is no public way to query rules before synthesis.
 */
function securityGroupHasIngressRules(sg: ec2.ISecurityGroup): boolean {
  const priv = sg as unknown as Record<string, unknown>;
  const direct = priv['directIngressRules'];
  if (Array.isArray(direct) && direct.length > 0) return true;

  return sg.node
    .findAll()
    .some((c) => c instanceof ec2.CfnSecurityGroupIngress);
}

function securityGroupHasEgressRules(sg: ec2.ISecurityGroup): boolean {
  const priv = sg as unknown as Record<string, unknown>;
  const direct = priv['directEgressRules'];
  if (Array.isArray(direct)) {
    const real = direct.filter(
      (r: Record<string, unknown>) =>
        r['description'] !== 'Disallow all traffic'
    );
    if (real.length > 0) return true;
  }

  return sg.node
    .findAll()
    .some((c) => c instanceof ec2.CfnSecurityGroupEgress);
}

function securityGroupAllowsAllOutbound(sg: ec2.ISecurityGroup): boolean {
  return (sg as unknown as Record<string, unknown>)['allowAllOutbound'] === true;
}

/**
 * CDK auto-creates a security group for NLBs (when the feature flag
 * `networkLoadBalancerWithSecurityGroupByDefault` is enabled), but starts
 * it completely locked down. If you forget to add rules via
 * `nlb.connections.allowFrom/allowTo`, health checks silently fail and
 * the ECS circuit breaker fires after minutes of retrying.
 *
 * This aspect catches it at synth time in seconds.
 */
export class AssertNlbSecurityGroupRules implements cdk.IAspect {
  visit(node: IConstruct): void {
    if (!(node instanceof elbv2.NetworkLoadBalancer)) return;

    const sgs = node.connections.securityGroups;
    if (sgs.length === 0) return;

    for (const sg of sgs) {
      if (!securityGroupHasIngressRules(sg)) {
        cdk.Annotations.of(node).addError(
          `NLB "${node.node.path}" has a security group with no ingress rules — all inbound traffic is blocked. ` +
            `Fix: Call nlb.connections.allowFromAnyIpv4(ec2.Port.tcp(<port>)) for each listener port.`
        );
      }

      if (
        !securityGroupAllowsAllOutbound(sg) &&
        !securityGroupHasEgressRules(sg)
      ) {
        cdk.Annotations.of(node).addError(
          `NLB "${node.node.path}" has a security group with no egress rules to targets — ` +
            `health checks and traffic forwarding will fail. ` +
            `Fix: Call nlb.connections.allowTo(<service>, ec2.Port.tcp(<port>)) for each target port.`
        );
      }
    }
  }
}

/**
 * ECS services attached to load balancers need specific configuration to
 * avoid deployment hangs and silent failures:
 * - healthCheckGracePeriodSeconds must be set (default 0 kills tasks instantly)
 * - Deployment circuit breaker must be enabled (without it, failed deployments
 *   hang for up to 3 hours waiting for stabilization)
 */
export class AssertEcsServiceHealthCheckConfig implements cdk.IAspect {
  visit(node: IConstruct): void {
    if (!(node instanceof ecs.CfnService)) return;

    const lbs = node.loadBalancers;
    const hasLbs =
      Array.isArray(lbs) &&
      lbs.length > 0 &&
      !cdk.Tokenization.isResolvable(lbs);
    if (!hasLbs) return;

    const grace = node.healthCheckGracePeriodSeconds;
    if (grace === undefined || grace === null) {
      cdk.Annotations.of(node).addError(
        `ECS service "${node.node.path}" has load balancers but no healthCheckGracePeriodSeconds. ` +
          `Tasks will be killed before they can pass LB health checks. ` +
          `Fix: Set healthCheckGracePeriod on the FargateService (recommend 60-120s for fast-booting containers).`
      );
    }

    const deployConfig = node.deploymentConfiguration;
    if (
      deployConfig !== undefined &&
      !cdk.Tokenization.isResolvable(deployConfig)
    ) {
      const typed =
        deployConfig as ecs.CfnService.DeploymentConfigurationProperty;
      const cb = typed.deploymentCircuitBreaker;
      const hasCircuitBreaker =
        cb !== undefined &&
        !cdk.Tokenization.isResolvable(cb) &&
        (cb as ecs.CfnService.DeploymentCircuitBreakerProperty).enable === true;

      if (!hasCircuitBreaker) {
        cdk.Annotations.of(node).addWarning(
          `ECS service "${node.node.path}" does not have deployment circuit breaker enabled. ` +
            `Without it, failed deployments hang for up to 3 hours. ` +
            `Fix: Set circuitBreaker: { rollback: true } on the FargateService.`
        );
      }
    }
  }
}

/**
 * A security group that is a direct child of a load balancer (NLB or ALB)
 * with zero ingress rules is always a bug — it means the LB cannot receive
 * any traffic.
 */
export class AssertSecurityGroupHasRules implements cdk.IAspect {
  visit(node: IConstruct): void {
    if (!(node instanceof ec2.SecurityGroup)) return;

    const scope = node.node.scope;
    if (!scope) return;

    const isLbChild =
      scope instanceof elbv2.NetworkLoadBalancer ||
      scope instanceof elbv2.ApplicationLoadBalancer;
    if (!isLbChild) return;

    if (!securityGroupHasIngressRules(node)) {
      cdk.Annotations.of(node).addError(
        `Load balancer "${scope.node.path}" has a security group with no ingress rules — ` +
          `no traffic can reach it. ` +
          `Fix: Call lb.connections.allowFromAnyIpv4(ec2.Port.tcp(<port>)) for each listener port.`
      );
    }
  }
}
