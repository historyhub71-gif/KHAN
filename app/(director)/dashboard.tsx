import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../../component/common/Button';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { feeService } from '../../services/feeService';
import { pdfReportService } from '../../services/pdfReportService';
import { supabase } from '../../utils/supabase';

const Tab = createBottomTabNavigator();

// ---------------------------------------------------------------------
// 1. Home Tab Screen
// ---------------------------------------------------------------------
interface HomeTabProps {
  user: any;
  stats: {
    teachers: number;
    students: number;
    courses: number;
    interviewers: number;
    todayAttendance: number;
    pendingInterviews: number;
    pendingReviews: number;
    totalFeesCollected: number;
    pendingFees: number;
    totalAdmissionRevenue: number;
    currentMonthCollection: number;
    overdueAmount: number;
    unpaidStudentsCount: number;
    paidStudentsCount: number;
  };
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  colors: any;
}

function HomeTabScreen({ user, stats, isLoading, refreshing, onRefresh, colors }: HomeTabProps) {
  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.secondary }]}>
              <Text style={styles.avatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'D'}
              </Text>
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back,</Text>
              <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                {user?.name}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.roleBadge, { backgroundColor: colors.secondary + '15' }]}>
              <Text style={[styles.roleBadgeText, { color: colors.secondary }]}>DIRECTOR</Text>
            </View>
          </View>
        </View>

        {/* Section Title */}
        <Text style={[styles.sectionTitleLabel, { color: colors.textSecondary }]}>Financial Overview</Text>

        {/* Stats Grid: Financials */}
        <View style={styles.statsCardGrid}>
          <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.itemIconContainer, { backgroundColor: colors.success + '15' }]}>
              <MaterialIcons name="attach-money" size={24} color={colors.success} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.success }]} numberOfLines={1}>
              Rs. {(stats.totalFeesCollected || 0).toLocaleString()}
            </Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Tuition Fees Collected</Text>
          </View>

          <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.itemIconContainer, { backgroundColor: colors.secondary + '15' }]}>
              <MaterialIcons name="receipt" size={24} color={colors.secondary} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.secondary }]} numberOfLines={1}>
              Rs. {(stats.totalAdmissionRevenue || 0).toLocaleString()}
            </Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Admission Revenue</Text>
          </View>
        </View>

        <View style={styles.statsCardGrid}>
          <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.itemIconContainer, { backgroundColor: colors.success + '15' }]}>
              <MaterialIcons name="cloud-done" size={24} color={colors.success} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.success }]}>Online</Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>System Status</Text>
          </View>
        </View>

        {/* Info Card */}
        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.statusIconContainer, { backgroundColor: colors.secondary + '15' }]}>
            <MaterialIcons name="info-outline" size={22} color={colors.secondary} />
          </View>
          <View style={styles.statusTextContainer}>
            <Text style={[styles.statusTitle, { color: colors.text }]}>Director Overview</Text>
            <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
              {'Use the "Reports" tab to review institution-wide analytics, attendance rates, and financial summaries.'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// 2. Reports Tab Screen
// ---------------------------------------------------------------------
interface ReportsTabProps {
  colors: any;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  stats: {
    totalFeesCollected: number;
    pendingFees: number;
    totalAdmissionRevenue: number;
    currentMonthCollection: number;
    overdueAmount: number;
    unpaidStudentsCount: number;
    paidStudentsCount: number;
    students: number;
  };
}

function ReportsTabScreen({ colors, refreshing, onRefresh, stats }: ReportsTabProps) {
  const [globalStats, setGlobalStats] = useState({ present: 0, absent: 0, total: 0, rate: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [unpaidStudents, setUnpaidStudents] = useState<any[]>([]);

  const fetchReportData = async () => {
    try {
      setStatsLoading(true);

      const [attendanceRes, recentTxRes, unpaidRes] = await Promise.all([
        supabase.from('attendance').select('status'),
        supabase
          .from('fee_payments')
          .select('*, studentProfile:student_id(id, name, email), fee_receipts(receipt_number)')
          .eq('status', 'approved')
          .is('deleted_at', null)
          .order('payment_date', { ascending: false })
          .limit(5),
        supabase
          .from('fee_payments')
          .select('student_id, amount, due_date, profiles!student_id(id, name, email)')
          .eq('status', 'unpaid')
          .is('deleted_at', null)
          .order('due_date', { ascending: true }),
      ]);

      // Attendance
      if (attendanceRes.data && attendanceRes.data.length > 0) {
        const present = attendanceRes.data.filter((r) => r.status === 'present').length;
        const total = attendanceRes.data.length;
        const absent = total - present;
        const rate = Math.round((present / total) * 100);
        setGlobalStats({ present, absent, total, rate });
      } else {
        setGlobalStats({ present: 0, absent: 0, total: 0, rate: 0 });
      }

      // Recent transactions (last 5 paid)
      if (recentTxRes.data) {
        setRecentTransactions(
          recentTxRes.data.map((p: any) => ({
            id: p.id,
            student_name: p.studentProfile?.name || 'Unknown',
            student_email: p.studentProfile?.email || '',
            amount: Number(p.amount),
            payment_date: p.payment_date,
            payment_method: p.payment_method || 'Cash',
            receipt_number: p.fee_receipts?.receipt_number || 'N/A',
            student_id: p.student_id,
          }))
        );
      }

      // Students with unpaid fees — group by student
      if (unpaidRes.data) {
        const studentMap = new Map<string, any>();
        unpaidRes.data.forEach((p: any) => {
          const sid = p.student_id;
          if (!studentMap.has(sid)) {
            studentMap.set(sid, {
              id: sid,
              name: p.profiles?.name || 'Unknown',
              email: p.profiles?.email || '',
              total_unpaid: 0,
              earliest_due: p.due_date,
            });
          }
          const entry = studentMap.get(sid);
          entry.total_unpaid += Number(p.amount);
          if (p.due_date < entry.earliest_due) entry.earliest_due = p.due_date;
        });
        setUnpaidStudents(Array.from(studentMap.values()));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [refreshing]);

  const formatCurrency = (amt: number) => `Rs. ${Number(amt).toLocaleString()}`;

  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.tabHeader}>
          <Text style={[styles.tabTitle, { color: colors.text }]}>Financial Reports</Text>
          <Text style={[styles.tabSubtitle, { color: colors.textSecondary }]}>
            Live financial metrics and payment analytics
          </Text>
        </View>

        {statsLoading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14, fontWeight: '600' }}>
              Loading report data...
            </Text>
          </View>
        ) : (
          <>
            {/* ── Financial Summary Grid ── */}
            <Text style={[styles.sectionTitleLabel, { color: colors.textSecondary }]}>Revenue Summary</Text>

            <View style={[styles.globalRateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.globalRateLabel, { color: colors.textSecondary }]}>Total Tuition Revenue Collected</Text>
              <Text style={[styles.globalRateVal, { color: colors.success, fontSize: 30 }]}>
                {formatCurrency(stats.totalFeesCollected)}
              </Text>
            </View>

            <View style={styles.statsCardGrid}>
              <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.itemIconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <MaterialIcons name="today" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.gridItemVal, { color: colors.primary }]} numberOfLines={1}>
                  {formatCurrency(stats.currentMonthCollection)}
                </Text>
                <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>This Month</Text>
              </View>

              <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.itemIconContainer, { backgroundColor: colors.secondary + '15' }]}>
                  <MaterialIcons name="receipt" size={20} color={colors.secondary} />
                </View>
                <Text style={[styles.gridItemVal, { color: colors.secondary }]} numberOfLines={1}>
                  {formatCurrency(stats.totalAdmissionRevenue)}
                </Text>
                <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Admission Revenue</Text>
              </View>
            </View>

            <View style={styles.statsCardGrid}>
              <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.itemIconContainer, { backgroundColor: colors.warning + '15' }]}>
                  <MaterialIcons name="hourglass-empty" size={20} color={colors.warning} />
                </View>
                <Text style={[styles.gridItemVal, { color: colors.warning }]} numberOfLines={1}>
                  {formatCurrency(stats.pendingFees)}
                </Text>
                <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Total Outstanding</Text>
              </View>

              <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.itemIconContainer, { backgroundColor: colors.danger + '15' }]}>
                  <MaterialIcons name="warning" size={20} color={colors.danger} />
                </View>
                <Text style={[styles.gridItemVal, { color: colors.danger }]} numberOfLines={1}>
                  {formatCurrency(stats.overdueAmount)}
                </Text>
                <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Overdue Fees</Text>
              </View>
            </View>

            {/* ── Paid vs Unpaid Students ── */}
            <Text style={[styles.sectionTitleLabel, { color: colors.textSecondary, marginTop: 8 }]}>Student Fee Status</Text>
            <View style={styles.statsCardGrid}>
              <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.itemIconContainer, { backgroundColor: colors.success + '15' }]}>
                  <MaterialIcons name="check-circle" size={20} color={colors.success} />
                </View>
                <Text style={[styles.gridItemVal, { color: colors.success }]}>{stats.paidStudentsCount}</Text>
                <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Paid Up Students</Text>
              </View>

              <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.itemIconContainer, { backgroundColor: colors.danger + '15' }]}>
                  <MaterialIcons name="cancel" size={20} color={colors.danger} />
                </View>
                <Text style={[styles.gridItemVal, { color: colors.danger }]}>{stats.unpaidStudentsCount}</Text>
                <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Unpaid Students</Text>
              </View>
            </View>

            {/* ── Recent Transactions ── */}
            <Text style={[styles.sectionTitleLabel, { color: colors.textSecondary, marginTop: 8 }]}>Recent Transactions</Text>
            {recentTransactions.length === 0 ? (
              <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.statusIconContainer, { backgroundColor: colors.textSecondary + '15' }]}>
                  <MaterialIcons name="inbox" size={22} color={colors.textSecondary} />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={[styles.statusTitle, { color: colors.textSecondary }]}>No Payments Yet</Text>
                  <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
                    Collected payments will appear here.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {recentTransactions.map((tx) => (
                  <View
                    key={tx.id}
                    style={[styles.txCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={[styles.txAvatarBg, { backgroundColor: colors.success + '15' }]}>
                      <Text style={[styles.txAvatarText, { color: colors.success }]}>
                        {tx.student_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.txStudentName, { color: colors.text }]} numberOfLines={1}>
                        {tx.student_name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                        {tx.receipt_number} • {tx.payment_method}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                        {tx.payment_date ? new Date(tx.payment_date).toLocaleDateString() : '—'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.success }}>
                        {formatCurrency(tx.amount)}
                      </Text>
                      <View style={[styles.paidBadge, { backgroundColor: colors.success + '15' }]}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: colors.success }}>PAID</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── Students With Unpaid Fees Roster ── */}
            <Text style={[styles.sectionTitleLabel, { color: colors.textSecondary, marginTop: 20 }]}>Unpaid Fee Roster</Text>
            {unpaidStudents.length === 0 ? (
              <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.statusIconContainer, { backgroundColor: colors.success + '15' }]}>
                  <MaterialIcons name="check-circle" size={22} color={colors.success} />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={[styles.statusTitle, { color: colors.success }]}>All Fees Paid</Text>
                  <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
                    All active students are up to date with their fees.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {unpaidStudents.map((stu) => {
                  const isOverdue = stu.earliest_due && new Date(stu.earliest_due) < new Date();
                  return (
                    <View
                      key={stu.id}
                      style={[styles.txCard, { backgroundColor: colors.surface, borderColor: isOverdue ? colors.danger + '50' : colors.border }]}
                    >
                      <View style={[styles.txAvatarBg, { backgroundColor: (isOverdue ? colors.danger : colors.warning) + '15' }]}>
                        <Text style={[styles.txAvatarText, { color: isOverdue ? colors.danger : colors.warning }]}>
                          {stu.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.txStudentName, { color: colors.text }]} numberOfLines={1}>
                          {stu.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                          {stu.email}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                          Due: {stu.earliest_due || '—'}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: isOverdue ? colors.danger : colors.warning }}>
                          {formatCurrency(stu.total_unpaid)}
                        </Text>
                        <View style={[styles.paidBadge, { backgroundColor: (isOverdue ? colors.danger : colors.warning) + '15' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: isOverdue ? colors.danger : colors.warning }}>
                            {isOverdue ? 'OVERDUE' : 'UNPAID'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Attendance Section ── */}
            <Text style={[styles.sectionTitleLabel, { color: colors.textSecondary, marginTop: 20 }]}>Student Attendance</Text>
            <View style={[styles.globalRateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.globalRateLabel, { color: colors.textSecondary }]}>Global Attendance Rate</Text>
              <Text style={[styles.globalRateVal, { color: colors.primary }]}>{globalStats.rate}%</Text>
              <View style={[styles.rateProgressBarBg, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.rateProgressBarFill,
                    { width: `${globalStats.rate}%` as any, backgroundColor: colors.primary },
                  ]}
                />
              </View>
            </View>

            <View style={styles.statsCardGrid}>
              <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.itemIconContainer, { backgroundColor: colors.success + '15' }]}>
                  <MaterialIcons name="check" size={20} color={colors.success} />
                </View>
                <Text style={[styles.gridItemVal, { color: colors.success }]}>{globalStats.present}</Text>
                <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Total Presents</Text>
              </View>

              <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.itemIconContainer, { backgroundColor: colors.danger + '15' }]}>
                  <MaterialIcons name="close" size={20} color={colors.danger} />
                </View>
                <Text style={[styles.gridItemVal, { color: colors.danger }]}>{globalStats.absent}</Text>
                <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Total Absents</Text>
              </View>
            </View>

            <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 8 }]}>
              <View style={[styles.statusIconContainer, { backgroundColor: colors.success + '15' }]}>
                <MaterialIcons name="assessment" size={22} color={colors.success} />
              </View>
              <View style={styles.statusTextContainer}>
                <Text style={[styles.statusTitle, { color: colors.text }]}>Total Attendance Logs</Text>
                <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
                  The institution has registered a total of {globalStats.total} attendance records.
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// 3. Overview Tab Screen (Read-Only Management Panel)
// ---------------------------------------------------------------------
interface OverviewTabProps {
  colors: any;
  router: any;
}

