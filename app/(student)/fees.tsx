import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { feeService } from '../../services/feeService';
import { FeePayment } from '../../types';

export default function StudentFeesScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      if (!user?.id) return;
      setIsLoading(true);

      const [paymentLogs, reminderLogs] = await Promise.all([
        feeService.getStudentPayments(user.id),
        feeService.getReminderHistory(user.id),
      ]);

      setPayments(paymentLogs);
      setReminders(reminderLogs);
    } catch (err) {
      console.error('Failed to load student fee details:', err);
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

  const getStatusStyle = (status: FeePayment['status']) => {
    switch (status) {
      case 'approved':
        return { bg: colors.success + '15', text: colors.success, icon: 'checkmark-circle-outline' as const };
      case 'pending':
        return { bg: colors.warning + '15', text: colors.warning, icon: 'time-outline' as const };
      case 'rejected':
        return { bg: colors.danger + '15', text: colors.danger, icon: 'close-circle-outline' as const };
      default:
        return { bg: colors.textSecondary + '15', text: colors.textSecondary, icon: 'wallet-outline' as const };
    }
  };

  // Calculate unpaid totals
  const unpaidPayments = payments.filter((p) => p.status === 'unpaid');
  const pendingPayments = payments.filter((p) => p.status === 'pending');
  const outstandingAmount = unpaidPayments.reduce((acc, p) => acc + Number(p.amount), 0);

  return (
    <ScreenContainer>
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14, fontWeight: '600' }}>
            Loading fee accounts...
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
          {/* Outstanding Balance Card */}
          <View style={[styles.balanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.balanceIconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="card" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.balanceTitle, { color: colors.textSecondary }]}>Outstanding Tuition Fee</Text>
            <Text style={[styles.balanceAmount, { color: colors.text }]}>
              Rs. {outstandingAmount.toFixed(2)}
            </Text>
            {unpaidPayments.length > 0 ? (
              <View style={[styles.dueLabelContainer, { backgroundColor: colors.danger + '12' }]}>
                <Ionicons name="warning-outline" size={14} color={colors.danger} />
                <Text style={[styles.dueLabelText, { color: colors.danger }]}>
                  {unpaidPayments.length} payment(s) outstanding. Due date: {unpaidPayments[0].due_date}
                </Text>
              </View>
            ) : pendingPayments.length > 0 ? (
              <View style={[styles.dueLabelContainer, { backgroundColor: colors.warning + '12' }]}>
                <Ionicons name="time-outline" size={14} color={colors.warning} />
                <Text style={[styles.dueLabelText, { color: colors.warning }]}>
                  Fee submission is pending admin approval.
                </Text>
              </View>
            ) : (
              <View style={[styles.dueLabelContainer, { backgroundColor: colors.success + '12' }]}>
                <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
                <Text style={[styles.dueLabelText, { color: colors.success }]}>
                  Your account is fully paid up. Thank you!
                </Text>
              </View>
            )}
          </View>

          {/* Section: Payment Ledger */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Ledger</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Tuition fee invoices and payment status history
            </Text>
          </View>

          {payments.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="receipt-outline" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No fee records logged on your profile yet.
              </Text>
            </View>
          ) : (
            <View style={styles.ledgerList}>
              {payments.map((payment) => {
                const statusInfo = getStatusStyle(payment.status);
                return (
                  <View
                    key={payment.id}
                    style={[styles.ledgerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={styles.ledgerRow}>
                      <View>
                        <Text style={[styles.ledgerAmount, { color: colors.text }]}>
                          Rs. {Number(payment.amount).toFixed(2)}
                        </Text>
                        <Text style={[styles.ledgerDueDate, { color: colors.textSecondary }]}>
                          Due Date: {payment.due_date}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                        <Ionicons name={statusInfo.icon} size={14} color={statusInfo.text} style={{ marginRight: 4 }} />
                        <Text style={[styles.statusBadgeText, { color: statusInfo.text }]}>
                          {payment.status === 'approved' ? 'PAID' : payment.status}
                        </Text>
                      </View>
                    </View>

                    {payment.status === 'approved' && payment.receipt_number && (
                      <View style={[styles.receiptBlock, { borderTopColor: colors.border }]}>
                        <Ionicons name="document-text-outline" size={16} color={colors.success} style={{ marginRight: 6 }} />
                        <Text style={[styles.receiptText, { color: colors.text }]}>
                          Receipt Code: <Text style={{ fontWeight: '700' }}>{payment.receipt_number}</Text>
                        </Text>
                      </View>
                    )}

                    {payment.status === 'rejected' && payment.rejection_reason && (
                      <View style={[styles.rejectionBlock, { borderTopColor: colors.border, backgroundColor: colors.danger + '06' }]}>
                        <Ionicons name="alert-circle-outline" size={16} color={colors.danger} style={{ marginRight: 6 }} />
                        <Text style={[styles.rejectionText, { color: colors.danger }]}>
                          Rejection Reason: {payment.rejection_reason}
                        </Text>
                      </View>
                    )}

                    {payment.payment_method && payment.payment_method !== 'None' && (
                      <Text style={[styles.methodText, { color: colors.textSecondary }]}>
                        Method: {payment.payment_method} {payment.payment_date ? `(${new Date(payment.payment_date).toLocaleDateString()})` : ''}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Section: Reminders History */}
          <View style={[styles.sectionHeader, { marginTop: 28 }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Fee Alert History</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Logs of historical fee reminders sent to this profile
            </Text>
          </View>

          {reminders.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="notifications-outline" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No fee alerts or payment reminders received.
              </Text>
            </View>
          ) : (
            <View style={styles.remindersList}>
              {reminders.map((reminder) => (
                <View
                  key={reminder.id}
                  style={[styles.reminderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.reminderHeader}>
                    <View style={[
                      styles.reminderTypeIcon,
                      { backgroundColor: reminder.notification_type === 'Fee Overdue Reminder' ? colors.danger + '15' : colors.primary + '15' }
                    ]}>
                      <Ionicons
                        name={reminder.notification_type === 'Fee Overdue Reminder' ? 'warning' : 'calendar'}
                        size={16}
                        color={reminder.notification_type === 'Fee Overdue Reminder' ? colors.danger : colors.primary}
                      />
                    </View>
                    <Text style={[styles.reminderDate, { color: colors.textSecondary }]}>
                      {new Date(reminder.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={[styles.reminderTitle, { color: colors.text }]}>
                    {reminder.title}
                  </Text>
                  <Text style={[styles.reminderMessage, { color: colors.textSecondary }]}>
                    {reminder.message}
                  </Text>
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
  balanceCard: {
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  balanceIconContainer: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  balanceTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '900',
    marginVertical: 8,
  },
  dueLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginTop: 4,
  },
  dueLabelText: {
    fontSize: 11.5,
    fontWeight: '700',
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
    marginTop: 8,
    fontWeight: '500',
  },
  ledgerList: {
    gap: 12,
  },
  ledgerCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ledgerAmount: {
    fontSize: 20,
    fontWeight: '800',
  },
  ledgerDueDate: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  receiptBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 10,
  },
  receiptText: {
    fontSize: 12.5,
  },
  rejectionBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  rejectionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  methodText: {
    fontSize: 11.5,
    marginTop: 6,
    fontWeight: '500',
  },
  remindersList: {
    gap: 12,
  },
  reminderCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reminderTypeIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderDate: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  reminderTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  reminderMessage: {
    fontSize: 12.5,
    lineHeight: 18,
  },
});
