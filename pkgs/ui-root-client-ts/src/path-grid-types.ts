export type PathGridTone =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple';

export type PathGridEndpoint = {
  readonly cell: number;
  readonly label: string;
  readonly tone: PathGridTone;
  readonly connected: boolean;
};

export type PathGridLine = {
  readonly id: string;
  readonly cells: readonly number[];
  readonly tone: PathGridTone;
  readonly connected: boolean;
};

export type PathGridBoardProps = {
  readonly columns: number;
  readonly rows: number;
  readonly label: string;
  readonly testId: string;
  readonly endpoints: readonly PathGridEndpoint[];
  readonly lines: readonly PathGridLine[];
  readonly cellLabel: (index: number) => string;
  readonly disabled?: boolean | undefined;
  readonly describedBy?: string | undefined;
  readonly onActivate?: ((index: number) => void) | undefined;
  readonly onNavigate?: ((index: number) => void) | undefined;
  readonly onCellKey?: ((key: string, index: number) => boolean) | undefined;
  readonly onTraceStart?: ((index: number) => void) | undefined;
  readonly onTraceMove?: ((index: number) => void) | undefined;
  readonly onTraceEnd?: (() => void) | undefined;
  readonly onTraceCancel?: (() => void) | undefined;
};