function OverviewTabScreen({ colors, router }: OverviewTabProps) {
  const overviewItems = [
    {
      title: 'Fee Approvals',
      desc: 'View fee receipts and approvals',
      icon: 'monetization-on',
      route: '/(admin)/fees',
      color: colors.primary,
    },
    {
      title: 'Admission Fees',
      desc: 'View admission deals and discounts',
      icon: 'receipt',
      route: '/(admin)/admission-fees',
      color: colors.danger,
    },
  ];

  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tabHeader}>
          <Text style={[styles.tabTitle, { color: colors.text }]}>Institution Overview</Text>
          <Text style={[styles.tabSubtitle, { color: colors.textSecondary }]}>
            Read-only access to all academic and financial modules
          </Text>
        </View>

        <View style={styles.actionsGrid}>
          {overviewItems.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push(item.route)}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: item.color + '15' }]}>
                <MaterialIcons name={item.icon as any} size={28} color={item.color} />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={[styles.actionCardTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.actionCardDesc, { color: colors.textSecondary }]}>{item.desc}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// 4. Profile Tab Screen
// ---------------------------------------------------------------------
interface ProfileTabProps {
  user: any;
  colors: any;
  isDark: boolean;
  toggleTheme: () => void;
  handleLogout: () => Promise<void>;
  router: any;
}

