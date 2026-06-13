import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { teacherAttendanceService } from '../../services/teacherAttendanceService';
import { TeacherAttendance } from '../../types';

export default function TeacherAttendanceScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  // State
  const [todayRecord, setTodayRecord] = useState<TeacherAttendance | null>(null);
  const [history, setHistory] = useState<TeacherAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Digital clock effect
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      if (!user?.id) return;

      const [todayRec, hist] = await Promise.all([
        teacherAttendanceService.getTodayRecord(user.id),
        teacherAttendanceService.getHistory(user.id),
      ]);

      setTodayRecord(todayRec);
      setHistory(hist);
    } catch (err) {
      console.error('Failed to load teacher attendance details:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleCheckIn = async () => {
    if (!user?.id) return;
    try {
      setIsLoading(true);
      const record = await teacherAttendanceService.checkIn(user.id);
      Alert.alert(
        'Check-In Successful',
        `Checked in at ${record.check_in}. Status: ${record.status === 'late' ? 'Late Arrival' : 'On Time'}`
      );
      fetchData();
    } catch (err: any) {
      Alert.alert('Check-In Error', err.message || 'Failed to check in. Note that check-ins are limited to once per day.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!user?.id || !todayRecord) return;
    try {
      setIsLoading(true);
      await teacherAttendanceService.checkOut(user.id, todayRecord.id);
      Alert.alert('Check-Out Successful', 'You have checked out for the day.');
      fetchData();
    } catch (err: any) {
      Alert.alert('Check-Out Error', err.message || 'Failed to check out.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: TeacherAttendance['status']) => {
    switch (status) {
      case 'present': return colors.success;
      case 'late': return colors.warning;
      case 'absent': return colors.danger;
      default: return colors.textSecondary;
    }
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '--:--';
    // Remove seconds if present
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return timeStr;
  };

  const isLateCheckIn = () => {
    const now = new Date();
    return now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 0);
  };

  return (
    <ScreenContainer>
      {isLoading && history.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14, fontWeight: '600' }}>
            Loading attendance system...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={[styles.scrollContainer, { backgroundColor: colors.background }]}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: 40 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Calendar Header */}
          <View style={styles.calendarHeader}>
            <Text style={[styles.dayText, { color: colors.textSecondary }]}>
              {currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={[styles.timeText, { color: colors.text }]}>
              {currentTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
          </View>

          {/* Action Card (Check In / Check Out) */}
          <View style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {!todayRecord ? (
              // Check In View
              <View style={styles.centerCol}>
                <TouchableOpacity
                  style={[styles.circleBtn, { backgroundColor: colors.primary }]}
                  onPress={handleCheckIn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="enter-outline" size={48} color={colors.white} />
                  <Text style={styles.circleBtnText}>Check In</Text>
                </TouchableOpacity>
                <Text style={[styles.checkInLimit, { color: colors.textSecondary }]}>
                  Arrival deadline: <Text style={{ fontWeight: '700', color: colors.text }}>09:00 AM</Text>
                </Text>
                <View style={[styles.warningAlert, { backgroundColor: isLateCheckIn() ? colors.warning + '12' : colors.success + '12' }]}>
                  <Ionicons
                    name={isLateCheckIn() ? "warning-outline" : "checkmark-circle-outline"}
                    size={14}
                    color={isLateCheckIn() ? colors.warning : colors.success}
                  />
                  <Text style={[styles.warningAlertText, { color: isLateCheckIn() ? colors.warning : colors.success }]}>
                    {isLateCheckIn() ? 'Checking in now will mark you LATE' : 'On-time check-in active'}
                  </Text>
                </View>
              </View>
            ) : !todayRecord.check_out ? (
              // Check Out View
              <View style={styles.centerCol}>
                <TouchableOpacity
                  style={[styles.circleBtn, { backgroundColor: colors.warning }]}
                  onPress={handleCheckOut}
                  activeOpacity={0.8}
                >
                  <Ionicons name="exit-outline" size={48} color={colors.white} />
                  <Text style={styles.circleBtnText}>Check Out</Text>
                </TouchableOpacity>
                <View style={styles.statsRow}>
                  <View style={styles.statCell}>
                    <Text style={[styles.statCellLabel, { color: colors.textSecondary }]}>Check In</Text>
                    <Text style={[styles.statCellVal, { color: colors.text }]}>{formatTime(todayRecord.check_in)}</Text>
                  </View>
                  <View style={styles.statCellDivider} />
                  <View style={styles.statCell}>
                    <Text style={[styles.statCellLabel, { color: colors.textSecondary }]}>Status</Text>
                    <Text style={[styles.statCellVal, { color: getStatusColor(todayRecord.status), fontWeight: '800' }]}>
                      {todayRecord.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              // Completed View
              <View style={styles.centerCol}>
                <View style={[styles.successCircle, { backgroundColor: colors.success }]}>
                  <Ionicons name="checkmark-done" size={48} color={colors.white} />
                </View>
                <Text style={[styles.successTitle, { color: colors.text }]}>Attendance Complete</Text>
                <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
                  You are all set for today!
                </Text>
                <View style={styles.statsRow}>
                  <View style={styles.statCell}>
                    <Text style={[styles.statCellLabel, { color: colors.textSecondary }]}>Check In</Text>
                    <Text style={[styles.statCellVal, { color: colors.text }]}>{formatTime(todayRecord.check_in)}</Text>
                  </View>
                  <View style={styles.statCellDivider} />
                  <View style={styles.statCell}>
                    <Text style={[styles.statCellLabel, { color: colors.textSecondary }]}>Check Out</Text>
                    <Text style={[styles.statCellVal, { color: colors.text }]}>{formatTime(todayRecord.check_out)}</Text>
                  </View>
                  <View style={styles.statCellDivider} />
                  <View style={styles.statCell}>
                    <Text style={[styles.statCellLabel, { color: colors.textSecondary }]}>Status</Text>
                    <Text style={[styles.statCellVal, { color: getStatusColor(todayRecord.status), fontWeight: '800' }]}>
                      {todayRecord.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Section: History Logs */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Attendance Logs History</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Chronological log of your daily check-ins
            </Text>
          </View>

          {history.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="calendar-outline" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No check-in history logged on your profile yet.
              </Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {history.map((item) => (
                <View
                  key={item.id}
                  style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.historyRow}>
                    <View>
                      <Text style={[styles.historyDate, { color: colors.text }]}>
                        {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                      <Text style={[styles.historyTimes, { color: colors.textSecondary }]}>
                        In: {formatTime(item.check_in)} | Out: {formatTime(item.check_out)}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
                      <Text style={[styles.statusBadgeText, { color: getStatusColor(item.status) }]}>
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  calendarHeader: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 32,
    fontWeight: '900',
    marginTop: 4,
  },
  actionCard: {
    padding: 28,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 28,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  centerCol: {
    alignItems: 'center',
    width: '100%',
  },
  circleBtn: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    marginBottom: 16,
  },
  circleBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 6,
  },
  checkInLimit: {
    fontSize: 12.5,
    marginBottom: 10,
  },
  warningAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginTop: 4,
  },
  warningAlertText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 16,
  },
  statCell: {
    alignItems: 'center',
    flex: 1,
  },
  statCellLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statCellVal: {
    fontSize: 14.5,
    fontWeight: '700',
    marginTop: 4,
  },
  statCellDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#cbd5e1',
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  successSubtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
  },
  sectionHeader: {
    marginBottom: 16,
    paddingLeft: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyBox: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  historyList: {
    gap: 12,
  },
  historyCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyDate: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  historyTimes: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
});
