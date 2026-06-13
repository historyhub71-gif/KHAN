import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { useTheme } from '../../context/ThemeContext';
import { teacherAttendanceService } from '../../services/teacherAttendanceService';
import { TeacherAttendance } from '../../types';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  present: { label: 'Present', color: '#34C759', icon: 'check-circle' },
  late: { label: 'Late', color: '#FF9500', icon: 'schedule' },
  absent: { label: 'Absent', color: '#FF3B30', icon: 'cancel' },
};

export default function AdminTeacherAttendanceScreen() {
  const { colors } = useTheme();
  const [records, setRecords] = useState<TeacherAttendance[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const presentCount = records.filter((r) => r.status === 'present').length;
  const lateCount = records.filter((r) => r.status === 'late').length;
  const absentCount = records.filter((r) => r.status === 'absent').length;

  const fetchData = useCallback(async (date: string, isRefresh = false) => {
    try {
      if (!isRefresh) setIsLoading(true);
      const data = await teacherAttendanceService.getAllTeacherAttendance(date);
      setRecords(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load attendance records');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(selectedDate); }, [fetchData, selectedDate]));

  const onRefresh = () => { setRefreshing(true); fetchData(selectedDate, true); };

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const newDate = d.toISOString().slice(0, 10);
    setSelectedDate(newDate);
    fetchData(newDate);
  };

  const isToday = selectedDate === new Date().toISOString().slice(0, 10);

  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.headerIconBg, { backgroundColor: colors.warning + '15' }]}>
            <MaterialIcons name="access-time" size={28} color={colors.warning} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>Teacher Attendance</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Daily check-in & check-out monitor
            </Text>
          </View>
        </View>

        {/* Date Navigator */}
        <View style={[styles.dateNav, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.dateNavBtn} onPress={() => shiftDate(-1)} activeOpacity={0.7}>
            <MaterialIcons name="chevron-left" size={26} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.dateDisplay}>
            <Text style={[styles.dateText, { color: colors.text }]}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </Text>
            {isToday && (
              <View style={[styles.todayBadge, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.todayBadgeText, { color: colors.primary }]}>Today</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.dateNavBtn, isToday && styles.dateNavBtnDisabled]}
            onPress={() => !isToday && shiftDate(1)}
            activeOpacity={isToday ? 1 : 0.7}
          >
            <MaterialIcons name="chevron-right" size={26} color={isToday ? colors.border : colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Summary Row */}
        <View style={styles.summaryRow}>
          {[
            { label: 'Present', count: presentCount, color: colors.success },
            { label: 'Late', count: lateCount, color: colors.warning },
            { label: 'Absent', count: absentCount, color: colors.danger },
            { label: 'Total', count: records.length, color: colors.primary },
          ].map((s) => (
            <View key={s.label} style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.summaryCount, { color: s.color }]}>{s.count}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Records List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading records...</Text>
          </View>
        ) : records.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="event-busy" size={56} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No attendance records found for this date.
            </Text>
          </View>
        ) : (
          records.map((rec) => {
            const cfg = STATUS_CONFIG[rec.status] || STATUS_CONFIG.absent;
            return (
              <View
                key={rec.id}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: cfg.color }]}
              >
                <View style={[styles.cardStatusDot, { backgroundColor: cfg.color + '20' }]}>
                  <MaterialIcons name={cfg.icon as any} size={20} color={cfg.color} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                    {(rec as any).teacher_name || 'Teacher'}
                  </Text>
                  <View style={styles.timeRow}>
                    <View style={styles.timeBit}>
                      <MaterialIcons name="login" size={13} color={colors.textSecondary} />
                      <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                        In: {rec.check_in || '—'}
                      </Text>
                    </View>
                    <View style={styles.timeBit}>
                      <MaterialIcons name="logout" size={13} color={colors.textSecondary} />
                      <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                        Out: {rec.check_out || '—'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.statusPill, { backgroundColor: cfg.color + '15' }]}>
                  <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerIconBg: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 3 },
  subtitle: { fontSize: 13 },
  dateNav: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    borderWidth: 1, marginBottom: 16, overflow: 'hidden',
  },
  dateNavBtn: { paddingHorizontal: 10, paddingVertical: 14 },
  dateNavBtnDisabled: { opacity: 0.4 },
  dateDisplay: { flex: 1, alignItems: 'center', gap: 4 },
  dateText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  todayBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  todayBadgeText: { fontSize: 11, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1 },
  summaryCount: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  summaryLabel: { fontSize: 11, fontWeight: '600' },
  loadingContainer: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 16, fontSize: 15, textAlign: 'center', maxWidth: 260 },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 14, borderWidth: 1, borderLeftWidth: 4,
    marginBottom: 10,
  },
  cardStatusDot: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  timeRow: { flexDirection: 'row', gap: 14 },
  timeBit: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  timeText: { fontSize: 12 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusPillText: { fontSize: 12, fontWeight: '700' },
});