function ProfileTabScreen({ user, colors, isDark, toggleTheme, handleLogout, router }: ProfileTabProps) {
  return (
    <ScreenContainer>
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* User Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.profileAvatar, { backgroundColor: colors.secondary }]}>
            <Text style={styles.profileAvatarText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'D'}
            </Text>
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>{user?.name}</Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
          <View style={[styles.roleLabel, { backgroundColor: colors.secondary + '15' }]}>
            <Text style={[styles.roleLabelText, { color: colors.secondary }]}>DIRECTOR</Text>
          </View>
        </View>

        {/* Settings Info Groups */}
        <Text style={[styles.profileGroupTitle, { color: colors.textSecondary }]}>System Credentials</Text>
        <View style={[styles.profileGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.profileRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.profileRowLabel, { color: colors.textSecondary }]}>Status</Text>
            <View style={[styles.badge, { backgroundColor: colors.success + '15', position: 'relative', top: 0, right: 0 }]}>
              <Text style={[styles.badgeText, { color: colors.success, fontSize: 11, fontWeight: '700' }]}>Active</Text>
            </View>
          </View>
          <View style={[styles.profileRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.profileRowLabel, { color: colors.textSecondary }]}>Director Email</Text>
            <Text style={[styles.profileRowVal, { color: colors.text }]} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={[styles.profileRowLabel, { color: colors.textSecondary }]}>Access Rights</Text>
            <Text style={[styles.profileRowVal, { color: colors.text }]}>Financial Executive</Text>
          </View>
        </View>

        <Text style={[styles.profileGroupTitle, { color: colors.textSecondary }]}>Preferences</Text>
        <View style={[styles.profileGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.profileSwitchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={colors.text} />
              <Text style={[styles.switchLabel, { color: colors.text }]}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.secondary }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        <Text style={[styles.profileGroupTitle, { color: colors.textSecondary }]}>Security</Text>
        <View style={[styles.profileGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.profileRowClickable}
            onPress={() => router.push('/reset-password')}
            activeOpacity={0.7}
          >
            <View style={styles.rowIconContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.secondary} />
              <Text style={[styles.clickableRowText, { color: colors.text }]}>Reset Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtnFull, { backgroundColor: colors.danger + '12', borderColor: colors.danger + '30' }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={[styles.logoutBtnText, { color: colors.danger }]}>Sign Out of App</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// MAIN ENTRY: Bottom Tab Navigator Controller
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// 5. Fee Collection Tab Screen
// ---------------------------------------------------------------------
interface StudentRecord {
  id: string;
  name: string;
  email: string;
  course: string;
  outstanding_balance: number;
  unpaid_payment_id?: string;
  unpaid_due_date?: string;
  is_overdue: boolean;
}

function FeeCollectionTabScreen({ colors, user }: { colors: any; user: any }) {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unpaid'>('all');

  // Form states
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'Cash' | 'Card' | 'Bank Transfer' | 'Mobile Wallet'>('Cash');
  const [notes, setNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [remainingBalanceText, setRemainingBalanceText] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success Receipt Modal
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);

  const fetchCollectionData = async () => {
    try {
      setIsLoading(true);
      const [unpaidRes, allStudentsRes, { data: studentCourses }] = await Promise.all([
        feeService.getUnpaidStudents().catch(() => []),
        adminService.getStudents().catch(() => []),
        supabase.from('course_students').select('student_id, courses(name, code)'),
      ]);

      const courseMap: Record<string, string[]> = {};
      if (studentCourses) {
        studentCourses.forEach((sc: any) => {
          if (!sc.student_id || !sc.courses) return;
          if (!courseMap[sc.student_id]) {
            courseMap[sc.student_id] = [];
          }
          courseMap[sc.student_id].push(`${sc.courses.name} (${sc.courses.code})`);
        });
      }

      const unpaidGroup: Record<string, { total: number; id?: string; due_date?: string; is_overdue: boolean }> = {};
      unpaidRes.forEach((up: any) => {
        if (!up.student_id) return;
        if (!unpaidGroup[up.student_id]) {
          unpaidGroup[up.student_id] = { total: 0, is_overdue: false };
        }
        unpaidGroup[up.student_id].total += Number(up.amount);
        if (up.payment_id) unpaidGroup[up.student_id].id = up.payment_id;
        if (up.due_date) unpaidGroup[up.student_id].due_date = up.due_date;
        if (up.is_overdue) unpaidGroup[up.student_id].is_overdue = true;
      });

      const records: StudentRecord[] = allStudentsRes.map((stu: any) => {
        const unpaidInfo = unpaidGroup[stu.id];
        return {
          id: stu.id,
          name: stu.name || 'Unknown',
          email: stu.email || '',
          course: courseMap[stu.id]?.join(', ') || 'No Course Assigned',
          outstanding_balance: unpaidInfo?.total || 0,
          unpaid_payment_id: unpaidInfo?.id,
          unpaid_due_date: unpaidInfo?.due_date,
          is_overdue: unpaidInfo?.is_overdue || false,
        };
      });

      setStudents(records);
      applyFiltersAndSearch(records, searchQuery, filterType);
    } catch (err) {
      console.error('Failed to load collection data:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCollectionData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchCollectionData();
  };

  const applyFiltersAndSearch = (
    list: StudentRecord[],
    query: string,
    filter: 'all' | 'unpaid'
  ) => {
    let result = [...list];

    if (filter === 'unpaid') {
      result = result.filter((s) => s.outstanding_balance > 0);
    }

    if (query.trim() !== '') {
      const q = query.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.course.toLowerCase().includes(q)
      );
    }

    setFilteredStudents(result);
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    applyFiltersAndSearch(students, text, filterType);
  };

  const handleFilterChange = (type: 'all' | 'unpaid') => {
    setFilterType(type);
    applyFiltersAndSearch(students, searchQuery, type);
  };

  const openCollection = (student: StudentRecord) => {
    setSelectedStudent(student);
    setAmount(student.outstanding_balance > 0 ? student.outstanding_balance.toString() : '15000');
    setMethod('Cash');
    setNotes('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setRemainingBalanceText('0');
  };

  const closeCollection = () => {
    setSelectedStudent(null);
  };

  const handleCollectSubmit = async () => {
    if (!selectedStudent || !user?.id) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount.');
      return;
    }

    const parsedRemaining = parseFloat(remainingBalanceText);
    if (isNaN(parsedRemaining) || parsedRemaining < 0) {
      Alert.alert('Validation Error', 'Please enter a valid remaining balance (>= 0).');
      return;
    }

    if (!paymentDate.trim()) {
      Alert.alert('Validation Error', 'Please enter a valid payment date.');
      return;
    }

    try {
      setIsSubmitting(true);

      const result = await feeService.collectPaymentDirectly({
        studentId: selectedStudent.id,
        paymentId: selectedStudent.unpaid_payment_id,
        amount: parsedAmount,
        paymentMethod: method,
        notes: notes.trim(),
        submittedBy: user.id,
        paymentDate: new Date(paymentDate).toISOString(),
        remainingBalance: parsedRemaining,
      });

      setSuccessReceipt({
        ...result,
        course: selectedStudent.course,
        director_name: user.name || 'Director',
        collection_date: new Date(paymentDate).toLocaleDateString(),
      });

      closeCollection();
      fetchCollectionData();
    } catch (err: any) {
      Alert.alert('Collection Error', err.message || 'Failed to record fee collection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = async () => {
    if (!successReceipt) return;
    try {
      await pdfReportService.printReceipt(successReceipt);
    } catch (err: any) {
      Alert.alert('Print Error', err.message || 'Failed to print receipt.');
    }
  };

  const handleShare = async () => {
    if (!successReceipt) return;
    try {
      await pdfReportService.shareReceiptPdf(successReceipt);
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Failed to share receipt.');
    }
  };

  const formatCurrency = (amt: number) => `Rs. ${Number(amt).toFixed(2)}`;

  return (
    <ScreenContainer>
      <View style={[styles.tabHeader, { paddingBottom: 0 }]}>
        <Text style={[styles.tabTitle, { color: colors.text }]}>Fee Collection</Text>
        <Text style={[styles.tabSubtitle, { color: colors.textSecondary }]}>
          Search students and collect monthly tuition fees directly
        </Text>
      </View>

      <View style={styles.searchFilterContainer}>
        <View style={[styles.searchBarContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInputField, { color: colors.text }]}
            placeholder="Search student, ID, course..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => handleSearchChange('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterPillsRow}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              { borderColor: colors.border, backgroundColor: colors.surface },
              filterType === 'all' && { backgroundColor: colors.secondary, borderColor: colors.secondary },
            ]}
            onPress={() => handleFilterChange('all')}
          >
            <Text style={[styles.filterPillText, { color: colors.text }, filterType === 'all' && { color: colors.white }]}>
              All Students ({students.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              { borderColor: colors.border, backgroundColor: colors.surface },
              filterType === 'unpaid' && { backgroundColor: colors.danger, borderColor: colors.danger },
            ]}
            onPress={() => handleFilterChange('unpaid')}
          >
            <Text style={[styles.filterPillText, { color: colors.text }, filterType === 'unpaid' && { color: colors.white }]}>
              Unpaid / Overdue ({students.filter((s) => s.outstanding_balance > 0).length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14, fontWeight: '600' }}>
            Loading students...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Ionicons name="search-outline" size={48} color={colors.textSecondary} style={{ marginBottom: 12 }} />
              <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>
                No students found matching filters.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.studentCollectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardAvatarCol}>
                <View style={[styles.avatarCircleSmall, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.avatarTextSmall, { color: colors.primary }]}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.studentNameText, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>
                  ID: {item.id.slice(0, 8).toUpperCase()} • {item.course}
                </Text>
                {item.outstanding_balance > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger }}>
                      Balance: {formatCurrency(item.outstanding_balance)}
                    </Text>
                    {item.is_overdue && (
                      <View style={[styles.overdueBadge, { backgroundColor: colors.danger + '12', marginTop: 0 }]}>
                        <Text style={[styles.overdueBadgeText, { color: colors.danger }]}>OVERDUE</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.success, marginTop: 6 }}>
                    ✓ Fully Paid Up
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[
                  styles.collectActionBtn,
                  { backgroundColor: item.outstanding_balance > 0 ? colors.secondary : colors.primary + '12' },
                ]}
                onPress={() => openCollection(item)}
              >
                <Text
                  style={[
                    styles.collectActionBtnText,
                    { color: item.outstanding_balance > 0 ? colors.white : colors.primary },
                  ]}
                >
                  Collect
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* COLLECTION DIALOG MODAL */}
      <Modal visible={selectedStudent !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Record Fee Payment</Text>
                <Text style={[styles.modalStudentSub, { color: colors.textSecondary }]}>
                  Student: {selectedStudent?.name} (ID: {selectedStudent?.id.slice(0, 8).toUpperCase()})
                </Text>
              </View>
              <TouchableOpacity onPress={closeCollection}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Amount Received (Rs.)</Text>
              <TextInput
                style={[styles.inputField, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholder="15000"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>Remaining Balance (Rs.)</Text>
              <TextInput
                style={[styles.inputField, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
                keyboardType="numeric"
                value={remainingBalanceText}
                onChangeText={setRemainingBalanceText}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>Payment Date</Text>
              <TextInput
                style={[styles.inputField, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
                value={paymentDate}
                onChangeText={setPaymentDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>Payment Method</Text>
              <View style={styles.methodSelector}>
                {(['Cash', 'Card', 'Bank Transfer', 'Mobile Wallet'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.methodPill,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      method === m && { backgroundColor: colors.secondary, borderColor: colors.secondary },
                    ]}
                    onPress={() => setMethod(m)}
                  >
                    <Text style={[styles.methodPillText, { color: colors.text }, method === m && { color: colors.white }]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.text }]}>Collection Notes</Text>
              <TextInput
                style={[styles.textArea, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
                multiline
                placeholder="Receipt details, references, remarks..."
                placeholderTextColor={colors.textSecondary}
                value={notes}
                onChangeText={setNotes}
              />

              <Button
                title="Record Payment (PAID)"
                onPress={handleCollectSubmit}
                loading={isSubmitting}
                style={{ backgroundColor: colors.secondary, marginTop: 16, borderRadius: 12, height: 50 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* SUCCESS RECEIPT POPUP MODAL */}
      <Modal visible={successReceipt !== null} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.successModalCard, { backgroundColor: colors.surface }]}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={[styles.successIconBg, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="checkmark-circle" size={40} color={colors.success} />
              </View>
              <Text style={[styles.successTitle, { color: colors.text }]}>Fee Collection Success!</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                The payment has been immediately marked as PAID.
              </Text>
            </View>

            <View style={[styles.receiptSummaryBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.receiptSummaryRow}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Receipt Number</Text>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>
                  {successReceipt?.receipt_number}
                </Text>
              </View>
              <View style={styles.receiptSummaryRow}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Student Name</Text>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 12 }}>
                  {successReceipt?.student_name}
                </Text>
              </View>
              <View style={styles.receiptSummaryRow}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Course</Text>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 12 }}>
                  {successReceipt?.course}
                </Text>
              </View>
              <View style={styles.receiptSummaryRow}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Amount Paid</Text>
                <Text style={{ color: colors.success, fontWeight: '800', fontSize: 14 }}>
                  {formatCurrency(successReceipt?.amount || 0)}
                </Text>
              </View>
              <View style={styles.receiptSummaryRow}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Payment Method</Text>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 12 }}>
                  {successReceipt?.payment_method}
                </Text>
              </View>
              <View style={styles.receiptSummaryRow}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Payment Date</Text>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 12 }}>
                  {successReceipt?.collection_date}
                </Text>
              </View>
              <View style={[styles.receiptSummaryRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 }]}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Remaining Balance</Text>
                <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 12 }}>
                  {formatCurrency(successReceipt?.balance_after || 0)}
                </Text>
              </View>
            </View>

            <View style={{ gap: 10, marginTop: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.receiptActionBtn, { flex: 1, borderColor: colors.primary, borderWidth: 1.5 }]}
                  onPress={handlePrint}
                >
                  <Ionicons name="print" size={18} color={colors.primary} />
                  <Text style={[styles.receiptActionBtnText, { color: colors.primary }]}>Print</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.receiptActionBtn, { flex: 1, backgroundColor: colors.primary }]}
                  onPress={handleShare}
                >
                  <Ionicons name="share-social" size={18} color={colors.white} />
                  <Text style={[styles.receiptActionBtnText, { color: colors.white }]}>Share</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.successDoneBtn, { backgroundColor: colors.border }]}
                onPress={() => setSuccessReceipt(null)}
              >
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Close & Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

