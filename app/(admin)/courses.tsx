import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useContext, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CourseList } from '../../component/admin/CourseList';
import { Button } from '../../component/common/Button';
import { ScreenContainer } from '../../component/common/ScreenContainer';
import { TextInput } from '../../component/common/TextInput';
import { AuthContext } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { Course } from '../../types';
import { Colors } from '../../utils/colors';

export default function CoursesScreen() {
  const { user } = useContext(AuthContext);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchCourses();
    }, [])
  );

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      const data = await adminService.getCourses();
      setCourses(data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load courses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!courseName.trim() || !courseCode.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      setIsSubmitting(true);
      await adminService.createCourse(courseName, courseCode, user.id);
      setCourseName('');
      setCourseCode('');
      setShowCreateForm(false);
      fetchCourses();
      Alert.alert('Success', 'Course created successfully');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create course');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCourse = async () => {
    if (!courseName.trim() || !courseCode.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!editingCourse) return;

    try {
      setIsSubmitting(true);
      await adminService.updateCourse(editingCourse.id, {
        name: courseName,
        code: courseCode,
      });
      setCourseName('');
      setCourseCode('');
      setShowCreateForm(false);
      setEditingCourse(null);
      fetchCourses();
      Alert.alert('Success', 'Course updated successfully');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update course');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setCourseName(course.name);
    setCourseCode(course.code);
    setShowCreateForm(true);
  };

  const handleCancelEdit = () => {
    setEditingCourse(null);
    setCourseName('');
    setCourseCode('');
    setShowCreateForm(false);
  };

  const handleDelete = (courseId: string) => {
    Alert.alert('Delete Course', 'Are you sure you want to delete this course?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminService.deleteCourse(courseId);
            fetchCourses();
            Alert.alert('Success', 'Course deleted successfully');
          } catch (err) {
            Alert.alert('Error', 'Failed to delete course');
          }
        },
      },
    ]);
  };

  const handleAssign = (courseId: string) => {
    router.push(`/course-assignments?courseId=${courseId}`);
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        {!showCreateForm ? (
          <Button
            title="Create New Course"
            onPress={() => setShowCreateForm(true)}
            fullWidth
            style={styles.createButton}
          />
        ) : (
          <View style={styles.formContainer}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {editingCourse ? 'Edit Course' : 'Create New Course'}
              </Text>
              <TouchableOpacity onPress={editingCourse ? handleCancelEdit : () => setShowCreateForm(false)}>
                <MaterialIcons name="close" size={24} color={Colors.dark} />
              </TouchableOpacity>
            </View>

            <TextInput
              label="Course Name"
              placeholder="e.g., Mathematics"
              value={courseName}
              onChangeText={setCourseName}
              editable={!isSubmitting}
              containerStyle={styles.field}
            />

            <TextInput
              label="Course Code"
              placeholder="e.g., MATH101"
              value={courseCode}
              onChangeText={setCourseCode}
              editable={!isSubmitting}
              containerStyle={styles.field}
            />

            <View style={styles.formButtons}>
              <Button
                title={editingCourse ? "Update" : "Create"}
                onPress={editingCourse ? handleUpdateCourse : handleCreateCourse}
                loading={isSubmitting}
                fullWidth
              />
            </View>
          </View>
        )}

        <CourseList
          courses={courses}
          isLoading={isLoading}
          onEditPress={handleEdit}
          onDeletePress={handleDelete}
          onAssignPress={handleAssign}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  createButton: {
    marginBottom: 16,
  },
  formContainer: {
    backgroundColor: Colors.light,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark,
  },
  field: {
    marginBottom: 12,
  },
  formButtons: {
    marginTop: 16,
  },
});
