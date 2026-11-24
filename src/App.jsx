import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Clock, Play, Pause, Square, Plus, Users, DollarSign, 
  Sparkles, CheckCircle2, ChevronRight, Edit3, Trash2, 
  ExternalLink, ArrowLeft, RefreshCw, Layers, Award,
  ShoppingBag, ShieldAlert, X
} from 'lucide-react';

// Chave do LocalStorage
const STORAGE_KEY = 'crochet_studio_data_v1';

// Dados iniciais padrão se o storage estiver vazio
const DEFAULT_PROFILES = [
  { id: 'artesa-1', name: 'Bianca', avatarColor: 'from-rose-400 to-pink-500', defaultRate: 20 },
  { id: 'artesa-2', name: 'Carol', avatarColor: 'from-amber-400 to-orange-500', defaultRate: 22 }
];

const DEFAULT_PROJECTS = [
  {
    id: 'demo-proj-1',
    userId: 'artesa-1',
    name: 'Bolsa Tulipa em Fio Náutico',
    imageUrl: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=800&q=80',
    materialsCost: 45.0,
    hourlyRate: 20.0,
    status: 'in_progress', // 'in_progress' | 'completed'
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    sessions: [
      { id: 's1', sessionNumber: 1, durationSeconds: 5400, completedAt: new Date(Date.now() - 86400000 * 2).toISOString() }, // 1.5h
      { id: 's2', sessionNumber: 2, durationSeconds: 7200, completedAt: new Date(Date.now() - 86400000 * 1).toISOString() }  // 2h
    ],
    // Se houver uma sessão aberta em andamento
    activeSession: null
  }
];

