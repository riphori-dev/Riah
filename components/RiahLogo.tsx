import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, G, Ellipse } from 'react-native-svg';

interface RiahLogoProps {
  size?: number;
  color?: string;
}

export default function RiahLogo({ size = 100, color = '#F4A98A' }: RiahLogoProps) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Main head - soft circle */}
        <Circle cx="50" cy="45" r="35" fill={color} opacity="0.8" />

        {/* Top puff - baby bonnet style */}
        <Ellipse cx="50" cy="20" rx="20" ry="15" fill={color} />

        {/* Left ear */}
        <Circle cx="25" cy="35" r="8" fill={color} opacity="0.9" />
        {/* Right ear */}
        <Circle cx="75" cy="35" r="8" fill={color} opacity="0.9" />

        {/* Left eye */}
        <Circle cx="40" cy="40" r="4" fill="#4A3728" />
        {/* Right eye */}
        <Circle cx="60" cy="40" r="4" fill="#4A3728" />

        {/* Happy smile - curved line */}
        <Path d="M 40 50 Q 50 58 60 50" stroke="#4A3728" strokeWidth="2" fill="none" strokeLinecap="round" />

        {/* Rosy cheek left */}
        <Circle cx="28" cy="48" r="3" fill="#F9C784" opacity="0.6" />
        {/* Rosy cheek right */}
        <Circle cx="72" cy="48" r="3" fill="#F9C784" opacity="0.6" />

        {/* Little bow on top - decoration */}
        <G>
          {/* Bow left */}
          <Ellipse cx="42" cy="15" rx="6" ry="8" fill="#A8D5BA" opacity="0.7" />
          {/* Bow right */}
          <Ellipse cx="58" cy="15" rx="6" ry="8" fill="#A8D5BA" opacity="0.7" />
          {/* Bow center knot */}
          <Circle cx="50" cy="16" r="3" fill="#F9C784" />
        </G>

        {/* Cute heart accent at bottom */}
        <Path
          d="M 50 75 L 55 70 Q 58 68 60 70 Q 62 72 60 75 Q 58 77 50 85 Q 42 77 40 75 Q 38 72 40 70 Q 42 68 45 70 Z"
          fill="#F9C784"
          opacity="0.8"
        />
      </Svg>
    </View>
  );
}
