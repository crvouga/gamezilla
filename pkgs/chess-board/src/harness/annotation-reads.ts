import { readAnnotationDom } from './annotation-dom';
import { partitionArrows } from './annotation-ownership';
import type { BoardWorld } from './board-world';
export const readAnnotations = (w: BoardWorld) => {
  const dom = readAnnotationDom(w.app.host);
  const ownership = partitionArrows(dom.arrows, w.app.userArrowSnapshot());
  return {
    ...dom,
    circles: w.app.layer('shapes'),
    personalArrows: ownership.personal.map((a) => a.token),
    activityArrows: ownership.activity,
    unfinished: w.app
      .layer('arrows')
      .filter((t) => t.startsWith('arrow-preview:')),
    changes: w.app.userArrowChanges(),
    enabled: w.app.config().enableUserArrows === true,
  };
};
