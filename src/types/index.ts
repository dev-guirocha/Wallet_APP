export interface PaymentMetadata {
  status: 'paid' | 'pending';
  date?: string;
  value?: number;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  location?: string;
  phone?: string;
  phoneRaw?: string;
  days: string[];
  time?: string;
  dayTimes?: Record<string, string>;
  value: number;
  valueFormatted?: string;
  dueDay: number;
  payments: Record<string, PaymentMetadata>;
  notificationsPaymentOptIn?: boolean;
  notificationsScheduleOptIn?: boolean;
}

export interface Expense {
  id: string;
  title: string;
  value: number;
  date: string;
  category?: string;
  categoryLabel?: string;
  isRecurring?: boolean;
}

export interface AppState {
  clients: Client[];
  expenses: Expense[];
  clientTerm: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userAge: number | null;
  userProfession: string;
  isLoading: boolean;

  setClientTerm: (term: string) => void;
  setUserProfession: (profession: string) => void;
  setUserProfile: (profile: {
    name?: string;
    email?: string;
    phone?: string;
    age?: number | null;
    profession?: string;
  }) => void;
  addClient: (client: Omit<Client, 'id' | 'payments'>) => void;
  updateClient: (id: string, data: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  togglePayment: (clientId: string, monthKey: string) => void;
  addExpense: (expense: Omit<Expense, 'id'>) => void;
  deleteExpense: (id: string) => void;
}
