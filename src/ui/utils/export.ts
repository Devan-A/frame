import type { ParsedBoard } from '../../types';

/**
 * Downloads a file with the given content and filename.
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports the parsed board data as a JSON file.
 */
export function exportToJSON(data: ParsedBoard): void {
  const jsonString = JSON.stringify(data, null, 2);
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadFile(jsonString, `concept-board-${timestamp}.json`, 'application/json');
}

/**
 * Exports the parsed board data as a CSV file.
 * Flattens the hierarchical data into rows.
 */
export function exportToCSV(data: ParsedBoard): void {
  const headers = [
    'concept_index',
    'concept_avg_score',
    'participant_index',
    'participant_score',
    'feature_index',
    'feature_title',
    'feature_description',
  ];

  const rows: string[][] = [];

  for (const concept of data.concepts) {
    if (concept.participants.length === 0) {
      rows.push([
        String(concept.index),
        concept.averageScore !== null ? String(concept.averageScore) : 'N/A',
        '',
        '',
        '',
        '',
        '',
      ]);
      continue;
    }

    for (const participant of concept.participants) {
      if (participant.features.length === 0) {
        rows.push([
          String(concept.index),
          concept.averageScore !== null ? String(concept.averageScore) : 'N/A',
          String(participant.index),
          participant.conceptScore !== null ? String(participant.conceptScore) : 'N/A',
          '',
          '',
          '',
        ]);
        continue;
      }

      for (const feature of participant.features) {
        rows.push([
          String(concept.index),
          concept.averageScore !== null ? String(concept.averageScore) : 'N/A',
          String(participant.index),
          participant.conceptScore !== null ? String(participant.conceptScore) : 'N/A',
          String(feature.index),
          escapeCSV(feature.title),
          escapeCSV(feature.description),
        ]);
      }
    }
  }

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  const timestamp = new Date().toISOString().slice(0, 10);
  downloadFile(csvContent, `concept-board-${timestamp}.csv`, 'text/csv');
}

/**
 * Escapes a string for CSV format.
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
