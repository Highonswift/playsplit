/** Cricket scoring domain types (Enhancement Phase 3, §8–9, §12). */

export type ExtraType = 'wide' | 'noball' | 'bye' | 'legbye' | 'penalty';

export type DismissalType =
  | 'bowled' | 'caught' | 'lbw' | 'run_out' | 'stumped' | 'hit_wicket'
  | 'retired_out' | 'retired_hurt' | 'obstructing' | 'hit_twice' | 'timed_out';

export interface Wicket {
  type: DismissalType;
  /** Which batter is dismissed (run-outs can dismiss the non-striker). */
  outEnd: 'striker' | 'nonstriker';
  fielderId?: string;
  bowlerCredited?: boolean; // false for run_out/retired/obstructing/timed_out
  incomingBatterId?: string;
  crossed?: boolean;        // batters crossed before the dismissal completed
}

/** One recorded delivery — the physical event, as entered by the umpire. */
export interface Ball {
  bowlerId: string;
  runsBat: number;           // runs off the bat (0..6+)
  extra: ExtraType | null;
  extraRuns: number;         // byes/leg-byes runs, extra wide runs, penalty runs, overthrows
  wicket: Wicket | null;
}

export interface InningsSetup {
  battingTeamId: string;
  bowlingTeamId: string;
  strikerId: string;
  nonStrikerId: string;
  maxOvers: number | null;   // null = unlimited
  playersPerSide: number;
}

export interface BatCard {
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  dismissal: string | null;   // short label, e.g. "bowled", "c & b", "run out"
  dismissalType?: DismissalType;
  outBowlerId?: string;       // for UI to render names
  outFielderId?: string;
  order: number;
  strikeRate: number;
}

export interface BowlCard {
  playerId: string;
  legalBalls: number;
  runs: number;
  wickets: number;
  maidens: number;
  wides: number;
  noballs: number;
  dots: number;
}

export interface Partnership {
  batter1: string;
  batter2: string;
  runs: number;
  balls: number;
  unbroken: boolean;
}

export interface FallOfWicket {
  wicketNumber: number;
  score: number;
  outPlayerId: string;
  over: string; // "12.3"
}

/** Per-delivery record for commentary & the timeline (§9.4). */
export interface TimelineEntry {
  over: string;          // "3.2"
  strikerId: string;
  bowlerId: string;
  runsBat: number;
  extra: ExtraType | null;
  extraRuns: number;
  wicketType?: DismissalType;
  wicketOutId?: string;
}

export interface InningsState {
  battingTeamId: string;
  bowlingTeamId: string;
  totalRuns: number;
  wickets: number;
  legalBalls: number;
  oversText: string;         // "16.3"
  maxOvers: number | null;
  extras: { wide: number; noball: number; bye: number; legbye: number; penalty: number; total: number };
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  batting: BatCard[];
  bowling: BowlCard[];
  partnerships: Partnership[];
  fallOfWickets: FallOfWicket[];
  currentOver: string[];     // e.g. ["1", "W", "4", "wd"]
  timeline: TimelineEntry[];
  runRate: number;
  complete: boolean;
}
