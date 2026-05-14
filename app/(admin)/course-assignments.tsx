import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { UserList } from '../../component/admin/UserList';
import { Button } from '../../component/common/Button';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { adminService } from '../../services/adminService';
import { Course, Profile } from '../../types';
import { Colors } from '../../utils/colors';

export default function CourseAssignmentsScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [assignedTeachers, setAssignedTeachers] = useState<Profile[]>([]);
  const [assignedStudents, setAssignedStudents] = useState<Profile[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<Profile[]>([]);
  const [availableStudents, setAvailableStudents] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);

  const fetchData = useCallback(async () => {
    if (!courseId) return;

    try {
      setIsLoading(true);
      const [courseData, teachers, students, allTeachers, allStudents] = await Promise.all([
        adminService.getCourse(courseId),
        adminService.getCourseTeachers(courseId),
        adminService.getCourseStudents(courseId),
        adminService.getTeachers(),
        adminService.getStudents(),
      ]);

      setCourse(courseData);
      setAssignedTeachers(teachers);
      setAssignedStudents(students);

      // Filter out already assigned users
      const assignedTeacherIds = new Set(teachers.map(t => t.id));
      const assignedStudentIds = new Set(students.map(s => s.id));

      setAvailableTeachers(allTeachers.filter(t => t.approved && !assignedTeacherIds.has(t.id)));
      setAvailableStudents(allStudents.filter(s => s.approved && !assignedStudentIds.has(s.id)));
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load course assignments');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useFocusEffect(
    useCallback(() => {
      if (courseId) {
        fetchData();
      }
    }, [courseId, fetchData])
  );

  const handleAssignTeacher = async (teacher: Profile) => {
    if (!courseId) return;

    try {
      await adminService.assignTeacherToCourse(courseId, teacher.id);
      setShowTeacherModal(false);
      fetchData();
      Alert.alert('Success', 'Teacher assigned successfully');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to assign teacher');
    }
  };

  const handleRemoveTeacher = (teacherId: string) => {
    if (!courseId) return;

    Alert.alert('Remove Teacher', 'Are you sure you want to remove this teacher from the course?', [
      { text: 'Cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminService.removeTeacherFromCourse(courseId, teacherId);
            fetchData();
            Alert.alert('Success', 'Teacher removed successfully');
          } catch {
            Alert.alert('Error', 'Failed to remove teacher');
          }
        },
      },
    ]);
  };

  const handleAssignStudent = async (student: Profile) => {
    if (!courseId) return;

    try {
      await adminService.assignStudentToCourse(courseId, student.id);
      setShowStudentModal(false);
      fetchData();
      Alert.alert('Success', 'Student assigned successfully');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to assign student');
    }
  };

  const handleRemoveStudent = (studentId: string) => {
    if (!courseId) return;

    Alert.alert('Remove Student', 'Are you sure you want to remove this student from the course?', [
      { text: 'Cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminService.removeStudentFromCourse(courseId, studentId);
            fetchData();
            Alert.alert('Success', 'Student removed successfully');
          } catch {
            Alert.alert('Error', 'Failed to remove student');
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <Text>Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!course) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <Text>Course not found</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <View style={styles.courseHeader}>
          <Text style={styles.courseName}>{course.name}</Text>
          <Text style={styles.courseCode}>{course.code}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Assigned Teachers ({assignedTeachers.length})</Text>
            <Button
              title="Add Teacher"
              onPress={() => setShowTeacherModal(true)}
              style={styles.addButton}
            />
          </View>

          {assignedTeachers.length === 0 ? (
            <Text style={styles.emptyText}>No teachers assigned</Text>
          ) : (
            <FlatList
              data={assignedTeachers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.assignedUserCard}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userEmail}>{item.email}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveTeacher(item.id)}
                  >
                    <MaterialIcons name="remove-circle" size={24} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              )}
              scrollEnabled={false}
            />
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Assigned Students ({assignedStudents.length})</Text>
            <Button
              title="Add Student"
              onPress={() => setShowStudentModal(true)}
              style={styles.addButton}
            />
          </View>

          {assignedStudents.length === 0 ? (
            <Text style={styles.emptyText}>No students assigned</Text>
          ) : (
            <FlatList
              data={assignedStudents}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.assignedUserCard}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userEmail}>{item.email}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveStudent(item.id)}
                  >
                    <MaterialIcons name="remove-circle" size={24} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              )}
              scrollEnabled={false}
            />
          )}
        </View>
      </View>

      {/* Teacher Assignment Modal */}
      <Modal
        visible={showTeacherModal}
        animationType="slide"
        onRequestClose={() => setShowTeacherModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Teacher to Assign</Text>
            <TouchableOpacity
              onPress={() => setShowTeacherModal(false)}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              style={styles.closeButton}
            >
              <MaterialIcons name="close" size={24} color={Colors.dark} />
            </TouchableOpacity>
          </View>

          <UserList
            users={availableTeachers}
            isLoading={false}
            onUserPress={handleAssignTeacher}
          />
        </SafeAreaView>
      </Modal>

      {/* Student Assignment Modal */}
      <Modal
        visible={showStudentModal}
        animationType="slide"
        onRequestClose={() => setShowStudentModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Student to Assign</Text>
            <TouchableOpacity
              onPress={() => setShowStudentModal(false)}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              style={styles.closeButton}
            >
              <MaterialIcons name="close" size={24} color={Colors.dark} />
            </TouchableOpacity>
          </View>

          <UserList
            users={availableStudents}
            isLoading={false}
            onUserPress={handleAssignStudent}
          />
        </SafeAreaView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseHeader: {
    backgroundColor: Colors.light,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  courseName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark,
    marginBottom: 4,
  },
  courseCode: {
    fontSize: 14,
    color: Colors.gray,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.gray,
    fontStyle: 'italic',
    padding: 16,
  },
  assignedUserCard: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.dark,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: Colors.gray,
  },
  removeButton: {
    padding: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  modalHeader: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light,
  },
  closeButton: {
    padding: 6,
    zIndex: 999,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark,
  },
});