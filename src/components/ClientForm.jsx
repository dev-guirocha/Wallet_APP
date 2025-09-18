import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "../context/AppContext";

const ClientForm = () => {
  const { addClient } = useApp();
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("");
  const [time, setTime] = useState("");
  const [price, setPrice] = useState("");

  const onSubmit = () => {
    if (!name || !frequency || !time || !price) return;
    addClient({ name, frequency, time, price: parseFloat(price) });
    setName("");
    setFrequency("");
    setTime("");
    setPrice("");
  };

  return (
    <Card className="shadow-xl">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold mb-4">Cadastrar Cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Frequência (ex: 2x/semana)" value={frequency} onChange={(e) => setFrequency(e.target.value)} />
          <Input placeholder="Dia e hora (ex: Seg 10:00)" value={time} onChange={(e) => setTime(e.target.value)} />
          <Input placeholder="Valor (R$)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <Button onClick={onSubmit}>Adicionar Cliente</Button>
      </CardContent>
    </Card>
  );
};

export default ClientForm;
