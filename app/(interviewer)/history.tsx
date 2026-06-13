import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { Button } from '../../component/common/Button';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { interviewerService } from '../../services/interviewerService';
import { Interview } from '../../types';
import { supabase } from '../../utils/supabase';

export default function HistoryScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const [history, setHistory] = useState<Interview[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<Interview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'admission' | 'progress_review'>('all');

  // Detail view state
  const [viewingInterview, setViewingInterview] = useState<Interview | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('interviews')
        .select('*, profiles:student_id(name)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mapped = data.map((row: any) => ({
          ...row,
          student_name: row.profiles?.name,
        }));
        setHistory(mapped);
        applyFilters(mapped, searchQuery, selectedType);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, searchQuery, selectedType]);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  const applyFilters = (
    data: Interview[],
    query: string,
    type: 'all' | 'admission' | 'progress_review'
  ) => {
    let filtered = [...data];

    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter(
        (item) => item.student_name && item.student_name.toLowerCase().includes(q)
      );
    }

    if (type !== 'all') {
      filtered = filtered.filter((item) => item.interview_type === type);
    }

    setFilteredHistory(filtered);
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    applyFilters(history, text, selectedType);
  };

  const handleTypeFilter = (type: 'all' | 'admission' | 'progress_review') => {
    setSelectedType(type);
    applyFilters(history, searchQuery, type);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Interview }) => (
    <TouchableOpacity
      style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => setViewingInterview(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={[
          styles.typeBadge,
          { backgroundColor: item.interview_type === 'admission' ? colors.primary + '15' : colors.warning + '15' }
        ]}>
          <Text style={[
            styles.typeBadgeText,
            { color: item.interview_type === 'admission' ? colors.primary : colors.warning }
          ]}>
            {item.interview_type === 'admission' ? 'Admission' : '14-Day Review'}
          </Text>
        </View>
        <Text style={[styles.historyDate, { color: colors.textSecondary }]}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>

      <Text style={[styles.studentName, { color: colors.text }]}>
        {item.student_name || 'Student'}
      </Text>

      <View style={styles.cardFooter}>
        <Text style={[styles.scoreText, { color: colors.textSecondary }]}>
          Score: <Text style={{ color: colors.text, fontWeight: '700' }}>{item.total_score}/50</Text>
        </Text>
        <View style={[
          styles.levelBadge,
          { backgroundColor: item.assigned_level === 'Advanced' ? colors.success + '15' : item.assigned_level === 'Intermediate' ? colors.secondary + '15' : colors.danger + '15' }
        ]}>
          <Text style={[
            styles.levelBadgeText,
            { color: item.assigned_level === 'Advanced' ? colors.success : item.assigned_level === 'Intermediate' ? colors.secondary : colors.danger }
          ]}>
            {item.assigned_level}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer>
      {/* Search and Filters */}
      <View style={[styles.filterContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBar, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search student by name..."
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
        </View>

        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[styles.filterTab, selectedType === 'all' && { borderBottomColor: colors.success }]}
            onPress={() => handleTypeFilter('all')}
          >
            <Text style={[styles.filterTabText, { color: colors.textSecondary }, selectedType === 'all' && { color: colors.success, fontWeight: '700' }]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, selectedType === 'admission' && { borderBottomColor: colors.success }]}
            onPress={() => handleTypeFilter('admission')}
          >
            <Text style={[styles.filterTabText, { color: colors.textSecondary }, selectedType === 'admission' && { color: colors.success, fontWeight: '700' }]}>
              Admissions
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, selectedType === 'progress_review' && { borderBottomColor: colors.success }]}
            onPress={() => handleTypeFilter('progress_review')}
          >
            <Text style={[styles.filterTabText, { color: colors.textSecondary }, selectedType === 'progress_review' && { color: colors.success, fontWeight: '700' }]}>
              Reviews
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.success} />
          <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14, fontWeight: '600' }}>
            Loading history records...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredHistory}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.success} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14, fontWeight: '600' }}>
                No completed assessments found matching your filters.
              </Text>
            </View>
          }
        />
      )}

      {/* DETAIL MODAL */}
      <Modal visible={viewingInterview !== null} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Assessment Details</Text>
                <Text style={[styles.modalStudentSub, { color: colors.textSecondary }]}>
                  Student: {viewingInterview?.student_name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setViewingInterview(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={[styles.calcCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.calcRow}>
                  <Text style={[styles.calcLabel, { color: colors.textSecondary }]}>Type:</Text>
                  <Text style={[styles.calcValue, { color: colors.text, textTransform: 'capitalize' }]}>
                    {viewingInterview?.interview_type === 'admission' ? 'Admission Interview' : '14-Day Progress Review'}
                  </Text>
                </View>
                <View style={styles.calcRow}>
                  <Text style={[styles.calcLabel, { color: colors.textSecondary }]}>Level Assigned:</Text>
                  <View style={[
                    styles.levelBadgeInline,
                    { backgroundColor: viewingInterview?.assigned_level === 'Advanced' ? colors.success + '15' : viewingInterview?.assigned_level === 'Intermediate' ? colors.secondary + '15' : colors.danger + '15' }
                  ]}>
                    <Text style={[
                      styles.levelBadgeTextInline,
                      { color: viewingInterview?.assigned_level === 'Advanced' ? colors.success : viewingInterview?.assigned_level === 'Intermediate' ? colors.secondary : colors.danger }
                    ]}>
                      {viewingInterview?.assigned_level}
                    </Text>
                  </View>
                </View>
                <View style={styles.calcRow}>
                  <Text style={[styles.calcLabel, { color: colors.textSecondary }]}>Total Score:</Text>
                  <Text style={[styles.calcValue, { color: colors.text, fontWeight: '700' }]}>
                    {viewingInterview?.total_score} / 50
                  </Text>
                </View>
              </View>

              <Text style={[styles.detailSectionTitle, { color: colors.text }]}>Sub-scores</Text>
              <View style={[styles.detailScoresBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <View style={[styles.detailScoreRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailScoreLabel, { color: colors.text }]}>English Vocabulary & Grammar</Text>
                  <Text style={[styles.detailScoreVal, { color: colors.success }]}>{viewingInterview?.english} / 10</Text>
                </View>
                <View style={[styles.detailScoreRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailScoreLabel, { color: colors.text }]}>Communication Skills</Text>
                  <Text style={[styles.detailScoreVal, { color: colors.success }]}>{viewingInterview?.communication} / 10</Text>
                </View>
                <View style={[styles.detailScoreRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailScoreLabel, { color: colors.text }]}>Confidence Level</Text>
                  <Text style={[styles.detailScoreVal, { color: colors.success }]}>{viewingInterview?.confidence} / 10</Text>
                </View>
                <View style={[styles.detailScoreRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailScoreLabel, { color: colors.text }]}>Technical Skills & Aptitude</Text>
                  <Text style={[styles.detailScoreVal, { color: colors.success }]}>{viewingInterview?.technical_skills} / 10</Text>
                </View>
                <View style={styles.detailScoreRow}>
                  <Text style={[styles.detailScoreLabel, { color: colors.text }]}>Learning Ability</Text>
                  <Text style={[styles.detailScoreVal, { color: colors.success }]}>{viewingInterview?.learning_ability} / 10</Text>
                </View>
              </View>

              <Text style={[styles.detailSectionTitle, { color: colors.text }]}>Strengths</Text>
              <View style={[styles.detailTextArea, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.text }}>{viewingInterview?.strengths || 'None logged.'}</Text>
              </View>

              <Text style={[styles.detailSectionTitle, { color: colors.text }]}>Weaknesses</Text>
              <View style={[styles.detailTextArea, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.text }}>{viewingInterview?.weaknesses || 'None logged.'}</Text>
              </View>

              <Text style={[styles.detailSectionTitle, { color: colors.text }]}>Recommendations / Notes</Text>
              <View style={[styles.detailTextArea, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.text }}>{viewingInterview?.recommendations || 'None logged.'}</Text>
              </View>

              <Button
                title="Close"
                onPress={() => setViewingInterview(null)}
                style={{ backgroundColor: colors.secondary, marginTop: 20, borderRadius: 12, height: 45 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  filterContainer: {
    padding: 16,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 16,
  },
  filterTab: {
    paddingVertical: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  historyCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  historyDate: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 12,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalStudentSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  calcCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calcLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  calcValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  levelBadgeInline: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  levelBadgeTextInline: {
    fontSize: 10,
    fontWeight: '800',
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  detailScoresBox: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  detailScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  detailScoreLabel: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  detailScoreVal: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  detailTextArea: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    marginBottom: 16,
  },
});
