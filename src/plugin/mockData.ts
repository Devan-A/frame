import type { AnalysisResponse } from '../types/api';
import type { ParsedBoard } from '../types';

/**
 * Mock API response data for development/testing.
 */
export const mockAnalysisResponse: AnalysisResponse = {
  prioritized_concept_list: [
    {
      name: 'Concept Alpha',
      id: 'concept-1',
      rank: 1,
      need: 'Faster user activation',
      average_z_score: 2.4,
      disagreement: 0.3,
      concensus_weight: 0.85,
      final_score: 8.7,
    },
    {
      name: 'Concept Beta',
      id: 'concept-2',
      rank: 2,
      need: 'Better team collaboration',
      average_z_score: 1.8,
      disagreement: 0.5,
      concensus_weight: 0.72,
      final_score: 7.2,
    },
    {
      name: 'Concept Gamma',
      id: 'concept-3',
      rank: 3,
      need: 'Real-time data updates',
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
      'A comprehensive solution that addresses the primary user need for faster onboarding through an intuitive wizard-based approach with contextual help and progressive disclosure of features. Participants strongly aligned on prioritising simplicity over feature richness.',
  },
  insights: [
    {
      strong_concensus: 'All participants agreed that onboarding speed is the top priority.',
      high_disagreement: 'Significant disagreement on advanced customisation features.',
      other_data_patterns: 'Clear cluster of preferences around simplicity over feature richness.',
    },
  ],
  features_and_themes: [
    {
      theme: { title: 'Onboarding',     need: 'Faster user activation'  },
      feature: 'Interactive Tutorial',
      rationale: 'Reduces time to first value by 40%',
    },
    {
      theme: { title: 'Collaboration',  need: 'Team coordination'        },
      feature: 'Real-time Sync',
      rationale: 'Enables seamless multi-user workflows',
    },
    {
      theme: { title: 'Reliability',    need: 'Prevent data loss'        },
      feature: 'Auto-save & Recovery',
      rationale: 'Eliminates manual save friction',
    },
    {
      theme: { title: 'Accessibility',  need: 'Global reach'             },
      feature: 'Multi-language Support',
      rationale: 'Opens product to non-English markets',
    },
    {
      theme: { title: 'Extensibility',  need: 'Third-party connectivity' },
      feature: 'API Integration Layer',
      rationale: 'Reduces integration effort by 60%',
    },
  ],
};

/**
 * Mock parsed board data used when visualising the draw-to-board flow.
 * Contains 3 concepts × 3 participants × 5 features each.
 */
export const mockParsedBoard: ParsedBoard = {
  concepts: [
    {
      index: 1,
      nodeId: 'mock-concept-1',
      averageScore: 3.3,
      aggregatedFeatures: [],
      participants: [
        {
          index: 1,
          nodeId: 'mock-p1',
          conceptScore: 4,
          features: [
            { index: 1, title: 'Interactive Tutorial',    description: 'Guided step-by-step walkthrough for new users'      },
            { index: 2, title: 'Real-time Sync',          description: 'Live collaboration across multiple team members'     },
            { index: 3, title: 'Auto-save & Recovery',    description: 'Automatic periodic saves with one-click restore'     },
            { index: 4, title: 'Multi-language Support',  description: 'UI available in 12 languages at launch'              },
            { index: 5, title: 'API Integration Layer',   description: 'REST and webhook support for third-party services'   },
          ],
        },
        {
          index: 2,
          nodeId: 'mock-p2',
          conceptScore: 3,
          features: [
            { index: 1, title: 'Onboarding Wizard',       description: 'Contextual setup flow based on user role'            },
            { index: 2, title: 'Notification Centre',     description: 'Unified inbox for all system and team alerts'        },
            { index: 3, title: 'Export Options',          description: 'Download data as CSV, JSON, or PDF'                  },
            { index: 4, title: 'Dark Mode',               description: 'System-aware theme switching'                        },
            { index: 5, title: 'Offline Mode',            description: 'Core features available without internet access'     },
          ],
        },
        {
          index: 3,
          nodeId: 'mock-p3',
          conceptScore: 3,
          features: [
            { index: 1, title: 'Search & Filters',        description: 'Full-text search with faceted filtering'             },
            { index: 2, title: 'Role-based Access',       description: 'Granular permissions per user and team'              },
            { index: 3, title: 'Audit Log',               description: 'Tamper-proof record of all user actions'             },
            { index: 4, title: 'Custom Dashboards',       description: 'Drag-and-drop widget layout per user preference'     },
            { index: 5, title: 'Scheduled Reports',       description: 'Automated email delivery of key metrics'             },
          ],
        },
      ],
    },
  ],
  totalParticipants: 3,
  totalFeatures: 15,
  lastParsed: new Date().toISOString(),
};