export default function DirectorDashboardScreen() {
  const { user, signOut, isInitializing: authLoading } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();

  const [stats, setStats] = useState({
    teachers: 0,
    students: 0,
    courses: 0,
    interviewers: 0,
    todayAttendance: 0,
    pendingInterviews: 0,
    pendingReviews: 0,
    totalFeesCollected: 0,
    pendingFees: 0,
    totalAdmissionRevenue: 0,
    currentMonthCollection: 0,
    overdueAmount: 0,
    unpaidStudentsCount: 0,
    paidStudentsCount: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setIsLoading(true);

      const [
        feesApprovedData,
        admissionData,
        allPayments,
        allStudents,
      ] = await Promise.all([
        supabase.from('fee_payments').select('amount').eq('status', 'approved').is('deleted_at', null),
        supabase.from('admission_deals').select('final_fee').eq('payment_status', 'paid'),
        feeService.getAllFeeRecords(),
        adminService.getStudents(),
      ]);

      const totalFeesCollected = feesApprovedData.data?.reduce((acc, f) => acc + Number(f.amount), 0) || 0;
      const totalAdmissionRevenue = admissionData.data?.reduce((acc, d) => acc + Number(d.final_fee), 0) || 0;

      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      let currentMonthCollection = 0;
      let totalOutstanding = 0;
      let overdueAmount = 0;

      const studentOutstandingMap = new Map<string, number>();

      allPayments.forEach((p: any) => {
        if (p.status === 'PAID') {
          if (p.payment_date) {
            const pDate = new Date(p.payment_date);
            if (pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear) {
              currentMonthCollection += p.amount;
            }
          }
        } else if (p.status === 'UNPAID' || p.status === 'OVERDUE') {
          totalOutstanding += p.amount;
          if (p.status === 'OVERDUE') {
            overdueAmount += p.amount;
          }
          studentOutstandingMap.set(p.student_id, (studentOutstandingMap.get(p.student_id) || 0) + p.amount);
        }
      });

      let unpaidStudentsCount = 0;
      let paidStudentsCount = 0;

      allStudents.forEach((stu: any) => {
        const outstanding = studentOutstandingMap.get(stu.id) || 0;
        if (outstanding > 0) {
          unpaidStudentsCount++;
        } else {
          paidStudentsCount++;
        }
      });

      setStats({
        teachers: 0,
        students: allStudents.length,
        courses: 0,
        interviewers: 0,
        todayAttendance: 0,
        pendingInterviews: 0,
        pendingReviews: 0,
        totalFeesCollected,
        pendingFees: totalOutstanding,
        totalAdmissionRevenue,
        currentMonthCollection,
        overdueAmount,
        unpaidStudentsCount,
        paidStudentsCount,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  useEffect(() => {
    if (!user && !authLoading) {
      router.replace('/(auth)/login');
    }
  }, [user, authLoading, router]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchStats(true);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) return null;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Reports') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'Collection') {
            iconName = focused ? 'cash' : 'cash-outline';
          } else if (route.name === 'Overview') {
            iconName = focused ? 'folder-open' : 'folder-open-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return (
            <View style={styles.tabIconBg}>
              <Ionicons name={iconName} size={24} color={color} />
            </View>
          );
        },
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0,
          height: 98,
          paddingBottom: 10,
          paddingTop: 8,
          elevation: 12,
          shadowColor: colors.secondary,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: -2,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home">
        {() => (
          <HomeTabScreen
            user={user}
            stats={stats}
            isLoading={isLoading}
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={colors}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Reports">
        {() => (
          <ReportsTabScreen
            colors={colors}
            refreshing={refreshing}
            onRefresh={onRefresh}
            stats={stats}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Collection">
        {() => (
          <FeeCollectionTabScreen
            colors={colors}
            user={user}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Overview">
        {() => (
          <OverviewTabScreen
            colors={colors}
            router={router}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Profile">
        {() => (
          <ProfileTabScreen
            user={user}
            colors={colors}
            isDark={isDark}
            toggleTheme={toggleTheme}
            handleLogout={handleLogout}
            router={router}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// ---------------------------------------------------------------------
// StyleSheet — mirrors admin/teacher dashboard styles exactly
// ---------------------------------------------------------------------
const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 36,
  },
  tabIconBg: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarText: {
    color: '#dddcdcff',
    fontSize: 18,
    fontWeight: '800',
  },
  headerTextContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionTitleLabel: {
    fontSize: 15.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: 6,
    marginBottom: 12,
  },
  statsCardGrid: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 12,
  },
  statsGridItem: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  itemIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridItemVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  gridItemLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginTop: 20,
  },
  statusIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  tabHeader: {
    marginBottom: 20,
  },
  tabTitle: {
    fontSize: 26,
    fontWeight: '800',
  },
  tabSubtitle: {
    fontSize: 10,
    marginTop: 4,
  },
  globalRateCard: {
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  globalRateLabel: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  globalRateVal: {
    fontSize: 40,
    fontWeight: '900',
    marginVertical: 12,
  },
  rateProgressBarBg: {
    height: 8,
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  rateProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  actionsGrid: {
    gap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextContainer: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionCardDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  profileCard: {
    alignItems: 'center',
    padding: 0,
    borderRadius: 22,
    borderWidth: 0,
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  profileAvatar: {
    width: 42,
    height: 42,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  profileEmail: {
    fontSize: 13.5,
    marginTop: 0,
  },
  roleLabel: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 5,
  },
  roleLabelText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  profileGroupTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: 6,
    marginBottom: 8,
    marginTop: 16,
  },
  profileGroup: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
  },
  profileRowLabel: {
    fontSize: 13.5,
    fontWeight: '400',
  },
  profileRowVal: {
    fontSize: 13.5,
    fontWeight: '200',
    maxWidth: '60%',
  },
  profileSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  switchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchLabel: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  profileRowClickable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  rowIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clickableRowText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9.5,
    fontWeight: '800',
  },
  logoutBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 24,
  },
  logoutBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  // Fee Collection Styles
  searchFilterContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 12,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  searchInputField: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  studentCollectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardAvatarCol: {
    marginRight: 12,
  },
  studentNameText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  collectActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  collectActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  successModalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    elevation: 8,
  },
  successIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  receiptSummaryBlock: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
    gap: 8,
  },
  receiptSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: 12,
  },
  receiptActionBtnText: {
    fontSize: 14,
    fontWeight: '900',
  },
  successDoneBtn: {
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircleSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextSmall: {
    fontSize: 16,
    fontWeight: '700',
  },
  overdueBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  overdueBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalStudentSub: {
    fontSize: 13,
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inputField: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  methodSelector: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  methodPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  methodPillText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  textArea: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingTop: 10,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  txAvatarBg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txAvatarText: {
    fontSize: 17,
    fontWeight: '800',
  },
  txStudentName: {
    fontSize: 14,
    fontWeight: '700',
  },
  paidBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
});

