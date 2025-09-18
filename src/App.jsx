import FinanceSummary from "./components/FinanceSummary";
import ClientForm from "./components/ClientForm";
import ClientList from "./components/ClientList";
import Agenda from "./components/Agenda";
import OnboardingWizard from "./components/OnboardingWizard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { AppProvider, useApp } from "./context/AppContext";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const PT_WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function nowHHMM(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function NotificationsBanner() {
  const { clients, payments } = useApp();
  const [alerts, setAlerts] = useState([]);
  const [notifiedIds, setNotifiedIds] = useState(() => new Set());

  useEffect(() => {
    const computeDueNow = () => {
      const current = new Date();
      const weekday = PT_WEEK[current.getDay()];
      const hhmm = nowHHMM(current);
      return clients.filter((client) => {
        if (!client.time) return false;
        const [weekAbbr, time] = client.time.split(" ");
        const sameWeekday = weekAbbr?.toLowerCase() === weekday.toLowerCase();
        const pendingPayment = !payments[client.id];
        return sameWeekday && time === hhmm && pendingPayment;
      });
    };

    const tick = () => {
      const dueNow = computeDueNow();
      if (!dueNow.length) return;

      setNotifiedIds((prev) => {
        const unseen = dueNow.filter((client) => !prev.has(client.id));
        if (!unseen.length) return prev;

        setAlerts((prevAlerts) => [
          ...prevAlerts,
          ...unseen.map((client) => ({
            id: client.id,
            msg: `Lembrete: ${client.name} tem cobrança agora (${client.time}).`,
          })),
        ]);

        const updated = new Set(prev);
        unseen.forEach((client) => updated.add(client.id));
        return updated;
      });
    };

    tick();
    const interval = setInterval(tick, 60 * 1000);
    return () => clearInterval(interval);
  }, [clients, payments]);

  if (!alerts.length) return null;

  return (
    <div className="space-y-2 mb-4">
      {alerts.map((alert) => (
        <Card key={alert.id} className="border-2 border-yellow-400">
          <CardContent className="p-3 flex items-center justify-between">
            <span className="text-sm">{alert.msg}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAlerts((prev) => prev.filter((item) => item.id !== alert.id))}
            >
              OK
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Shell() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">Wallet.A — MVP</h1>

      <OnboardingWizard />
      <NotificationsBanner />

      <div className="mb-6">
        <FinanceSummary />
      </div>

      <Tabs defaultValue="clientes">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes">
          <ClientForm />
          <ClientList />
        </TabsContent>

        <TabsContent value="agenda">
          <Agenda />
        </TabsContent>

        <TabsContent value="config">
          <Card className="shadow-xl">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-2">Configurações</h2>
              <ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
                <li>Preferências de notificação (mock ativo: alerta por minuto se horário coincidir)</li>
                <li>Planos e assinatura (definir gateway)</li>
                <li>Backup/exportação de dados (CSV disponível no Resumo Financeiro)</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
