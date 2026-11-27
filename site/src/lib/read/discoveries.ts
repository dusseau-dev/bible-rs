import type { StudyPassage, StudySource, Tradition, DiscoveryStatus } from './study';

export type EvidenceUnit = {
  id: string; text: string; sourceIds: string[];
  basis: 'text' | 'history' | 'inference' | 'interpretation';
  tradition: Tradition;
};
export type Discovery = {
  id: string; category: 'history' | 'related' | 'academic' | 'reflection';
  title: EvidenceUnit; explanation: EvidenceUnit[]; payoff: EvidenceUnit;
};
export type ResearchImage = {
  id: string; src: string; sourceUrl: string; sourceId: string;
  credit: string; license: string; licenseUrl: string;
  date: string | null; provenance: string | null;
  depiction: 'artifact' | 'manuscript' | 'excavation' | 'reconstruction' | 'artwork';
  alt: string; caption: EvidenceUnit;
};
export type VisualNode = {
  id: string; label: EvidenceUnit;
  x: number | null; y: number | null;
  xLow: number | null; xHigh: number | null;
  yLow: number | null; yHigh: number | null;
};
export type LessonVisual = {
  kind: 'relationships' | 'timeline' | 'structure' | 'geography' | 'quantitative';
  nodes: VisualNode[];
  edges: Array<{ from: string; to: string; label: EvidenceUnit }>;
  xLabel: string | null; yLabel: string | null;
  xUnit: string | null; yUnit: string | null;
  explanation: EvidenceUnit; limitations: string;
};
export type LessonSection = {
  kind: 'discovery' | 'passage' | 'evidence' | 'disagreement' | 'payoff';
  units: EvidenceUnit[];
};
export type Lesson = {
  discoveryId: string; sections: LessonSection[];
  exercise: { passages: StudyPassage[]; questions: [string, string, string] };
  visual: LessonVisual; images: ResearchImage[];
};
export type DiscoveryBundle = {
  packetId: string | null; evidenceVersion: string; promptVersion: string;
  items: Discovery[];
  research: Record<'scholarship' | 'questions' | 'news', DiscoveryStatus>;
};
export type LessonResponse =
  | { status: 'complete'; lesson: Lesson; sources: StudySource[] }
  | { status: 'insufficient'; message: string }
  | { status: 'pending' | 'unavailable' | 'expired'; message: string };
