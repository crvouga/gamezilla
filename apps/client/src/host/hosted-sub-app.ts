import type { ComponentType } from 'react';

export type HostedSubApp = {
  readonly id: string;
  readonly title: string;
  readonly App: ComponentType;
};

export type ClientHostProps = {
  readonly apps: readonly HostedSubApp[];
  readonly initialId?: string;
};
