import { readAnnotationDom } from './annotation-dom';
import type { BoardWorld } from './board-world';
export const readAnnotations = (w: BoardWorld) => ({
  ...readAnnotationDom(w.app.host),
  circles: w.app.layer('shapes'),
  personalArrows: w.app
    .layer('arrows')
    .filter((t) => t.startsWith('arrow:primary@')),
  unfinished: w.app
    .layer('arrows')
    .filter((t) => t.startsWith('arrow-preview:')),
  changes: w.app.userArrowChanges(),
  enabled: w.app.config().enableUserArrows === true,
});
