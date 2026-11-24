import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, Play, Pause, Square, Plus, DollarSign, 
  Sparkles, CheckCircle2, ChevronRight, Edit3, Trash2, 
  ExternalLink, ArrowLeft, Layers, ShoppingBag, X, LogOut
} from 'lucide-react';
import { supabase } from './supabaseClient';

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Estados de Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Estados de Dados
  const [projects, setProjects] = useState([]);
  const [currentView, setCurrentView] = useState('list'); // 'list' | 'detail' | 'form'
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  // Formulário
  const [formName, setFormName] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formMaterials, setFormMaterials] = useState('0');
  const [formRate, setFormRate] = useState('20');
  const [editingProjectId, setEditingProjectId] = useState(null);

  // Sessão ativa em memória (cronômetro rodando)
  const [activeSession, setActiveSession] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Tick do cronômetro
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Monitora autenticação
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Busca projetos e sessões do Supabase quando logado
  const fetchProjects = async () => {
    try {
      const { data: projs, error: projsErr } = await supabase
        .from('crochet_projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (projsErr) throw projsErr;

      const { data: sess, error: sessErr } = await supabase
        .from('crochet_sessions')
        .select('*')
        .order('session_number', { ascending: true });

      if (sessErr) throw sessErr;

      // Junta as sessões aos seus respectivos projetos
      const mapped = (projs || []).map(p => ({
        ...p,
        materialsCost: Number(p.materials_cost) || 0,
        hourlyRate: Number(p.hourly_rate) || 20,
        imageUrl: p.image_url,
        sessions: (sess || []).filter(s => s.project_id === p.id)
      }));

      setProjects(mapped);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  };

  useEffect(() => {
    if (session) {
      fetchProjects();
    }
  }, [session]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError('E-mail ou senha incorretos.');
    }
    setIsLoggingIn(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setActiveSession(null);
  };

  // Cronômetro da sessão ativa
  const getLiveSessionSeconds = (projId) => {
    if (!activeSession || activeSession.projectId !== projId) return 0;
    const { accumulatedSeconds, startTimestamp, isRunning } = activeSession;
    if (!isRunning || !startTimestamp) return accumulatedSeconds;
    const elapsed = Math.max(0, Math.floor((now - startTimestamp) / 1000));
    return accumulatedSeconds + elapsed;
  };

  const handleStartSession = (projectId) => {
    const currentProj = projects.find(p => p.id === projectId);
    const sessionNum = (currentProj?.sessions?.length || 0) + 1;
    setActiveSession({
      projectId,
      sessionNumber: sessionNum,
      accumulatedSeconds: 0,
      startTimestamp: Date.now(),
      isRunning: true
    });
  };

  const handlePauseSession = () => {
    if (!activeSession) return;
    const totalElapsed = getLiveSessionSeconds(activeSession.projectId);
    setActiveSession(prev => ({
      ...prev,
      accumulatedSeconds: totalElapsed,
      startTimestamp: null,
      isRunning: false
    }));
  };

  const handleResumeSession = () => {
    if (!activeSession) return;
    setActiveSession(prev => ({
      ...prev,
      startTimestamp: Date.now(),
      isRunning: true
    }));
  };

  const handleFinishSession = async (projectId) => {
    if (!activeSession || activeSession.projectId !== projectId) return;
    const totalSeconds = getLiveSessionSeconds(projectId);

    if (totalSeconds >= 5) {
      const { error } = await supabase.from('crochet_sessions').insert({
        project_id: projectId,
        session_number: activeSession.sessionNumber,
        duration_seconds: totalSeconds
      });
      if (error) console.error('Erro ao salvar sessão:', error);
      await fetchProjects();
    }
    setActiveSession(null);
  };

  // Cálculos financeiros
  const calculateMetrics = (project) => {
    if (!project) return { totalSeconds: 0, totalHours: 0, laborCost: 0, finalPrice: 0 };
    const savedSeconds = (project.sessions || []).reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
    const liveSeconds = getLiveSessionSeconds(project.id);
    const totalSeconds = savedSeconds + liveSeconds;
    const totalHours = totalSeconds / 3600;
    const rate = Number(project.hourlyRate) || 0;
    const materials = Number(project.materialsCost) || 0;
    const laborCost = totalHours * rate;
    return {
      totalSeconds,
      totalHours,
      laborCost,
      materialsCost: materials,
      finalPrice: laborCost + materials
    };
  };

  const formatTime = (secs) => {
    const s = Math.floor(secs % 60);
    const m = Math.floor((secs / 60) % 60);
    const h = Math.floor(secs / 3600);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatFriendlyTime = (secs) => {
    const m = Math.floor((secs / 60) % 60);
    const h = Math.floor(secs / 3600);
    if (h === 0 && m === 0) return `${Math.floor(secs)} seg`;
    if (h === 0) return `${m} min`;
    return `${h}h ${m}m`;
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  // Salvar / Editar Projeto
  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !session) return;

    const materials = parseFloat(formMaterials.replace(',', '.')) || 0;
    const rate = parseFloat(formRate.replace(',', '.')) || 20;

    if (editingProjectId) {
      await supabase.from('crochet_projects').update({
        name: formName.trim(),
        image_url: formImage.trim(),
        materials_cost: materials,
        hourly_rate: rate
      }).eq('id', editingProjectId);
    } else {
      await supabase.from('crochet_projects').insert({
        user_id: session.user.id,
        name: formName.trim(),
        image_url: formImage.trim(),
        materials_cost: materials,
        hourly_rate: rate,
        status: 'in_progress'
      });
    }

    await fetchProjects();
    setCurrentView('list');
  };

  const toggleProjectStatus = async (proj) => {
    const nextStatus = proj.status === 'completed' ? 'in_progress' : 'completed';
    await supabase.from('crochet_projects').update({ status: nextStatus }).eq('id', proj.id);
    await fetchProjects();
  };

  const handleDeleteProject = async (id) => {
    await supabase.from('crochet_projects').delete().eq('id', id);
    await fetchProjects();
    setCurrentView('list');
    setSelectedProjectId(null);
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center text-xs text-stone-400">
        Carregando ateliê...
      </div>
    );
  }

  // TELA DE LOGIN SEGURO
  if (!session) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
        <div className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl">
          <div className="w-12 h-12 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <Sparkles size={24} />
          </div>
          <h2 className="text-base font-bold text-center text-stone-800">Ateliê Crochê</h2>
          <p className="text-xs text-center text-stone-400 mb-5">Login com as credenciais do Litmosphere</p>

          <form onSubmit={handleLogin} className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-stone-600 block mb-1">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full p-2.5 border border-stone-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-600 block mb-1">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full p-2.5 border border-stone-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {authError && <p className="text-rose-500 text-[11px] font-semibold">{authError}</p>}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-md transition disabled:opacity-50 mt-2"
            >
              {isLoggingIn ? 'Entrando...' : 'Entrar no Ateliê'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const filteredProjects = projects.filter(p => filterStatus === 'all' ? true : p.status === filterStatus);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 font-sans flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl flex flex-col relative border-x border-stone-200">
        
        {/* HEADER */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-stone-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-400 to-amber-300 flex items-center justify-center text-white shadow-sm">
              <Sparkles size={16} />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-stone-900 leading-tight">Ateliê Crochê</h1>
              <p className="text-[10px] text-stone-400">{session.user.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg" title="Sair">
            <LogOut size={16} />
          </button>
        </header>

        {/* CORPO */}
        <main className="flex-1 overflow-y-auto pb-24 p-4">
          
          {/* VISTA 1: LISTAGEM */}
          {currentView === 'list' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-rose-50 to-amber-50 rounded-2xl p-4 border border-rose-100 flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold text-stone-800">Projetos do Ateliê</h2>
                  <p className="text-xs text-stone-500">{projects.length} cadastrados</p>
                </div>
                <button
                  onClick={() => {
                    setFormName('');
                    setFormImage('');
                    setFormMaterials('0');
                    setFormRate('20');
                    setEditingProjectId(null);
                    setCurrentView('form');
                  }}
                  className="flex items-center space-x-1 px-3 py-2 bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-md active:scale-95 transition"
                >
                  <Plus size={14} />
                  <span>Novo</span>
                </button>
              </div>

              {/* Filtros */}
              <div className="flex space-x-2">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`text-xs px-3 py-1 rounded-lg ${filterStatus === 'all' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600'}`}
                >
                  Todos ({projects.length})
                </button>
                <button
                  onClick={() => setFilterStatus('in_progress')}
                  className={`text-xs px-3 py-1 rounded-lg ${filterStatus === 'in_progress' ? 'bg-rose-500 text-white' : 'bg-stone-100 text-stone-600'}`}
                >
                  Em Produção
                </button>
                <button
                  onClick={() => setFilterStatus('completed')}
                  className={`text-xs px-3 py-1 rounded-lg ${filterStatus === 'completed' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600'}`}
                >
                  Concluídos
                </button>
              </div>

              {filteredProjects.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-stone-200 rounded-2xl text-xs text-stone-400">
                  Nenhum projeto encontrado.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredProjects.map(proj => {
                    const metrics = calculateMetrics(proj);
                    const isWorking = activeSession?.projectId === proj.id && activeSession?.isRunning;

                    return (
                      <div
                        key={proj.id}
                        onClick={() => {
                          setSelectedProjectId(proj.id);
                          setCurrentView('detail');
                        }}
                        className={`p-3.5 rounded-2xl border bg-white cursor-pointer transition shadow-xs hover:shadow-md ${
                          isWorking ? 'border-amber-400 ring-2 ring-amber-300/40' : 'border-stone-200'
                        }`}
                      >
                        <div className="flex space-x-3 items-center">
                          <div className="w-14 h-14 rounded-xl bg-stone-100 overflow-hidden flex-shrink-0 border border-stone-200">
                            {proj.imageUrl ? (
                              <img src={proj.imageUrl} alt={proj.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-300">Crochê</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-stone-800 text-xs truncate">{proj.name}</h3>
                            <p className="text-[11px] text-stone-500 flex items-center space-x-1 mt-0.5">
                              <Clock size={11} />
                              <span>{formatFriendlyTime(metrics.totalSeconds)}</span>
                              <span>•</span>
                              <span>{proj.sessions?.length || 0} sessões</span>
                            </p>
                            <p className="text-xs font-bold text-stone-800 mt-1">
                              {formatCurrency(metrics.finalPrice)}
                            </p>
                          </div>
                          <ChevronRight size={16} className="text-stone-300" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: DETALHES & CRONÔMETRO */}
          {currentView === 'detail' && selectedProject && (() => {
            const metrics = calculateMetrics(selectedProject);
            const isLive = activeSession?.projectId === selectedProject.id;
            const isRunning = isLive && activeSession?.isRunning;
            const liveSeconds = getLiveSessionSeconds(selectedProject.id);

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <button onClick={() => setCurrentView('list')} className="flex items-center space-x-1 text-xs text-stone-500 hover:text-stone-800">
                    <ArrowLeft size={16} />
                    <span>Voltar</span>
                  </button>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => {
                        setFormName(selectedProject.name);
                        setFormImage(selectedProject.imageUrl || '');
                        setFormMaterials(selectedProject.materialsCost.toString());
                        setFormRate(selectedProject.hourlyRate.toString());
                        setEditingProjectId(selectedProject.id);
                        setCurrentView('form');
                      }}
                      className="p-1.5 text-stone-400 hover:text-stone-700"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Excluir este projeto do Supabase?')) handleDeleteProject(selectedProject.id);
                      }}
                      className="p-1.5 text-stone-400 hover:text-rose-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Card de foto */}
                <div className="rounded-2xl border border-stone-200 overflow-hidden bg-white">
                  <div className="h-40 bg-stone-100 relative">
                    {selectedProject.imageUrl ? (
                      <img src={selectedProject.imageUrl} alt={selectedProject.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-stone-400">Sem foto de referência</div>
                    )}
                    <button
                      onClick={() => toggleProjectStatus(selectedProject)}
                      className="absolute top-3 right-3 text-xs px-2.5 py-1 bg-stone-900/80 text-white rounded-full font-semibold"
                    >
                      {selectedProject.status === 'completed' ? 'Finalizado' : 'Em Andamento'}
                    </button>
                  </div>
                  <div className="p-3">
                    <h2 className="font-bold text-stone-900 text-sm">{selectedProject.name}</h2>
                  </div>
                </div>

                {/* Cronômetro */}
                <div className="bg-stone-900 text-white rounded-3xl p-5 text-center">
                  <span className="text-[11px] text-amber-400 font-medium">
                    {isLive ? (isRunning ? 'CRONOMETRANDO' : 'PAUSADO') : 'PRONTO'}
                  </span>
                  <div className="font-mono text-4xl font-black text-amber-300 my-2">
                    {formatTime(liveSeconds)}
                  </div>
                  <div className="flex gap-2 mt-4 justify-center">
                    {!isLive ? (
                      <button
                        onClick={() => handleStartSession(selectedProject.id)}
                        className="w-full py-3 bg-amber-400 text-stone-900 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5"
                      >
                        <Play size={14} fill="currentColor" />
                        <span>Iniciar Sessão</span>
                      </button>
                    ) : (
                      <>
                        {isRunning ? (
                          <button onClick={handlePauseSession} className="flex-1 py-3 bg-stone-700 text-amber-300 font-bold text-xs rounded-xl">
                            <Pause size={14} fill="currentColor" className="inline mr-1" />
                            Pausar
                          </button>
                        ) : (
                          <button onClick={handleResumeSession} className="flex-1 py-3 bg-amber-400 text-stone-900 font-bold text-xs rounded-xl">
                            <Play size={14} fill="currentColor" className="inline mr-1" />
                            Retomar
                          </button>
                        )}
                        <button onClick={() => handleFinishSession(selectedProject.id)} className="flex-1 py-3 bg-rose-600 text-white font-bold text-xs rounded-xl">
                          <Square size={12} fill="currentColor" className="inline mr-1" />
                          Finalizar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Preço Dinâmico */}
                <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-2 text-xs">
                  <div className="flex justify-between text-stone-600">
                    <span>Horas Trabalhadas:</span>
                    <span className="font-semibold">{metrics.totalHours.toFixed(2)}h ({formatFriendlyTime(metrics.totalSeconds)})</span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>Mão de Obra ({metrics.totalHours.toFixed(2)}h × {formatCurrency(selectedProject.hourlyRate)}):</span>
                    <span className="font-semibold">{formatCurrency(metrics.laborCost)}</span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>Materiais:</span>
                    <span className="font-semibold">{formatCurrency(metrics.materialsCost)}</span>
                  </div>
                  <div className="pt-2 border-t border-stone-100 flex justify-between items-baseline font-bold text-sm">
                    <span>Preço Sugerido:</span>
                    <span className="text-rose-600 text-lg">{formatCurrency(metrics.finalPrice)}</span>
                  </div>
                </div>

                {/* Histórico de Sessões */}
                <div className="bg-white rounded-2xl border border-stone-200 p-4">
                  <h3 className="font-bold text-xs text-stone-800 mb-2">Histórico de Sessões ({selectedProject.sessions?.length || 0})</h3>
                  <div className="divide-y divide-stone-100 max-h-40 overflow-y-auto text-xs">
                    {selectedProject.sessions?.map(s => (
                      <div key={s.id} className="py-2 flex justify-between">
                        <span className="text-stone-600">Sessão {s.session_number}</span>
                        <span className="font-mono font-medium">{formatFriendlyTime(s.duration_seconds)}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            );
          })()}

          {/* VISTA 3: CADASTRO / EDIÇÃO */}
          {currentView === 'form' && (
            <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 text-xs">
              <h2 className="font-bold text-sm text-stone-800">{editingProjectId ? 'Editar' : 'Novo'} Projeto</h2>
              <form onSubmit={handleSaveProject} className="space-y-3">
                <div>
                  <label className="font-semibold block mb-1">Nome da Peça *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Ex: Bolsa Tulipa"
                    className="w-full p-2.5 border border-stone-300 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Link da Foto (URL externa)</label>
                  <input
                    type="url"
                    value={formImage}
                    onChange={e => setFormImage(e.target.value)}
                    placeholder="https://..."
                    className="w-full p-2.5 border border-stone-300 rounded-xl outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">Materiais (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formMaterials}
                      onChange={e => setFormMaterials(e.target.value)}
                      className="w-full p-2.5 border border-stone-300 rounded-xl outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Taxa (R$/h)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={formRate}
                      onChange={e => setFormRate(e.target.value)}
                      className="w-full p-2.5 border border-stone-300 rounded-xl outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-3">
                  <button type="button" onClick={() => setCurrentView('list')} className="flex-1 py-2.5 bg-stone-100 rounded-xl font-semibold">
                    Cancelar
                  </button>
                  <button type="submit" className="flex-1 py-2.5 bg-rose-500 text-white rounded-xl font-semibold">
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}