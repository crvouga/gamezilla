/**
 * Token used to identify a dependency in the container.
 * Use a symbol or string as the runtime value. The phantom type preserves T for
 * inference at use sites (e.g. `useDependency(token)` returns T).
 *
 * @example
 * const MyServiceToken: InjectionToken<MyService> = Symbol("MyService");
 */
export type InjectionToken<T = unknown> = (symbol | string) & {
  readonly __brand?: T;
};

/** @internal */
type Registration<T> =
  | { kind: 'factory'; factory: () => T; singleton: boolean; instance?: T }
  | { kind: 'value'; value: T };

/**
 * Minimal interface for resolving dependencies by token.
 * Implemented by {@link DependencyInjectionContainer}.
 */
export interface Container {
  /** Resolves and returns the dependency for the given token. Throws if not registered. */
  get<T>(token: InjectionToken<T>): T;
  /** Returns whether the token has a registration in this or a parent container. */
  has(token: InjectionToken<unknown>): boolean;
}

/**
 * Dependency injection container supporting factory and value registrations,
 * singletons, child containers, and circular dependency detection.
 */
export class DependencyInjectionContainer implements Container {
  private registrations = new Map<symbol | string, Registration<unknown>>();
  private parent: DependencyInjectionContainer | null = null;
  private resolutionStack: Set<symbol | string> = new Set();

  /**
   * @param parent - Optional parent container. Child inherits parent registrations
   * and can override them. Resolution falls back to parent when token is not found.
   */
  constructor(parent?: DependencyInjectionContainer) {
    this.parent = parent ?? null;
  }

  /**
   * Registers a factory for the token. The factory is invoked lazily on first get.
   *
   * @param token - Token to register
   * @param factory - Function that creates the dependency
   * @param options.singleton - If true (default), factory runs once and result is cached
   */
  register<T>(
    token: InjectionToken<T>,
    factory: () => T,
    options?: { singleton?: boolean }
  ): void {
    this.registrations.set(token, {
      kind: 'factory',
      factory,
      singleton: options?.singleton ?? true,
    });
  }

  /**
   * Registers a pre-created value for the token. Resolved immediately on get.
   *
   * @param token - Token to register
   * @param value - The dependency instance
   */
  registerValue<T>(token: InjectionToken<T>, value: T): void {
    this.registrations.set(token, { kind: 'value', value });
  }

  /**
   * Resolves the dependency for the token.
   *
   * @param token - Token to resolve
   * @returns The registered dependency
   * @throws If token is not registered (in this or parent container)
   * @throws If circular dependency is detected during factory resolution
   */
  get<T>(token: InjectionToken<T>): T {
    const reg = this.registrations.get(token);

    if (!reg) {
      if (this.parent) {
        return this.parent.get(token);
      }
      throw new Error(`No registration found for token: ${String(token)}`);
    }

    if (this.resolutionStack.has(token)) {
      const stack = [...this.resolutionStack, token].map(String).join(' -> ');
      throw new Error(`Circular dependency detected: ${stack}`);
    }

    if (reg.kind === 'value') {
      return reg.value as T;
    }

    if (reg.singleton && reg.instance !== undefined) {
      return reg.instance as T;
    }

    this.resolutionStack.add(token);
    try {
      const instance = reg.factory() as T;
      if (reg.singleton) {
        (reg as { instance?: T }).instance = instance;
      }
      return instance;
    } finally {
      this.resolutionStack.delete(token);
    }
  }

  /**
   * Checks if the token has a registration in this container or any parent.
   *
   * @param token - Token to check
   * @returns True if the token is registered
   */
  has(token: InjectionToken<unknown>): boolean {
    return this.registrations.has(token) || (this.parent?.has(token) ?? false);
  }

  /**
   * Creates a child container that inherits this container's registrations.
   * Child registrations shadow parent registrations for the same token.
   *
   * @returns A new container with this container as its parent
   */
  createChild(): DependencyInjectionContainer {
    return new DependencyInjectionContainer(this);
  }
}
