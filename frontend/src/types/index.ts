// Mirrors backend Pydantic schemas

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type PipelineStage =
  | "downloading"
  | "transcribing"
  | "analyzing"
  | "generating_tabs"
  | "done";

export type ChordFunction =
  | "tonic"
  | "subdominant"
  | "dominant"
  | "secondary"
  | "borrowed"
  | "other";

export interface NoteEvent {
  pitch: number;
  start_time: number;
  end_time: number;
  velocity: number;
  name: string;
}

export interface ChordEvent {
  name: string;
  roman_numeral: string;
  function: ChordFunction;
  start_time: number;
  end_time: number;
  notes: string[];
}

export interface GuitarTabNote {
  string: number;
  fret: number;
  start_time: number;
  end_time: number;
  pitch: number;
}

export interface GuitarTabChord {
  name: string;
  frets: number[];
  start_time: number;
  end_time: number;
}

export interface TheoryAnnotation {
  time: number;
  title: string;
  description: string;
  category: string;
  detail: string;
}

export interface SongSection {
  name: string;
  start_time: number;
  end_time: number;
}

export interface SongAnalysis {
  title: string;
  duration: number;
  key: string;
  key_confidence: number;
  mode: string;
  tempo: number;
  time_signature: string;
  notes: NoteEvent[];
  chords: ChordEvent[];
  guitar_tab_notes: GuitarTabNote[];
  guitar_tab_chords: GuitarTabChord[];
  theory_annotations: TheoryAnnotation[];
  sections: SongSection[];
}

export interface AnalyzeResponse {
  job_id: string;
  status: JobStatus;
}

export interface JobStatusResponse {
  id: string;
  status: JobStatus;
  stage: PipelineStage;
  progress: number;
  result: SongAnalysis | null;
  error: string | null;
}

export interface ModeInfo {
  name: string;
  scale_degrees: string[];
  intervals: string[];
  character: string;
  example_songs: string[];
}

export interface SecondaryDominant {
  target: string;
  chord: string;
  roman: string;
  description: string;
}
