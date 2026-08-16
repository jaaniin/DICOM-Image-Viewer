import { DICOMStudy } from './types';
import { formatDicomDate, formatDicomTime } from './formatters';

export interface ReportGenerationParams {
  studies: DICOMStudy[];
  findings: string;
  timestamp?: Date;
}

export function generateReportText({ studies, findings, timestamp = new Date() }: ReportGenerationParams): string {
  const pad = (num: number) => num.toString().padStart(2, '0');
  
  const year = timestamp.getFullYear();
  const month = pad(timestamp.getMonth() + 1);
  const day = pad(timestamp.getDate());
  const hours = pad(timestamp.getHours());
  const minutes = pad(timestamp.getMinutes());
  const seconds = pad(timestamp.getSeconds());
  
  const reportDateStr = `${year}-${month}-${day}`;
  const reportTimeStr = `${hours}:${minutes}:${seconds}`;

  const lines: string[] = [];

  // Header
  lines.push('======================================================================');
  lines.push('REPORT');
  lines.push('======================================================================');
  lines.push(`Report Date: ${reportDateStr}`);
  lines.push(`Report Time: ${reportTimeStr}`);
  lines.push('');

  // Study Information
  lines.push('----------------------------------------------------------------------');
  lines.push('STUDY INFORMATION');
  lines.push('----------------------------------------------------------------------');

  if (studies.length === 0) {
    lines.push('No studies loaded.');
    lines.push('');
  } else {
    studies.forEach((study, index) => {
      lines.push(`Study ${index + 1}:`);
      lines.push(`  Patient Name:        ${study.patientName || 'Unknown Patient'}`);
      lines.push(`  Patient ID:          ${study.patientId || 'Unknown ID'}`);
      lines.push(`  Study Date:          ${formatDicomDate(study.studyDate)}`);
      lines.push(`  Study Time:          ${formatDicomTime(study.studyTime) || 'Unknown'}`);
      lines.push(`  Study Description:   ${study.studyDescription || 'Unknown'}`);
      lines.push(`  Institution:         ${study.institutionName || 'Unknown'}`);
      lines.push('');
    });
  }

  // Findings
  lines.push('----------------------------------------------------------------------');
  lines.push('Findings:');
  lines.push('----------------------------------------------------------------------');
  lines.push(findings && findings.trim().length > 0 ? findings.trim() : '');
  lines.push('');
  lines.push('======================================================================');
  lines.push('END OF REPORT');
  lines.push('======================================================================');

  return lines.join('\n');
}

export function generateReportFilename(studies: DICOMStudy[], timestamp = new Date()): string {
  const pad = (num: number) => num.toString().padStart(2, '0');
  const dateStr = `${timestamp.getFullYear()}${pad(timestamp.getMonth() + 1)}${pad(timestamp.getDate())}`;
  const timeStr = `${pad(timestamp.getHours())}${pad(timestamp.getMinutes())}${pad(timestamp.getSeconds())}`;
  
  let patientClean = 'DICOM_Study';
  if (studies.length > 0 && studies[0].patientName) {
    patientClean = studies[0].patientName
      .replace(/[\^\\/:\*\?"<>\|]/g, '_')
      .replace(/\s+/g, '_')
      .trim();
  } else if (studies.length > 0 && studies[0].patientId) {
    patientClean = studies[0].patientId.replace(/[\^\\/:\*\?"<>\|]/g, '_').trim();
  }

  return `Report_${patientClean}_${dateStr}_${timeStr}.txt`;
}

export function downloadReportFile(content: string, filename: string): boolean {
  try {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 150);
    return true;
  } catch (err) {
    console.error('Failed to download report file', err);
    return false;
  }
}
