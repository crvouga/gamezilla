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
  grafana_data_source: {
    title: 'Data source lookup',
    logo: 'grafana',
    category: 'Plumbing',
    links: (c) => link('Data sources', grafana(c, '/connections/datasources')),
  },
};
