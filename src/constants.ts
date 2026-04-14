
import { Match, Bet, User } from './types';

export const SCORING_RULES = {
  EXACT_SCORE: 20,
  DRAW: 10,
  WINNER: 5,
  INVERTED: 2,
  NONE: 0,
};

export const calculatePoints = (bet: Bet, match: Match, isBetsLocked: boolean = false): number => {
  // Pontos só são calculados se o bloqueio estiver ativo
  if (!isBetsLocked) return 0;
  
  if (match.homeScore === undefined || match.awayScore === undefined) return 0;

  const { homeScore: bh, awayScore: ba } = bet;
  const { homeScore: mh, awayScore: ma } = match;

  // Exact score
  if (bh === mh && ba === ma) return SCORING_RULES.EXACT_SCORE;

  // Draw (different score)
  if (mh === ma && bh === ba) return SCORING_RULES.DRAW;

  // Winner
  const matchWinner = mh > ma ? 'home' : mh < ma ? 'away' : 'draw';
  const betWinner = bh > ba ? 'home' : bh < ba ? 'away' : 'draw';

  if (matchWinner === betWinner) return SCORING_RULES.WINNER;

  // Inverted score
  if (bh === ma && ba === mh) return SCORING_RULES.INVERTED;

  return SCORING_RULES.NONE;
};

