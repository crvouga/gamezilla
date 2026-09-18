import type {
  HtmlReportTest,
  ReportSnapshotBlob,
  ReportStepHit,
} from '@pkgs/sim';

import { blobDataUrl, blobText } from './frames';
import type { Route } from './hash';
import { showPress } from './hash';
import { frameSrcdoc, PHONE_H, PHONE_W } from './phone';

export type PhoneLayers = {
  frameEl: HTMLDivElement;
  paintGen: number;
};

function visibleLayer(frameEl: HTMLDivElement): HTMLElement | null {
  return frameEl.querySelector<HTMLElement>(
    'iframe.phone-layer.is-front, img.shot.is-front'
  );
}

function clearPendingLayers(frameEl: HTMLDivElement): void {
  frameEl
    .querySelectorAll<HTMLElement>(
      'iframe.phone-layer.is-back, img.shot.is-back'
    )
    .forEach((layer) => layer.remove());
}

function promoteLayer(frameEl: HTMLDivElement, layer: HTMLElement): void {
  frameEl
    .querySelectorAll<HTMLElement>(
      'iframe.phone-layer.is-front, img.shot.is-front'
    )
    .forEach((old) => {
      if (old !== layer) old.remove();
    });
  layer.classList.replace('is-back', 'is-front');
}

function createIframe(): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.className = 'phone-layer is-back';
  frame.sandbox = '';
  frame.width = String(PHONE_W);
  frame.height = String(PHONE_H);
  frame.title = 'snapshot';
  return frame;
}

function createImage(): HTMLImageElement {
  const image = document.createElement('img');
  image.className = 'shot is-back';
  image.alt = '';
  return image;
}

export function paintHtmlLayer(layers: PhoneLayers, srcdoc: string): void {
  const { frameEl } = layers;
  clearPendingLayers(frameEl);
  const oldVisible = visibleLayer(frameEl);
  const next = createIframe();
  layers.paintGen += 1;
  const gen = layers.paintGen;
  next.addEventListener(
    'load',
    () => {
      if (layers.paintGen !== gen) {
        if (next.classList.contains('is-back')) next.remove();
        return;
      }
      promoteLayer(frameEl, next);
    },
    { once: true }
  );
  frameEl.appendChild(next);
  next.setAttribute('srcdoc', srcdoc);
  if (!oldVisible) next.classList.replace('is-back', 'is-front');
}

export function paintPngLayer(layers: PhoneLayers, url: string | null): void {
  if (!url) return;
  const { frameEl } = layers;
  clearPendingLayers(frameEl);
  const oldVisible = visibleLayer(frameEl);
  const next = createImage();
  layers.paintGen += 1;
  const gen = layers.paintGen;
  next.addEventListener(
    'load',
    () => {
      if (layers.paintGen !== gen) {
        if (next.classList.contains('is-back')) next.remove();
        return;
      }
      promoteLayer(frameEl, next);
    },
    { once: true }
  );
  frameEl.appendChild(next);
  next.setAttribute('src', url);
  if (!oldVisible) next.classList.replace('is-back', 'is-front');
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
  hit: ReportStepHit | undefined;
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
  if (html === null) return;
  paintHtmlLayer(opts.layers, frameSrcdoc(html, opts.frameCss, pressHit));
}
