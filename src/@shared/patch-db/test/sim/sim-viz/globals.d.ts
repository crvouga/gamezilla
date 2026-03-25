/* Ambient globals loaded via CDN script tags before the bundle runs. */

declare const gsap: {
  timeline(): GsapTimeline;
  to(target: any, vars: any, position?: number): GsapTimeline;
};

interface GsapTimeline {
  kill(): void;
  to(target: any, vars: any, position?: number): GsapTimeline;
  fromTo(target: any, from: any, to: any, position?: number): GsapTimeline;
}

