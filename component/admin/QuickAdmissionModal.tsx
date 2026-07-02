import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { admissionService } from '../../services/admissionService';
import { Course } from '../../types';

interface QuickAdmissionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  colors: any;
}

export const QuickAdmissionModal = ({ visible, onClose, onSuccess, colors }: QuickAdmissionModalProps) => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [courseId, setCourseId] = useState('');
  const [originalFee, setOriginalFee] = useState('15000');
  const [finalFee, setFinalFee] = useState('15000');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (visible) {
      fetchCourses();
    }
  }, [visible]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const data = await adminService.getCourses();
      setCourses(data);
      if (data.length > 0 && !courseId) {
        setCourseId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!studentName.trim() || !studentEmail.trim() || !courseId) {
      Alert.alert('Validation', 'Please fill in name, email and select a course.');
      return;
    }

    try {
      setSubmitting(true);
      await admissionService.createDeal({
        studentName: studentName.trim(),
        studentEmail: studentEmail.trim(),
        phoneNumber: phoneNumber.trim(),
        courseId,
        originalFee: parseFloat(originalFee) || 0,
        finalFee: parseFloat(finalFee) || 0,
        remarks: remarks.trim(),
        paymentStatus: 'pending',
      } as any);

      Alert.alert('Success', 'Admission agreement created and student record generated. The student can now be interviewed or log in.');
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create admission deal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Quick Admission Hub</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ margin: 40 }} />
          ) : (
            <ScrollView contentContainerStyle={styles.form}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Student Full Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={studentName}
                onChangeText={setStudentName}
                placeholder="Enter student name"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Student Gmail / Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={studentEmail}
                onChangeText={setStudentEmail}
                placeholder="Important for account linking"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Phone Number</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="Contact number"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Select Course</Text>
              <View style={[styles.pickerContainer, { borderColor: colors.border }]}>
                {courses.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.pickerItem,
                      { borderBottomColor: colors.border },
                      courseId === c.id && { backgroundColor: colors.primary + '15' }
                    ]}
                    onPress={() => setCourseId(c.id)}
                  >
                    <View style={[styles.radio, { borderColor: colors.primary, backgroundColor: courseId === c.id ? colors.primary : 'transparent' }]} />
                    <Text style={[styles.pickerText, { color: colors.text }]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Original Fee</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={originalFee}
                    onChangeText={setOriginalFee}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ width: 16 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Final Agreed Fee</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={finalFee}
                    onChangeText={setFinalFee}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Negotiation Remarks</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={remarks}
                onChangeText={setRemarks}
                placeholder="e.g. 10% sibling discount"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>Confirm Quick Admission</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  content: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  form: { padding: 20 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  pickerContainer: { borderWidth: 1, borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, gap: 10 },
  pickerText: { fontSize: 14, fontWeight: '500' },
  radio: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  row: { flexDirection: 'row' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 14, gap: 8, marginTop: 10 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
