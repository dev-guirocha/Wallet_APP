import { formatBRL, safeMoneyNumber } from './money';

export const actionLabels = {
  charge: 'Cobrar',
  resend: 'Reenviar',
  receive: 'Registrar recebimento',
  confirm: 'Confirmar',
  complete: 'Concluir',
  reschedule: 'Reagendar',
  edit: 'Editar',
  retry: 'Tentar novamente',
};

export const titles = {
  today: 'Hoje',
  tomorrow: 'Amanhã',
  overdue: 'Atrasadas',
  thisWeek: 'Esta semana',
  thisMonth: 'Este mês',
};

export const emptyMessages = {
  charges: {
    default: {
      DUE_TODAY: 'Nenhuma cobrança vence hoje.',
      TOMORROW: 'Nenhuma cobrança vence amanhã.',
      OVERDUE: 'Sem cobranças atrasadas.',
      NEXT_7_DAYS: 'Sem cobranças para os próximos 7 dias.',
      ALL: 'Nenhuma cobrança pendente.',
    },
    receive: {
      DUE_TODAY: 'Nenhum recebimento para cobranças de hoje.',
      TOMORROW: 'Sem cobranças de amanhã para receber.',
      OVERDUE: 'Sem recebimentos de cobranças atrasadas.',
      NEXT_7_DAYS: 'Sem cobranças dos próximos 7 dias para receber.',
      ALL: 'Nenhuma cobrança pendente para registrar recebimento.',
    },
    title: 'Sem cobranças',
  },
  chargesToday: {
    defaultTitle: 'Sem cobranças hoje',
    defaultMessage: 'Nenhuma cobrança pendente hoje.',
    receiveTitle: 'Sem recebimentos pendentes',
    receiveMessage: 'Nenhuma cobrança enviada para registrar recebimento.',
  },
  agenda: {
    noDateTitle: 'Selecione um dia',
    noDateMessage: 'Escolha uma data no calendário para ver os compromissos.',
    emptyDayTitle: 'Sem compromissos',
    emptyDayMessage: 'Nenhum compromisso para o dia selecionado.',
    nowEmpty: 'Nenhum atendimento nos próximos 90 minutos.',
    upcomingEmpty: 'Sem atendimentos pendentes para este dia.',
    completedEmpty: 'Nenhum atendimento realizado até agora.',
  },
  reports: {
    noDataInterpretation: 'Sem dados suficientes para interpretar o período.',
    interpretationHealthy: 'Operação saudável: todo o valor previsto no mês já foi recebido.',
    interpretationHighDelinquency:
      'Atenção: a inadimplência está alta. Priorize cobranças nas semanas mais recentes.',
    interpretationGoodRhythm: 'Bom ritmo de caixa: a maior parte da receita prevista já entrou.',
    interpretationRecovery:
      'Ainda há espaço para recuperação: reforçar confirmação e cobrança tende a melhorar o fechamento.',
    periodHint: 'Toque em uma semana para ver o resumo textual.',
  },
};

export const reportMetricLabels = {
  REVENUE: 'Receita',
  RECEIVED: 'Recebido',
  LOST: 'Perdido',
};

export const formLabels = {
  save: 'Salvar',
  addExpense: {
    title: 'Nova despesa',
    submit: 'Salvar despesa',
    amount: 'Valor da despesa',
    description: 'Descrição',
    descriptionPlaceholder: 'Ex: Anúncio Instagram',
    date: 'Data',
    category: 'Categoria',
  },
  editProfile: {
    title: 'Editar perfil',
    submit: 'Salvar alterações',
    fullName: 'Nome completo',
    fullNamePlaceholder: 'Seu nome',
    phone: 'Telefone',
    phonePlaceholder: '(00) 00000-0000',
    profession: 'Profissão',
    professionPlaceholder: 'Sua profissão',
  },
};

export const settingsCopy = {
  title: 'Configurações',
  profileSubtitle: 'Personalize sua experiência',
  notificationsTitle: 'Notificações',
  notificationsLabel: 'Lembretes do aplicativo',
  notificationsSystemHint: 'Ative nas configurações do sistema',
  planTitle: 'Plano',
  freePlan: 'Plano Gratuito',
  proPlan: 'Plano Pro',
  planCtaFree: 'Conhecer Plano Pro',
  planCtaPro: 'Ver detalhes do Pro',
  accountTitle: 'Conta',
  editProfile: 'Editar perfil',
  changePhoto: 'Alterar foto',
  privacy: 'Preferências de privacidade',
  templates: 'Preferências de mensagens',
  chargesToday: 'Cobranças de hoje',
  signOut: 'Sair da conta',
  notificationsDisabled: 'Notificações desativadas.',
  notificationsEnabled: 'Notificações ativadas.',
  notificationsEnableError:
    'Não foi possível ativar as notificações. Verifique as permissões do sistema.',
};

export const privacyCopy = {
  title: 'Privacidade',
  balancesTitle: 'Saldo e valores',
  hideBalances: 'Ocultar valores na Home',
  helper: 'Quando ativado, os valores financeiros ficarão mascarados na tela inicial.',
  updateError: 'Não foi possível atualizar essa preferência agora.',
};

