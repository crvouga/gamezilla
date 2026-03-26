import { C } from './constants';

export function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M10 4v12M4 10h12"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconTrash({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M6 6l1 10h6l1-10M4 6h12M8 4h4"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconShuffle({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M3 7h4l3 6h4m0-6h-4l-1.5 3M14 7l3 3-3 3"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSync({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M3 10a7 7 0 0112.9-3.7M17 10a7 7 0 01-12.9 3.7"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <path
        d="M15 3v4h-4M5 17v-4h4"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconPartition({
  active,
  size = 16,
}: {
  active: boolean;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle
        cx={6}
        cy={10}
        r={3}
        stroke="currentColor"
        strokeWidth={1.6}
        fill={active ? C.red : 'none'}
        opacity={active ? 0.5 : 1}
      />
      <circle
        cx={14}
        cy={10}
        r={3}
        stroke="currentColor"
        strokeWidth={1.6}
        fill={active ? C.red : 'none'}
        opacity={active ? 0.5 : 1}
      />
      {active ? (
        <line
          x1={3}
          y1={3}
          x2={17}
          y2={17}
          stroke={C.red}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      ) : (
        <line
          x1={9}
          y1={10}
          x2={11}
          y2={10}
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function IconClear({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M4 5l2.5 12h7L16 5"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 5h16"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <path
        d="M8 8v6M12 8v6"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconGrip({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 16" fill="none">
      <circle cx={4} cy={3} r={1.2} fill="currentColor" opacity={0.5} />
      <circle cx={8} cy={3} r={1.2} fill="currentColor" opacity={0.5} />
      <circle cx={4} cy={8} r={1.2} fill="currentColor" opacity={0.5} />
      <circle cx={8} cy={8} r={1.2} fill="currentColor" opacity={0.5} />
      <circle cx={4} cy={13} r={1.2} fill="currentColor" opacity={0.5} />
      <circle cx={8} cy={13} r={1.2} fill="currentColor" opacity={0.5} />
    </svg>
  );
}

export function IconRemove({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx={10} cy={10} r={8} stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M7 7l6 6M13 7l-6 6"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconServer({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect
        x={3}
        y={2}
        width={18}
        height={7}
        rx={2}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <rect
        x={3}
        y={11}
        width={18}
        height={7}
        rx={2}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <circle cx={17} cy={5.5} r={1} fill={C.green} />
      <circle cx={17} cy={14.5} r={1} fill={C.green} />
      <path
        d="M8 20h8M12 18v2"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconLaptop({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect
        x={3}
        y={4}
        width={18}
        height={12}
        rx={2}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <path
        d="M1 18h22"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconAutoLayout({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect
        x={7}
        y={2}
        width={6}
        height={5}
        rx={1.2}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <rect
        x={1}
        y={13}
        width={6}
        height={5}
        rx={1.2}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <rect
        x={13}
        y={13}
        width={6}
        height={5}
        rx={1.2}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <path
        d="M10 7v3M10 10H4v3M10 10h6v3"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconClock({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx={10} cy={10} r={8} stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M10 5v5l3.5 2"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
