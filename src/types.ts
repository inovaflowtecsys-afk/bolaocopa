
export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  photoUrl: string;
  championPrediction: string;
  isPaid: boolean;
  isAdmin: boolean;
  totalPoints: number;
}

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeFlagUrl?: string;
  awayFlagUrl?: string;
  location?: string;
  homeScore?: number;
  awayScore?: number;
  date: string;
  group: string;
  status: 'scheduled' | 'finished' | 'live';
}

export interface Bet {
  id: string;
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  pointsEarned?: number;
  isLocked: boolean;
}

export interface AppState {
  users: User[];
  matches: Match[];
  bets: Bet[];
  currentUser: User | null;
  settings: {
    betsLocked: boolean;
    entryFee: number;
    year: string;
    logoUrl: string;
    prizes: {
      firstPlacePercent: number;
      secondPlacePercent: number;
      thirdPlacePercent: number;
      championBonusPercent: number;
    };
  };
}