export const templatesCopy = {
  title: 'Preferências de mensagens',
  submit: 'Salvar mensagens',
  confirmLabel: 'Mensagem de confirmação',
  chargeLabel: 'Mensagem de cobrança',
  confirmHelper: 'Variáveis: {nome}, {hora}, {data}',
  chargeHelper: 'Variáveis: {nome}, {data}, {dd}, {mm}',
  saveError: 'Não foi possível salvar suas preferências. Verifique sua conexão e tente novamente.',
};

export const photoCopy = {
  title: 'Alterar foto',
  submit: 'Salvar',
  pick: 'Escolher foto',
  selectFirstError: 'Selecione uma imagem.',
  selectNewError: 'Escolha uma nova imagem antes de salvar.',
  saveError: 'Não foi possível atualizar a foto.',
  pickError: 'Não foi possível selecionar a imagem.',
  pickDataError: 'Não foi possível obter a imagem selecionada.',
};

export const clientReportCopy = {
  loadingErrorTitle: 'Falha ao carregar',
  loadingErrorMessage: 'Não foi possível carregar o relatório do cliente.',
  summaryTitle: 'Resumo (6 meses)',
  historyTitle: 'Histórico 6 meses',
  avgValue: 'Valor médio',
  charges: 'Cobranças',
  avgDaysToPay: 'Tempo médio para pagar',
  daysSuffix: 'dias',
  noHistoryTitle: 'Sem histórico',
  noHistoryMessage: 'Sem movimentações desse cliente nos últimos 6 meses.',
};

export const planCopy = {
  title: 'Flowdesk Pro',
  subtitle: 'Tudo o que você precisa para crescer sem limites.',
  priceSuffix: '/mês',
  cancelAnytime: 'Cancele quando quiser',
  whyUpgrade: 'Por que migrar para o Pro?',
  supportTitle: 'Suporte dedicado',
  supportText:
    'Conte com atendimento prioritário e materiais exclusivos para organizar sua rotina e fortalecer o relacionamento com seus clientes.',
  features: [
    'Clientes ilimitados e histórico completo',
    'Relatórios financeiros com exportação',
    'Lembretes automáticos de agenda e pagamento',
    'Suporte prioritário e roadmap colaborativo',
  ],
  upgradeSuccessTitle: 'Plano atualizado',
  upgradeSuccessMessage: 'Você agora faz parte do Flowdesk Pro!',
  upgradeSuccessAction: 'Entendi',
  upgradeCta: 'Quero migrar para o Pro',
  activeCta: 'Plano Pro ativado',
  back: 'Voltar',
};

export const feedCopy = {
  titles: {
    updates: 'Updates',
    feed: 'Feed',
    timeline: 'Timeline',
  },
  subtitle: 'App updates in chronological order',
  seeAll: 'See all',
  filters: {
    ALL: 'All',
    FINANCE: 'Finance',
    CLIENTS: 'Clients',
    SCHEDULE: 'Schedule',
    RISK: 'Risk',
  },
  groups: {
    TODAY: 'Today',
    YESTERDAY: 'Yesterday',
    WEEK: 'This week',
  },
  importance: {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  },
  empty: {
    updatesTitle: 'No updates',
    updatesMessage: 'When relevant events happen, they will appear here.',
    filterTitle: 'No events for this filter',
    filterMessage: 'Try another filter to see more activity.',
  },
  error: {
    title: 'Unable to load feed',
    message: 'Could not load updates right now.',
  },
};

export const chargeContextLabels = {
  missingDueDate: 'Defina vencimento para habilitar cobrança.',
  sendBeforeReceive: 'Envie cobrança antes de registrar recebimento.',
  missingDueDateLabel: 'Vencimento não definido',
};

export const getChargeLabel = ({ hasCharge = false, mode = 'default' } = {}) => {
  if (mode === 'receive') return actionLabels.receive;
  return hasCharge ? actionLabels.resend : actionLabels.charge;
};

export const getChargeSecondaryLabel = ({ hasCharge = false, mode = 'default' } = {}) => {
  if (mode === 'receive') {
    return hasCharge ? actionLabels.resend : actionLabels.charge;
  }
  return actionLabels.receive;
};

export const getChargesEmptyMessage = ({ filterKey = 'ALL', mode = 'default' } = {}) => {
  const key = String(filterKey || 'ALL').toUpperCase();
  const dictionary = mode === 'receive' ? emptyMessages.charges.receive : emptyMessages.charges.default;
  return dictionary[key] || dictionary.ALL;
};

export const getFeedFilterLabel = (key = 'ALL') => {
  const normalized = String(key || 'ALL').toUpperCase();
  return feedCopy.filters[normalized] || feedCopy.filters.ALL;
};

export const getEventA11yLabel = (event = {}) => {
  const title = String(event?.title || '').trim();
  const subtitle = String(event?.subtitle || '').trim();
  const normalizedImportance = String(event?.importance || 'low').toLowerCase();
  const importanceLabel = feedCopy.importance[normalizedImportance] || feedCopy.importance.low;
  const amountValue = safeMoneyNumber(event?.amount, NaN);

  const parts = [];
  if (title) parts.push(title);
  if (subtitle) parts.push(subtitle);
  if (Number.isFinite(amountValue)) {
    parts.push(`Amount ${formatBRL(amountValue)}`);
  }
  parts.push(`Importance ${importanceLabel}`);

  return parts.join('. ');
};
