import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Button } from '../../component/common/Button';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { TextInput } from '../../component/common/TextInput';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { feeService } from '../../services/feeService';
import { Course } from '../../types';

interface AdmissionDeal {
  id: string;
  student_name: string;
  student_email: string;
  course_id: string;
  course_name?: string;
  original_fee: number;
  discount_amount: number;
  discount_percentage: number;
  final_fee: number;
  payment_status: 'pending' | 'paid';
  remarks: string;
  created_at: string;
  updated_at: string;
}

export default function AdmissionFeesScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // State
  const [deals, setDeals] = useState<AdmissionDeal[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Form Modal State
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingDeal, setEditingDeal] = useState<AdmissionDeal | null>(null);
  
  // Form Fields State
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [courseId, setCourseId] = useState('');
  const [originalFee, setOriginalFee] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [finalFee, setFinalFee] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>('pending');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Summary Modal State
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [summaryDeal, setSummaryDeal] = useState<AdmissionDeal | null>(null);

  // Dropdown menus visibility
  const [showCourseSelector, setShowCourseSelector] = useState(false);
  const [showFilterCourseSelector, setShowFilterCourseSelector] = useState(false);
  const [showFilterStatusSelector, setShowFilterStatusSelector] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setIsLoading(true);
      const [dealsData, coursesData] = await Promise.all([
        feeService.getAdmissionDeals().catch(() => []),
        adminService.getCourses().catch(() => []),
      ]);
      setDeals(dealsData);
      setCourses(coursesData);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to fetch admission data');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  // Dynamic calculations for the form
  const handleOriginalFeeChange = (val: string) => {
    setOriginalFee(val);
    const orig = parseFloat(val) || 0;
    const disc = parseFloat(discountAmount) || 0;
    
    const final = Math.max(0, orig - disc);
    setFinalFee(final.toString());

    if (orig > 0) {
      const pct = (disc / orig) * 100;
      setDiscountPercentage(pct.toFixed(1));
    } else {
      setDiscountPercentage('0');
    }
  };

  const handleDiscountAmountChange = (val: string) => {
    setDiscountAmount(val);
    const orig = parseFloat(originalFee) || 0;
    const disc = parseFloat(val) || 0;

    const final = Math.max(0, orig - disc);
    setFinalFee(final.toString());

    if (orig > 0) {
      const pct = (disc / orig) * 100;
      setDiscountPercentage(pct.toFixed(1));
    } else {
      setDiscountPercentage('0');
    }
  };

  const handleDiscountPercentageChange = (val: string) => {
    setDiscountPercentage(val);
    const orig = parseFloat(originalFee) || 0;
    const pct = parseFloat(val) || 0;

    const disc = orig * (pct / 100);
    setDiscountAmount(disc.toFixed(2));

    const final = Math.max(0, orig - disc);
    setFinalFee(final.toString());
  };

  const handleFinalFeeChange = (val: string) => {
    setFinalFee(val);
    const orig = parseFloat(originalFee) || 0;
    const final = parseFloat(val) || 0;

    const disc = Math.max(0, orig - final);
    setDiscountAmount(disc.toString());

    if (orig > 0) {
      const pct = (disc / orig) * 100;
      setDiscountPercentage(pct.toFixed(1));
    } else {
      setDiscountPercentage('0');
    }
  };

  // Open modal for creating new deal
  const handleOpenAdd = () => {
    if (!isAdmin) {
      Alert.alert('Permission Denied', 'Only administrators can create admission agreements.');
      return;
    }
    setEditingDeal(null);
    setStudentName('');
    setStudentEmail('');
    setCourseId(courses[0]?.id || '');
    setOriginalFee('15000');
    setDiscountAmount('0');
    setDiscountPercentage('0');
    setFinalFee('15000');
    setPaymentStatus('pending');
    setRemarks('');
    setFormModalVisible(true);
  };

  // Open modal for editing existing deal
  const handleOpenEdit = (deal: AdmissionDeal) => {
    if (!isAdmin) {
      Alert.alert('Permission Denied', 'Only administrators can edit admission agreements.');
      return;
    }
    setEditingDeal(deal);
    setStudentName(deal.student_name);
    setStudentEmail(deal.student_email || '');
    setCourseId(deal.course_id || '');
    setOriginalFee(deal.original_fee.toString());
    setDiscountAmount(deal.discount_amount.toString());
    setDiscountPercentage(deal.discount_percentage.toString());
    setFinalFee(deal.final_fee.toString());
    setPaymentStatus(deal.payment_status);
    setRemarks(deal.remarks || '');
    setFormModalVisible(true);
  };

  // Form Submit
  const handleSaveDeal = async () => {
    if (!studentName.trim() || !courseId) {
      Alert.alert('Validation Error', 'Please enter student name and select a course.');
      return;
    }

    const orig = parseFloat(originalFee);
    const disc = parseFloat(discountAmount) || 0;
    const final = parseFloat(finalFee);

    if (isNaN(orig) || orig < 0) {
      Alert.alert('Validation Error', 'Please enter a valid original fee.');
      return;
    }
    if (isNaN(final) || final < 0) {
      Alert.alert('Validation Error', 'Please enter a valid agreed fee.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingDeal) {
        // Edit Deal
        await feeService.updateAdmissionDeal(editingDeal.id, {
          studentName: studentName.trim(),
          studentEmail: studentEmail.trim(),
          courseId,
          originalFee: orig,
          discountAmount: disc,
          discountPercentage: parseFloat(discountPercentage) || 0,
          finalFee: final,
          paymentStatus,
          remarks: remarks.trim(),
          adminId: user!.id,
        });
        Alert.alert('Success', 'Admission deal updated successfully.');
      } else {
        // Create Deal
        await feeService.createAdmissionDeal({
          studentName: studentName.trim(),
          studentEmail: studentEmail.trim(),
          courseId,
          originalFee: orig,
          discountAmount: disc,
          discountPercentage: parseFloat(discountPercentage) || 0,
          finalFee: final,
          paymentStatus,
          remarks: remarks.trim(),
          adminId: user!.id,
        });
        Alert.alert('Success', 'Admission agreement saved.');
      }
      setFormModalVisible(false);
      fetchData(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save admission deal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mark status as Paid
  const handleMarkAsPaid = (dealId: string, name: string) => {
    if (!isAdmin) {
      Alert.alert('Permission Denied', 'Only administrators can mark payments as paid.');
      return;
    }
    Alert.alert(
      'Mark as Paid',
      `Confirm you have received the admission fee of PKR ${name}'s deal?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid',
          onPress: async () => {
            try {
              await feeService.markAdmissionDealAsPaid(dealId, user!.id);
              Alert.alert('Success', 'Admission fee marked as paid.');
              fetchData(true);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to update payment status.');
            }
          },
        },
      ]
    );
  };

  // Generate statistics
  const filteredDeals = deals.filter((d) => {
    const matchesSearch = d.student_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = selectedCourseId === 'all' || d.course_id === selectedCourseId;
    const matchesStatus = selectedStatus === 'all' || d.payment_status === selectedStatus;
    return matchesSearch && matchesCourse && matchesStatus;
  });

  const totalAdmissions = deals.length;
  const totalRevenue = deals.filter((d) => d.payment_status === 'paid').reduce((acc, d) => acc + Number(d.final_fee), 0);
  const totalDiscounts = deals.reduce((acc, d) => acc + Number(d.discount_amount), 0);
  const pendingAdmissionsCount = deals.filter((d) => d.payment_status === 'pending').length;
  const paidAdmissionsCount = deals.filter((d) => d.payment_status === 'paid').length;

  return (
    <ScreenContainer>
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading admission module...</Text>
        </View>
      ) : (
        <View style={styles.container}>
          {/* Main List & Dashboard */}
          <FlatList
            data={filteredDeals}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            ListHeaderComponent={
              <>
                {/* Stats Dashboard */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Negotiations & Deals Statistics</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
                  <StatItem label="Total Admissions" value={totalAdmissions} sub="Signed contracts" color={colors.primary} icon="people" colors={colors} />
                  <StatItem label="Total Revenue" value={`Rs. ${totalRevenue.toLocaleString()}`} sub="Collected fees" color={colors.success} icon="payments" colors={colors} />
                  <StatItem label="Discounts Given" value={`Rs. ${totalDiscounts.toLocaleString()}`} sub="Negotiation margin" color={colors.danger} icon="local-offer" colors={colors} />
                  <StatItem label="Pending Deals" value={pendingAdmissionsCount} sub="Awaiting payment" color={colors.warning} icon="schedule" colors={colors} />
                  <StatItem label="Paid Deals" value={paidAdmissionsCount} sub="Secured entries" color={colors.success} icon="check-circle" colors={colors} />
                </ScrollView>

                {/* Admission Fee management Header */}
                <View style={styles.controlHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Admission Agreements</Text>
                    <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>Manage student deals & discount logs</Text>
                  </View>
                  {isAdmin && (
                    <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary }]} onPress={handleOpenAdd} activeOpacity={0.8}>
                      <Ionicons name="add" size={16} color={colors.white} />
                      <Text style={[styles.createBtnText, { color: colors.white }]}>Add Deal</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Search & Filters Controls */}
                <View style={[styles.filterBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.searchField, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                    <RNTextInput
                      style={[styles.searchInput, { color: colors.text }]}
                      placeholder="Search students..."
                      placeholderTextColor={colors.textSecondary}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>

                  <View style={styles.filterRow}>
                    {/* Course Filter selector */}
                    <TouchableOpacity
                      style={[styles.filterSelector, { borderColor: colors.border, backgroundColor: colors.background }]}
                      onPress={() => setShowFilterCourseSelector(true)}
                    >
                      <Text style={[styles.filterSelText, { color: colors.text }]} numberOfLines={1}>
                        Course: {selectedCourseId === 'all' ? 'All' : courses.find(c => c.id === selectedCourseId)?.name || 'All'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>

                    {/* Status Filter selector */}
                    <TouchableOpacity
                      style={[styles.filterSelector, { borderColor: colors.border, backgroundColor: colors.background }]}
                      onPress={() => setShowFilterStatusSelector(true)}
                    >
                      <Text style={[styles.filterSelText, { color: colors.text }]}>
                        Status: {selectedStatus === 'all' ? 'All' : selectedStatus.toUpperCase()}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            }
            renderItem={({ item }) => {
              const courseName = courses.find((c) => c.id === item.course_id)?.name || item.course_name || 'Selected Course';
              return (
                <View style={[styles.dealCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.dealTop}>
                    <View style={styles.dealAvatarCol}>
                      <View style={[styles.dealAvatar, { backgroundColor: colors.primary + '15' }]}>
                        <Text style={[styles.dealAvatarText, { color: colors.primary }]}>
                          {item.student_name ? item.student_name.charAt(0).toUpperCase() : 'S'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.dealInfoCol}>
                      <Text style={[styles.dealStudentName, { color: colors.text }]} numberOfLines={1}>{item.student_name}</Text>
                      <Text style={[styles.dealCourseLabel, { color: colors.textSecondary }]} numberOfLines={1}>{courseName}</Text>
                      <View style={styles.dealCurrencyInfo}>
                        <Text style={[styles.dealOrigFee, { color: colors.textSecondary }]}>Rs. {item.original_fee.toLocaleString()}</Text>
                        <Text style={[styles.dealDiscValue, { color: colors.danger }]}>-{item.discount_percentage}% (Rs. {item.discount_amount.toLocaleString()})</Text>
                      </View>
                    </View>
                    <View style={styles.dealFinalCol}>
                      <Text style={[styles.dealFinalAmount, { color: colors.success }]}>Rs. {item.final_fee.toLocaleString()}</Text>
                      <View style={[styles.statusLabel, { backgroundColor: item.payment_status === 'paid' ? colors.success + '15' : colors.warning + '15' }]}>
                        <Text style={[styles.statusLabelText, { color: item.payment_status === 'paid' ? colors.success : colors.warning }]}>
                          {item.payment_status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {item.remarks ? (
                    <Text style={[styles.dealRemarksText, { color: colors.textSecondary, borderTopColor: colors.border }]}>
                      Notes: {item.remarks}
                    </Text>
                  ) : null}

                  <View style={[styles.dealActions, { borderTopColor: colors.border }]}>
                    <TouchableOpacity
                      style={[styles.dealActionBtn, { borderColor: colors.primary }]}
                      onPress={() => { setSummaryDeal(item); setSummaryModalVisible(true); }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="receipt-outline" size={14} color={colors.primary} />
                      <Text style={[styles.dealActionBtnText, { color: colors.primary }]}>Summary</Text>
                    </TouchableOpacity>

                    {isAdmin && (
                      <>
                        <TouchableOpacity
                          style={[styles.dealActionBtn, { borderColor: colors.secondary }]}
                          onPress={() => handleOpenEdit(item)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="create-outline" size={14} color={colors.secondary} />
                          <Text style={[styles.dealActionBtnText, { color: colors.secondary }]}>Edit</Text>
                        </TouchableOpacity>

                        {item.payment_status === 'pending' && (
                          <TouchableOpacity
                            style={[styles.dealActionBtn, { borderColor: colors.success, backgroundColor: colors.success + '08' }]}
                            onPress={() => handleMarkAsPaid(item.id, item.student_name)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
                            <Text style={[styles.dealActionBtnText, { color: colors.success }]}>Paid</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt" size={56} color={colors.border} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No admission deals found.</Text>
              </View>
            }
            contentContainerStyle={{ padding: 16 }}
          />
        </View>
      )}

      {/* FILTER MODAL: COURSE */}
      <Modal transparent visible={showFilterCourseSelector} animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowFilterCourseSelector(false)}>
          <View style={[styles.dropdownContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.dropdownTitle, { color: colors.text }]}>Select Course Filter</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              <TouchableOpacity
                style={[styles.dropdownRow, selectedCourseId === 'all' && { backgroundColor: colors.primary + '10' }]}
                onPress={() => { setSelectedCourseId('all'); setShowFilterCourseSelector(false); }}
              >
                <Text style={[styles.dropdownRowText, { color: colors.text }]}>All Courses</Text>
              </TouchableOpacity>
              {courses.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.dropdownRow, selectedCourseId === c.id && { backgroundColor: colors.primary + '10' }]}
                  onPress={() => { setSelectedCourseId(c.id); setShowFilterCourseSelector(false); }}
                >
                  <Text style={[styles.dropdownRowText, { color: colors.text }]} numberOfLines={1}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* FILTER MODAL: STATUS */}
      <Modal transparent visible={showFilterStatusSelector} animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowFilterStatusSelector(false)}>
          <View style={[styles.dropdownContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.dropdownTitle, { color: colors.text }]}>Select Status Filter</Text>
            <TouchableOpacity
              style={[styles.dropdownRow, selectedStatus === 'all' && { backgroundColor: colors.primary + '10' }]}
              onPress={() => { setSelectedStatus('all'); setShowFilterStatusSelector(false); }}
            >
              <Text style={[styles.dropdownRowText, { color: colors.text }]}>All Statuses</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownRow, selectedStatus === 'pending' && { backgroundColor: colors.primary + '10' }]}
              onPress={() => { setSelectedStatus('pending'); setShowFilterStatusSelector(false); }}
            >
              <Text style={[styles.dropdownRowText, { color: colors.text }]}>Pending</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownRow, selectedStatus === 'paid' && { backgroundColor: colors.primary + '10' }]}
              onPress={() => { setSelectedStatus('paid'); setShowFilterStatusSelector(false); }}
            >
              <Text style={[styles.dropdownRowText, { color: colors.text }]}>Paid</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* CREATION & EDIT MODAL */}
      <Modal visible={formModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingDeal ? 'Edit Admission Agreement' : 'New Admission Agreement'}
                </Text>
                <Text style={[styles.modalStudentSub, { color: colors.textSecondary }]}>
                  Specify final agreed price & negotiations margin
                </Text>
              </View>
              <TouchableOpacity onPress={() => setFormModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
              <TextInput
                label="Student Name"
                placeholder="e.g. John Doe"
                value={studentName}
                onChangeText={setStudentName}
                editable={!isSubmitting}
                containerStyle={styles.formField}
              />

              <TextInput
                label="Student Gmail / Email"
                placeholder="e.g. student@gmail.com"
                value={studentEmail}
                onChangeText={setStudentEmail}
                editable={!isSubmitting}
                keyboardType="email-address"
                autoCapitalize="none"
                containerStyle={styles.formField}
              />

              {/* Course Selector Dropdown */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Selected Course</Text>
              <TouchableOpacity
                style={[styles.dropdownTrigger, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => setShowCourseSelector(true)}
              >
                <Text style={[styles.dropdownTriggerText, { color: colors.text }]}>
                  {courses.find(c => c.id === courseId)?.name || 'Choose Course...'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Dropdown Modal Selector */}
              <Modal transparent visible={showCourseSelector} animationType="fade">
                <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowCourseSelector(false)}>
                  <View style={[styles.dropdownContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.dropdownTitle, { color: colors.text }]}>Select Course</Text>
                    <ScrollView style={{ maxHeight: 250 }}>
                      {courses.map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          style={styles.dropdownRow}
                          onPress={() => { setCourseId(c.id); setShowCourseSelector(false); }}
                        >
                          <Text style={[styles.dropdownRowText, { color: colors.text }]} numberOfLines={1}>{c.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </TouchableOpacity>
              </Modal>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    label="Original Fee (Rs.)"
                    placeholder="e.g. 15000"
                    keyboardType="numeric"
                    value={originalFee}
                    onChangeText={handleOriginalFeeChange}
                    editable={!isSubmitting}
                    containerStyle={styles.formField}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    label="Agreed Payable Fee (Rs.)"
                    placeholder="e.g. 12000"
                    keyboardType="numeric"
                    value={finalFee}
                    onChangeText={handleFinalFeeChange}
                    editable={!isSubmitting}
                    containerStyle={styles.formField}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    label="Discount Amount (Rs.)"
                    placeholder="e.g. 3000"
                    keyboardType="numeric"
                    value={discountAmount}
                    onChangeText={handleDiscountAmountChange}
                    editable={!isSubmitting}
                    containerStyle={styles.formField}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    label="Discount Percentage (%)"
                    placeholder="e.g. 20"
                    keyboardType="numeric"
                    value={discountPercentage}
                    onChangeText={handleDiscountPercentageChange}
                    editable={!isSubmitting}
                    containerStyle={styles.formField}
                  />
                </View>
              </View>

              {/* Status Picker option buttons */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Payment Status</Text>
              <View style={styles.statusButtonsContainer}>
                <TouchableOpacity
                  style={[
                    styles.statusBtn,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    paymentStatus === 'pending' && { backgroundColor: colors.warning + '25', borderColor: colors.warning }
                  ]}
                  onPress={() => setPaymentStatus('pending')}
                >
                  <Ionicons name="time-outline" size={14} color={paymentStatus === 'pending' ? colors.warning : colors.textSecondary} />
                  <Text style={[styles.statusBtnText, { color: paymentStatus === 'pending' ? colors.warning : colors.text }]}>PENDING</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusBtn,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    paymentStatus === 'paid' && { backgroundColor: colors.success + '25', borderColor: colors.success }
                  ]}
                  onPress={() => setPaymentStatus('paid')}
                >
                  <Ionicons name="checkmark-circle-outline" size={14} color={paymentStatus === 'paid' ? colors.success : colors.textSecondary} />
                  <Text style={[styles.statusBtnText, { color: paymentStatus === 'paid' ? colors.success : colors.text }]}>PAID</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                label="Remarks & Negotiations Notes"
                placeholder="Write negotiated installments, special terms, etc."
                value={remarks}
                onChangeText={setRemarks}
                editable={!isSubmitting}
                multiline
                numberOfLines={3}
                containerStyle={styles.formField}
              />

              <Button
                title={editingDeal ? "Update Deal" : "Create Deal"}
                onPress={handleSaveDeal}
                loading={isSubmitting}
                style={{ backgroundColor: colors.primary, marginTop: 24, borderRadius: 12, height: 50 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* SUMMARY MODAL */}
      <Modal visible={summaryModalVisible} transparent animationType="fade">
        <View style={styles.overlayModalCenter}>
          <View style={[styles.summaryCardModal, { backgroundColor: colors.surface }]}>
            <View style={styles.summaryModalTitleRow}>
              <MaterialIcons name="receipt-long" size={24} color={colors.primary} />
              <Text style={[styles.summaryModalTitle, { color: colors.text }]}>Admission Deal Summary</Text>
            </View>

            {summaryDeal && (
              <View style={styles.summaryBody}>
                <SummaryRow label="Student Name" value={summaryDeal.student_name} colors={colors} />
                <SummaryRow
                  label="Enrolled Course"
                  value={courses.find(c => c.id === summaryDeal.course_id)?.name || summaryDeal.course_name || 'N/A'}
                  colors={colors}
                />
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                
                <SummaryRow label="Standard Course Fee" value={`Rs. ${Number(summaryDeal.original_fee).toLocaleString()}`} colors={colors} />
                <SummaryRow label="Negotiated Discount" value={`-Rs. ${Number(summaryDeal.discount_amount).toLocaleString()} (${summaryDeal.discount_percentage}%)`} colors={colors} />
                
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                <SummaryRow label="Final Payable Amount" value={`Rs. ${Number(summaryDeal.final_fee).toLocaleString()}`} isBold colors={colors} />
                
                <View style={styles.summaryStatusBadgeRow}>
                  <Text style={[styles.summaryRowLabel, { color: colors.textSecondary }]}>Payment Status:</Text>
                  <View style={[styles.statusLabel, { backgroundColor: summaryDeal.payment_status === 'paid' ? colors.success + '15' : colors.warning + '15' }]}>
                    <Text style={[styles.statusLabelText, { color: summaryDeal.payment_status === 'paid' ? colors.success : colors.warning }]}>
                      {summaryDeal.payment_status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {summaryDeal.remarks ? (
                  <View style={[styles.summaryRemarksContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.summaryRemarksTitle, { color: colors.textSecondary }]}>Negotiations Notes & Terms:</Text>
                    <Text style={[styles.summaryRemarksText, { color: colors.text }]}>{summaryDeal.remarks}</Text>
                  </View>
                ) : null}
              </View>
            )}

            <Button
              title="Close Summary"
              onPress={() => setSummaryModalVisible(false)}
              style={{ backgroundColor: colors.primary, marginTop: 12, borderRadius: 12 }}
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// Stats Card Component
function StatItem({
  label,
  value,
  sub,
  color,
  icon,
  colors
}: {
  label: string;
  value: string | number;
  sub: string;
  color: string;
  icon: any;
  colors: any;
}) {
  return (
    <View style={[styles.statCardItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.statItemHeader]}>
        <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
          <MaterialIcons name={icon} size={20} color={color} />
        </View>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.statVal, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statSub, { color: colors.textSecondary }]}>{sub}</Text>
    </View>
  );
}

// Summary Row Component
function SummaryRow({ label, value, isBold, colors }: { label: string; value: string; isBold?: boolean; colors: any }) {
  return (
    <View style={styles.summaryRowItem}>
      <Text style={[styles.summaryRowLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.summaryRowVal, { color: colors.text }, isBold && { fontWeight: '800', fontSize: 17 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  container: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  sectionDesc: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  statsScroll: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  statCardItem: {
    width: 170,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginRight: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
  },
  statItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  statVal: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  statSub: {
    fontSize: 10,
  },
  controlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  filterBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  searchField: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterSelector: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  filterSelText: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: '85%',
  },
  dealCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
  },
  dealTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dealAvatarCol: {
    marginRight: 12,
  },
  dealAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealAvatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  dealInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  dealStudentName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  dealCourseLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  dealCurrencyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dealOrigFee: {
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  dealDiscValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  dealFinalCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  dealFinalAmount: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  statusLabel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusLabelText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  dealRemarksText: {
    fontSize: 12,
    marginTop: 12,
    borderTopWidth: 1,
    paddingTop: 10,
    fontWeight: '500',
  },
  dealActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  dealActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.2,
  },
  dealActionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    width: '80%',
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  dropdownTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  dropdownRow: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  dropdownRowText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalStudentSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  formField: {
    marginBottom: 14,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  dropdownTrigger: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  dropdownTriggerText: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  statusButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statusBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statusBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  overlayModalCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  summaryCardModal: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  summaryModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  summaryModalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  summaryBody: {
    marginBottom: 20,
  },
  summaryRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryRowLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryRowVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  summaryDivider: {
    height: 1,
    marginVertical: 4,
  },
  summaryStatusBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryRemarksContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  summaryRemarksTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  summaryRemarksText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});
