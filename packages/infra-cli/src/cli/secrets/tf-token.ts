import type { SecretEntry } from './types';

export class TfToken implements SecretEntry {
  readonly doppler = 'TF_TOKEN';
  readonly env = 'TF_TOKEN_app_terraform_io';
  readonly hint = 'https://app.terraform.io/app/settings/tokens → Create an API token';

  async validate(token: string): Promise<string | null> {
    try {
      const res = await fetch('https://app.terraform.io/api/v2/account/details', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/vnd.api+json',
        },
      });
      if (res.ok) return null;
      if (res.status === 401) return 'Token is invalid or expired';
      return `Terraform Cloud API returned HTTP ${res.status}`;
    } catch (e) {
      return `Terraform Cloud API unreachable: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}
