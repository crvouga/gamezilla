/** Vite handles the stylesheet; TypeScript only needs to know it exists. */
declare module '*.css';

interface Window {
  /**
   * Counts client-side step transitions. The browser verification reads it to
   * prove a step happened without a document load.
   */
  __idpSpaSteps?: number;
}
