import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useApp } from "../context/AppContext";
import { currencyBRL } from "../utils/money";

const ClientList = () => {
  const { clients, payments, togglePaid } = useApp();

  if (clients.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>;
  }

  return (
    <div className="mt-6 space-y-3">
      {clients.map((client) => (
        <Card key={client.id} className="p-4 flex justify-between items-center">
          <div>
            <p className="font-semibold">{client.name}</p>
            <p className="text-sm">{client.frequency} • {client.time}</p>
            <p className="text-sm">{currencyBRL(client.price)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{payments[client.id] ? "Pago" : "Pendente"}</span>
            <Checkbox checked={!!payments[client.id]} onCheckedChange={() => togglePaid(client.id)} />
          </div>
        </Card>
      ))}
    </div>
  );
};

export default ClientList;
