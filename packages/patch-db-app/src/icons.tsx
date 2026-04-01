import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { C } from './constants';

export function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 4v12M4 10h12"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconTrash({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M6 6l1 10h6l1-10M4 6h12M8 4h4"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconShuffle({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M3 7h4l3 6h4m0-6h-4l-1.5 3M14 7l3 3-3 3"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconSync({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M3 10a7 7 0 0112.9-3.7M17 10a7 7 0 01-12.9 3.7"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M15 3v4h-4M5 17v-4h4"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
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
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle
        cx={6}
        cy={10}
        r={3}
        stroke="currentColor"
        strokeWidth={1.6}
        fill={active ? C.red : 'none'}
        opacity={active ? 0.5 : 1}
      />
      <Circle
        cx={14}
        cy={10}
        r={3}
        stroke="currentColor"
        strokeWidth={1.6}
        fill={active ? C.red : 'none'}
        opacity={active ? 0.5 : 1}
      />
      {active ? (
        <Line
          x1={3}
          y1={3}
          x2={17}
          y2={17}
          stroke={C.red}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      ) : (
        <Line
          x1={9}
          y1={10}
          x2={11}
          y2={10}
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
}

export function IconClear({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M4 5l2.5 12h7L16 5"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M2 5h16"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M8 8v6M12 8v6"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconGrip({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 16" fill="none">
      <Circle cx={4} cy={3} r={1.2} fill="currentColor" opacity={0.5} />
      <Circle cx={8} cy={3} r={1.2} fill="currentColor" opacity={0.5} />
      <Circle cx={4} cy={8} r={1.2} fill="currentColor" opacity={0.5} />
      <Circle cx={8} cy={8} r={1.2} fill="currentColor" opacity={0.5} />
      <Circle cx={4} cy={13} r={1.2} fill="currentColor" opacity={0.5} />
      <Circle cx={8} cy={13} r={1.2} fill="currentColor" opacity={0.5} />
    </Svg>
  );
}

export function IconRemove({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx={10} cy={10} r={8} stroke="currentColor" strokeWidth={1.5} />
      <Path
        d="M7 7l6 6M13 7l-6 6"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconServer({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3}
        y={2}
        width={18}
        height={7}
        rx={2}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <Rect
        x={3}
        y={11}
        width={18}
        height={7}
        rx={2}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <Circle cx={17} cy={5.5} r={1} fill={C.green} />
      <Circle cx={17} cy={14.5} r={1} fill={C.green} />
      <Path
        d="M8 20h8M12 18v2"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconLaptop({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3}
        y={4}
        width={18}
        height={12}
        rx={2}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <Path
        d="M1 18h22"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconAutoLayout({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Rect
        x={7}
        y={2}
        width={6}
        height={5}
        rx={1.2}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <Rect
        x={1}
        y={13}
        width={6}
        height={5}
        rx={1.2}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <Rect
        x={13}
        y={13}
        width={6}
        height={5}
        rx={1.2}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <Path
        d="M10 7v3M10 10H4v3M10 10h6v3"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconClock({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx={10} cy={10} r={8} stroke="currentColor" strokeWidth={1.5} />
      <Path
        d="M10 5v5l3.5 2"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
