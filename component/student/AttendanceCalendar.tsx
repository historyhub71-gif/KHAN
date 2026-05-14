import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Attendance } from '../../types';
import { Colors } from '../../utils/colors';
import { DateHelpers } from '../../utils/dateHelpers';

interface AttendanceCalendarProps {
  attendance: Attendance[];
  courseId: string;
  onMonthChange?: (year: number, month: number) => void;
}

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({
  attendance,
  courseId,
  onMonthChange,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const attendanceMap = attendance.reduce(
    (acc, item) => {
      if (item.course_id === courseId) {
        acc[item.date] = item.status;
      }
      return acc;
    },
    {} as Record<string, 'present' | 'absent'>
  );

  const daysInMonth = DateHelpers.getDaysInMonth(currentDate);
  const firstDay = DateHelpers.getFirstDayOfMonth(currentDate);
  const monthYear = DateHelpers.getMonthYear(currentDate);
  const weekDays = DateHelpers.getWeekDays();

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const handlePrevMonth = () => {
    const newDate = DateHelpers.subtractMonths(currentDate, 1);
    setCurrentDate(newDate);
    onMonthChange?.(newDate.getFullYear(), newDate.getMonth());
  };

  const handleNextMonth = () => {
    const newDate = DateHelpers.addMonths(currentDate, 1);
    setCurrentDate(newDate);
    onMonthChange?.(newDate.getFullYear(), newDate.getMonth());
  };

  const getDateString = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return DateHelpers.formatISO(date);
  };

  const getAttendanceStatus = (day: number) => {
    const dateStr = getDateString(day);
    return attendanceMap[dateStr];
  };

  const getAttendanceColor = (day: number) => {
    const status = getAttendanceStatus(day);
    if (status === 'present') return Colors.success;
    if (status === 'absent') return Colors.danger;
    return Colors.lightGray;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
          <MaterialIcons name="chevron-left" size={28} color={Colors.primary} />
        </TouchableOpacity>

        <Text style={styles.monthYear}>{monthYear}</Text>

        <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
          <MaterialIcons name="chevron-right" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekDaysContainer}>
        {weekDays.map((day) => (
          <Text key={day} style={styles.weekDay}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.daysContainer}>
        {days.map((day, index) => (
          <View
            key={index}
            style={[
              styles.dayCell,
              day === null && styles.emptyCel,
              day !== null && {
                backgroundColor: getAttendanceColor(day),
              },
            ]}
          >
            {day !== null && (
              <Text
                style={[
                  styles.dayText,
                  ['present', 'absent'].includes(getAttendanceStatus(day) || '')
                    ? styles.dayTextWhite
                    : styles.dayTextDark,
                ]}
              >
                {day}
              </Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendColor, { backgroundColor: Colors.success }]}
          />
          <Text style={styles.legendText}>Present</Text>
        </View>

        <View style={styles.legendItem}>
          <View
            style={[styles.legendColor, { backgroundColor: Colors.danger }]}
          />
          <Text style={styles.legendText}>Absent</Text>
        </View>

        <View style={styles.legendItem}>
          <View
            style={[styles.legendColor, { backgroundColor: Colors.lightGray }]}
          />
          <Text style={styles.legendText}>No Mark</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  navButton: {
    padding: 8,
  },
  monthYear: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark,
  },
  weekDaysContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray,
    paddingVertical: 8,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderRadius: 8,
  },
  emptyCel: {
    backgroundColor: 'transparent',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dayTextWhite: {
    color: Colors.white,
  },
  dayTextDark: {
    color: Colors.dark,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: Colors.gray,
  },
});
