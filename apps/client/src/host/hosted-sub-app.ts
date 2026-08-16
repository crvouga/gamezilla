import type { IconComponent } from '@pkgs/ui';
import type { ComponentType } from 'react';

export type HostedSubApp = {
  readonly id: string;
  readonly title: string;
  readonly icon?: IconComponent;
  readonly App: ComponentType;
};

export type ClientHostProps = {
  readonly apps: readonly HostedSubApp[];
};
