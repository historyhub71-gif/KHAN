import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { adminService } from '../../services/adminService';
import { salaryService } from '../../services/salaryService';
import { Profile } from '../../types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface SalaryResult {
  teacherId: string;
  teacherName: string;
  baseSalary: number;
  workingDays: number;
  actualAbsences: number;
  totalLates: number;
  effectiveAbsences: number;
  deductionAmount: number;
  finalSalary: number;
}

export default function AdminSalariesScreen() {
  const { colors } = useTheme();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [salaryResults, setSalaryResults] = useState<SalaryResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settingModal, setSettingModal] = useState<{ visible: boolean; teacher: Profile | null }>({
    visible: false, teacher: null,
  });
  const [salaryInput, setSalaryInput] = useState('');
  const [workingDaysInput, setWorkingDaysInput] = useState('22');

  const fetchTeachers = useCallback(async () => {
    try {
      const data = await adminService.getTeachers();
      setTeachers(data.filter((t) => t.approved === true));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load teachers');
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchTeachers(); }, [fetchTeachers]));

  const onRefresh = () => { setRefreshing(true); fetchTeachers().finally(() => setRefreshing(false)); };

  const calculateAll = async () => {
    if (teachers.length === 0) {
      Alert.alert('No Teachers', 'There are no approved teachers to calculate salaries for.');
      return;
    }
    try {
      setIsLoading(true);
      const results: SalaryResult[] = [];
      for (const teacher of teachers) {
        const calc = await salaryService.calculateMonthlySalary(teacher.id, selectedMonth, selectedYear);
        results.push({
          teacherId: teacher.id,
          teacherName: teacher.name || 'Teacher',
          ...calc,
        });
      }
      setSalaryResults(results);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to calculate salaries');
    } finally {
      setIsLoading(false);
    }
  };

  const saveReport = async (result: SalaryResult) => {
    Alert.alert(
      'Save Report',
      `Save the salary deduction report for ${result.teacherName} for ${MONTHS[selectedMonth - 1]} ${selectedYear}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            try {
              await salaryService.saveDeductionReport({
                teacherId: result.teacherId,
                month: selectedMonth,
                year: selectedYear,
                baseSalary: result.baseSalary,
                workingDays: result.workingDays,
                actualAbsences: result.actualAbsences,
                totalLates: result.totalLates,
                effectiveAbsences: result.effectiveAbsences,
                deductionAmount: result.deductionAmount,
                finalSalary: result.finalSalary,
              });
              Alert.alert('Saved', 'Salary deduction report has been saved.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to save report');
            }
          },
        },
      ]
    );
  };

  const handleSetSalary = async () => {
    const salary = parseFloat(salaryInput);
    const workDays = parseInt(workingDaysInput, 10);
    if (isNaN(salary) || salary <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid salary amount.');
      return;
    }
    if (isNaN(workDays) || workDays <= 0 || workDays > 31) {
      Alert.alert('Invalid Input', 'Please enter valid working days (1-31).');
      return;
    }
    try {
      await salaryService.setSalarySetting({
        teacherId: settingModal.teacher!.id,
        monthlySalary: salary,
        workingDays: workDays,
        effectiveFrom: new Date().toISOString().slice(0, 10),
      });
      setSettingModal({ visible: false, teacher: null });
      setSalaryInput('');
      setWorkingDaysInput('22');
      Alert.alert('Success', `Salary configuration saved for ${settingModal.teacher!.name}.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to set salary configuration');
    }
  };

  const shiftMonth = (delta: number) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
    setSalaryResults([]);
  };

  const formatCurrency = (n: number) => `Rs. ${n.toFixed(2)}`;

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
          <View style={[styles.headerIconBg, { backgroundColor: colors.secondary + '15' }]}>
            <MaterialIcons name="payment" size={28} color={colors.secondary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>Teacher Salaries</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Calculate payroll with late & absence deductions
            </Text>
          </View>
        </View>

        {/* Month Selector */}
        <View style={[styles.monthNav, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.monthNavBtn} activeOpacity={0.7}>
            <MaterialIcons name="chevron-left" size={26} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.monthText, { color: colors.text }]}>
            {MONTHS[selectedMonth - 1]} {selectedYear}
          </Text>
          <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.monthNavBtn} activeOpacity={0.7}>
            <MaterialIcons name="chevron-right" size={26} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Calculate Button */}
        <TouchableOpacity
          style={[styles.calcBtn, { backgroundColor: colors.primary }]}
          onPress={calculateAll}
          activeOpacity={0.85}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <MaterialIcons name="calculate" size={20} color="#fff" />
              <Text style={styles.calcBtnText}>Calculate All Salaries</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Teacher List - Salary Settings */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          APPROVED TEACHERS ({teachers.length})
        </Text>

        {teachers.map((teacher) => {
          const result = salaryResults.find((r) => r.teacherId === teacher.id);
          return (
            <View key={teacher.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardTop}>
                <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {teacher.name ? teacher.name.charAt(0).toUpperCase() : 'T'}
                  </Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{teacher.name}</Text>
                  <Text style={[styles.cardEmail, { color: colors.textSecondary }]} numberOfLines={1}>{teacher.email}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.setBtn, { borderColor: colors.secondary, backgroundColor: colors.secondary + '10' }]}
                  onPress={() => { setSettingModal({ visible: true, teacher }); setSalaryInput(''); setWorkingDaysInput('22'); }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="edit" size={15} color={colors.secondary} />
                  <Text style={[styles.setBtnText, { color: colors.secondary }]}>Set</Text>
                </TouchableOpacity>
              </View>

              {result && (
                <View style={[styles.resultBox, { borderTopColor: colors.border }]}>
                  <View style={styles.resultGrid}>
                    <ResultItem label="Base Salary" value={formatCurrency(result.baseSalary)} color={colors.text} textSecondary={colors.textSecondary} />
                    <ResultItem label="Working Days" value={`${result.workingDays} days`} color={colors.text} textSecondary={colors.textSecondary} />
                    <ResultItem label="Absences" value={`${result.actualAbsences}`} color={colors.danger} textSecondary={colors.textSecondary} />
                    <ResultItem label="Lates" value={`${result.totalLates}`} color={colors.warning} textSecondary={colors.textSecondary} />
                    <ResultItem label="Effective Absences" value={`${result.effectiveAbsences}`} color={colors.danger} textSecondary={colors.textSecondary} />
                    <ResultItem label="Deduction" value={`-${formatCurrency(result.deductionAmount)}`} color={colors.danger} textSecondary={colors.textSecondary} />
                  </View>
                  <View style={[styles.finalRow, { borderTopColor: colors.border }]}>
                    <Text style={[styles.finalLabel, { color: colors.textSecondary }]}>Final Salary</Text>
                    <Text style={[styles.finalAmount, { color: colors.success }]}>
                      {formatCurrency(result.finalSalary)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: colors.success }]}
                    onPress={() => saveReport(result)}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name="save" size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>Save Report</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {teachers.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <MaterialIcons name="people" size={56} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No approved teachers found.</Text>
          </View>
        )}
      </ScrollView>

      {/* Set Salary Modal */}
      <Modal transparent visible={settingModal.visible} animationType="fade">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Salary Config
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                {settingModal.teacher?.name}
              </Text>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Monthly Base Salary (Rs.)</Text>
              <TextInput
                style={[styles.modalInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="e.g. 50000"
                placeholderTextColor={colors.textSecondary}
                value={salaryInput}
                onChangeText={setSalaryInput}
                keyboardType="numeric"
              />
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Working Days Per Month</Text>
              <TextInput
                style={[styles.modalInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="e.g. 22"
                placeholderTextColor={colors.textSecondary}
                value={workingDaysInput}
                onChangeText={setWorkingDaysInput}
                keyboardType="numeric"
              />
              <View style={[styles.infoBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                <MaterialIcons name="info-outline" size={15} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.primary }]}>
                  Deductions: 1 absence = 1 day salary. 2 lates = 1 day deduction.
                </Text>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.border }]}
                  onPress={() => setSettingModal({ visible: false, teacher: null })}
                >
                  <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.secondary }]}
                  onPress={() => {
                    Keyboard.dismiss();
                    handleSetSalary();
                  }}
                >
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>

  );
}

