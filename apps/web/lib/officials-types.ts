// Pure officials types & constants — safe to import from client OR server.

export interface Official {
  user_id: string;
  full_name: string | null;
  role: string;
  can_score: boolean;
}

export const OFFICIAL_ROLES = [
  { value: 'umpire1', label: 'On-field umpire 1' },
  { value: 'umpire2', label: 'On-field umpire 2' },
  { value: 'third_umpire', label: 'Third umpire' },
  { value: 'reserve', label: 'Reserve umpire' },
  { value: 'scorer', label: 'Scorer' },
  { value: 'referee', label: 'Match referee' },
];
