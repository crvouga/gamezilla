import type { Component } from 'solid-js';

export type ComponentEntry = {
  /** Stable kebab-case id (route segment / registry key). */
  id: string;
  /** Display name. */
  title: string;
  /** Section the entry is listed under. */
  group: string;
  Example: Component;
};

export function entry(
  id: string,
  title: string,
  group: string,
  Example: Component
): ComponentEntry {
  return { id, title, group, Example };
}
