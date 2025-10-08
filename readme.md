# Wallet.A - Gestor Financeiro para Autônomos (Mobile)

**Wallet.A** é um aplicativo móvel, desenvolvido em React Native, com uma interface minimalista e elegante, projetado para ser o assistente financeiro definitivo para profissionais autônomos. Gerencie seus clientes, agenda e pagamentos de forma intuitiva e centralizada, diretamente do seu celular.

## ✨ Funcionalidades Principais

  * **📱 Design Minimalista e Moderno:** Uma interface limpa, focada na usabilidade e construída com base em uma paleta de cores suaves para uma experiência de usuário agradável e profissional.
  * **🚀 Onboarding Inteligente:** Um fluxo de boas-vindas em duas etapas que apresenta o app e personaliza a experiência do usuário (Cliente vs. Paciente) com base na sua profissão.
  * **📈 Dashboard "Centro de Comando":** A tela inicial oferece uma visão geral e dinâmica do seu negócio, incluindo um resumo financeiro do mês, próximos pagamentos e os compromissos do dia.
  * **👥 Gestão Completa de Clientes:**
      * Cadastro detalhado de clientes com nome, local, dias de atendimento, horário, valor e contato.
      * Lista de clientes com um campo de busca que filtra em tempo real.
      * Ações rápidas de "arrastar para o lado" para marcar como pago, editar ou apagar um registro.
  * **📅 Agenda Interativa:**
      * Um calendário visual onde os dias com compromissos são marcados.
      * Ao selecionar uma data, os compromissos daquele dia são listados de forma clara, mantendo a interface limpa.
  * **💾 Persistência de Dados Local:** As informações dos seus clientes são salvas diretamente no dispositivo usando `@react-native-async-storage/async-storage`, garantindo que seus dados estejam sempre disponíveis, mesmo offline.

## 🛠️ Tecnologias Utilizadas

Este projeto foi construído com uma stack de desenvolvimento moderna, focada em performance e na criação de uma experiência nativa para iOS e Android a partir de uma única base de código.

  * **Core Framework:**

      * 
      * 
      * 

  * **Navegação:**

      * **React Navigation:** Para toda a estrutura de navegação, incluindo:
          * `Bottom Tabs Navigator`: Para a navegação principal (Início, Agenda, Clientes).
          * `Stack Navigator`: Para abrir telas modais, como a de "Adicionar Cliente".

  * **Componentes de UI & Estilo:**

      * **React Native Calendars:** Para a criação da agenda interativa.
      * **React Native Swipe List View:** Para implementar as ações de "arrastar" nos cards de cliente.
      * **React Native Vector Icons:** Para uma iconografia limpa e consistente.
      * **Expo Linear Gradient:** Utilizado no fluxo de onboarding.

  * **Gerenciamento de Dados:**

      * **AsyncStorage:** Para persistência de dados local no dispositivo.
      * **React Context API:** Para um gerenciamento de estado global e centralizado.
      * **UUID:** Para a geração de identificadores únicos para cada cliente.

## 🚀 Como Executar o Projeto

Para rodar este projeto localmente, você precisará ter o ambiente de desenvolvimento React Native/Expo configurado.

### Pré-requisitos

  * Node.js (LTS)
  * npm ou yarn
  * Xcode (para rodar no simulador de iOS) ou Android Studio (para rodar no emulador de Android)

### Instalação

1.  Clone o repositório:
    ```bash
    git clone https://github.com/dev-guirocha/WalletAPP.git
    ```
2.  Acesse a pasta do projeto:
    ```bash
    cd WalletAPP
    ```
3.  Instale as dependências:
    ```bash
    npm install
    ```
4.  Execute no simulador de iOS:
    ```bash
    npx expo run:ios
    ```
5.  Execute no emulador de Android:
    ```bash
    npx expo run:android
    ```

## 🤝 Contribuição

Contribuições são super bem-vindas\! Se você tem ideias para novas funcionalidades, melhorias ou correções de bugs, sinta-se à vontade para:

1.  Fazer um **Fork** do projeto.
2.  Criar uma nova **Branch** (`git checkout -b feature/sua-feature`).
3.  Fazer **Commit** das suas mudanças (`git commit -m 'feat: Adiciona sua feature'`).
4.  Enviar um **Pull Request**.

## ✉️ Contato

Para dúvidas ou sugestões, entre em contato:

  * **Email:** dev.guirocha@gmail.com
  * **GitHub:** [@dev-guirocha](https://github.com/dev-guirocha)

-----

*Desenvolvido com ❤️ por Guilherme Rocha.*