import React from 'react';
import Svg, { Circle, Ellipse, Path, Line } from 'react-native-svg';

/**
 * Hand-drawn style dog face icon — used for dog park map markers.
 * Rendered entirely with SVG primitives so it looks illustrated, not emoji.
 */
export default function DogParkIcon({ size = 22 }: { size?: number }) {
  const s = size / 24; // scale factor (designed on 24x24 grid)

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Left floppy ear */}
      <Ellipse
        cx={6.2}
        cy={10.5}
        rx={3.2}
        ry={4.8}
        fill="#8B6914"
        transform="rotate(-15, 6.2, 10.5)"
      />
      {/* Right floppy ear */}
      <Ellipse
        cx={17.8}
        cy={10.5}
        rx={3.2}
        ry={4.8}
        fill="#8B6914"
        transform="rotate(15, 17.8, 10.5)"
      />
      {/* Head */}
      <Circle cx={12} cy={11} r={7} fill="#C89B3C" />
      {/* Snout */}
      <Ellipse cx={12} cy={14.2} rx={3.2} ry={2.2} fill="#E8C06A" />
      {/* Nose */}
      <Ellipse cx={12} cy={13.1} rx={1.4} ry={0.95} fill="#2C1A0E" />
      {/* Nose highlight */}
      <Ellipse cx={11.5} cy={12.8} rx={0.45} ry={0.3} fill="#fff" opacity={0.6} />
      {/* Left eye */}
      <Circle cx={9.4} cy={10.2} r={1.3} fill="#1A0D00" />
      <Circle cx={9.1} cy={9.9} r={0.4} fill="#fff" />
      {/* Right eye */}
      <Circle cx={14.6} cy={10.2} r={1.3} fill="#1A0D00" />
      <Circle cx={14.3} cy={9.9} r={0.4} fill="#fff" />
      {/* Mouth — gentle curve */}
      <Path
        d="M10.5 15.2 Q12 16.4 13.5 15.2"
        stroke="#2C1A0E"
        strokeWidth={0.7}
        fill="none"
        strokeLinecap="round"
      />
      {/* Tongue */}
      <Ellipse cx={12} cy={16.1} rx={1.0} ry={0.75} fill="#E05C7A" />
    </Svg>
  );
}
