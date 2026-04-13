import type { ParsedBoard } from '../../types';

/**
 * Downloads a file with the given content and filename via a temporary anchor.
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  var blob = new Blob([content], { type: mimeType });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Escapes a string for safe CSV inclusion.
 */
function escapeCSV(value: string): string {
  if (value.indexOf(',') >= 0 || value.indexOf('"') >= 0 || value.indexOf('\n') >= 0) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/**
 * Exports parsed board data as a scores CSV matching the backend's
 * user_concept_scores format:
 *   project_name, participant_id, concept_id, concept_name,
 *   score, features_to_include, feature_description
 *
 * One row per participant-concept combination; features are aggregated.
 */
export function exportToScoresCSV(data: ParsedBoard, projectName: string): void {
  var csvHeaders = [
    'project_name',
    'participant_id',
    'concept_id',
    'concept_name',
    'score',
    'features_to_include',
    'feature_description',
  ];

  var rows: string[][] = [];

  for (var c = 0; c < data.concepts.length; c++) {
    var concept = data.concepts[c];
    for (var p = 0; p < concept.participants.length; p++) {
      var participant = concept.participants[p];
      var titles: string[] = [];
      var descs: string[] = [];
      for (var f = 0; f < participant.features.length; f++) {
        var feat = participant.features[f];
        if (feat.title && feat.title !== '[untitled]') titles.push(feat.title);
        if (feat.description && feat.description !== '[no description]') descs.push(feat.description);
      }

      rows.push([
        escapeCSV(projectName),
        escapeCSV('participant-' + participant.index),
        escapeCSV('concept-' + concept.index),
        escapeCSV('Concept ' + concept.index),
        participant.conceptScore !== null ? String(participant.conceptScore) : '',
        escapeCSV(titles.join(', ')),
        escapeCSV(descs.join('; ')),
      ]);
    }
  }

  var lines = [csvHeaders.join(',')];
  for (var r = 0; r < rows.length; r++) {
    lines.push(rows[r].join(','));
  }

  var timestamp = new Date().toISOString().slice(0, 10);
  downloadFile(
    lines.join('\n'),
    projectName.replace(/\s+/g, '_') + '-scores-' + timestamp + '.csv',
    'text/csv',
  );
}
