/** Native Viewport options shared with the automated responsive matrix. */
export const viewports = {
  phone: { name: 'Phone', styles: { width: '390px', height: '844px' } },
  tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
  desktop: { name: 'Desktop', styles: { width: '1440px', height: '900px' } },
};

/** Backgrounds follows the production document theme; it never selects a theme. */
export const backgrounds = {
  options: {
    canvas: { name: 'Canvas', value: 'var(--ui-color-background)' },
    surface: { name: 'Surface', value: 'var(--ui-color-surface)' },
    muted: { name: 'Muted surface', value: 'var(--ui-color-surface-muted)' },
  },
  grid: { cellSize: 4, cellAmount: 4, opacity: 0.1 },
};
