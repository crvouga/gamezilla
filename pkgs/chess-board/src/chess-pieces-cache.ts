import { type SkImage, Skia, type SkSVG } from '@shopify/react-native-skia';
import { useEffect, useSyncExternalStore } from 'react';
import type { PieceCode } from './chess-board-types';
import { PIECE_SVGS, PIECE_SVGS_CBURNETT } from './chess-pieces-svg';

export type PieceImageCache = Record<PieceCode, SkImage>;

export type PieceCaches = {
  images: PieceImageCache;
};

const PIECE_RASTER_SIZE = 512;

async function waitForSvgReady(svg: SkSVG): Promise<void> {
  // On web, Skia.SVG.MakeFromString creates an HTMLImageElement that loads
  // its data URL asynchronously. We must wait for `complete` + `naturalWidth`
  // before rasterizing or the snapshot will be blank.
  const ref = (svg as unknown as { ref?: unknown }).ref as
    | HTMLImageElement
    | undefined;
  if (typeof HTMLImageElement === 'undefined') return;
  if (!(ref instanceof HTMLImageElement)) return;
  if (ref.complete && ref.naturalWidth > 0) return;
  await new Promise<void>((resolve, reject) => {
    const onLoad = () => {
      ref.removeEventListener('load', onLoad);
      ref.removeEventListener('error', onError);
      resolve();
    };
    const onError = () => {
      ref.removeEventListener('load', onLoad);
      ref.removeEventListener('error', onError);
      reject(new Error('Failed to load piece SVG'));
    };
    ref.addEventListener('load', onLoad);
    ref.addEventListener('error', onError);
  });
}

function rasterizePiece(svg: SkSVG): SkImage {
  // Use Surface.Make (CPU/raster) NOT MakeOffscreen (WebGL). MakeOffscreen
  // creates a separate WebGL context on web; the resulting SkImage is
  // GPU-bound to that context and renders as transparent in the main Canvas's
  // GL context. CPU-backed snapshots are portable across contexts.
  const surface = Skia.Surface.Make(PIECE_RASTER_SIZE, PIECE_RASTER_SIZE);
  if (!surface) {
    throw new Error('Failed to create raster surface');
  }
  const canvas = surface.getCanvas();
  canvas.drawSvg(svg, PIECE_RASTER_SIZE, PIECE_RASTER_SIZE);
  const image = surface.makeImageSnapshot();
  surface.dispose();
  return image;
}

function isSvgUrl(source: string): boolean {
  return source.startsWith('https://') || source.startsWith('http://');
}

async function resolveSvgXml(code: PieceCode, source: string): Promise<string> {
  if (!isSvgUrl(source)) return source;
  try {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch {
    // Offline / blocked network: fall back to bundled Cburnett XML.
    return PIECE_SVGS_CBURNETT[code];
  }
}

async function loadPieceCaches(): Promise<PieceCaches> {
  const entries = Object.entries(PIECE_SVGS) as [PieceCode, string][];
  const svgs: SkSVG[] = [];
  try {
    const results = await Promise.all(
      entries.map(async ([code, source]) => {
        const xml = await resolveSvgXml(code, source);
        const svg = Skia.SVG.MakeFromString(xml);
        if (svg === null) {
          throw new Error(`Failed to parse SVG for piece ${code}`);
        }
        svgs.push(svg);
        await waitForSvgReady(svg);
        return [code, rasterizePiece(svg)] as const;
      })
    );
    const images = {} as PieceImageCache;
    for (const [code, image] of results) {
      images[code] = image;
    }
    return { images };
  } finally {
    for (const svg of svgs) svg.dispose();
  }
}

/**
 * Module-level singleton holding the rasterized piece images.
 *
 * Native drag uses SvgXml (not PNG data-URIs) — encoding was removed after
 * iOS Image failed to decode large base64 ghosts and web encode corrupted
 * board rasters.
 *
 * Bump {@link PIECE_CACHE_GEN} when the raster pipeline changes so hot reload
 * cannot keep serving a corrupt in-memory cache from a prior module revision.
 */
const PIECE_CACHE_GEN = 5;
const pieceCacheSubscribers = new Set<() => void>();
let pieceCacheValue: PieceCaches | null = null;
let pieceCacheGenLoaded = -1;
let pieceCacheLoadingPromise: Promise<void> | null = null;

function ensurePieceCacheLoad(): void {
  if (pieceCacheValue !== null && pieceCacheGenLoaded === PIECE_CACHE_GEN) {
    return;
  }
  if (pieceCacheLoadingPromise !== null) return;
  pieceCacheValue = null;
  pieceCacheLoadingPromise = (async () => {
    try {
      pieceCacheValue = await loadPieceCaches();
      pieceCacheGenLoaded = PIECE_CACHE_GEN;
    } finally {
      pieceCacheLoadingPromise = null;
      for (const notify of pieceCacheSubscribers) notify();
    }
  })();
}

function subscribePieceCache(notify: () => void): () => void {
  pieceCacheSubscribers.add(notify);
  return () => {
    pieceCacheSubscribers.delete(notify);
  };
}

function getPieceCacheSnapshot(): PieceCaches | null {
  return pieceCacheValue;
}

export function usePieceCaches(): PieceCaches | null {
  const cache = useSyncExternalStore(
    subscribePieceCache,
    getPieceCacheSnapshot,
    getPieceCacheSnapshot
  );
  useEffect(() => {
    ensurePieceCacheLoad();
  }, []);
  return cache;
}

/** Skia images only — most board layers do not need the URI map. */
export function usePieceSkiaImages(): PieceImageCache | null {
  return usePieceCaches()?.images ?? null;
}

/**
 * Force-kicks the cache load before any board mounts. Mounted from the
 * chess subtree bootstrap so the first puzzle / engine board appears
 * with pieces already drawn instead of waiting one Suspense round-trip.
 */
export function preloadPieceSkiaImages(): void {
  ensurePieceCacheLoad();
}