export default function App() {
  // Carrega estado do storage
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Falha ao carregar localStorage", e);
    }
    return {
      profiles: DEFAULT_PROFILES,
      activeProfileId: 'artesa-1',
      projects: DEFAULT_PROJECTS
    };
  });

  // Salva automaticamente a cada alteração
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Erro ao salvar dados", e);
    }
  }, [data]);

  const activeProfile = useMemo(() => {
    return data.profiles.find(p => p.id === data.activeProfileId) || data.profiles[0];
  }, [data.profiles, data.activeProfileId]);

  // Navegação simples: 'list' | 'detail' | 'new' | 'edit'
  const [currentView, setCurrentView] = useState('list');
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  // Estados dos modais / formulários
  const [formName, setFormName] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formMaterials, setFormMaterials] = useState('');
  const [formRate, setFormRate] = useState('');
  const [editingProjectId, setEditingProjectId] = useState(null);

  // Modal para alternar/editar perfis
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Filtro na listagem
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'in_progress' | 'completed'

  // Tick para manter cronômetro ativo atualizando na tela a cada 1 segundo
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const userProjects = useMemo(() => {
    return data.projects.filter(p => p.userId === activeProfile.id);
  }, [data.projects, activeProfile.id]);

  const filteredProjects = useMemo(() => {
    if (filterStatus === 'all') return userProjects;
    return userProjects.filter(p => p.status === filterStatus);
  }, [userProjects, filterStatus]);

  const selectedProject = useMemo(() => {
    return data.projects.find(p => p.id === selectedProjectId) || null;
  }, [data.projects, selectedProjectId]);

  // ===============================
  // LÓGICA DO CRONÔMETRO À PROVA DE FALHAS
  // ===============================
  // A sessão ativa possui:
  // - accumulatedSeconds: tempo pausado já acumulado
  // - startTimestamp: timestamp (ms) do momento em que foi iniciado/retomado (ou null se pausado)
  // - isRunning: booleano
  // O tempo decorrido total da sessão ativa = accumulatedSeconds + (isRunning ? (now - startTimestamp)/1000 : 0)

  const getLiveSessionSeconds = (project) => {
    if (!project || !project.activeSession) return 0;
    const { accumulatedSeconds, startTimestamp, isRunning } = project.activeSession;
    if (!isRunning || !startTimestamp) return accumulatedSeconds;
    const elapsedSinceStart = Math.max(0, Math.floor((now - startTimestamp) / 1000));
    return accumulatedSeconds + elapsedSinceStart;
  };

  const handleStartSession = (projectId) => {
    setData(prev => ({
      ...prev,
      projects: prev.projects.map(proj => {
        if (proj.id !== projectId) return proj;
        const sessionCount = (proj.sessions?.length || 0) + 1;
        
        return {
          ...proj,
          status: 'in_progress',
          activeSession: {
            sessionNumber: sessionCount,
            accumulatedSeconds: 0,
            startTimestamp: Date.now(),
            isRunning: true,
            startedAt: new Date().toISOString()
          }
        };
      })
    }));
  };

  const handlePauseSession = (projectId) => {
    setData(prev => ({
      ...prev,
      projects: prev.projects.map(proj => {
        if (proj.id !== projectId || !proj.activeSession) return proj;
        const currentElapsed = getLiveSessionSeconds(proj);
        return {
          ...proj,
          activeSession: {
            ...proj.activeSession,
            accumulatedSeconds: currentElapsed,
            startTimestamp: null,
            isRunning: false
          }
        };
      })
    }));
  };

  const handleResumeSession = (projectId) => {
    setData(prev => ({
      ...prev,
      projects: prev.projects.map(proj => {
        if (proj.id !== projectId || !proj.activeSession) return proj;
        return {
          ...proj,
          activeSession: {
            ...proj.activeSession,
            startTimestamp: Date.now(),
            isRunning: true
          }
        };
      })
    }));
  };

  const handleFinishSession = (projectId) => {
    setData(prev => ({
      ...prev,
      projects: prev.projects.map(proj => {
        if (proj.id !== projectId || !proj.activeSession) return proj;
        const totalSessionSeconds = getLiveSessionSeconds(proj);
        
        if (totalSessionSeconds < 5) {
          // Ignora acidentes de menos de 5 segundos
          return {
            ...proj,
            activeSession: null
          };
        }

        const newSessionRecord = {
          id: 'sess-' + Date.now(),
          sessionNumber: proj.activeSession.sessionNumber,
          durationSeconds: totalSessionSeconds,
          completedAt: new Date().toISOString()
        };

        return {
          ...proj,
          sessions: [...(proj.sessions || []), newSessionRecord],
          activeSession: null
        };
      })
    }));
  };

  // ===============================
  // CÁLCULOS FINANCEIROS
  // ===============================
  const calculateProjectMetrics = (project) => {
    if (!project) return { totalSeconds: 0, totalHours: 0, laborCost: 0, finalPrice: 0 };
    
    // Soma de todas as sessões salvas
    const savedSeconds = (project.sessions || []).reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
    // Mais a sessão ativa caso esteja correndo
    const currentLiveSeconds = getLiveSessionSeconds(project);
    const totalSeconds = savedSeconds + currentLiveSeconds;
    
    const totalHours = totalSeconds / 3600;
    const rate = Number(project.hourlyRate) || 0;
    const materials = Number(project.materialsCost) || 0;

    const laborCost = totalHours * rate;
    const finalPrice = laborCost + materials;

    return {
      totalSeconds,
      totalHours,
      laborCost,
      materialsCost: materials,
      finalPrice
    };
  };

  // Formatador de segundos para HH:MM:SS
  const formatTime = (secondsTotal) => {
    const sec = Math.floor(secondsTotal % 60);
    const min = Math.floor((secondsTotal / 60) % 60);
    const hours = Math.floor(secondsTotal / 3600);
    return `${hours.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Formatador amigável em Horas e Minutos
  const formatFriendlyTime = (secondsTotal) => {
    const min = Math.floor((secondsTotal / 60) % 60);
    const hours = Math.floor(secondsTotal / 3600);
    if (hours === 0 && min === 0) return `${Math.floor(secondsTotal)} seg`;
    if (hours === 0) return `${min} min`;
    return `${hours}h ${min}m`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount || 0);
  };

  // Ações de Projeto
  const openNewProjectForm = () => {
    setFormName('');
    setFormImage('');
    setFormMaterials('0');
    setFormRate(activeProfile.defaultRate.toString());
    setEditingProjectId(null);
    setCurrentView('form');
  };

  const openEditProjectForm = (project) => {
    setFormName(project.name);
    setFormImage(project.imageUrl || '');
    setFormMaterials(project.materialsCost.toString());
    setFormRate(project.hourlyRate.toString());
    setEditingProjectId(project.id);
    setCurrentView('form');
  };

  const handleSaveProject = (e) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const materialsNum = parseFloat(formMaterials.replace(',', '.')) || 0;
    const rateNum = parseFloat(formRate.replace(',', '.')) || activeProfile.defaultRate;

    if (editingProjectId) {
      // Edição
      setData(prev => ({
        ...prev,
        projects: prev.projects.map(p => {
          if (p.id !== editingProjectId) return p;
          return {
            ...p,
            name: formName.trim(),
            imageUrl: formImage.trim(),
            materialsCost: materialsNum,
            hourlyRate: rateNum
          };
        })
      }));
    } else {
      // Novo
      const newProj = {
        id: 'proj-' + Date.now(),
        userId: activeProfile.id,
        name: formName.trim(),
        imageUrl: formImage.trim(),
        materialsCost: materialsNum,
        hourlyRate: rateNum,
        status: 'in_progress',
        createdAt: new Date().toISOString(),
        sessions: [],
        activeSession: null
      };

      setData(prev => ({
        ...prev,
        projects: [newProj, ...prev.projects]
      }));
      setSelectedProjectId(newProj.id);
    }

    setCurrentView(editingProjectId ? 'detail' : 'list');
  };

  const toggleProjectStatus = (projectId) => {
    setData(prev => ({
      ...prev,
      projects: prev.projects.map(p => {
        if (p.id !== projectId) return p;
        const nextStatus = p.status === 'completed' ? 'in_progress' : 'completed';
        return { ...p, status: nextStatus };
      })
    }));
  };

  const handleDeleteProject = (projectId) => {
    setData(prev => ({
      ...prev,
      projects: prev.projects.filter(p => p.id !== projectId)
    }));
    setCurrentView('list');
    setSelectedProjectId(null);
  };

  // Alterna Perfil
  const switchProfile = (profileId) => {
    setData(prev => ({ ...prev, activeProfileId: profileId }));
    setShowProfileModal(false);
    setCurrentView('list');
    setSelectedProjectId(null);
  };

  // ===============================
  // RENDERIZAÇÃO
  // ===============================
  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 font-sans flex justify-center selection:bg-rose-100">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl flex flex-col relative border-x border-stone-200">
        
        {/* CABEÇALHO SUPERIOR */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-stone-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-400 to-amber-300 flex items-center justify-center text-white shadow-sm">
              <Sparkles size={16} />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-stone-900 leading-tight">Ateliê Crochê</h1>
              <p className="text-[11px] text-stone-400 font-medium">Gestão & Precificação</p>
            </div>
          </div>

          {/* Botão de Alternar Artesã */}
          <button 
            onClick={() => setShowProfileModal(true)}
            className="flex items-center space-x-2 px-2.5 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200/80 transition-all border border-stone-200/70"
            title="Trocar artesã"
          >
            <div className={`w-5 h-5 rounded-full bg-gradient-to-r ${activeProfile.avatarColor} flex items-center justify-center text-[10px] text-white font-bold`}>
              {activeProfile.name.charAt(0)}
            </div>
            <span className="text-xs font-semibold text-stone-700">{activeProfile.name}</span>
            <Users size={12} className="text-stone-400" />
          </button>
        </header>

        {/* CORPO PRINCIPAL COM CONDIÇÃO DE TELAS */}
        <main className="flex-1 overflow-y-auto pb-24 p-4">

          {/* VISTA 1: LISTA DE PROJETOS */}
          {currentView === 'list' && (
            <div className="space-y-4">
              {/* Banner de Boas-Vindas e Resumo Rápido */}
              <div className="bg-gradient-to-br from-rose-50 via-stone-50 to-amber-50 rounded-2xl p-4 border border-rose-100/60 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-semibold tracking-wider uppercase text-rose-500">Mãos na agulha</span>
                    <h2 className="text-lg font-bold text-stone-800">Olá, {activeProfile.name}! ✨</h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {userProjects.filter(p => p.status === 'in_progress').length} projetos ativos no momento
                    </p>
                  </div>
                  <button
                    onClick={openNewProjectForm}
                    className="flex items-center space-x-1.5 px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl shadow-md shadow-rose-200 text-xs font-semibold transition active:scale-95"
                  >
                    <Plus size={15} />
                    <span>Novo</span>
                  </button>
                </div>

                {/* Filtros de status */}
                <div className="flex space-x-2 mt-4 pt-3 border-t border-rose-100/60">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`text-xs px-3 py-1 rounded-lg font-medium transition ${
                      filterStatus === 'all' ? 'bg-stone-800 text-white shadow-xs' : 'bg-white/80 text-stone-600 hover:bg-white'
                    }`}
                  >
                    Todos ({userProjects.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('in_progress')}
                    className={`text-xs px-3 py-1 rounded-lg font-medium transition ${
                      filterStatus === 'in_progress' ? 'bg-rose-500 text-white shadow-xs' : 'bg-white/80 text-stone-600 hover:bg-white'
                    }`}
                  >
                    Em Produção
                  </button>
                  <button
                    onClick={() => setFilterStatus('completed')}
                    className={`text-xs px-3 py-1 rounded-lg font-medium transition ${
                      filterStatus === 'completed' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white/80 text-stone-600 hover:bg-white'
                    }`}
                  >
                    Concluídos
                  </button>
                </div>
              </div>

              {/* Lista dos Projetos */}
              {filteredProjects.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/50">
                  <div className="w-12 h-12 mx-auto rounded-full bg-rose-100/60 text-rose-500 flex items-center justify-center mb-3">
                    <ShoppingBag size={22} />
                  </div>
                  <h3 className="text-sm font-semibold text-stone-700">Nenhum projeto encontrado</h3>
                  <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                    {filterStatus === 'all' 
                      ? 'Comece adicionando uma peça para marcar suas sessões de confecção.' 
                      : 'Não há projetos com este status no momento.'}
                  </p>
                  <button
                    onClick={openNewProjectForm}
                    className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 bg-stone-800 text-white text-xs font-semibold rounded-xl hover:bg-stone-900 transition"
                  >
                    <Plus size={14} />
                    <span>Iniciar Primeiro Projeto</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredProjects.map(proj => {
                    const metrics = calculateProjectMetrics(proj);
                    const isWorkingNow = proj.activeSession?.isRunning;

                    return (
                      <div
                        key={proj.id}
                        onClick={() => {
                          setSelectedProjectId(proj.id);
                          setCurrentView('detail');
                        }}
                        className={`group relative overflow-hidden bg-white rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow-md ${
                          isWorkingNow 
                            ? 'border-amber-400 ring-2 ring-amber-300/40' 
                            : 'border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        {/* Indicador de Sessão Aberta */}
                        {isWorkingNow && (
                          <div className="bg-amber-500 text-white text-[10px] font-bold px-3 py-0.5 flex items-center justify-between animate-pulse">
                            <span className="flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              <span>CRONOMETRANDO AGORA</span>
                            </span>
                            <span>{formatFriendlyTime(metrics.totalSeconds)}</span>
                          </div>
                        )}

                        <div className="p-3.5 flex space-x-3.5 items-center">
                          {/* Imagem de Referência */}
                          <div className="w-16 h-16 rounded-xl bg-stone-100 overflow-hidden flex-shrink-0 relative border border-stone-200">
                            {proj.imageUrl ? (
                              <img 
                                src={proj.imageUrl} 
                                alt={proj.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.parentNode.classList.add('flex', 'items-center', 'justify-center', 'text-stone-300');
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs font-serif italic">
                                Crochê
                              </div>
                            )}
                          </div>

                          {/* Informações Centrais */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <span className={`inline-block w-2 h-2 rounded-full ${
                                proj.status === 'completed' ? 'bg-emerald-500' : 'bg-rose-400'
                              }`} />
                              <h3 className="font-semibold text-stone-800 text-sm truncate">{proj.name}</h3>
                            </div>

                            <div className="flex items-center space-x-3 text-xs text-stone-500 mt-1">
                              <span className="flex items-center space-x-1">
                                <Clock size={12} className="text-stone-400" />
                                <span>{formatFriendlyTime(metrics.totalSeconds)}</span>
                              </span>
                              <span>•</span>
                              <span>{proj.sessions?.length || 0} {proj.sessions?.length === 1 ? 'sessão' : 'sessões'}</span>
                            </div>

                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-stone-400">Preço Sugerido:</span>
                              <span className="text-xs font-bold text-stone-800 bg-stone-100 px-2 py-0.5 rounded-md">
                                {formatCurrency(metrics.finalPrice)}
                              </span>
                            </div>
                          </div>

                          <div className="text-stone-300 group-hover:text-stone-600 pl-1 transition">
                            <ChevronRight size={18} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: DETALHES DO PROJETO & CRONÔMETRO */}
          {currentView === 'detail' && selectedProject && (() => {
            const metrics = calculateProjectMetrics(selectedProject);
            const activeSession = selectedProject.activeSession;
            const liveSeconds = getLiveSessionSeconds(selectedProject);
            const isRunning = activeSession?.isRunning;

            return (
              <div className="space-y-4">
                {/* Barra de Retorno e Ações */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentView('list')}
                    className="flex items-center space-x-1 text-xs font-medium text-stone-500 hover:text-stone-800 px-2 py-1.5 rounded-lg hover:bg-stone-100 transition"
                  >
                    <ArrowLeft size={16} />
                    <span>Voltar aos Projetos</span>
                  </button>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => openEditProjectForm(selectedProject)}
                      className="p-2 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition"
                      title="Editar Valores e Dados"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Deseja realmente apagar este projeto e todas as suas sessões?')) {
                          handleDeleteProject(selectedProject.id);
                        }
                      }}
                      className="p-2 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                      title="Excluir Projeto"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Card de Identificação da Peça */}
                <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
                  <div className="relative h-44 bg-stone-100">
                    {selectedProject.imageUrl ? (
                      <img 
                        src={selectedProject.imageUrl} 
                        alt={selectedProject.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 bg-stone-100">
                        <ShoppingBag size={32} className="text-stone-300 mb-1" />
                        <span className="text-xs">Sem foto de referência</span>
                      </div>
                    )}
                    
                    {/* Badge de status clicável */}
                    <button
                      onClick={() => toggleProjectStatus(selectedProject.id)}
                      className={`absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full shadow-md backdrop-blur-md flex items-center space-x-1.5 transition ${
                        selectedProject.status === 'completed'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-stone-900/80 text-white hover:bg-stone-900'
                      }`}
                    >
                      <CheckCircle2 size={13} />
                      <span>{selectedProject.status === 'completed' ? 'Finalizado' : 'Em Andamento'}</span>
                    </button>
                  </div>

                  <div className="p-4">
                    <h2 className="text-base font-bold text-stone-900 leading-snug">{selectedProject.name}</h2>
                    {selectedProject.imageUrl && (
                      <a 
                        href={selectedProject.imageUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-[11px] text-rose-500 hover:text-rose-600 font-medium mt-1"
                      >
                        <ExternalLink size={11} />
                        <span>Ver foto original ampliada</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* PAINEL DE CRONÔMETRO (BLINDADO) */}
                <div className="bg-gradient-to-b from-stone-900 to-stone-800 text-white rounded-3xl p-5 shadow-xl text-center relative overflow-hidden">
                  <div className="flex justify-between items-center text-xs text-stone-400 border-b border-stone-700/60 pb-3 mb-4">
                    <span className="flex items-center space-x-1 font-medium">
                      <Clock size={13} className="text-amber-400" />
                      <span>Sessão Atual {activeSession ? `#${activeSession.sessionNumber}` : ''}</span>
                    </span>
                    <span className="text-[11px] uppercase tracking-wider font-semibold">
                      {activeSession ? (isRunning ? 'Em Andamento' : 'Pausada') : 'Pronto para crochetar'}
                    </span>
                  </div>

                  {/* Mostrador Digital Gigante */}
                  <div className="py-2">
                    <div className="font-mono text-4xl sm:text-5xl font-black tracking-wider text-amber-300 drop-shadow-sm">
                      {formatTime(liveSeconds)}
                    </div>
                    <p className="text-[11px] text-stone-400 mt-1">
                      {activeSession 
                        ? (isRunning ? 'Contando tempo de confecção...' : 'Pausado • Não perde o registro') 
                        : 'Clique em "Iniciar Sessão" para registrar seu tempo'}
                    </p>
                  </div>

                  {/* Controles Táteis Grandes */}
                  <div className="mt-5 flex items-center justify-center gap-2">
                    {!activeSession ? (
                      <button
                        onClick={() => handleStartSession(selectedProject.id)}
                        className="w-full py-3.5 px-6 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-900 font-bold text-sm flex items-center justify-center space-x-2 shadow-lg transition active:scale-95"
                      >
                        <Play size={18} fill="currentColor" />
                        <span>Iniciar 1ª Sessão</span>
                      </button>
                    ) : (
                      <>
                        {isRunning ? (
                          <button
                            onClick={() => handlePauseSession(selectedProject.id)}
                            className="flex-1 py-3.5 px-4 rounded-2xl bg-stone-700 hover:bg-stone-600 text-amber-300 font-semibold text-xs flex items-center justify-center space-x-2 transition active:scale-95"
                          >
                            <Pause size={16} fill="currentColor" />
                            <span>Pausar</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleResumeSession(selectedProject.id)}
                            className="flex-1 py-3.5 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-900 font-bold text-xs flex items-center justify-center space-x-2 transition active:scale-95"
                          >
                            <Play size={16} fill="currentColor" />
                            <span>Retomar</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleFinishSession(selectedProject.id)}
                          className="flex-1 py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center justify-center space-x-2 transition active:scale-95 shadow-md"
                        >
                          <Square size={14} fill="currentColor" />
                          <span>Finalizar Sessão</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* PAINEL FINANCEIRO DINÂMICO */}
                <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                        <DollarSign size={16} />
                      </div>
                      <h3 className="font-bold text-stone-800 text-xs">Cálculo de Precificação</h3>
                    </div>
                    <span className="text-[11px] text-stone-400">Automático</span>
                  </div>

                  {/* Grade de Componentes do Preço */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center text-stone-600">
                      <span>Tempo Líquido Trabalhado</span>
                      <span className="font-semibold text-stone-800">
                        {formatFriendlyTime(metrics.totalSeconds)} ({metrics.totalHours.toFixed(2)}h)
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-stone-600">
                      <span>Valor da sua Hora ({activeProfile.name})</span>
                      <span className="font-semibold text-stone-800">
                        {formatCurrency(selectedProject.hourlyRate)}/h
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-stone-600">
                      <span>Mão de Obra ({metrics.totalHours.toFixed(2)}h × {formatCurrency(selectedProject.hourlyRate)})</span>
                      <span className="font-semibold text-stone-800">{formatCurrency(metrics.laborCost)}</span>
                    </div>

                    <div className="flex justify-between items-center text-stone-600">
                      <span>Materiais (fios, fecho, tag)</span>
                      <span className="font-semibold text-stone-800">{formatCurrency(metrics.materialsCost)}</span>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex justify-between items-baseline">
                      <div>
                        <span className="text-xs font-bold text-stone-900 block">Preço Final Sugerido</span>
                        <span className="text-[10px] text-stone-400">Mão de obra + Materiais</span>
                      </div>
                      <span className="text-xl font-black text-rose-600">
                        {formatCurrency(metrics.finalPrice)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* HISTÓRICO DE SESSÕES */}
                <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-stone-800 text-xs flex items-center space-x-1.5">
                      <Layers size={14} className="text-stone-400" />
                      <span>Histórico de Sessões Salvas ({selectedProject.sessions?.length || 0})</span>
                    </h3>
                  </div>

                  {(!selectedProject.sessions || selectedProject.sessions.length === 0) ? (
                    <p className="text-xs text-stone-400 italic py-2 text-center">
                      Nenhuma sessão finalizada ainda. Quando você concluir uma etapa no cronômetro, ela ficará registrada aqui.
                    </p>
                  ) : (
                    <div className="divide-y divide-stone-100 max-h-48 overflow-y-auto">
                      {selectedProject.sessions.map((sess, idx) => (
                        <div key={sess.id || idx} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-stone-700">Sessão {sess.sessionNumber || idx + 1}</span>
                            <p className="text-[10px] text-stone-400">
                              {sess.completedAt ? new Date(sess.completedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Registrado'}
                            </p>
                          </div>
                          <span className="font-mono font-medium text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg">
                            {formatFriendlyTime(sess.durationSeconds)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            );
          })()}

          {/* VISTA 3: FORMULÁRIO (NOVO OU EDITAR PROJETO) */}
          {currentView === 'form' && (
            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
                <h2 className="font-bold text-stone-900 text-sm">
                  {editingProjectId ? 'Editar Dados do Projeto' : 'Cadastrar Novo Projeto'}
                </h2>
                <button
                  type="button"
                  onClick={() => setCurrentView(editingProjectId ? 'detail' : 'list')}
                  className="p-1 rounded-lg hover:bg-stone-100 text-stone-400"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveProject} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Nome da Peça / Projeto *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Bolsa de Crochê Tulipa"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-400 text-xs text-stone-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Link da Imagem (URL externa)
                  </label>
                  <input
                    type="url"
                    placeholder="https://exemplo.com/foto-croche.jpg"
                    value={formImage}
                    onChange={(e) => setFormImage(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-400 text-xs text-stone-800"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">
                    Cole o link de uma imagem do Pinterest, Imgur ou web para não ocupar armazenamento.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      Custo Materiais (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formMaterials}
                      onChange={(e) => setFormMaterials(e.target.value)}
                      placeholder="0,00"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-400 text-xs text-stone-800"
                    />
                    <p className="text-[10px] text-stone-400 mt-1">Fios, fechos, botões</p>
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      Sua Hora (R$/h)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={formRate}
                      onChange={(e) => setFormRate(e.target.value)}
                      placeholder="20,00"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-400 text-xs text-stone-800"
                    />
                    <p className="text-[10px] text-stone-400 mt-1">Pode mudar por peça</p>
                  </div>
                </div>

                <div className="pt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentView(editingProjectId ? 'detail' : 'list')}
                    className="flex-1 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 font-semibold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold shadow-md shadow-rose-200 transition"
                  >
                    {editingProjectId ? 'Salvar Alterações' : 'Criar Projeto'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </main>

        {/* MODAL DE TROCA DE PERFIL (2 ARTESÃS) */}
        {showProfileModal && (
          <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-xs p-5 shadow-2xl border border-stone-200">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Quem está crochetando?</h3>
                  <p className="text-xs text-stone-400">Selecione o seu perfil</p>
                </div>
                <button 
                  onClick={() => setShowProfileModal(false)}
                  className="p-1 rounded-full text-stone-400 hover:bg-stone-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2.5">
                {data.profiles.map(p => {
                  const isCurrent = p.id === activeProfile.id;
                  const projectCount = data.projects.filter(proj => proj.userId === p.id).length;

                  return (
                    <button
                      key={p.id}
                      onClick={() => switchProfile(p.id)}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between border transition text-left ${
                        isCurrent 
                          ? 'border-rose-400 bg-rose-50/60' 
                          : 'border-stone-200 hover:border-stone-300 bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-r ${p.avatarColor} text-white font-bold flex items-center justify-center text-sm shadow-xs`}>
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-stone-800">{p.name}</p>
                          <p className="text-[11px] text-stone-400">{projectCount} projetos cadastrados</p>
                        </div>
                      </div>
                      {isCurrent && <CheckCircle2 size={16} className="text-rose-500" />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 text-center">
                <p className="text-[11px] text-stone-400">
                  Os dados ficam guardados no navegador do seu celular automaticamente.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* NAVEGAÇÃO INFERIOR FIXA */}
        <footer className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-stone-200 px-6 py-2.5 flex justify-around items-center z-20">
          <button
            onClick={() => {
              setCurrentView('list');
              setSelectedProjectId(null);
            }}
            className={`flex flex-col items-center space-y-1 text-xs font-medium transition ${
              currentView === 'list' ? 'text-rose-600' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            <Layers size={18} />
            <span>Projetos</span>
          </button>

          <button
            onClick={openNewProjectForm}
            className="flex flex-col items-center space-y-1 text-xs font-medium text-stone-400 hover:text-stone-600 transition"
          >
            <div className="w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center -mt-5 shadow-lg shadow-rose-200 active:scale-95 transition">
              <Plus size={20} />
            </div>
            <span className="text-[11px]">Novo</span>
          </button>

          <button
            onClick={() => setShowProfileModal(true)}
            className="flex flex-col items-center space-y-1 text-xs font-medium text-stone-400 hover:text-stone-600 transition"
          >
            <Users size={18} />
            <span>Perfil ({activeProfile.name})</span>
          </button>
        </footer>

      </div>
    </div>
  );
}
