import type { HtmlReportTest, ReportSnapshotBlob } from '@pkgs/sim';

import { blobDataUrl, blobText } from './frames';
import type { Route } from './hash';
import { showPress } from './hash';
import { frameSrcdoc, PHONE_H, PHONE_W } from './phone';

export type PhoneLayers = {
  frameEl: HTMLDivElement;
  paintGen: number;
};

function ensureHtml(frameEl: HTMLDivElement): {
  front: HTMLIFrameElement;
  back: HTMLIFrameElement;
} {
  frameEl.querySelectorAll('img.shot').forEach((el) => el.remove());
  const layers = frameEl.querySelectorAll('iframe.phone-layer');
  if (layers.length >= 2) {
    return {
      front: layers[0] as HTMLIFrameElement,
      back: layers[1] as HTMLIFrameElement,
    };
  }
  layers.forEach((el) => el.remove());
  const front = document.createElement('iframe');
  front.className = 'phone-layer is-front';
  front.sandbox = '';
  front.width = String(PHONE_W);
  front.height = String(PHONE_H);
  front.title = 'front';
  const back = document.createElement('iframe');
  back.className = 'phone-layer is-back';
  back.sandbox = '';
  back.width = String(PHONE_W);
  back.height = String(PHONE_H);
  back.title = 'back';
  frameEl.appendChild(front);
  frameEl.appendChild(back);
  return { front, back };
}

function ensurePng(frameEl: HTMLDivElement): {
  front: HTMLImageElement;
  back: HTMLImageElement;
} {
  frameEl.querySelectorAll('iframe.phone-layer').forEach((el) => el.remove());
  const imgs = frameEl.querySelectorAll('img.shot');
  if (imgs.length >= 2) {
    return {
      front: imgs[0] as HTMLImageElement,
      back: imgs[1] as HTMLImageElement,
    };
  }
  imgs.forEach((el) => el.remove());
  const front = document.createElement('img');
  front.className = 'shot is-front';
  front.alt = '';
  const back = document.createElement('img');
  back.className = 'shot is-back';
  back.alt = '';
  frameEl.appendChild(front);
  frameEl.appendChild(back);
  return { front, back };
}

function swapOnLoad(
  front: HTMLElement,
  back: HTMLElement,
  layers: PhoneLayers,
  gen: number
): void {
  const onLoad = () => {
    if (layers.paintGen !== gen) return;
    front.classList.remove('is-front');
    front.classList.add('is-back');
    back.classList.remove('is-back');
    back.classList.add('is-front');
  };
  if (back instanceof HTMLIFrameElement) back.onload = onLoad;
  if (back instanceof HTMLImageElement) back.onload = onLoad;
}

export function paintHtmlLayer(layers: PhoneLayers, srcdoc: string): void {
  const { front: f0, back: b0 } = ensureHtml(layers.frameEl);
  const front =
    layers.frameEl.querySelector<HTMLIFrameElement>(
      'iframe.phone-layer.is-front'
    ) || f0;
  const back =
    layers.frameEl.querySelector<HTMLIFrameElement>(
      'iframe.phone-layer.is-back'
    ) || b0;
  layers.paintGen += 1;
  const gen = layers.paintGen;
  if (!front.getAttribute('srcdoc')) {
    front.setAttribute('srcdoc', srcdoc);
    return;
  }
  swapOnLoad(front, back, layers, gen);
  if (back.getAttribute('srcdoc') === srcdoc) back.removeAttribute('srcdoc');
  back.setAttribute('srcdoc', srcdoc);
}

export function paintPngLayer(layers: PhoneLayers, url: string | null): void {
  const { front: f0, back: b0 } = ensurePng(layers.frameEl);
  const front =
    layers.frameEl.querySelector<HTMLImageElement>('img.shot.is-front') || f0;
  const back =
    layers.frameEl.querySelector<HTMLImageElement>('img.shot.is-back') || b0;
  layers.paintGen += 1;
  const gen = layers.paintGen;
  if (!front.getAttribute('src')) {
    if (url) front.setAttribute('src', url);
    return;
  }
  if (!url) return;
  swapOnLoad(front, back, layers, gen);
  if (back.getAttribute('src') === url) back.removeAttribute('src');
  back.setAttribute('src', url);
}

export function applyPhoneScale(frameEl: HTMLDivElement, s: number): void {
  frameEl.style.width = `${PHONE_W * s}px`;
  frameEl.style.height = `${PHONE_H * s}px`;
  for (const inner of frameEl.querySelectorAll<HTMLIFrameElement>(
    'iframe.phone-layer'
  )) {
    inner.style.transform = `scale(${s})`;
    inner.style.width = `${PHONE_W}px`;
    inner.style.height = `${PHONE_H}px`;
  }
}

export function paintPhoneBlob(opts: {
  layers: PhoneLayers;
  test: HtmlReportTest;
  blob: ReportSnapshotBlob;
  route: Route;
  stepActorId: string | undefined;
  hit: import('@pkgs/sim').ReportStepHit | undefined;
  frameCss: string;
}): void {
  const pressHit =
    showPress(opts.route) &&
    opts.hit &&
    (!opts.stepActorId ||
      !opts.blob.nodeId ||
      opts.stepActorId === opts.blob.nodeId)
      ? opts.hit
      : null;
  if (opts.blob.media === 'png') {
    paintPngLayer(opts.layers, blobDataUrl(opts.test, opts.blob));
    return;
  }
  const html = blobText(opts.test, opts.blob);
  paintHtmlLayer(
    opts.layers,
    html !== null
      ? frameSrcdoc(html, opts.frameCss, pressHit)
      : '<html><body></body></html>'
  );
}
