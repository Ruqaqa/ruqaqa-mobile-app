import React, { useRef, useCallback, useState } from 'react';
import {
  View,
  PanResponder,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';

interface OpacitySliderProps {
  value: number;
  minimumValue: number;
  maximumValue: number;
  disabled?: boolean;
  onValueChange: (value: number) => void;
  trackColor: string;
}

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 22;
const HIT_SLOP = 12;

/**
 * Custom slider built with PanResponder.
 * Avoids adding @react-native-community/slider as a dependency.
 */
export function OpacitySlider({
  value,
  minimumValue,
  maximumValue,
  disabled = false,
  onValueChange,
  trackColor,
}: OpacitySliderProps) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const trackWidth = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  const range = maximumValue - minimumValue;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    trackWidth.current = w;
    setLayoutWidth(w);
  }, []);

  const resolveValue = useCallback(
    (pageX: number, trackStartX: number) => {
      const w = trackWidth.current;
      if (w <= 0) return valueRef.current;
      const pct = Math.max(0, Math.min(1, (pageX - trackStartX) / w));
      return Math.round(minimumValue + pct * range);
    },
    [minimumValue, range],
  );

  const trackStartX = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (evt) => {
        // Calculate track start position from the touch
        const w = trackWidth.current;
        const fraction =
          (valueRef.current - minimumValue) / (maximumValue - minimumValue);
        trackStartX.current = evt.nativeEvent.pageX - fraction * w;
        const newVal = resolveValue(evt.nativeEvent.pageX, trackStartX.current);
        onValueChange(newVal);
      },
      onPanResponderMove: (evt) => {
        const newVal = resolveValue(evt.nativeEvent.pageX, trackStartX.current);
        onValueChange(newVal);
      },
    }),
  ).current;

  const fraction = range > 0 ? (value - minimumValue) / range : 0;
  const thumbLeftPx = fraction * layoutWidth;
  const activeWidth = fraction * layoutWidth;

  return (
    <View
      style={[styles.container, disabled && { opacity: 0.4 }]}
      onLayout={onLayout}
      {...panResponder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityValue={{
        min: minimumValue,
        max: maximumValue,
        now: value,
      }}
      accessibilityLabel={`Opacity ${value}%`}
    >
      {/* Inactive track */}
      <View style={[styles.track, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />

      {/* Active track */}
      <View
        style={[
          styles.track,
          styles.activeTrack,
          { width: activeWidth, backgroundColor: trackColor },
        ]}
      />

      {/* Thumb */}
      <View
        style={[
          styles.thumb,
          {
            left: thumbLeftPx - THUMB_SIZE / 2,
            backgroundColor: trackColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: THUMB_SIZE + HIT_SLOP * 2,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    position: 'absolute',
    start: 0,
    end: 0,
  },
  activeTrack: {
    end: undefined,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
});
