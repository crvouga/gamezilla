export type JavaCandidates = {
  readonly explicit: string | null;
  readonly managed: string | null;
  readonly onPath: string | null;
};

/** Prefer the pinned JVM to platform launchers that may have no runtime. */
export function javaCommand(
  candidates: JavaCandidates,
  exists: (path: string) => boolean
): string {
  if (candidates.explicit !== null) {
    if (exists(candidates.explicit)) return candidates.explicit;
    throw new Error(
      `alloy: JAVA_HOME has no bin/java (${candidates.explicit})`
    );
  }
  for (const candidate of [candidates.managed, candidates.onPath]) {
    if (candidate !== null && exists(candidate)) return candidate;
  }
  throw new Error('alloy: no Java runtime found');
}
