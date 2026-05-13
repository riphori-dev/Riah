import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Ellipse } from 'react-native-svg';

export default function BabyIllustration() {
  return (
    <View style={styles.container}>
      <View style={styles.backdrop}>
        <Svg width={130} height={130} viewBox="0 0 130 130">
          {/* Head */}
          <Circle
            cx="65"
            cy="45"
            r="22"
            fill="#F9C784"
            stroke="#F4A98A"
            strokeWidth="1"
          />
          
          {/* Hair tuft */}
          <Path
            d="M 55 30 Q 65 25, 75 30"
            fill="none"
            stroke="#8C7B6E"
            strokeWidth="2"
            strokeLinecap="round"
          />
          
          {/* Eyes (closed) */}
          <Path
            d="M 58 43 Q 60 45, 62 43"
            fill="none"
            stroke="#4A3728"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <Path
            d="M 68 43 Q 70 45, 72 43"
            fill="none"
            stroke="#4A3728"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          
          {/* Smile */}
          <Path
            d="M 60 50 Q 65 53, 70 50"
            fill="none"
            stroke="#4A3728"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          
          {/* Ears */}
          <Circle cx="45" cy="45" r="4" fill="#F9C784" stroke="#F4A98A" strokeWidth="1" />
          <Circle cx="85" cy="45" r="4" fill="#F9C784" stroke="#F4A98A" strokeWidth="1" />
          
          {/* Body/Onesie */}
          <Path
            d="M 65 67 Q 45 75, 42 95 L 88 95 Q 85 75, 65 67"
            fill="#A8D5BA"
            stroke="#F4A98A"
            strokeWidth="1"
          />
          
          {/* Arms */}
          <Path
            d="M 48 75 Q 35 80, 32 90"
            fill="none"
            stroke="#F9C784"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <Path
            d="M 82 75 Q 95 80, 98 90"
            fill="none"
            stroke="#F9C784"
            strokeWidth="4"
            strokeLinecap="round"
          />
          
          {/* Hands */}
          <Circle cx="32" cy="92" r="3" fill="#F9C784" stroke="#F4A98A" strokeWidth="1" />
          <Circle cx="98" cy="92" r="3" fill="#F9C784" stroke="#F4A98A" strokeWidth="1" />
          
          {/* Legs */}
          <Path
            d="M 55 95 L 55 110"
            fill="none"
            stroke="#F9C784"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <Path
            d="M 75 95 L 75 110"
            fill="none"
            stroke="#F9C784"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FFF0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
