import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface ProgressBarProps {
  percentage: number;
  showLabel?: boolean;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  showLabel = true,
  height = 8,
}) => {
  const { colors } = useTheme();
  const clamped = Math.min(100, Math.max(0, percentage));
  const barColor =
    clamped >= 75
      ? colors.success
      : clamped >= 50
        ? colors.warning
        : colors.danger;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.track,
          { backgroundColor: colors.border, height, borderRadius: height / 2 },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${clamped}%`,
              backgroundColor: barColor,
              height,
              borderRadius: height / 2,
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{clamped}%</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  track: {
    flex: 1,
    overflow: 'hidden',
  },
  fill: {},
  label: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },
});
