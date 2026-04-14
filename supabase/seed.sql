-- Dados iniciais para facilitar testes locais e homologacao.
-- Execute depois do arquivo schema.sql.

insert into public.matches (
  home_team,
  away_team,
  "group",
  date,
  status,
  location,
  home_flag_url,
  away_flag_url
)
values
  ('Mexico', 'A2', 'A', '2026-06-11T16:00:00Z', 'scheduled', 'Estadio Azteca, Cidade do Mexico', 'https://flagcdn.com/w80/mx.png', 'https://flagcdn.com/w80/un.png'),
  ('Canada', 'A4', 'A', '2026-06-12T13:00:00Z', 'scheduled', 'BMO Field, Toronto', 'https://flagcdn.com/w80/ca.png', 'https://flagcdn.com/w80/un.png'),
  ('EUA', 'D2', 'D', '2026-06-12T19:00:00Z', 'scheduled', 'SoFi Stadium, Los Angeles', 'https://flagcdn.com/w80/us.png', 'https://flagcdn.com/w80/un.png'),
  ('Brasil', 'B2', 'B', '2026-06-13T16:00:00Z', 'scheduled', 'MetLife Stadium, New Jersey', 'https://flagcdn.com/w80/br.png', 'https://flagcdn.com/w80/un.png'),
  ('Argentina', 'C2', 'C', '2026-06-14T13:00:00Z', 'scheduled', 'AT&T Stadium, Dallas', 'https://flagcdn.com/w80/ar.png', 'https://flagcdn.com/w80/un.png'),
  ('Franca', 'E2', 'E', '2026-06-15T16:00:00Z', 'scheduled', 'Mercedes-Benz Stadium, Atlanta', 'https://flagcdn.com/w80/fr.png', 'https://flagcdn.com/w80/un.png'),
  ('Alemanha', 'F2', 'F', '2026-06-16T13:00:00Z', 'scheduled', 'Hard Rock Stadium, Miami', 'https://flagcdn.com/w80/de.png', 'https://flagcdn.com/w80/un.png'),
  ('Espanha', 'G2', 'G', '2026-06-17T16:00:00Z', 'scheduled', 'Lumen Field, Seattle', 'https://flagcdn.com/w80/es.png', 'https://flagcdn.com/w80/un.png'),
  ('Inglaterra', 'H2', 'H', '2026-06-18T13:00:00Z', 'scheduled', 'Levis Stadium, San Francisco', 'https://flagcdn.com/w80/gb-eng.png', 'https://flagcdn.com/w80/un.png'),
  ('Portugal', 'A3', 'A', '2026-06-19T16:00:00Z', 'scheduled', 'Gillette Stadium, Boston', 'https://flagcdn.com/w80/pt.png', 'https://flagcdn.com/w80/un.png');
