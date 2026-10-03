import React from 'react';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

export type IconName =
  | 'home'
  | 'jar'
  | 'receipt'
  | 'clock'
  | 'alert'
  | 'coins'
  | 'star'
  | 'check'
  | 'plus'
  | 'bowl'
  | 'search'
  | 'circle'
  | 'chevronDown'
  | 'chevronUp'
  | 'trash';

/** Lightly hand-drawn line icons with one consistent stroke. */
export function Icon({
  name,
  size = 32,
  color = colors.text,
  strokeWidth = 2.5,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  let body: React.ReactNode;
  switch (name) {
    case 'home':
      body = (
        <>
          <Path {...common} d="M4.5 15.5 16 5.2l11.6 10.1" />
          <Path
            {...common}
            d="M7.8 13.4v12.3c0 .7.5 1.2 1.2 1.2h5V20h4.2v6.9h5c.7 0 1.2-.5 1.2-1.2V13.3"
          />
        </>
      );
      break;
    case 'jar':
      body = (
        <>
          <Path {...common} d="M10 4.5h12" />
          <Path
            {...common}
            d="M9.2 4.5v3.2c-2.4 1.4-3.6 3.4-3.6 6v10.6c0 1.6 1.2 2.9 2.8 2.9h15.2c1.6 0 2.8-1.3 2.8-2.9V13.7c0-2.6-1.2-4.6-3.6-6V4.5"
          />
          <Path {...common} d="M9.6 16.8h12.8" />
        </>
      );
      break;
    case 'receipt':
      body = (
        <>
          <Path {...common} d="M7.5 4.5h17v23l-3-2-2.8 2-2.7-2-2.7 2-2.8-2-3 2z" />
          <Path {...common} d="M11.5 11h9M11.5 15.5h9M11.5 20h5.5" />
        </>
      );
      break;
    case 'clock':
      body = (
        <>
          <Circle {...common} cx={16} cy={16} r={11.5} />
          <Path {...common} d="M16 9.5V16l4.2 2.6" />
        </>
      );
      break;
    case 'alert':
      body = (
        <>
          <Path {...common} d="M16 5 3.8 26.2h24.4z" />
          <Path {...common} d="M16 13v6" />
          <Circle cx={16} cy={22.6} r={1.2} fill={color} />
        </>
      );
      break;
    case 'coins':
      body = (
        <>
          <Ellipse {...common} cx={16} cy={9} rx={9} ry={3.6} />
          <Path {...common} d="M7 9v6.5c0 2 4 3.6 9 3.6s9-1.6 9-3.6V9" />
          <Path {...common} d="M7 15.5V22c0 2 4 3.6 9 3.6s9-1.6 9-3.6v-6.5" />
        </>
      );
      break;
    case 'star':
      body = (
        <Path
          {...common}
          d="m16 4.6 3.4 7 7.6 1-5.5 5.3 1.3 7.6L16 21.9l-6.8 3.6 1.3-7.6L5 12.6l7.6-1z"
        />
      );
      break;
    case 'check':
      body = <Path {...common} d="m6.5 16.8 6 5.8 13-13" />;
      break;
    case 'plus':
      body = <Path {...common} d="M16 6.5v19M6.5 16h19" />;
      break;
    case 'bowl':
      body = (
        <>
          <Path {...common} d="M4.5 15h23c0 6.4-5.1 11.5-11.5 11.5S4.5 21.4 4.5 15z" />
          <Path
            {...common}
            d="M11 10.5c0-2 1.3-2.6 1.3-4.6M16.5 10.5c0-2 1.3-2.6 1.3-4.6"
          />
        </>
      );
      break;
    case 'search':
      body = (
        <>
          <Circle {...common} cx={14} cy={14} r={8.5} />
          <Path {...common} d="m20.5 20.5 6.5 6.5" />
        </>
      );
      break;
    case 'circle':
      body = <Circle {...common} cx={16} cy={16} r={10.5} />;
      break;
    case 'chevronDown':
      body = <Path {...common} d="M8 12.5 16 20.5l8-8" />;
      break;
    case 'chevronUp':
      body = <Path {...common} d="M8 19.5 16 11.5l8 8" />;
      break;
    case 'trash':
      body = (
        <>
          <Path {...common} d="M6 9h20M12.5 9V6.2h7V9" />
          <Path {...common} d="M8.5 9l1.3 16.4c.1 1 .9 1.6 1.8 1.6h8.8c.9 0 1.7-.6 1.8-1.6L23.5 9" />
        </>
      );
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      {body}
    </Svg>
  );
}

/** Large expand chevron for "See why": points down to open, up to close. */
export function BigChevron({ up }: { up: boolean }) {
  return (
    <Svg width={64} height={40} viewBox="0 0 64 40" aria-hidden>
      <Path
        d={up ? 'M12 30 32 11l20 19' : 'M12 10 32 29l20-19'}
        stroke={colors.accent}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Pantry logo: a hand-drawn pantry shelf with a pizza slice and jars. */
export function PantryLogo({ size = 64 }: { size?: number }) {
  const line = {
    stroke: colors.text,
    strokeWidth: 2.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <Path
        {...line}
        fill={colors.white}
        d="M12.5 7.8c12.8-.9 26.3-.8 39.2.2 1 .1 1.7.9 1.7 1.9l-.3 44.6c0 1-.8 1.8-1.8 1.8l-38.9.3c-1 0-1.8-.8-1.8-1.8L10.7 9.7c0-1 .8-1.8 1.8-1.9z"
      />
      <Path {...line} fill="none" d="M11.4 31.6c13.7.6 27.5.4 41.2-.2" />
      <Path {...line} fill={colors.cream} d="M21 14.6c7.2-2.4 14.8-2.4 22 0L32.1 28.6z" />
      <Circle cx={29} cy={18.4} r={1.9} fill={colors.accent} />
      <Circle cx={35.2} cy={18} r={1.7} fill={colors.accent} />
      <Circle cx={32.1} cy={23.2} r={1.5} fill={colors.accent} />
      <Rect {...line} fill="none" x={17} y={38} width={11} height={13.5} rx={3} />
      <Rect {...line} fill={colors.green} x={16.4} y={34.6} width={12.2} height={3.4} rx={1.4} />
      <Rect {...line} fill="none" x={34} y={40} width={13} height={11.5} rx={3} />
      <Rect {...line} fill={colors.green} x={33.4} y={36.6} width={14.2} height={3.4} rx={1.4} />
    </Svg>
  );
}
