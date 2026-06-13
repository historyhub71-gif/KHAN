import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { feeService } from '../../services/feeService';
import { pdfReportService } from '../../services/pdfReportService';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type TabKey = 'all' | 'PAID' | 'UNPAID' | 'OVERDUE';
type DateFilterKey = 'all' | 'today' | 'month';

export default function AdminFeesScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();

  // State
  const [records, setRecords] = useState<any[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterKey>('all');

  // Modal State
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setIsLoading(true);
      const data = await feeService.getAllFeeRecords();
      setRecords(data);
      applyFilters(data, searchQuery, activeTab, dateFilter);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load fee records');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, activeTab, dateFilter]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const applyFilters = (
    allData: any[],
    query: string,
    tab: TabKey,
    dateRange: DateFilterKey
  ) => {
    let result = [...allData];

    // Status Tab Filter
    if (tab !== 'all') {
      result = result.filter((r) => r.status === tab);
    }

    // Date Range Filter
    const todayStr = new Date().toDateString();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    if (dateRange === 'today') {
      result = result.filter((r) => {
        if (!r.payment_date) return false;
        return new Date(r.payment_date).toDateString() === todayStr;
      });
    } else if (dateRange === 'month') {
      result = result.filter((r) => {
        if (!r.payment_date) return false;
        const d = new Date(r.payment_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
    }

    // Search Query Filter
    if (query.trim() !== '') {
      const q = query.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.student_name.toLowerCase().includes(q) ||
          r.student_id.toLowerCase().includes(q) ||
          r.course.toLowerCase().includes(q) ||
          r.receipt_number.toLowerCase().includes(q) ||
          r.director_name.toLowerCase().includes(q)
      );
    }

    setFilteredRecords(result);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    applyFilters(records, text, activeTab, dateFilter);
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    applyFilters(records, searchQuery, tab, dateFilter);
  };

  const handleDateFilterChange = (range: DateFilterKey) => {
    setDateFilter(range);
    applyFilters(records, searchQuery, activeTab, range);
  };

  // Receipt printing and sharing
  const handlePrint = async (record: any) => {
    try {
      await pdfReportService.printReceipt(record);
    } catch (err: any) {
      Alert.alert('Print Error', err.message || 'Failed to print receipt.');
    }
  };

  const handleShare = async (record: any) => {
    try {
      await pdfReportService.shareReceiptPdf(record);
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Failed to share receipt.');
    }
  };

  const handleDownload = async (record: any) => {
    try {
      await pdfReportService.downloadPdf(record);
      Alert.alert('Success', 'Receipt PDF downloaded successfully.');
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Failed to download receipt.');
    }
  };

  // Export report of filtered transactions
  const handleExportReport = async () => {
    try {
      if (filteredRecords.length === 0) {
        Alert.alert('No Data', 'There are no records to export.');
        return;
      }

      const rowsHtml = filteredRecords
        .map((r, index) => {
          return `
          <tr>
            <td>${index + 1}</td>
            <td>${r.student_name}<br/><span style="color:#6c757d;font-size:10px;">ID: ${r.student_id.slice(0, 8).toUpperCase()}</span></td>
            <td>${r.course}</td>
            <td>${r.receipt_number}</td>
            <td>Rs. ${r.amount.toFixed(2)}</td>
            <td>${r.payment_method}</td>
            <td>${r.collection_date}</td>
            <td>${r.director_name}</td>
            <td><span style="font-weight:700;color:${r.status === 'PAID' ? '#34C759' : r.status === 'OVERDUE' ? '#FF3B30' : '#FF9500'}">${r.status}</span></td>
          </tr>
        `;
        })
        .join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: -apple-system, sans-serif; color: #1c1c1e; padding: 20px; font-size: 11px; }
            h1 { color: #007AFF; font-size: 20px; margin-bottom: 5px; }
            p.sub { color: #6c757d; margin: 0 0 20px; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #007AFF; color: #ffffff; padding: 8px; text-align: left; font-weight: bold; }
            td { padding: 8px; border-bottom: 1px solid #e9ecef; }
            tr:nth-child(even) td { background-color: #f8f9fa; }
            .summary { display: flex; justify-content: flex-end; margin-top: 20px; font-size: 13px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Fee Collections Report</h1>
          <p class="sub">Generated on ${new Date().toLocaleString()} · Filter: Tab: ${activeTab.toUpperCase()}, Date: ${dateFilter.toUpperCase()}</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Student</th>
                <th>Course</th>
                <th>Receipt</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Date</th>
                <th>Director</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="summary">
            Total Records: ${filteredRecords.length} | Sum: Rs. ${filteredRecords.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
          </div>
        </body>
        </html>
      `;

      await Print.printAsync({ html });
    } catch (err: any) {
      Alert.alert('Export Error', err.message || 'Failed to export report.');
    }
  };

  // Calculations for metrics
  const paidRecords = records.filter((r) => r.status === 'PAID');
  const unpaidRecords = records.filter((r) => r.status === 'UNPAID');
  const overdueRecords = records.filter((r) => r.status === 'OVERDUE');

  // Today's collections
  const todayStr = new Date().toDateString();
  const todayCollections = paidRecords
    .filter((r) => r.payment_date && new Date(r.payment_date).toDateString() === todayStr)
    .reduce((sum, r) => sum + r.amount, 0);

  // Monthly revenue
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyRevenue = paidRecords
    .filter((r) => {
      if (!r.payment_date) return false;
      const d = new Date(r.payment_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, r) => sum + r.amount, 0);

  // Director-wise collections calculation
  const directorSummaryMap: Record<string, number> = {};
  paidRecords.forEach((r) => {
    if (!r.director_name || r.director_name === 'N/A') return;
    directorSummaryMap[r.director_name] = (directorSummaryMap[r.director_name] || 0) + r.amount;
  });

  const directorSummaries = Object.keys(directorSummaryMap).map((name) => ({
    name,
    amount: directorSummaryMap[name],
  }));

  const formatCurrency = (amount: number) => `Rs. ${Number(amount).toFixed(2)}`;

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
          <View style={[styles.headerIconBg, { backgroundColor: colors.success + '15' }]}>
            <MaterialIcons name="monetization-on" size={28} color={colors.success} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>Fee Records Dashboard</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Monitor tuition revenue, collections, and track student fee receipts
            </Text>
          </View>
        </View>

        {/* Top Analytics Summary Cards */}
        <Text style={[styles.sectionTitleLabel, { color: colors.textSecondary }]}>Financial Summaries</Text>
        <View style={styles.statsCardGrid}>
          <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.itemIconContainer, { backgroundColor: colors.success + '15' }]}>
              <MaterialIcons name="attach-money" size={20} color={colors.success} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.success }]}>
              {formatCurrency(monthlyRevenue)}
            </Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Monthly Revenue</Text>
          </View>

          <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.itemIconContainer, { backgroundColor: colors.primary + '15' }]}>
              <MaterialIcons name="today" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.primary }]}>
              {formatCurrency(todayCollections)}
            </Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Today's Collections</Text>
          </View>
        </View>

        <View style={styles.statsCardGrid}>
          <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.itemIconContainer, { backgroundColor: colors.warning + '15' }]}>
              <MaterialIcons name="hourglass-empty" size={20} color={colors.warning} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.warning }]}>
              {unpaidRecords.length} Invoices
            </Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Unpaid Invoices</Text>
          </View>

          <View style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.itemIconContainer, { backgroundColor: colors.danger + '15' }]}>
              <MaterialIcons name="warning" size={20} color={colors.danger} />
            </View>
            <Text style={[styles.gridItemVal, { color: colors.danger }]}>
              {overdueRecords.length} Students
            </Text>
            <Text style={[styles.gridItemLabel, { color: colors.textSecondary }]}>Overdue Accounts</Text>
          </View>
        </View>

        {/* Director-wise collections log summary */}
        {directorSummaries.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.sectionTitleLabel, { color: colors.textSecondary }]}>Director-wise Collections</Text>
            <View style={[styles.directorBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {directorSummaries.map((dir, idx) => (
                <View
                  key={dir.name}
                  style={[
                    styles.directorRow,
                    idx < directorSummaries.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="person-circle-outline" size={20} color={colors.secondary} />
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{dir.name}</Text>
                  </View>
                  <Text style={{ color: colors.success, fontWeight: '700', fontSize: 13 }}>
                    {formatCurrency(dir.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Search & Date filters */}
        <View style={{ marginTop: 20, gap: 10 }}>
          <View style={[styles.searchBarContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInputField, { color: colors.text }]}
              placeholder="Search student, course, receipt, director..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Date range switcher */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(['all', 'today', 'month'] as const).map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.filterPill,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  dateFilter === range && { backgroundColor: colors.secondary, borderColor: colors.secondary },
                ]}
                onPress={() => handleDateFilterChange(range)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: colors.text },
                    dateFilter === range && { color: colors.white },
                  ]}
                >
                  {range === 'all' ? 'All Time' : range === 'today' ? "Today" : "This Month"}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Export Reports Button */}
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
              onPress={handleExportReport}
            >
              <MaterialIcons name="picture-as-pdf" size={15} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>Export</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 16 }]}>
          {(['all', 'PAID', 'UNPAID', 'OVERDUE'] as const).map((t) => {
            const isActive = activeTab === t;
            let tabColor = colors.primary;
            if (t === 'PAID') tabColor = colors.success;
            if (t === 'OVERDUE') tabColor = colors.danger;
            if (t === 'UNPAID') tabColor = colors.warning;

            return (
              <TouchableOpacity
                key={t}
                style={[
                  styles.tabBtn,
                  isActive && { borderBottomColor: tabColor, borderBottomWidth: 2.5 },
                ]}
                onPress={() => handleTabChange(t)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabBtnText, { color: isActive ? tabColor : colors.textSecondary }]}>
                  {t === 'all' ? 'All' : t}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content list */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading fee records...</Text>
          </View>
        ) : filteredRecords.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="search-off" size={56} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No fee records match the current filters.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filteredRecords.map((item) => {
              let statusColor = colors.success;
              if (item.status === 'OVERDUE') statusColor = colors.danger;
              if (item.status === 'UNPAID') statusColor = colors.warning;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setSelectedRecord(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.cardAvatar,
                        {
                          backgroundColor:
                            (item.status === 'PAID'
                              ? colors.success
                              : item.status === 'OVERDUE'
                              ? colors.danger
                              : colors.warning) + '15',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.cardAvatarText,
                          {
                            color:
                              item.status === 'PAID'
                                ? colors.success
                                : item.status === 'OVERDUE'
                                ? colors.danger
                                : colors.warning,
                          },
                        ]}
                      >
                        {item.student_name ? item.student_name.charAt(0).toUpperCase() : 'S'}
                      </Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                        {item.student_name}
                      </Text>
                      <Text style={[styles.cardMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                        ID: {item.student_id.slice(0, 8).toUpperCase()} • {item.course}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 }}>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '12' }]}>
                          <Text style={[styles.statusBadgeText, { color: statusColor }]}>{item.status}</Text>
                        </View>
                        {item.receipt_number !== 'N/A' && (
                          <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '500' }}>
                            {item.receipt_number}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.cardAmount, { color: item.status === 'PAID' ? colors.success : colors.text }]}>
                        {formatCurrency(item.amount)}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 4 }}>
                        {item.status === 'PAID' ? `By: ${item.director_name}` : `Due: ${item.due_date}`}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* RECORD DETAILS MODAL */}
      <Modal transparent visible={selectedRecord !== null} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Fee Record Details</Text>
              <TouchableOpacity onPress={() => setSelectedRecord(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedRecord && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Student Name</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedRecord.student_name}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Student ID</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedRecord.student_id}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Student Email</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedRecord.student_email}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Course Enrolled</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedRecord.course}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Due Date</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedRecord.due_date}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Amount</Text>
                  <Text style={[styles.detailValue, { color: colors.text, fontWeight: '700' }]}>
                    {formatCurrency(selectedRecord.amount)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Outstanding Balance</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      { color: selectedRecord.remaining_balance > 0 ? colors.danger : colors.success, fontWeight: '700' },
                    ]}
                  >
                    {formatCurrency(selectedRecord.remaining_balance)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Status</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          (selectedRecord.status === 'PAID'
                            ? colors.success
                            : selectedRecord.status === 'OVERDUE'
                            ? colors.danger
                            : colors.warning) + '15',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color:
                            selectedRecord.status === 'PAID'
                              ? colors.success
                              : selectedRecord.status === 'OVERDUE'
                              ? colors.danger
                              : colors.warning,
                        },
                      ]}
                    >
                      {selectedRecord.status}
                    </Text>
                  </View>
                </View>

                {selectedRecord.status === 'PAID' && (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Receipt Number</Text>
                      <Text style={[styles.detailValue, { color: colors.secondary, fontWeight: '800' }]}>
                        {selectedRecord.receipt_number}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Payment Method</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{selectedRecord.payment_method}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Collection Date</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {selectedRecord.payment_date ? new Date(selectedRecord.payment_date).toLocaleString() : '—'}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Collected By (Director)</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{selectedRecord.director_name}</Text>
                    </View>

                    {selectedRecord.balance_before !== undefined && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Balance Before Payment</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>
                          {formatCurrency(selectedRecord.balance_before)}
                        </Text>
                      </View>
                    )}

                    {selectedRecord.balance_after !== undefined && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Balance After Payment</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>
                          {formatCurrency(selectedRecord.balance_after)}
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {selectedRecord.notes ? (
                  <View style={[styles.detailRow, { flexDirection: 'column', alignItems: 'flex-start', gap: 6 }]}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Notes</Text>
                    <Text style={[styles.detailValue, { color: colors.text, fontStyle: 'italic', textAlign: 'left', width: '100%' }]}>
                      {selectedRecord.notes}
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
            )}

            {/* Receipt Actions for Paid records */}
            {selectedRecord && selectedRecord.status === 'PAID' ? (
              <View style={{ gap: 8, marginTop: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { flex: 1, borderColor: colors.primary, borderWidth: 1.5 }]}
                    onPress={() => handlePrint(selectedRecord)}
                  >
                    <Ionicons name="print" size={16} color={colors.primary} />
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>Print</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { flex: 1, backgroundColor: colors.primary }]}
                    onPress={() => handleShare(selectedRecord)}
                  >
                    <Ionicons name="share-social" size={16} color="#fff" />
                    <Text style={[styles.actionBtnText, { color: '#fff' }]}>Share</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.success }]}
                  onPress={() => handleDownload(selectedRecord)}
                >
                  <Ionicons name="download" size={16} color="#fff" />
                  <Text style={[styles.actionBtnText, { color: '#fff' }]}>Download PDF</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: colors.border }]}
                onPress={() => setSelectedRecord(null)}
              >
                <Text style={[styles.closeBtnText, { color: colors.text }]}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerIconBg: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 3 },
  subtitle: { fontSize: 12.5, lineHeight: 17 },
  sectionTitleLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700', marginBottom: 10, marginTop: 10 },
  statsCardGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statsGridItem: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 14, gap: 4 },
  itemIconContainer: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  gridItemVal: { fontSize: 16, fontWeight: '800' },
  gridItemLabel: { fontSize: 11, fontWeight: '600' },
  directorBlock: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  directorRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, alignItems: 'center' },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 48, borderRadius: 12, borderWidth: 1.5 },
  searchInputField: { flex: 1, fontSize: 14, height: '100%' },
  filterPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, justifyContent: 'center' },
  filterPillText: { fontSize: 11.5, fontWeight: '700' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1.5, justifyContent: 'center' },
  tabBar: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', borderWidth: 1, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnText: { fontSize: 12, fontWeight: '700' },
  loadingContainer: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 14, textAlign: 'center' },
  card: { borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  cardAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardAvatarText: { fontSize: 16, fontWeight: '700' },
  cardInfo: { flex: 1, marginRight: 8 },
  cardName: { fontSize: 14.5, fontWeight: '700', marginBottom: 2 },
  cardMeta: { fontSize: 11.5 },
  cardAmount: { fontSize: 16, fontWeight: '800' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 6 },
  statusBadgeText: { fontSize: 9.5, fontWeight: '800' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '90%', borderRadius: 24, padding: 22, elevation: 8 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f3f5', alignItems: 'center' },
  detailLabel: { fontSize: 12, fontWeight: '600' },
  detailValue: { fontSize: 13, fontWeight: '700', textAlign: 'right' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 12 },
  actionBtnText: { fontWeight: '700', fontSize: 14 },
  closeBtn: { height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  closeBtnText: { fontWeight: '700', fontSize: 15 },
});
