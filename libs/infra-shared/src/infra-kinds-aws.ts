/** AWS resource kinds. */

import type { Kind } from './infra-kind-helpers';
import { awsConsole, iam, link, none, text } from './infra-kind-helpers';

export const AWS_KINDS: Readonly<Record<string, Kind>> = {
  aws_iam_openid_connect_provider: {
    title: 'OIDC identity provider',
    logo: 'aws-iam',
    category: 'Identity & access',
    links: iam('/identity_providers'),
  },
  aws_iam_role: {
    title: 'IAM role',
    logo: 'aws-iam',
    category: 'Identity & access',
    links: (c) => {
      const name = text(c.attrs, 'name');
      return link(
        'IAM role',
        name === null
          ? null
          : `https://console.aws.amazon.com/iam/home#/roles/details/${name}`
      );
    },
  },
  aws_iam_role_policy: {
    title: 'IAM role policy',
    logo: 'aws-iam',
    category: 'Identity & access',
    links: iam('/roles'),
  },
  aws_iam_role_policy_attachment: {
    title: 'IAM policy attachment',
    logo: 'aws-iam',
    category: 'Identity & access',
    links: iam('/roles'),
  },
  aws_iam_user: {
    title: 'IAM user',
    logo: 'aws-iam',
    category: 'Identity & access',
    links: (c) => {
      const name = text(c.attrs, 'name');
      return link(
        'IAM user',
        name === null
          ? null
          : `https://console.aws.amazon.com/iam/home#/users/details/${name}`
      );
    },
  },
  aws_iam_user_policy: {
    title: 'IAM user policy',
    logo: 'aws-iam',
    category: 'Identity & access',
    links: iam('/users'),
  },
  aws_iam_access_key: {
    title: 'IAM access key',
    logo: 'aws-iam',
    category: 'Identity & access',
    links: iam('/users'),
  },
  aws_lambda_function: {
    title: 'Lambda function',
    logo: 'aws-lambda',
    category: 'Compute',
    links: (c) => {
      const name = text(c.attrs, 'function_name');
      return link(
        'Function',
        name === null ? null : awsConsole(c, 'lambda', `#/functions/${name}`)
      );
    },
  },
  aws_lambda_permission: {
    title: 'Lambda invoke permission',
    logo: 'aws-lambda',
    category: 'Identity & access',
    links: (c) => {
      const name = text(c.attrs, 'function_name');
      return link(
        'Function',
        name === null ? null : awsConsole(c, 'lambda', `#/functions/${name}`)
      );
    },
  },
  aws_cloudwatch_log_group: {
    title: 'CloudWatch log group',
    logo: 'aws-cloudwatch',
    category: 'Observability',
    links: (c) => {
      const name = text(c.attrs, 'name');
      const encoded = name?.replaceAll('/', '$252F');
      return link(
        'Log group',
        encoded === undefined
          ? null
          : awsConsole(
              c,
              'cloudwatch',
              `#logsV2:log-groups/log-group/${encoded}`
            )
      );
    },
  },
  aws_acm_certificate: {
    title: 'TLS certificate',
    logo: 'aws-acm',
    category: 'Networking',
    links: (c) =>
      link('Certificates', awsConsole(c, 'acm', '#/certificates/list')),
  },
  aws_acm_certificate_validation: {
    title: 'Certificate validation',
    logo: 'aws-acm',
    category: 'Networking',
    links: (c) =>
      link('Certificates', awsConsole(c, 'acm', '#/certificates/list')),
  },
  aws_iot_authorizer: {
    title: 'IoT custom authorizer',
    logo: 'aws',
    category: 'Networking',
    links: (c) => link('IoT Core', awsConsole(c, 'iot', '#/authorizerhub')),
  },
  aws_iot_domain_configuration: {
    title: 'IoT domain configuration',
    logo: 'aws',
    category: 'Networking',
    links: (c) => link('IoT Core', awsConsole(c, 'iot', '#/settings')),
  },
  aws_caller_identity: {
    title: 'AWS account lookup',
    logo: 'aws',
    category: 'Plumbing',
    links: none,
  },
  aws_iot_endpoint: {
    title: 'IoT endpoint lookup',
    logo: 'aws',
    category: 'Plumbing',
    links: none,
  },
};
