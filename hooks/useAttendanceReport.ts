import { useCallback, useState } from 'react';
import { pdfReportService } from '../services/pdfReportService';
import { reportService } from '../services/reportService';
import { StudentAttendanceReport } from '../types';

export const useAttendanceReport = (
  teacherId: string | undefined,
  courseId: string | undefined,
  studentId: string | undefined
) => {
  const [report, setReport] = useState<StudentAttendanceReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (!teacherId || !courseId || !studentId) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await reportService.getStudentAttendanceReport(
        teacherId,
        courseId,
        studentId
      );
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load report data');
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [teacherId, courseId, studentId]);

  const downloadPdf = useCallback(async () => {
    if (!report) return;
    try {
      setIsExporting(true);
      setError(null);
      await pdfReportService.downloadPdf(report);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setIsExporting(false);
    }
  }, [report]);

  const shareToParent = useCallback(async () => {
    if (!report) return;
    try {
      setIsExporting(true);
      setError(null);
      await pdfReportService.sharePdf(report, 'Share report with parent');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to share PDF');
    } finally {
      setIsExporting(false);
    }
  }, [report]);

  return {
    report,
    isLoading,
    isExporting,
    error,
    loadReport,
    downloadPdf,
    shareToParent,
  };
};
