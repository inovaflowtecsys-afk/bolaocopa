import * as React from 'react';
import { useAppState } from './hooks/useAppState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Trophy, Users, DollarSign, Calendar, Shield, LogOut, UserPlus, Filter, Lock, Unlock, Pencil, Trash2, PieChart as PieChartIcon, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { GROUPS, COUNTRIES, SCORING_RULES, calculatePoints } from './constants';
import { Match, User, Bet } from './types';
import { isSupabaseConfigured, supabaseConfigError } from './lib/supabase';
import { supabase } from './lib/supabase';

export default function App() {
  const appInfoLabel = `Inovaflowtec v${__APP_VERSION__} - ${__BUILD_DATE__}`;

  const { state, login, logout, registerUser, placeBet, updateMatchResult, togglePaymentStatus, toggleAdminStatus, toggleBetsLock, addMatch, updateMatch, deleteMatch, deleteUser, setEntryFee, setYear, setLogoUrl, setPrizeSettings, resetState } = useAppState();
  const supabaseReady = isSupabaseConfigured;
  const [activeTab, setActiveTab] = React.useState('matches');
  const [groupFilter, setGroupFilter] = React.useState('all');
  const [isRegistering, setIsRegistering] = React.useState(false);
  const [selectedMatch, setSelectedMatch] = React.useState<Match | null>(null);
  const [betScores, setBetScores] = React.useState({ home: 0, away: 0 });
  const [loginForm, setLoginForm] = React.useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = React.useState(false);
  const [isForgotPassword, setIsForgotPassword] = React.useState(false);
  const [isResetPassword, setIsResetPassword] = React.useState(false);
  const [forgotEmail, setForgotEmail] = React.useState('');
  const [resetPasswordForm, setResetPasswordForm] = React.useState({ password: '', confirmPassword: '' });
  const [resetPasswordError, setResetPasswordError] = React.useState<string | null>(null);
  const [base64Photo, setBase64Photo] = React.useState<string>('');
  const [adminMatchFilter, setAdminMatchFilter] = React.useState('all');
  const [viewingBetsMatch, setViewingBetsMatch] = React.useState<Match | null>(null);
  const [viewingUserBets, setViewingUserBets] = React.useState<User | null>(null);
  const [editingMatchId, setEditingMatchId] = React.useState<string | null>(null);
  const [isMatchDialogOpen, setIsMatchDialogOpen] = React.useState(false);
  const [isPendingBetsOpen, setIsPendingBetsOpen] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [isWinnerModalOpen, setIsWinnerModalOpen] = React.useState(false);
  const [prizeForm, setPrizeForm] = React.useState(state.settings.prizes);
  const [newMatch, setNewMatch] = React.useState({ 
    homeTeam: '', 
    awayTeam: '', 
    date: '', 
    group: 'A',
    location: '',
    homeFlagUrl: '',
    awayFlagUrl: ''
  });

  const currentUser = state.currentUser;

  React.useEffect(() => {
    if (currentUser && !currentUser.isAdmin && (activeTab === 'users' || activeTab === 'admin')) {
      setActiveTab('matches');
    }
  }, [currentUser, activeTab]);

  React.useEffect(() => {
    const hasRecoveryHash = window.location.hash.includes('type=recovery');
    if (hasRecoveryHash) {
      setIsResetPassword(true);
      setIsRegistering(false);
      setIsForgotPassword(false);
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResetPassword(true);
        setIsRegistering(false);
        setIsForgotPassword(false);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const filteredMatches = state.matches
    .filter(m => groupFilter === 'all' || m.group === groupFilter)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const sortedUsers = [...state.users].sort((a, b) => b.totalPoints - a.totalPoints);
  const top3 = sortedUsers.slice(0, 3);

  const totalCollected = state.users.filter(u => u.isPaid).length * state.settings.entryFee;

  const totalMatches = state.matches.length;
  const finishedMatches = state.matches.filter(m => m.status === 'finished').length;
  const remainingMatches = totalMatches - finishedMatches;
  const maxPossibleGain = remainingMatches * 20;

  React.useEffect(() => {
    if (finishedMatches === totalMatches && totalMatches > 0) {
      setIsWinnerModalOpen(true);
    }
  }, [finishedMatches, totalMatches]);

  const progressData = [
    { name: 'Encerrados', value: finishedMatches, color: '#10b981' },
    { name: 'Pendentes', value: totalMatches - finishedMatches, color: '#e2e8f0' }
  ];

  const calculateProbabilities = (userPoints: number) => {
    if (remainingMatches === 0) {
      const rank = sortedUsers.findIndex(u => u.totalPoints === userPoints);
      return {
        p1: rank === 0 ? 100 : 0,
        p2: rank === 1 ? 100 : 0,
        p3: rank === 2 ? 100 : 0
      };
    }

    const firstPoints = sortedUsers[0]?.totalPoints || 0;
    const secondPoints = sortedUsers[1]?.totalPoints || 0;
    const thirdPoints = sortedUsers[2]?.totalPoints || 0;

    const getProb = (targetPoints: number, currentPoints: number) => {
      const gap = Math.max(0, targetPoints - currentPoints);
      if (gap === 0) return 85; // High chance if already there
      if (gap > maxPossibleGain) return 0;
      return Math.round((1 - (gap / maxPossibleGain)) * 60); // Scaled chance
    };

    return {
      p1: getProb(firstPoints, userPoints),
      p2: getProb(secondPoints, userPoints),
      p3: getProb(thirdPoints, userPoints)
    };
  };

  const usersWithPendingBets = state.users.map(user => {
    const userBetsCount = state.bets.filter(b => b.userId === user.id).length;
    return {
      ...user,
      pendingCount: Math.max(0, state.matches.length - userBetsCount)
    };
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBase64Photo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const success = await login(loginForm.email, loginForm.password);
    if (success) {
      toast.success('Login realizado com sucesso!');
    } else {
      setLoginError('E-mail ou senha incorretos. Por favor, tente novamente.');
      toast.error('E-mail ou senha incorretos.');
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const champion = formData.get('champion') as string;
    const photoUrl = base64Photo || `https://picsum.photos/seed/${name}/100/100`;

    const success = await registerUser({ name, email, password, championPrediction: champion, photoUrl });
    if (success) {
      setIsRegistering(false);
      setBase64Photo('');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!supabaseReady) {
      toast.error('Configure o Supabase antes de continuar.');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    });

    if (error) {
      toast.error(`Erro ao enviar e-mail: ${error.message}`);
      return;
    }

    toast.success('Enviamos o link de redefinição para seu e-mail.');
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResetPasswordError(null);

    if (resetPasswordForm.password.length < 6) {
      setResetPasswordError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (resetPasswordForm.password !== resetPasswordForm.confirmPassword) {
      setResetPasswordError('As senhas não coincidem.');
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: resetPasswordForm.password,
    });

    if (error) {
      setResetPasswordError(error.message);
      return;
    }

    await supabase.auth.signOut();
    window.history.replaceState({}, document.title, window.location.pathname);

    setResetPasswordForm({ password: '', confirmPassword: '' });
    setIsResetPassword(false);
    setIsForgotPassword(false);
    setIsRegistering(false);
    toast.success('Senha redefinida com sucesso. Faça login com a nova senha.');
  };

  const getPointsRuleLabel = (bet: Bet, match: Match) => {
    const points = calculatePoints(bet, match);

    if (points === SCORING_RULES.EXACT_SCORE) return 'Placar exato';
    if (points === SCORING_RULES.DRAW) return 'Empate';
    if (points === SCORING_RULES.WINNER) return 'Vencedor';
    if (points === SCORING_RULES.INVERTED) return 'Placar invertido';
    return 'Sem pontuação';
  };

  const handleAddMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatch.homeTeam || !newMatch.awayTeam || !newMatch.date) {
      toast.error('Preencha todos os campos do jogo.');
      return;
    }

    const matchData = {
      homeTeam:    newMatch.homeTeam,
      awayTeam:    newMatch.awayTeam,
      date:        newMatch.date,
      group:       newMatch.group,
      location:    newMatch.location,
      homeFlagUrl: newMatch.homeFlagUrl,
      awayFlagUrl: newMatch.awayFlagUrl,
    };

    if (editingMatchId) {
      updateMatch(editingMatchId, matchData);
      toast.success('Jogo atualizado com sucesso!');
    } else {
      addMatch(matchData);
      toast.success('Jogo cadastrado com sucesso!');
    }

    setNewMatch({ 
      homeTeam: '', 
      awayTeam: '', 
      date: '', 
      group: 'A',
      location: '',
      homeFlagUrl: '',
      awayFlagUrl: ''
    });
    setEditingMatchId(null);
    setIsMatchDialogOpen(false);
  };

  const startEditingMatch = (match: Match) => {
    setNewMatch({
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      date: match.date.substring(0, 16), // Format for datetime-local input
      group: match.group,
      location: match.location || '',
      homeFlagUrl: match.homeFlagUrl || '',
      awayFlagUrl: match.awayFlagUrl || ''
    });
    setEditingMatchId(match.id);
    setIsMatchDialogOpen(true);
  };

  const handlePlaceBet = () => {
    if (selectedMatch) {
      placeBet(selectedMatch.id, betScores.home, betScores.away);
      setSelectedMatch(null);
      toast.success('Palpite salvo!');
    }
  };

  const handleSavePrizes = (e: React.FormEvent) => {
    e.preventDefault();
    setPrizeSettings(prizeForm);
    toast.success('Regras de premiação atualizadas!');
  };

  const handleToggleBetsLock = () => {
    const hasPending = usersWithPendingBets.some(u => u.pendingCount > 0 && !u.isAdmin);
    if (!state.settings.betsLocked && hasPending) {
      toast.error('Não é possível bloquear os palpites enquanto houver participantes com palpites pendentes.');
      return;
    }
    toggleBetsLock();
    toast.success(state.settings.betsLocked ? 'Palpites abertos com sucesso!' : 'Palpites bloqueados com sucesso!');
  };

  const calculatePrizeValues = () => {
    const total = totalCollected;
    const { firstPlacePercent, secondPlacePercent, thirdPlacePercent, championBonusPercent } = state.settings.prizes;
    
    return {
      first: (total * firstPlacePercent) / 100,
      second: (total * secondPlacePercent) / 100,
      third: (total * thirdPlacePercent) / 100,
      champion: (total * championBonusPercent) / 100,
    };
  };

  const prizes = calculatePrizeValues();

  if (!currentUser && !isRegistering && !isForgotPassword && !isResetPassword) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Background Image with Transparency */}
        <div 
          className="absolute inset-0 z-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'url("https://www.noroeste.com.mx/binrepository/1040x630/0c0/0d0/none/12707/EOMB/balon-2_1-11440267_20251002164223.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        
        <Card className="w-full max-w-md border-none shadow-xl relative z-10 bg-white/90 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-24 h-24 flex items-center justify-center bg-white rounded-full border-4 border-slate-100 shadow-lg overflow-hidden">
              <img 
                src={state.settings.logoUrl} 
                alt={`FIFA ${state.settings.year} Logo`} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">Bolão da Copa {state.settings.year}</CardTitle>
            <CardDescription>Acesse sua conta para palpitar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!supabaseReady && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-semibold">Supabase não configurado</p>
                <p>{supabaseConfigError}</p>
                <p className="mt-1">Depois disso, execute o arquivo supabase/schema.sql no SQL Editor do projeto.</p>
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-5">
              {loginError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs font-medium animate-in fade-in slide-in-from-top-1">
                  {loginError}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="login-email">E-mail</Label>
                <Input 
                  id="login-email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  value={loginForm.email}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                  required 
                />
              </div>
              <div className="space-y-2 relative">
                <Label htmlFor="login-password">Senha</Label>
                <Input 
                  id="login-password" 
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••" 
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  className="pr-10"
                  required 
                />
                <button
                  type="button"
                  className="absolute right-3 top-9 text-slate-400 hover:text-slate-600 z-10"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="pt-1">
                <Button type="submit" className="w-full h-12 bg-slate-900 hover:bg-slate-800" disabled={!supabaseReady}>Entrar</Button>
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="link"
                  className="h-auto px-0 text-xs text-slate-500"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setIsRegistering(false);
                    setIsResetPassword(false);
                  }}
                >
                  Esqueci minha senha
                </Button>
              </div>
            </form>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500">Ou</span>
              </div>
            </div>
            <Button variant="secondary" className="w-full h-12 gap-2" onClick={() => setIsRegistering(true)} disabled={!supabaseReady}>
              <UserPlus className="w-4 h-4" /> Criar Novo Cadastro
            </Button>
            <div className="flex justify-center pt-2">
              <Button variant="link" size="sm" className="text-[10px] text-slate-400" onClick={resetState}>
                {appInfoLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isForgotPassword) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <Card className="w-full max-w-md border-none shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Esqueci minha senha</CardTitle>
            <CardDescription>Digite seu e-mail para receber o link de redefinição.</CardDescription>
          </CardHeader>
          <form onSubmit={handleForgotPassword}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">E-mail</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 mt-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setIsForgotPassword(false);
                  setIsRegistering(false);
                  setIsResetPassword(false);
                }}
              >
                Voltar ao login
              </Button>
              <Button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800" disabled={!supabaseReady}>
                Enviar link
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  if (isResetPassword) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <Card className="w-full max-w-md border-none shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Redefinir senha</CardTitle>
            <CardDescription>Cadastre sua nova senha para voltar ao acesso normal.</CardDescription>
          </CardHeader>
          <form onSubmit={handleResetPassword}>
            <CardContent className="space-y-4">
              {resetPasswordError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
                  {resetPasswordError}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Digite a nova senha"
                  value={resetPasswordForm.password}
                  onChange={(e) => setResetPasswordForm(prev => ({ ...prev, password: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirme a nova senha"
                  value={resetPasswordForm.confirmPassword}
                  onChange={(e) => setResetPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 mt-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setIsResetPassword(false);
                  setResetPasswordForm({ password: '', confirmPassword: '' });
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700">
                Salvar nova senha
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  if (isRegistering) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <Card className="w-full max-w-md border-none shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Novo Cadastro</CardTitle>
            <CardDescription>Preencha os dados para entrar no bolão</CardDescription>
          </CardHeader>
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4">
              {!supabaseReady && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  {supabaseConfigError}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input id="name" name="name" placeholder="Ex: João Silva" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" placeholder="seu@email.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" name="password" type="password" placeholder="Crie uma senha" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="photo">Sua Foto</Label>
                <div className="flex items-center gap-4">
                  <Avatar 
                    className="h-16 w-16 border-2 border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => document.getElementById('photo')?.click()}
                  >
                    <AvatarImage src={base64Photo} />
                    <AvatarFallback><Users className="w-8 h-8 text-slate-300" /></AvatarFallback>
                  </Avatar>
                  <Input 
                    id="photo" 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <p className="text-xs text-slate-500">Clique na imagem para alterar</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="champion">Quem será o Campeão?</Label>
                <Select name="champion" required>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Selecione um país" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => (
                      <SelectItem key={c.name} value={c.name}>
                        <span className="flex items-center gap-2">
                          <span className="text-lg">{c.flag}</span>
                          <span>{c.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 italic">* Esta escolha não poderá ser alterada depois.</p>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 mt-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setIsRegistering(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700" disabled={!supabaseReady}>Finalizar Cadastro</Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 md:pb-0 relative overflow-hidden">
      {/* Background Image with Transparency */}
      <div 
        className="fixed inset-0 z-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: 'url("https://www.noroeste.com.mx/binrepository/1040x630/0c0/0d0/none/12707/EOMB/balon-2_1-11440267_20251002164223.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      <div className="relative z-10">
        <Toaster position="top-center" />
        
        {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 px-4 py-3 md:px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center overflow-hidden">
            <img 
              src={state.settings.logoUrl} 
              alt="Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight hidden sm:block">Bolão da Copa {state.settings.year}</h1>
        </div>

          <div className="flex items-center gap-4">
            <Dialog>
              <DialogTrigger>
                <Button variant="outline" size="sm" className="hidden sm:flex gap-2 border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100">
                  <Trophy className="w-4 h-4" /> Regras de Premiação
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" /> Regras de Premiação
                  </DialogTitle>
                  <CardDescription>
                    Confira como será distribuído o prêmio total do bolão.
                  </CardDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="bg-slate-900 text-white p-4 rounded-xl text-center">
                    <span className="text-xs text-slate-400 uppercase font-bold">Total Arrecadado</span>
                    <h4 className="text-3xl font-black text-green-400">R$ {totalCollected}</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-white font-bold">1º</div>
                        <span className="font-bold text-sm">Primeiro Lugar ({state.settings.prizes.firstPlacePercent}%)</span>
                      </div>
                      <span className="font-black text-slate-900">R$ {prizes.first.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-slate-700 font-bold">2º</div>
                        <span className="font-bold text-sm">Segundo Lugar ({state.settings.prizes.secondPlacePercent}%)</span>
                      </div>
                      <span className="font-black text-slate-900">R$ {prizes.second.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-300 flex items-center justify-center text-orange-800 font-bold">3º</div>
                        <span className="font-bold text-sm">Terceiro Lugar ({state.settings.prizes.thirdPlacePercent}%)</span>
                      </div>
                      <span className="font-black text-slate-900">R$ {prizes.third.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold">🏆</div>
                        <span className="font-bold text-sm">Acertar Campeão ({state.settings.prizes.championBonusPercent}%)</span>
                      </div>
                      <span className="font-black text-yellow-700">R$ {prizes.champion.toFixed(2)}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center italic">
                    * Os valores são calculados com base no total de participantes que confirmaram o pagamento.
                  </p>
                </div>
              </DialogContent>
            </Dialog>

            <div className="flex flex-col items-end">
              <span className="text-sm font-semibold">{currentUser?.name}</span>
              <div className="flex items-center gap-1.5">
                <Badge variant={currentUser?.isPaid ? "success" : "destructive"} className="text-[10px] px-1.5 py-0 h-4">
                  {currentUser?.isPaid ? 'Pago' : 'Pendente'}
                </Badge>
                <span className="text-xs font-bold text-green-600">{currentUser?.totalPoints} pts</span>
              </div>
            </div>
          <Avatar className="h-10 w-10 border-2 border-slate-100">
            <AvatarImage src={currentUser?.photoUrl} />
            <AvatarFallback>{currentUser?.name[0]}</AvatarFallback>
          </Avatar>
          <Button variant="ghost" size="icon" onClick={logout} className="text-slate-500">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar / Stats (Desktop) */}
        <aside className="lg:col-span-3 space-y-6 hidden lg:block">
          <Card className="border-none shadow-md overflow-hidden">
            <div className="bg-slate-900 p-4 text-white">
              <h3 className="font-bold flex items-center gap-2">
                <div className="w-5 h-5 flex items-center justify-center bg-white rounded-full">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-slate-900">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m12 12-4-4m4 4 4-4m-4 4-4 4m4-4 4 4" />
                  </svg>
                </div>
                Painel do Bolão
              </h3>
            </div>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Participantes</span>
                </div>
                <span className="font-bold">{state.users.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm">Arrecadado</span>
                </div>
                <span className="font-bold text-green-600">R$ {totalCollected}</span>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    {state.settings.betsLocked ? (
                      <Lock className="w-4 h-4 text-red-500" />
                    ) : (
                      <Unlock className="w-4 h-4 text-emerald-500" />
                    )}
                    <span className="text-xs font-bold text-slate-700">Status do Bolão</span>
                  </div>
                  <Badge 
                    variant={state.settings.betsLocked ? "destructive" : "success"}
                    className="text-[10px] uppercase font-black px-2"
                  >
                    {state.settings.betsLocked ? 'Bloqueado' : 'Aberto'}
                  </Badge>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-slate-400 uppercase font-bold mb-3 flex items-center gap-2">
                  <PieChartIcon className="w-3 h-3" /> Progresso da Copa
                </p>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={progressData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {progressData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ fontSize: '10px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 text-[10px] font-bold text-slate-500">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    {finishedMatches} Encerrados
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                    {totalMatches - finishedMatches} Pendentes
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-slate-400 uppercase font-bold mb-3">Últimos Resultados</p>
                <div className="space-y-2">
                  {state.matches.filter(m => m.status === 'finished').slice(-5).reverse().map(match => (
                    <div key={match.id} className="flex items-center justify-between bg-slate-50 p-2 rounded-md border border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400">{match.homeTeam} vs {match.awayTeam}</span>
                        <span className="text-xs font-black">{match.homeScore} - {match.awayScore}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] h-4">Fim</Badge>
                    </div>
                  ))}
                  {state.matches.filter(m => m.status === 'finished').length === 0 && (
                    <p className="text-xs text-slate-400 italic">Nenhum jogo finalizado</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t">
                {finishedMatches > 0 && (
                  <>
                    <p className="text-xs text-slate-400 uppercase font-bold mb-3">Top 3 Ranking</p>
                    <div className="space-y-3">
                      {top3.map((user, idx) => (
                        <div key={user.id} className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0 ? 'bg-yellow-100 text-yellow-700' : 
                            idx === 1 ? 'bg-slate-100 text-slate-700' : 
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {idx + 1}
                          </div>
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={user.photoUrl} />
                            <AvatarFallback>{user.name[0]}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium truncate flex-1">{user.name}</span>
                          <span className="text-sm font-bold">{user.totalPoints}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {currentUser?.isAdmin && (
            <Card className="border-none shadow-md border-l-4 border-l-slate-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Admin Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant={state.settings.betsLocked ? "destructive" : "outline"} 
                  className="w-full justify-start gap-2 text-xs"
                  onClick={toggleBetsLock}
                >
                  {state.settings.betsLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  {state.settings.betsLocked ? 'Desbloquear Palpites' : 'Bloquear Palpites'}
                </Button>
                <Button 
                  variant="default" 
                  className="w-full justify-start gap-2 text-xs bg-slate-900"
                  onClick={() => setActiveTab('admin')}
                >
                  <Shield className="w-3 h-3" /> Acessar Gestão Completa
                </Button>
                <Button 
                  variant="secondary" 
                  className="w-full justify-start gap-2 text-xs"
                  onClick={() => setActiveTab('admin')}
                >
                  <Calendar className="w-3 h-3" /> Lançar Resultados
                </Button>
              </CardContent>
            </Card>
          )}
        </aside>

        {/* Main Content */}
        <div className="lg:col-span-9 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between mb-6">
              <div className="hidden md:block">
                <TabsList className="bg-white border shadow-sm">
                  <TabsTrigger value="matches" className="gap-2">
                    <Calendar className="w-4 h-4" /> Jogos
                  </TabsTrigger>
                  <TabsTrigger value="ranking" className="gap-2">
                    <Trophy className="w-4 h-4" /> Ranking
                  </TabsTrigger>
                  {currentUser?.isAdmin && (
                    <>
                      <TabsTrigger value="users" className="gap-2">
                        <Users className="w-4 h-4" /> Usuários
                      </TabsTrigger>
                      <TabsTrigger value="admin" className="gap-2">
                        <Shield className="w-4 h-4" /> Gestão
                      </TabsTrigger>
                    </>
                  )}
                </TabsList>
              </div>

              <div className="md:hidden">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  {activeTab === 'matches' && <><Calendar className="w-6 h-6 text-slate-900" /> Jogos</>}
                  {activeTab === 'ranking' && <><Trophy className="w-6 h-6 text-slate-900" /> Ranking</>}
                  {activeTab === 'users' && <><Users className="w-6 h-6 text-slate-900" /> Usuários</>}
                  {activeTab === 'admin' && <><Shield className="w-6 h-6 text-slate-900" /> Gestão</>}
                </h2>
              </div>

              {activeTab === 'matches' && (
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <Select value={groupFilter} onValueChange={setGroupFilter}>
                    <SelectTrigger className="w-[120px] h-9 bg-white">
                      <SelectValue placeholder="Grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Grupos</SelectItem>
                      {GROUPS.map(g => (
                        <SelectItem key={g} value={g}>Grupo {g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <TabsContent value="matches" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {filteredMatches.map(match => {
                    const userBet = state.bets.find(b => b.userId === currentUser?.id && b.matchId === match.id);
                    const isFinished = match.status === 'finished';
                    
                    return (
                      <motion.div
                        key={match.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow">
                          <div className="bg-slate-50 px-4 py-2 flex justify-between items-center border-b">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Grupo {match.group} • {new Date(match.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {match.location && (
                                <span className="text-[9px] text-slate-400 flex items-center gap-1">
                                  <Filter className="w-2 h-2" /> {match.location}
                                </span>
                              )}
                            </div>
                            <Badge variant={isFinished ? "secondary" : "outline"} className="text-[10px]">
                              {isFinished ? 'Encerrado' : 'Agendado'}
                            </Badge>
                          </div>
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex flex-col items-center gap-2 flex-1">
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden border border-slate-200 shadow-sm">
                                  {match.homeFlagUrl ? (
                                    <img src={match.homeFlagUrl} alt={match.homeTeam} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <span className="text-xl font-bold">{match.homeTeam?.charAt(0) || '?'}</span>
                                  )}
                                </div>
                                <span className="text-sm font-bold text-center">{match.homeTeam}</span>
                              </div>
                              
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-3">
                                  <span className="text-3xl font-black text-slate-900">
                                    {isFinished ? match.homeScore : '-'}
                                  </span>
                                  <span className="text-slate-300 font-bold">X</span>
                                  <span className="text-3xl font-black text-slate-900">
                                    {isFinished ? match.awayScore : '-'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col items-center gap-2 flex-1">
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden border border-slate-200 shadow-sm">
                                  {match.awayFlagUrl ? (
                                    <img src={match.awayFlagUrl} alt={match.awayTeam} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <span className="text-xl font-bold">{match.awayTeam?.charAt(0) || '?'}</span>
                                  )}
                                </div>
                                <span className="text-sm font-bold text-center">{match.awayTeam}</span>
                              </div>
                            </div>

                            <div className="mt-6 pt-4 border-t flex flex-col items-center gap-3">
                              {userBet ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-[10px] text-slate-400 uppercase font-bold">Seu Palpite</span>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-lg px-3 py-1 font-black">
                                      {userBet.homeScore} - {userBet.awayScore}
                                    </Badge>
                                    {isFinished && (
                                      <Badge variant="success" className="animate-bounce">
                                        +{userBet.pointsEarned} pts
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Nenhum palpite realizado</span>
                              )}

                              {!isFinished && !state.settings.betsLocked && (
                                <Dialog open={selectedMatch?.id === match.id} onOpenChange={(open) => !open && setSelectedMatch(null)}>
                                  <DialogTrigger>
                                    <Button 
                                      variant={userBet ? "outline" : "default"} 
                                      className="w-full h-10 gap-2"
                                      onClick={() => {
                                        setSelectedMatch(match);
                                        setBetScores({ 
                                          home: userBet?.homeScore ?? 0, 
                                          away: userBet?.awayScore ?? 0 
                                        });
                                      }}
                                    >
                                      {userBet ? 'Alterar Palpite' : 'Lançar Palpite'}
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-[425px] bg-white/95 backdrop-blur-sm border-none shadow-2xl">
                                    <DialogHeader>
                                      <DialogTitle className="text-center text-2xl font-black">Seu Palpite</DialogTitle>
                                      <CardDescription className="text-center">
                                        {match.homeTeam} vs {match.awayTeam}
                                      </CardDescription>
                                    </DialogHeader>
                                    <div className="py-8 flex items-center justify-center gap-8">
                                      <div className="flex flex-col items-center gap-3">
                                        <span className="font-bold text-sm">{match.homeTeam}</span>
                                        <Input 
                                          type="number" 
                                          className="w-20 h-20 text-center text-4xl font-black border-2 focus:border-yellow-400" 
                                          value={betScores.home}
                                          onChange={(e) => setBetScores(prev => ({ ...prev, home: parseInt(e.target.value) || 0 }))}
                                        />
                                      </div>
                                      <span className="text-4xl font-black text-slate-200">X</span>
                                      <div className="flex flex-col items-center gap-3">
                                        <span className="font-bold text-sm">{match.awayTeam}</span>
                                        <Input 
                                          type="number" 
                                          className="w-20 h-20 text-center text-4xl font-black border-2 focus:border-yellow-400" 
                                          value={betScores.away}
                                          onChange={(e) => setBetScores(prev => ({ ...prev, away: parseInt(e.target.value) || 0 }))}
                                        />
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button className="w-full h-12 text-lg font-bold bg-slate-900 hover:bg-slate-800" onClick={handlePlaceBet}>
                                        Confirmar Palpite
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              )}
                              
                              {state.settings.betsLocked && !isFinished && (
                                <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                                  <Lock className="w-3 h-3" /> Palpites bloqueados pelo administrador
                                </div>
                              )}

                              <div className="w-full pt-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="w-full h-8 text-[10px] font-bold gap-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 border-slate-200"
                                  onClick={() => setViewingBetsMatch(match)}
                                >
                                  <Users className="w-3 h-3" /> Ver Palpites de Todos
                                </Button>
                              </div>

                              <Dialog open={viewingBetsMatch?.id === match.id} onOpenChange={(open) => !open && setViewingBetsMatch(null)}>
                                <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                                  <DialogHeader className="p-6 bg-slate-900 text-white">
                                    <DialogTitle className="text-xl font-black flex items-center gap-2">
                                      <Users className="w-5 h-5 text-yellow-400" /> Palpites: {match.homeTeam} vs {match.awayTeam}
                                    </DialogTitle>
                                    <CardDescription className="text-slate-300">
                                      Confira o que cada participante apostou para este jogo
                                    </CardDescription>
                                  </DialogHeader>
                                  <ScrollArea className="flex-1 p-6">
                                    <div className="space-y-4">
                                      {state.users.map(user => {
                                        const bet = state.bets.find(b => b.userId === user.id && b.matchId === match.id);
                                        const officialResultText = match.homeScore !== undefined && match.awayScore !== undefined
                                          ? `${match.homeScore} - ${match.awayScore}`
                                          : 'Ainda sem resultado';

                                        return (
                                          <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                                            <div className="flex items-center gap-3">
                                              <Avatar className="h-8 w-8">
                                                <AvatarImage src={user.photoUrl} />
                                                <AvatarFallback>{user.name[0]}</AvatarFallback>
                                              </Avatar>
                                              <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-900">{user.name}</span>
                                                {user.isAdmin && <span className="text-[9px] text-yellow-600 font-bold uppercase">Admin</span>}
                                                {isFinished && (
                                                  <span className="text-[10px] text-slate-500">
                                                    Resultado oficial: <strong>{officialResultText}</strong>
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                              {bet ? (
                                                <div className="flex flex-col items-end gap-1">
                                                  <span className="text-lg font-black text-slate-900">
                                                    {bet.homeScore} - {bet.awayScore}
                                                  </span>
                                                  {isFinished && (
                                                    <div className="flex items-center gap-2">
                                                      <Badge variant="success" className="text-[10px]">
                                                        +{calculatePoints(bet, match)} pts
                                                      </Badge>
                                                      <Badge variant="outline" className="text-[10px]">
                                                        {getPointsRuleLabel(bet, match)}
                                                      </Badge>
                                                    </div>
                                                  )}
                                                </div>
                                              ) : (
                                                <div className="flex flex-col items-end gap-1">
                                                  <span className="text-[10px] text-slate-400 italic">Sem palpite</span>
                                                  {isFinished && (
                                                    <Badge variant="outline" className="text-[10px]">
                                                      0 pts
                                                    </Badge>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </ScrollArea>
                                  <div className="p-4 bg-slate-50 border-t text-center">
                                    <Button variant="outline" className="w-full" onClick={() => setViewingBetsMatch(null)}>
                                      Fechar
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </TabsContent>

            <TabsContent value="ranking" className="mt-0">
              <Card className="border-none shadow-md">
                <CardHeader>
                  <CardTitle>Classificação Geral</CardTitle>
                  <CardDescription>Acompanhe quem está na liderança</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold border-y">
                          <th className="px-6 py-3 text-left w-16">Pos</th>
                          <th className="px-6 py-3 text-left">Participante</th>
                          <th className="px-6 py-3 text-center">Campeão</th>
                          <th className="px-6 py-3 text-center">Chances (1º/2º/3º)</th>
                          <th className="px-6 py-3 text-center">Status</th>
                          <th className="px-6 py-3 text-right">Pontos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {sortedUsers.map((user, idx) => {
                          const probs = calculateProbabilities(user.totalPoints);
                          return (
                            <tr 
                              key={user.id} 
                              className={`hover:bg-slate-50 transition-colors cursor-pointer ${user.id === currentUser?.id ? 'bg-yellow-50/50' : ''}`}
                              onClick={() => setViewingUserBets(user)}
                            >
                              <td className="px-6 py-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                  idx === 0 ? 'bg-yellow-400 text-white' : 
                                  idx === 1 ? 'bg-slate-300 text-slate-700' : 
                                  idx === 2 ? 'bg-orange-300 text-orange-800' : 
                                  'text-slate-400'
                                }`}>
                                  {idx + 1}º
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage src={user.photoUrl} />
                                    <AvatarFallback>{user.name[0]}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-900">{user.name}</span>
                                    {user.id === currentUser?.id && <span className="text-[10px] text-yellow-600 font-bold uppercase">Você</span>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center font-medium text-slate-600">
                                {user.championPrediction}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-1">
                                  <div className="flex flex-col items-center min-w-[40px]">
                                    <span className="text-[8px] text-slate-400 uppercase font-bold">1º</span>
                                    <span className={`text-[10px] font-black ${probs.p1 > 50 ? 'text-emerald-600' : probs.p1 > 20 ? 'text-yellow-600' : 'text-slate-400'}`}>
                                      {probs.p1}%
                                    </span>
                                  </div>
                                  <div className="w-[1px] h-4 bg-slate-100 mx-1" />
                                  <div className="flex flex-col items-center min-w-[40px]">
                                    <span className="text-[8px] text-slate-400 uppercase font-bold">2º</span>
                                    <span className={`text-[10px] font-black ${probs.p2 > 50 ? 'text-emerald-600' : probs.p2 > 20 ? 'text-yellow-600' : 'text-slate-400'}`}>
                                      {probs.p2}%
                                    </span>
                                  </div>
                                  <div className="w-[1px] h-4 bg-slate-100 mx-1" />
                                  <div className="flex flex-col items-center min-w-[40px]">
                                    <span className="text-[8px] text-slate-400 uppercase font-bold">3º</span>
                                    <span className={`text-[10px] font-black ${probs.p3 > 50 ? 'text-emerald-600' : probs.p3 > 20 ? 'text-yellow-600' : 'text-slate-400'}`}>
                                      {probs.p3}%
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <Badge variant={user.isPaid ? "success" : "destructive"} className="text-[10px]">
                                  {user.isPaid ? 'Pago' : 'Pendente'}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className="text-lg font-black text-slate-900">{user.totalPoints}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile List */}
                  <div className="md:hidden divide-y">
                    {sortedUsers.map((user, idx) => {
                      const probs = calculateProbabilities(user.totalPoints);
                      return (
                        <div 
                          key={user.id} 
                          className={`p-4 flex flex-col gap-3 cursor-pointer ${user.id === currentUser?.id ? 'bg-yellow-50/50' : ''}`}
                          onClick={() => setViewingUserBets(user)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                idx === 0 ? 'bg-yellow-400 text-white' : 
                                idx === 1 ? 'bg-slate-300 text-slate-700' : 
                                idx === 2 ? 'bg-orange-300 text-orange-800' : 
                                'bg-slate-100 text-slate-400'
                              }`}>
                                {idx + 1}º
                              </div>
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={user.photoUrl} />
                                <AvatarFallback>{user.name[0]}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 text-sm">{user.name}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant={user.isPaid ? "success" : "destructive"} className="text-[8px] h-4 px-1">
                                    {user.isPaid ? 'Pago' : 'Pendente'}
                                  </Badge>
                                  {user.id === currentUser?.id && <span className="text-[8px] text-yellow-600 font-bold uppercase">Você</span>}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xl font-black text-slate-900">{user.totalPoints}</span>
                              <span className="block text-[8px] text-slate-400 uppercase font-bold">Pontos</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <div className="flex flex-col">
                              <span className="text-[8px] text-slate-400 uppercase font-bold">Campeão</span>
                              <span className="text-xs font-bold text-slate-700">{user.championPrediction}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col items-center">
                                <span className="text-[8px] text-slate-400 uppercase font-bold">1º</span>
                                <span className={`text-[10px] font-black ${probs.p1 > 50 ? 'text-emerald-600' : probs.p1 > 20 ? 'text-yellow-600' : 'text-slate-400'}`}>
                                  {probs.p1}%
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-[8px] text-slate-400 uppercase font-bold">2º</span>
                                <span className={`text-[10px] font-black ${probs.p2 > 50 ? 'text-emerald-600' : probs.p2 > 20 ? 'text-yellow-600' : 'text-slate-400'}`}>
                                  {probs.p2}%
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-[8px] text-slate-400 uppercase font-bold">3º</span>
                                <span className={`text-[10px] font-black ${probs.p3 > 50 ? 'text-emerald-600' : probs.p3 > 20 ? 'text-yellow-600' : 'text-slate-400'}`}>
                                  {probs.p3}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* User Bets Modal */}
              <Dialog open={!!viewingUserBets} onOpenChange={(open) => !open && setViewingUserBets(null)}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                  {viewingUserBets && (
                    <>
                      <DialogHeader className="p-6 bg-slate-900 text-white">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 border-2 border-yellow-400">
                            <AvatarImage src={viewingUserBets.photoUrl} />
                            <AvatarFallback>{viewingUserBets.name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <DialogTitle className="text-xl font-black">{viewingUserBets.name}</DialogTitle>
                            <CardDescription className="text-slate-300">
                              Desempenho detalhado e todos os palpites
                            </CardDescription>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-4">
                          <div className="bg-white/10 p-2 rounded-lg text-center">
                            <span className="block text-[10px] uppercase font-bold text-slate-400">Pontos</span>
                            <span className="text-xl font-black text-yellow-400">{viewingUserBets.totalPoints}</span>
                          </div>
                          <div className="bg-white/10 p-2 rounded-lg text-center">
                            <span className="block text-[10px] uppercase font-bold text-slate-400">Campeão</span>
                            <span className="text-xs font-bold truncate">{viewingUserBets.championPrediction}</span>
                          </div>
                          <div className="bg-white/10 p-2 rounded-lg text-center">
                            <span className="block text-[10px] uppercase font-bold text-slate-400">Status</span>
                            <span className="text-xs font-bold">{viewingUserBets.isPaid ? 'Ativo' : 'Pendente'}</span>
                          </div>
                        </div>
                      </DialogHeader>
                      <ScrollArea className="flex-1 p-6">
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Histórico de Palpites</h4>
                          {state.matches.map(match => {
                            const bet = state.bets.find(b => b.userId === viewingUserBets.id && b.matchId === match.id);
                            const isFinished = match.status === 'finished';
                            return (
                              <div key={match.id} className="flex items-center justify-between p-3 rounded-lg bg-white/50 backdrop-blur-md border border-white/20 shadow-sm">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[9px] font-bold text-slate-500 uppercase">Grupo {match.group}</span>
                                  <span className="text-xs font-bold text-slate-900">{match.homeTeam} x {match.awayTeam}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  {bet ? (
                                    <div className="flex items-center gap-3">
                                      <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-2">
                                          <div className="flex flex-col items-center">
                                            <span className="text-[8px] text-slate-400 uppercase">Palpite</span>
                                            <span className="text-sm font-black text-slate-900">
                                              {bet.homeScore} - {bet.awayScore}
                                            </span>
                                          </div>
                                          {isFinished && (
                                            <div className="flex flex-col items-center border-l pl-2 border-slate-200">
                                              <span className="text-[8px] text-slate-400 uppercase">Real</span>
                                              <span className="text-sm font-black text-green-600">
                                                {match.homeScore} - {match.awayScore}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      {isFinished && (
                                        <Badge variant="success" className="text-[10px] h-6">
                                          +{bet.pointsEarned || 0}
                                        </Badge>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      {isFinished && (
                                        <div className="flex flex-col items-end mr-2">
                                          <span className="text-[8px] text-slate-400 uppercase">Placar Real</span>
                                          <span className="text-xs font-bold text-slate-600">{match.homeScore}-{match.awayScore}</span>
                                        </div>
                                      )}
                                      <span className="text-[10px] text-slate-400 italic">Sem palpite</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                      <div className="p-4 bg-slate-50 border-t">
                        <Button variant="outline" className="w-full" onClick={() => setViewingUserBets(null)}>
                          Fechar Detalhes
                        </Button>
                      </div>
                    </>
                  )}
                </DialogContent>
              </Dialog>
            </TabsContent>

            {currentUser?.isAdmin && (
              <TabsContent value="users" className="mt-0 space-y-6">
                <Card className="border-none shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" /> Controle de Acesso e Administradores
                    </CardTitle>
                    <CardDescription>
                      Defina quem são os administradores do sistema e gerencie o status de pagamento de todos os participantes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b">
                            <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Usuário</th>
                            <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">E-mail</th>
                            <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Admin</th>
                            <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Pagamento</th>
                            <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {state.users.map(user => (
                            <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <Avatar className={user.isAdmin ? "border-2 border-yellow-400" : ""}>
                                    <AvatarImage src={user.photoUrl} />
                                    <AvatarFallback>{user.name[0]}</AvatarFallback>
                                  </Avatar>
                                  <span className="font-bold text-sm">{user.name}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-500">{user.email}</td>
                              <td className="px-6 py-4 text-center">
                                <Badge variant={user.isAdmin ? "warning" : "outline"} className="gap-1">
                                  {user.isAdmin ? <Shield className="w-3 h-3" /> : null}
                                  {user.isAdmin ? 'Admin' : 'Membro'}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <Badge variant={user.isPaid ? "success" : "destructive"}>
                                  {user.isPaid ? 'Pago' : 'Pendente'}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                  {user.id !== currentUser?.id && (
                                    <Button 
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => {
                                        if (confirm(`Tem certeza que deseja banir ${user.name}?`)) {
                                          deleteUser(user.id);
                                          toast.success(`${user.name} foi banido.`);
                                        }
                                      }}
                                    >
                                      Banir
                                    </Button>
                                  )}
                                  {user.id !== currentUser?.id && (
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className={user.isAdmin ? "text-red-600 border-red-100 bg-red-50 hover:bg-red-100" : "text-yellow-600 border-yellow-100 bg-yellow-50 hover:bg-yellow-100"}
                                      onClick={() => {
                                        toggleAdminStatus(user.id);
                                        toast.success(`${user.name} agora é ${!user.isAdmin ? 'Administrador' : 'Participante'}`);
                                      }}
                                    >
                                      {user.isAdmin ? 'Remover Admin' : 'Tornar Admin'}
                                    </Button>
                                  )}
                                  <Button 
                                    variant={user.isPaid ? "outline" : "default"} 
                                    size="sm"
                                    onClick={() => togglePaymentStatus(user.id)}
                                  >
                                    {user.isPaid ? 'Estornar' : 'Confirmar Pagamento'}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {currentUser?.isAdmin && (
              <TabsContent value="admin" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Pending Bets Summary */}
                  <Card className="border-none shadow-md md:col-span-2 bg-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                          <Calendar className="w-5 h-5 text-slate-900" /> Palpites Pendentes
                        </CardTitle>
                        <CardDescription className="text-slate-500">
                          Visualize quem ainda não completou todos os palpites.
                        </CardDescription>
                      </div>
                      <Dialog open={isPendingBetsOpen} onOpenChange={setIsPendingBetsOpen}>
                        <DialogTrigger>
                          <Button variant="outline" className="gap-2">
                            <Filter className="w-4 h-4" /> Ver Lista Detalhada
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col p-0 overflow-hidden">
                          <DialogHeader className="p-6 pb-2">
                            <DialogTitle className="flex items-center gap-2 text-xl">
                              <Users className="w-6 h-6 text-slate-900" /> Palpites Pendentes por Usuário
                            </DialogTitle>
                            <CardDescription>
                              Lista de participantes e quantidade de palpites faltantes.
                            </CardDescription>
                          </DialogHeader>
                          
                          <ScrollArea className="flex-1 p-6 pt-2">
                            <div className="space-y-3">
                              {usersWithPendingBets
                                .filter(u => !u.isAdmin)
                                .sort((a, b) => b.pendingCount - a.pendingCount)
                                .map(user => (
                                  <div key={user.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
                                    <div className="flex items-center gap-4">
                                      <Avatar className="h-10 w-10 border border-slate-200">
                                        <AvatarImage src={user.photoUrl} />
                                        <AvatarFallback>P</AvatarFallback>
                                      </Avatar>
                                      <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-900">Participante</span>
                                        <span className="text-xs text-slate-500">{user.email}</span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4">
                                      <div className="text-right">
                                        <Badge variant={user.pendingCount === 0 ? "success" : "destructive"} className="text-xs">
                                          {user.pendingCount === 0 ? 'Concluído' : `${user.pendingCount} pendentes`}
                                        </Badge>
                                      </div>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => {
                                          if (confirm(`Tem certeza que deseja banir este participante? Todos os seus dados e palpites serão excluídos permanentemente.`)) {
                                            deleteUser(user.id);
                                            toast.success('Participante banido com sucesso.');
                                          }
                                        }}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </ScrollArea>
                          <DialogFooter className="p-6 bg-slate-50 border-t">
                            <Button variant="outline" onClick={() => setIsPendingBetsOpen(false)}>Fechar</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex-1">
                          <p className="text-sm text-slate-600">Existem <span className="font-bold text-slate-900">{usersWithPendingBets.filter(u => u.pendingCount > 0 && !u.isAdmin).length}</span> participantes com palpites pendentes.</p>
                        </div>
                        <Badge variant="outline" className="bg-white">Total Jogos: {totalMatches}</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* General Settings */}
                  <Card className="border-none shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-slate-900" /> Configurações Gerais
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="entry-fee">Valor da Inscrição (R$)</Label>
                          <div className="flex gap-2">
                            <Input 
                              id="entry-fee" 
                              type="number" 
                              defaultValue={state.settings.entryFee}
                              className="flex-1"
                              onBlur={(e) => setEntryFee(parseInt(e.target.value) || 0)}
                            />
                            <Button variant="outline" onClick={() => toast.success('Valor atualizado!')}>Salvar</Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="app-year">Ano da Copa</Label>
                          <div className="flex gap-2">
                            <Input 
                              id="app-year" 
                              type="text" 
                              defaultValue={state.settings.year}
                              className="flex-1"
                              onBlur={(e) => setYear(e.target.value)}
                            />
                            <Button variant="outline" onClick={() => toast.success('Ano atualizado!')}>Salvar</Button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="logo-url">URL do Logotipo</Label>
                        <div className="flex gap-2">
                          <Input 
                            id="logo-url" 
                            type="text" 
                            defaultValue={state.settings.logoUrl}
                            className="flex-1"
                            onBlur={(e) => setLogoUrl(e.target.value)}
                          />
                          <Button variant="outline" onClick={() => toast.success('Logo atualizado!')}>Salvar</Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Status dos Palpites</Label>
                        <Button 
                          variant={state.settings.betsLocked ? "destructive" : "outline"} 
                          className="w-full justify-between gap-2"
                          onClick={handleToggleBetsLock}
                        >
                          <span className="flex items-center gap-2">
                            {state.settings.betsLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            {state.settings.betsLocked ? 'Palpites Bloqueados' : 'Palpites Abertos'}
                          </span>
                          <Badge variant={state.settings.betsLocked ? "secondary" : "success"}>
                            {state.settings.betsLocked ? 'OFF' : 'ON'}
                          </Badge>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Prize Rules Settings */}
                  <Card className="border-none shadow-md">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Trophy className="w-4 h-4" /> Regras de Premiação (%)
                      </CardTitle>
                      <CardDescription className="text-[10px]">
                        Defina o percentual do total arrecadado para cada prêmio.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSavePrizes} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-slate-400">1º Lugar (%)</Label>
                            <Input 
                              type="number" 
                              value={prizeForm.firstPlacePercent} 
                              onChange={(e) => setPrizeForm(prev => ({ ...prev, firstPlacePercent: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-slate-400">2º Lugar (%)</Label>
                            <Input 
                              type="number" 
                              value={prizeForm.secondPlacePercent} 
                              onChange={(e) => setPrizeForm(prev => ({ ...prev, secondPlacePercent: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-slate-400">3º Lugar (%)</Label>
                            <Input 
                              type="number" 
                              value={prizeForm.thirdPlacePercent} 
                              onChange={(e) => setPrizeForm(prev => ({ ...prev, thirdPlacePercent: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-slate-400">Campeão (%)</Label>
                            <Input 
                              type="number" 
                              value={prizeForm.championBonusPercent} 
                              onChange={(e) => setPrizeForm(prev => ({ ...prev, championBonusPercent: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                        </div>
                        <div className="pt-2">
                          <div className={`p-2 rounded text-[10px] font-bold text-center mb-2 ${
                            (prizeForm.firstPlacePercent + prizeForm.secondPlacePercent + prizeForm.thirdPlacePercent + prizeForm.championBonusPercent) === 100 
                            ? 'bg-green-50 text-green-600' 
                            : 'bg-red-50 text-red-600'
                          }`}>
                            Total: {prizeForm.firstPlacePercent + prizeForm.secondPlacePercent + prizeForm.thirdPlacePercent + prizeForm.championBonusPercent}%
                          </div>
                          <Button type="submit" className="w-full bg-slate-900">Salvar Regras</Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>

                  {/* Match Results */}
                  <Card className="border-none shadow-md md:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div>
                        <CardTitle>Lançar Resultados</CardTitle>
                        <CardDescription>Atualize os placares oficiais</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Dialog open={isMatchDialogOpen} onOpenChange={(open) => {
                          setIsMatchDialogOpen(open);
                          if (!open) {
                            setEditingMatchId(null);
                            setNewMatch({ 
                              homeTeam: '', 
                              awayTeam: '', 
                              date: '', 
                              group: 'A',
                              location: '',
                              homeFlagUrl: '',
                              awayFlagUrl: ''
                            });
                          }
                        }}>
                        <DialogTrigger>
                          <Button size="sm" className="gap-2 bg-slate-900">
                            <Calendar className="w-4 h-4" /> Novo Jogo
                          </Button>
                        </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>{editingMatchId ? 'Editar Jogo' : 'Cadastrar Novo Jogo'}</DialogTitle>
                              <CardDescription>
                                {editingMatchId ? 'Atualize as informações da partida' : `Adicione uma nova partida à Copa ${state.settings.year}`}
                              </CardDescription>
                            </DialogHeader>
                            <form onSubmit={handleAddMatch} className="space-y-4 py-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Time da Casa</Label>
                                  <Input 
                                    placeholder="Ex: Brasil" 
                                    value={newMatch.homeTeam}
                                    onChange={e => setNewMatch(prev => ({ ...prev, homeTeam: e.target.value }))}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Time Visitante</Label>
                                  <Input 
                                    placeholder="Ex: México" 
                                    value={newMatch.awayTeam}
                                    onChange={e => setNewMatch(prev => ({ ...prev, awayTeam: e.target.value }))}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Bandeira Casa (URL)</Label>
                                  <Input 
                                    placeholder="URL da bandeira" 
                                    value={newMatch.homeFlagUrl}
                                    onChange={e => setNewMatch(prev => ({ ...prev, homeFlagUrl: e.target.value }))}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Bandeira Visitante (URL)</Label>
                                  <Input 
                                    placeholder="URL da bandeira" 
                                    value={newMatch.awayFlagUrl}
                                    onChange={e => setNewMatch(prev => ({ ...prev, awayFlagUrl: e.target.value }))}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Local do Jogo</Label>
                                <Input 
                                  placeholder="Ex: Estádio Azteca, Cidade do México" 
                                  value={newMatch.location}
                                  onChange={e => setNewMatch(prev => ({ ...prev, location: e.target.value }))}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Data e Hora</Label>
                                  <Input 
                                    type="datetime-local" 
                                    value={newMatch.date}
                                    onChange={e => setNewMatch(prev => ({ ...prev, date: e.target.value }))}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Grupo</Label>
                                  <Select value={newMatch.group} onValueChange={v => setNewMatch(prev => ({ ...prev, group: v }))}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {GROUPS.map(g => (
                                        <SelectItem key={g} value={g}>Grupo {g}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <Button type="submit" className="w-full">
                                {editingMatchId ? 'Salvar Alterações' : 'Cadastrar Jogo'}
                              </Button>
                            </form>
                          </DialogContent>
                        </Dialog>
                        <Select value={adminMatchFilter} onValueChange={setAdminMatchFilter}>
                          <SelectTrigger className="w-[100px] h-8 text-xs">
                            <SelectValue placeholder="Grupo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {GROUPS.map(g => (
                              <SelectItem key={g} value={g}>Gr {g}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[400px]">
                        <div className="divide-y">
                          {state.matches
                            .filter(m => adminMatchFilter === 'all' || m.group === adminMatchFilter)
                            .map(match => (
                            <div key={match.id} className="p-4 space-y-3">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">Grupo {match.group}</span>
                                  <span className="text-[9px] text-slate-300">•</span>
                                  <span className="text-[9px] text-slate-400">{new Date(match.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-slate-400 hover:text-slate-900"
                                    onClick={() => startEditingMatch(match)}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-slate-400 hover:text-red-600"
                                    onClick={() => {
                                      if (confirm('Tem certeza que deseja excluir este jogo? Todos os palpites vinculados serão perdidos.')) {
                                        deleteMatch(match.id);
                                        toast.success('Jogo excluído com sucesso!');
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                  <Badge variant={match.status === 'finished' ? "success" : "outline"} className="text-[10px]">
                                    {match.status === 'finished' ? 'Finalizado' : 'Pendente'}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2 sm:gap-4">
                                <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                                  <span className="text-xs sm:text-sm font-bold truncate">{match.homeTeam}</span>
                                  <div className="w-6 h-6 rounded-full overflow-hidden border border-slate-200 flex-shrink-0">
                                    {match.homeFlagUrl ? (
                                      <img src={match.homeFlagUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[10px]">{match.homeTeam[0]}</div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                  <Input 
                                    type="number" 
                                    className="w-10 sm:w-12 h-9 sm:h-10 text-center font-bold p-0" 
                                    defaultValue={match.homeScore ?? 0}
                                    id={`home-${match.id}`}
                                  />
                                  <span className="font-bold text-slate-300">x</span>
                                  <Input 
                                    type="number" 
                                    className="w-10 sm:w-12 h-9 sm:h-10 text-center font-bold p-0" 
                                    defaultValue={match.awayScore ?? 0}
                                    id={`away-${match.id}`}
                                  />
                                </div>
                                <div className="flex items-center gap-2 flex-1 justify-start min-w-0">
                                  <div className="w-6 h-6 rounded-full overflow-hidden border border-slate-200 flex-shrink-0">
                                    {match.awayFlagUrl ? (
                                      <img src={match.awayFlagUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[10px]">{match.awayTeam[0]}</div>
                                    )}
                                  </div>
                                  <span className="text-xs sm:text-sm font-bold truncate">{match.awayTeam}</span>
                                </div>
                              </div>
                              <Button 
                                variant="secondary" 
                                className="w-full h-8 text-xs font-bold"
                                onClick={() => {
                                  const h = parseInt((document.getElementById(`home-${match.id}`) as HTMLInputElement).value);
                                  const a = parseInt((document.getElementById(`away-${match.id}`) as HTMLInputElement).value);
                                  updateMatchResult(match.id, h, a);
                                  toast.success('Resultado atualizado!');
                                }}
                              >
                                Salvar Resultado
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>

      {/* Winner Modal */}
      <Dialog open={isWinnerModalOpen} onOpenChange={setIsWinnerModalOpen}>
        <DialogContent className="sm:max-w-[500px] border-none p-0 overflow-hidden bg-transparent shadow-none">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -top-20 -right-20 w-64 h-64 bg-yellow-400/10 rounded-full blur-3xl"
              />
              <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4 relative z-10" />
              <h2 className="text-3xl font-black text-white relative z-10">TEMOS UM CAMPEÃO!</h2>
              <p className="text-slate-400 font-bold relative z-10">A COPA DO MUNDO {state.settings.year} CHEGOU AO FIM</p>
            </div>
            
            <div className="p-8 text-center space-y-6">
              {sortedUsers[0] && (
                <div className="space-y-4">
                  <div className="relative inline-block">
                    <Avatar className="h-32 w-32 border-4 border-yellow-400 shadow-xl mx-auto">
                      <AvatarImage src={sortedUsers[0].photoUrl} />
                      <AvatarFallback className="text-4xl">{sortedUsers[0].name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-slate-900 w-10 h-10 rounded-full flex items-center justify-center font-black shadow-lg border-4 border-white">
                      1º
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase">{sortedUsers[0].name}</h3>
                    <p className="text-slate-500 font-bold">Vencedor do Bolão com {sortedUsers[0].totalPoints} pontos!</p>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-2">
                    <span className="text-xs text-slate-400 uppercase font-bold">Prêmio Total Estimado</span>
                    <h4 className="text-4xl font-black text-green-600">R$ {prizes.first.toFixed(2)}</h4>
                    <p className="text-[10px] text-slate-400 italic">Baseado em {state.settings.prizes.firstPlacePercent}% do total arrecadado</p>
                  </div>
                </div>
              )}

              <Button 
                className="w-full h-14 text-lg font-black bg-slate-900 hover:bg-slate-800 rounded-xl"
                onClick={() => setIsWinnerModalOpen(false)}
              >
                VER CLASSIFICAÇÃO COMPLETA
              </Button>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around items-center h-16 md:hidden z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <button 
          className={`flex flex-col items-center gap-1 flex-1 py-2 ${activeTab === 'matches' ? 'text-slate-900' : 'text-slate-400'}`}
          onClick={() => setActiveTab('matches')}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">Jogos</span>
        </button>
        <button 
          className={`flex flex-col items-center gap-1 flex-1 py-2 ${activeTab === 'ranking' ? 'text-slate-900' : 'text-slate-400'}`}
          onClick={() => setActiveTab('ranking')}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">Ranking</span>
        </button>
        {currentUser?.isAdmin && (
          <>
            <button 
              className={`flex flex-col items-center gap-1 flex-1 py-2 ${activeTab === 'users' ? 'text-slate-900' : 'text-slate-400'}`}
              onClick={() => setActiveTab('users')}
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase">Usuários</span>
            </button>
            <button 
              className={`flex flex-col items-center gap-1 flex-1 py-2 ${activeTab === 'admin' ? 'text-slate-900' : 'text-slate-400'}`}
              onClick={() => setActiveTab('admin')}
            >
              <Shield className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase">Gestão</span>
            </button>
          </>
        )}
      </nav>
    </div>
  </div>
  );
}

function CardFooter({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={`p-6 pt-0 flex items-center ${className}`}>{children}</div>;
}
