import type { AnalysisResponse, FeatureScoring } from '../types/api';

/**
 * Mock API response data for development/testing
 */
export const mockAnalysisResponse: AnalysisResponse = {
  prioritized_concept_list: [
    {
      name: 'Concept Alpha',
      id: 'concept-1',
      rank: 1,
      need: 'User needs faster onboarding',
      average_z_score: 2.4,
      disagreement: 0.3,
      concensus_weight: 0.85,
      final_score: 8.7,
    },
    {
      name: 'Concept Beta',
      id: 'concept-2',
      rank: 2,
      need: 'Users want better collaboration',
      average_z_score: 1.8,
      disagreement: 0.5,
      concensus_weight: 0.72,
      final_score: 7.2,
    },
    {
      name: 'Concept Gamma',
      id: 'concept-3',
      rank: 3,
      need: 'Need for real-time updates',
      average_z_score: 1.2,
      disagreement: 0.8,
      concensus_weight: 0.65,
      final_score: 5.8,
    },
  ],
  highest_scoring_concept: {
    name: 'Concept Alpha',
    id: 'concept-1',
    description:
      'A comprehensive solution that addresses the primary user need for faster onboarding through an intuitive wizard-based approach with contextual help and progressive disclosure of features.',
  },
  insights: [
    {
      strong_concensus:
        'All participants agreed that onboarding speed is the top priority.',
      high_disagreement:
        'Significant disagreement on the importance of advanced customization features.',
      other_data_patterns:
        'Clear cluster of preferences around simplicity over feature richness.',
    },
  ],
  features_and_themes: [
    {
      theme: { title: 'Onboarding', need: 'Faster user activation' },
      feature: 'Interactive Tutorial',
      rationale: 'Reduces time to first value by 40%',
    },
    {
      theme: { title: 'Collaboration', need: 'Team coordination' },
      feature: 'Real-time Sync',
      rationale: 'Enables seamless team workflows',
    },
    {
      theme: { title: 'Efficiency', need: 'Reduce manual work' },
      feature: 'Auto-save & Recovery',
      rationale: 'Prevents data loss and saves time',
    },
  ],
};

/**
 * Generate mock feature scoring data based on parsed board data
 */
export function generateMockFeatureScoring(
  participants: number,
  featuresPerParticipant: number
): FeatureScoring[] {
  const criticalityLevels = ['High', 'Medium', 'Low', 'Critical'];
  const featureNames = [
    'Search Functionality',
    'User Dashboard',
    'Notification System',
    'Export Options',
    'Custom Themes',
    'API Integration',
    'Offline Mode',
    'Multi-language Support',
  ];
  const descriptions = [
    'Enables quick content discovery',
    'Centralized user information view',
    'Real-time alerts and updates',
    'Data portability features',
    'Personalization options',
    'Third-party connectivity',
    'Works without internet',
    'Global accessibility',
  ];

  const results: FeatureScoring[] = [];

  for (let p = 1; p <= participants; p++) {
    for (let f = 0; f < featuresPerParticipant; f++) {
      results.push({
        participant: `participant-${p}`,
        feature_name: featureNames[f % featureNames.length],
        feature_description: descriptions[f % descriptions.length],
        criticality: criticalityLevels[Math.floor(Math.random() * criticalityLevels.length)],
      });
    }
  }

  return results;
}
