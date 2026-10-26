/** Grafana Cloud resource kinds. */

import type { Kind } from './infra-kind-helpers';
import { GRAFANA_ADMIN, grafana, link, text } from './infra-kind-helpers';

export const GRAFANA_KINDS: Readonly<Record<string, Kind>> = {
  grafana_cloud_stack: {
    title: 'Grafana Cloud stack',
    logo: 'grafana',
    category: 'Observability',
    links: (c) => link('Stack', grafana(c)),
  },
  grafana_cloud_stack_service_account: {
    title: 'Grafana service account',
    logo: 'grafana',
    category: 'Identity & access',
    links: (c) => link('Service accounts', grafana(c, '/org/serviceaccounts')),
  },
  grafana_cloud_stack_service_account_token: {
    title: 'Grafana service-account token',
    logo: 'grafana',
    category: 'Identity & access',
    links: (c) => link('Service accounts', grafana(c, '/org/serviceaccounts')),
  },
  grafana_cloud_access_policy: {
    title: 'Grafana access policy',
    logo: 'grafana',
    category: 'Identity & access',
    links: () => link('Access policies', GRAFANA_ADMIN),
  },
  grafana_cloud_access_policy_token: {
    title: 'Grafana access-policy token',
    logo: 'grafana',
    category: 'Identity & access',
    links: () => link('Access policies', GRAFANA_ADMIN),
  },
  grafana_folder: {
    title: 'Dashboard folder',
    logo: 'grafana',
    category: 'Observability',
    links: (c) => {
      const uid = text(c.attrs, 'uid');
      return link(
        'Folder',
        uid === null ? null : grafana(c, `/dashboards/f/${uid}`)
      );
    },
  },
  grafana_dashboard: {
    title: 'Dashboard',
    logo: 'grafana',
    category: 'Observability',
    links: (c) => link('Dashboards', grafana(c, '/dashboards')),
  },
  grafana_rule_group: {
    title: 'Alert rule group',
    logo: 'grafana',
    category: 'Observability',
    links: (c) => link('Alert rules', grafana(c, '/alerting/list')),
  },
  grafana_slo: {
    title: 'Service level objective',
    logo: 'grafana',
    category: 'Observability',
    links: (c) => link('SLOs', grafana(c, '/a/grafana-slo-app/manage-slos')),
  },
  grafana_contact_point: {
    title: 'Alert contact point',
    logo: 'grafana',
    category: 'Observability',
    links: (c) => link('Contact points', grafana(c, '/alerting/notifications')),
  },
  grafana_notification_policy: {
    title: 'Alert notification policy',
    logo: 'grafana',
    category: 'Observability',
    links: (c) => link('Notification policies', grafana(c, '/alerting/routes')),
  },
  grafana_oncall_integration: {
    title: 'IRM integration',
    logo: 'grafana',
    category: 'Observability',
    links: (c) => link('IRM', grafana(c, '/a/grafana-irm-app/integrations')),
  },
  grafana_oncall_escalation_chain: {
    title: 'IRM escalation chain',
    logo: 'grafana',
    category: 'Observability',
    links: (c) =>
      link('Escalation chains', grafana(c, '/a/grafana-irm-app/escalations')),
  },
  grafana_oncall_escalation: {
    title: 'IRM escalation step',
    logo: 'grafana',
    category: 'Plumbing',
    links: (c) =>
      link('Escalation chains', grafana(c, '/a/grafana-irm-app/escalations')),
  },
  grafana_oncall_route: {
    title: 'IRM route',
    logo: 'grafana',
    category: 'Plumbing',
    links: (c) => link('IRM', grafana(c, '/a/grafana-irm-app/integrations')),
  },
  grafana_synthetic_monitoring_installation: {
    title: 'Synthetic Monitoring',
    logo: 'grafana',
    category: 'Observability',
    links: (c) =>
      link('Checks', grafana(c, '/a/grafana-synthetic-monitoring-app/checks')),
  },
  grafana_synthetic_monitoring_check: {
    title: 'Synthetic check',
    logo: 'grafana',
    category: 'Observability',
    links: (c) =>
      link('Checks', grafana(c, '/a/grafana-synthetic-monitoring-app/checks')),
  },
  grafana_synthetic_monitoring_probes: {
    title: 'Synthetic Monitoring probes lookup',
    logo: 'grafana',
    category: 'Plumbing',
  },
  grafana_oncall_user: {
    title: 'IRM user lookup',
    logo: 'grafana',
    category: 'Plumbing',
  },
  grafana_data_source: {
    title: 'Data source lookup',
    logo: 'grafana',
    category: 'Plumbing',
    links: (c) => link('Data sources', grafana(c, '/connections/datasources')),
  },
};
