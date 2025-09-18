import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useApp } from "../context/AppContext";
import { currencyBRL } from "../utils/money";
import { toCSV, downloadCSV } from "../utils/csv";

const FinanceSummary = () => {
  const { totals, clients, payments } = useApp();

  const handleExportCSV = () => {
    const rows = clients.map((c) => ({
      nome: c.name,
      frequencia: c.frequency,
      horario: c.time,
      valor: currencyBRL(c.price),
      status: payments[c.id] ? "Pago" : "Pendente",
    }));
    const csv = toCSV(rows, ["nome", "frequencia", "horario", "valor", "status"]);
    downloadCSV(`financeiro_walleta_${new Date().toISOString().slice(0,10)}.csv`, csv);
  };

  return (
    <Card className="shadow-xl">
      <CardContent className="p-6 text-center space-y-3">
        <h2 className="text-xl font-semibold">Resumo Financeiro</h2>
        <p>
          Total Recebido: <span className="font-bold text-green-600">{currencyBRL(totals.totalPaid)}</span>
        </p>
        <p>
          Total a Receber: <span className="font-bold text-red-600">{currencyBRL(totals.totalToReceive)}</span>
        </p>
        <div className="pt-2">
          <Button variant="outline" onClick={handleExportCSV}>Exportar CSV</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FinanceSummary;