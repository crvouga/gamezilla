import { Skia, type SkImage, type SkSVG } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import type { PieceCode } from './chess-board-types';
import { PIECE_SVGS, PIECE_SVGS_CBURNETT } from './chess-pieces-svg';

export type PieceImageCache = Record<PieceCode, SkImage>;

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

export function usePieceSkiaImages(): PieceImageCache | null {
  const [cache, setCache] = useState<PieceImageCache | null>(null);

  useEffect(() => {
    let cancelled = false;
    const svgs: SkSVG[] = [];

    async function load() {
      const entries = Object.entries(PIECE_SVGS) as [PieceCode, string][];
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

      if (cancelled) return;

      const out = {} as PieceImageCache;
      for (const [code, image] of results) {
        out[code] = image;
      }
      setCache(out);
    }

    void load();

    return () => {
      cancelled = true;
      for (const svg of svgs) svg.dispose();
    };
  }, []);

  return cache;
}