export const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export const COUNTRIES = [
  { name: 'Brasil', flag: '🇧🇷' },
  { name: 'Argentina', flag: '🇦🇷' },
  { name: 'França', flag: '🇫🇷' },
  { name: 'Alemanha', flag: '🇩🇪' },
  { name: 'Espanha', flag: '🇪🇸' },
  { name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { name: 'Portugal', flag: '🇵🇹' },
  { name: 'Itália', flag: '🇮🇹' },
  { name: 'Bélgica', flag: '🇧🇪' },
  { name: 'Holanda', flag: '🇳🇱' },
  { name: 'Uruguai', flag: '🇺🇾' },
  { name: 'México', flag: '🇲🇽' },
  { name: 'EUA', flag: '🇺🇸' },
  { name: 'Canadá', flag: '🇨🇦' },
  { name: 'Japão', flag: '🇯🇵' },
  { name: 'Coreia do Sul', flag: '🇰🇷' },
  { name: 'Marrocos', flag: '🇲🇦' },
  { name: 'Senegal', flag: '🇸🇳' },
  { name: 'Suíça', flag: '🇨🇭' },
  { name: 'Croácia', flag: '🇭🇷' },
];

export const MOCK_MATCHES: Match[] = [
  { 
    id: '1', 
    homeTeam: 'México', 
    awayTeam: 'A2', 
    homeFlagUrl: 'https://flagcdn.com/w80/mx.png',
    awayFlagUrl: 'https://flagcdn.com/w80/un.png',
    location: 'Estádio Azteca, Cidade do México',
    date: '2026-06-11T16:00:00Z', 
    group: 'A', 
    status: 'scheduled' 
  },
  { 
    id: '2', 
    homeTeam: 'Canadá', 
    awayTeam: 'A4', 
    homeFlagUrl: 'https://flagcdn.com/w80/ca.png',
    awayFlagUrl: 'https://flagcdn.com/w80/un.png',
    location: 'BMO Field, Toronto',
    date: '2026-06-12T13:00:00Z', 
    group: 'A', 
    status: 'scheduled' 
  },
  { 
    id: '3', 
    homeTeam: 'EUA', 
    awayTeam: 'D2', 
    homeFlagUrl: 'https://flagcdn.com/w80/us.png',
    awayFlagUrl: 'https://flagcdn.com/w80/un.png',
    location: 'SoFi Stadium, Los Angeles',
    date: '2026-06-12T19:00:00Z', 
    group: 'D', 
    status: 'scheduled' 
  },
  { 
    id: '4', 
    homeTeam: 'Brasil', 
    awayTeam: 'B2', 
    homeFlagUrl: 'https://flagcdn.com/w80/br.png',
    awayFlagUrl: 'https://flagcdn.com/w80/un.png',
    location: 'MetLife Stadium, New Jersey',
    date: '2026-06-13T16:00:00Z', 
    group: 'B', 
    status: 'scheduled' 
  },
  { 
    id: '5', 
    homeTeam: 'Argentina', 
    awayTeam: 'C2', 
    homeFlagUrl: 'https://flagcdn.com/w80/ar.png',
    awayFlagUrl: 'https://flagcdn.com/w80/un.png',
    location: 'AT&T Stadium, Dallas',
    date: '2026-06-14T13:00:00Z', 
    group: 'C', 
    status: 'scheduled' 
  },
  { 
    id: '6', 
    homeTeam: 'França', 
    awayTeam: 'E2', 
    homeFlagUrl: 'https://flagcdn.com/w80/fr.png',
    awayFlagUrl: 'https://flagcdn.com/w80/un.png',
    location: 'Mercedes-Benz Stadium, Atlanta',
    date: '2026-06-15T16:00:00Z', 
    group: 'E', 
    status: 'scheduled' 
  },
  { 
    id: '7', 
    homeTeam: 'Alemanha', 
    awayTeam: 'F2', 
    homeFlagUrl: 'https://flagcdn.com/w80/de.png',
    awayFlagUrl: 'https://flagcdn.com/w80/un.png',
    location: 'Hard Rock Stadium, Miami',
    date: '2026-06-16T13:00:00Z', 
    group: 'F', 
    status: 'scheduled' 
  },
  { 
    id: '8', 
    homeTeam: 'Espanha', 
    awayTeam: 'G2', 
    homeFlagUrl: 'https://flagcdn.com/w80/es.png',
    awayFlagUrl: 'https://flagcdn.com/w80/un.png',
    location: 'Lumen Field, Seattle',
    date: '2026-06-17T16:00:00Z', 
    group: 'G', 
    status: 'scheduled' 
  },
  { 
    id: '9', 
    homeTeam: 'Inglaterra', 
    awayTeam: 'H2', 
    homeFlagUrl: 'https://flagcdn.com/w80/gb-eng.png',
    awayFlagUrl: 'https://flagcdn.com/w80/un.png',
    location: 'Levi\'s Stadium, San Francisco',
    date: '2026-06-18T13:00:00Z', 
    group: 'H', 
    status: 'scheduled' 
  },
  { 
    id: '10', 
    homeTeam: 'Portugal', 
    awayTeam: 'A3', 
    homeFlagUrl: 'https://flagcdn.com/w80/pt.png',
    awayFlagUrl: 'https://flagcdn.com/w80/un.png',
    location: 'Gillette Stadium, Boston',
    date: '2026-06-19T16:00:00Z', 
    group: 'A', 
    status: 'scheduled' 
  },
];

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Admin', email: 'admin@bolao.com', password: 'admin', photoUrl: 'https://picsum.photos/seed/admin/100/100', championPrediction: 'Brasil', isPaid: true, isAdmin: true, totalPoints: 120 },
  { id: 'u2', name: 'João Silva', email: 'joao@email.com', password: '123', photoUrl: 'https://picsum.photos/seed/joao/100/100', championPrediction: 'Argentina', isPaid: true, isAdmin: false, totalPoints: 95 },
  { id: 'u3', name: 'Maria Oliveira', email: 'maria@email.com', password: '123', photoUrl: 'https://picsum.photos/seed/maria/100/100', championPrediction: 'França', isPaid: true, isAdmin: false, totalPoints: 88 },
  { id: 'u4', name: 'Pedro Santos', email: 'pedro@email.com', password: '123', photoUrl: 'https://picsum.photos/seed/pedro/100/100', championPrediction: 'Brasil', isPaid: false, isAdmin: false, totalPoints: 45 },
];
