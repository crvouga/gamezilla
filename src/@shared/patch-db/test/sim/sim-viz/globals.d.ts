/* Ambient globals loaded via CDN script tags before the bundle runs. */

declare const React: any;
declare const ReactDOM: {
  createRoot(container: Element): { render(element: unknown): void };
};

declare const gsap: {
  timeline(): GsapTimeline;
  to(target: any, vars: any, position?: number): GsapTimeline;
};

interface GsapTimeline {
  kill(): void;
  to(target: any, vars: any, position?: number): GsapTimeline;
  fromTo(target: any, from: any, to: any, position?: number): GsapTimeline;
}

/* Injected by generate-sim-viz.ts before the bundle */
declare const RAW: SimRecording[];
declare const DIR_LABEL: string;