function ResultItem({ label, value, color, textSecondary }: { label: string; value: string; color: string; textSecondary: string }) {
  return (
    <View style={styles.resultItem}>
      <Text style={[styles.resultItemLabel, { color: textSecondary }]}>{label}</Text>
      <Text style={[styles.resultItemValue, { color }]}>{value}</Text>
    </View>
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
  monthNav: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    borderWidth: 1, marginBottom: 14, overflow: 'hidden',
  },
  monthNavBtn: { paddingHorizontal: 14, paddingVertical: 12 },
  monthText: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  calcBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14, marginBottom: 20,
  },
  calcBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 10 },
  card: { borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: '700' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  cardEmail: { fontSize: 12 },
  setBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5 },
  setBtnText: { fontSize: 13, fontWeight: '700' },
  resultBox: { borderTopWidth: 1, padding: 14 },
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  resultItem: { width: '33.33%', marginBottom: 10 },
  resultItemLabel: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
  resultItemValue: { fontSize: 14, fontWeight: '700' },
  finalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 10, marginBottom: 12 },
  finalLabel: { fontSize: 14, fontWeight: '600' },
  finalAmount: { fontSize: 22, fontWeight: '800' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 16, fontSize: 15, textAlign: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  modalInput: { borderWidth: 1.5, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 14 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 16 },
  infoText: { flex: 1, fontSize: 12, fontWeight: '500' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { fontWeight: '700', fontSize: 15 },
});
