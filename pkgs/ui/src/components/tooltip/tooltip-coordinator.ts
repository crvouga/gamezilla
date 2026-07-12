type TooltipDismiss = () => void;

let activeDismiss: TooltipDismiss | null = null;

export function claimActiveTooltip(dismiss: TooltipDismiss): void {
  if (activeDismiss !== null && activeDismiss !== dismiss) {
    activeDismiss();
  }
  activeDismiss = dismiss;
}

export function releaseActiveTooltip(dismiss: TooltipDismiss): void {
  if (activeDismiss === dismiss) {
    activeDismiss = null;
  }
}
