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
import { useTheme } from '../../context/ThemeContext';
import { EmptyState } from '../common/EmptyState';

interface TeacherCourseListProps {
  courses: Course[];
  isLoading: boolean;
  onCoursePress?: (course: Course) => void;
}

export const TeacherCourseList: React.FC<TeacherCourseListProps> = ({
  courses,
  isLoading,
  onCoursePress,
}) => {
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (courses.length === 0) {
    return (
      <EmptyState
        title="No Courses"
        message="You haven't been assigned to any courses yet"
      />
    );
  }

  return (
    <FlatList
      data={courses}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.courseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => onCoursePress?.(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.courseIcon, { backgroundColor: colors.primary + '10' }]}>
            <MaterialIcons name="class" size={28} color={colors.primary} />
          </View>

          <View style={styles.courseInfo}>
            <Text style={[styles.courseName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.courseCode, { color: colors.textSecondary }]}>{item.code}</Text>
          </View>

          <View style={[styles.chevronContainer, { backgroundColor: colors.background }]}>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.listContainer}
    />
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingVertical: 8,
  },
  courseCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  courseIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  courseCode: {
    fontSize: 13,
    fontWeight: '600',
  },
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
