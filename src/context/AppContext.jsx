import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEYS = {
  clients: "walleta_clients",
  payments: "walleta_payments",
  onboarding: "walleta_onboarding_done",
};

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [clients, setClients] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.clients);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [payments, setPayments] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.payments);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [onboardingDone, setOnboardingDone] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.onboarding) === "1";
  });

  // Persistência
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(clients)); } catch {}
  }, [clients]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.payments, JSON.stringify(payments)); } catch {}
  }, [payments]);

  const addClient = (client) => {
    const id = crypto.randomUUID();
    const newClient = { id, ...client };
    setClients((prev) => [...prev, newClient]);
  };

  const togglePaid = (clientId) => {
    setPayments((prev) => ({ ...prev, [clientId]: !prev[clientId] }));
  };

  const markOnboardingDone = () => {
    setOnboardingDone(true);
    try { localStorage.setItem(STORAGE_KEYS.onboarding, "1"); } catch {}
  };

  const totals = useMemo(() => {
    const totalPaid = clients.reduce((acc, c) => acc + (payments[c.id] ? Number(c.price) : 0), 0);
    const totalToReceive = clients.reduce((acc, c) => acc + (!payments[c.id] ? Number(c.price) : 0), 0);
    return { totalPaid, totalToReceive };
  }, [clients, payments]);

  const value = { clients, addClient, payments, togglePaid, totals, onboardingDone, markOnboardingDone };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp deve ser usado dentro de <AppProvider>");
  return ctx;
}
