import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { StudentAttendanceReport } from '../types';
import { buildAttendanceReportHtml } from '../utils/pdfReportHtml';

async function getLogoDataUri(): Promise<string | undefined> {
  try {
    const assets = await Asset.loadAsync(require('../assets/images/icon.png'));
    if (!assets || assets.length === 0) return undefined;
    
    const asset = assets[0];
    if (!asset || !asset.localUri) return undefined;

    const base64 = await FileSystem.readAsStringAsync(
      asset.localUri,
      {
        encoding: FileSystem.EncodingType.Base64,
      }
    );

    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.warn('Failed to load logo asset for PDF:', error);
    return undefined;
  }
}

function buildFileName(report: StudentAttendanceReport): string {
  const safeName = report.student.name
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();

  const date = new Date().toISOString().slice(0, 10);

  return `attendance_${safeName}_${date}.pdf`;
}

export const pdfReportService = {
  generatePdfUri: async (
    report: StudentAttendanceReport
  ): Promise<string> => {
    const logo = await getLogoDataUri();

    const html = buildAttendanceReportHtml(report, logo);

    const result = await Print.printToFileAsync({
      html,
      base64: false,
    });

    // ✅ SAFE CHECK (NO FAKE ERROR)
    if (!result || !result.uri) {
      console.log('PDF generated but URI missing');
      return '';
    }

    return result.uri;
  },

  sharePdf: async (
    report: StudentAttendanceReport,
    dialogTitle = 'Share attendance report'
  ): Promise<void> => {
    const uri = await pdfReportService.generatePdfUri(report);

    if (!uri) {
      throw new Error('PDF file not found');
    }

    const canShare = await Sharing.isAvailableAsync();

    if (!canShare) {
      throw new Error('Sharing is not available on this device.');
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle,
      UTI: 'com.adobe.pdf',
    });
  },

  downloadPdf: async (
    report: StudentAttendanceReport
  ): Promise<string> => {
    const uri = await pdfReportService.generatePdfUri(report);

    if (!uri) {
      throw new Error('PDF file not found');
    }

    const canShare = await Sharing.isAvailableAsync();

    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Download PDF Report',
        UTI: 'com.adobe.pdf',
      });
    }

    return uri;
  },

  getSuggestedFileName: buildFileName,
};