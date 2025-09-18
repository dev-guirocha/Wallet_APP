import { Card, CardContent } from "@/components/ui/card";
import { useApp } from "../context/AppContext";

const Agenda = () => {
  const { clients, payments } = useApp();

  return (
    <Card className="shadow-xl">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold mb-4">Agenda</h2>
        {clients.length === 0 && <p>Nenhum cliente cadastrado ainda.</p>}
        {clients.map((client) => (
          <Card key={client.id} className="p-4 mb-2">
            <p>
              <strong>{client.name}</strong> — {client.time} ({client.frequency})
            </p>
            <p className="text-sm">Status: {payments[client.id] ? "Pago" : "Pendente"}</p>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
};

export default Agenda;
