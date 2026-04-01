import type { ReactNode } from 'react';
import { cardChrome } from './styles';

export function NodePanelShell({
  icon,
  iconColor,
  title,
  headerExtra,
  partitioned,
  children,
}: {
  icon: ReactNode;
  iconColor?: string;
  title: string;
  headerExtra?: ReactNode;
  partitioned?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`${cardChrome} ${partitioned ? 'ring-1 ring-red-500/40' : ''}`}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className={iconColor}>{icon}</span>
        <span className="font-mono text-sm font-semibold text-white/90">
          {title}
        </span>
        {headerExtra}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}
