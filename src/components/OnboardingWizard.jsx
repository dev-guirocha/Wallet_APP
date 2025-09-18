import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useApp } from "../context/AppContext";

const steps = [
  {
    title: "Bem-vindo ao Wallet.A",
    text: "Gestor de agenda e finanças para autônomos. Vamos te guiar em 3 passos rápidos.",
  },
  {
    title: "Como funciona",
    text: "Cadastre clientes com frequência, horário e valor. Marque como pago quando receber para atualizar seus totais.",
  },
  {
    title: "Cadastre o primeiro cliente",
    text: "Vá na aba Clientes, preencha o formulário e clique em Adicionar Cliente.",
  },
];

export default function OnboardingWizard() {
  const { onboardingDone, markOnboardingDone } = useApp();
  const [index, setIndex] = useState(0);

  if (onboardingDone) return null;

  return (
    <Card className="mb-6 border-2">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-1">{steps[index].title}</h3>
        <p className="text-sm mb-4">{steps[index].text}</p>
        <div className="flex gap-2">
          {index < steps.length - 1 ? (
            <Button onClick={() => setIndex((value) => value + 1)}>Próximo</Button>
          ) : (
            <Button onClick={markOnboardingDone}>Concluir</Button>
          )}
          <Button variant="ghost" onClick={markOnboardingDone}>Pular</Button>
        </div>
      </CardContent>
    </Card>
  );
}
