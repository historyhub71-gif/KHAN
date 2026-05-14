import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Course } from '../../types';
import { Colors } from '../../utils/colors';
import { EmptyState } from '../common/EmptyState';

interface CourseListProps {
  courses: Course[];
  isLoading: boolean;
  onCoursePress?: (course: Course) => void;
  onDeletePress?: (courseId: string) => void;
  onAssignPress?: (courseId: string) => void;
  onEditPress?: (course: Course) => void;
}

export const CourseList: React.FC<CourseListProps> = ({
  courses,
  isLoading,
  onCoursePress,
  onDeletePress,
  onAssignPress,
  onEditPress,
}) => {
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (courses.length === 0) {
    return <EmptyState title="No Courses" message="No courses found" />;
  }

  return (
    <FlatList
      data={courses}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.courseCard}
          onPress={() => onCoursePress?.(item)}
        >
          <View style={styles.courseInfo}>
            <Text style={styles.courseName}>{item.name}</Text>
            <Text style={styles.courseCode}>{item.code}</Text>
          </View>

          <View style={styles.actions}>
            {onEditPress && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => onEditPress(item)}
              >
                <MaterialIcons
                  name="edit"
                  size={24}
                  color={Colors.primary}
                />
              </TouchableOpacity>
            )}

            {onAssignPress && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => onAssignPress(item.id)}
              >
                <MaterialIcons
                  name="person-add"
                  size={24}
                  color={Colors.primary}
                />
              </TouchableOpacity>
            )}

            {onDeletePress && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => onDeletePress(item.id)}
              >
                <MaterialIcons name="delete" size={24} color={Colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.listContainer}
    />
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  courseCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark,
    marginBottom: 4,
  },
  courseCode: {
    fontSize: 14,
    color: Colors.gray,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 8,
  },
});
