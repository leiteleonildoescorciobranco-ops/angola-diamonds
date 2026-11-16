# ANGOLA DIAMONDS — MVP inicial

Este projeto é uma base de desenvolvimento full-stack, não uma loja já publicada.

## O que já está preparado
- Registo com nome, email e palavra-passe (hash bcrypt).
- Início e fim de sessão.
- Catálogo de diamantes e passes.
- Criação de encomendas com ID de jogador.
- Pagamento manual por Multicaixa Express.
- Upload de comprovativo JPG/PNG/PDF (limite 5 MB).
- Área de administração para ver comprovativos, confirmar pagamento e concluir encomendas.
- O ID de jogador só aparece na área de administração; o pedido só pode ser concluído depois de o pagamento ser verificado.

## Preços iniciais
Taxa: 1 BRL = 250 Kz. Margem: 30%, arredondada para cima ao múltiplo de 50 Kz.
- 100: 1.500 Kz
- 310: 4.550 Kz
- 520: 6.850 Kz
- 1.060: 14.650 Kz
- 2.180: 28.600 Kz
- 5.600: 68.250 Kz
- 22.400: 273.000 Kz
- Assinatura semanal: 2.950 Kz
- Assinatura mensal: 14.650 Kz
- Passe Booyah e Premium Plus: preço por confirmar

Os preços dos passes Booyah ainda não foram fornecidos, por isso não foram inventados.

## Executar localmente
1. Instalar Node.js 20 ou superior.
2. Extrair a pasta.
3. Copiar `.env.example` para `.env`.
4. Definir `SESSION_SECRET` e uma palavra-passe forte em `ADMIN_PASSWORD`.
5. No terminal, dentro da pasta, executar:
   `npm install`
   `npm start`
6. Abrir `http://localhost:3000`.

## Para publicar na Internet
Será necessário:
- serviço de alojamento que execute Node.js;
- domínio (opcional no início, mas recomendado);
- HTTPS ativo;
- armazenamento persistente para SQLite e comprovativos, ou migrar para PostgreSQL + armazenamento privado de ficheiros;
- configurar variáveis de ambiente secretas no alojamento;
- backups e monitorização.

Antes de aceitar clientes reais, é necessário rever segurança, proteção contra CSRF, validação de ficheiros pelo conteúdo real, política de privacidade/termos, backups e configuração de produção. A autenticação Google/Facebook, notificações WhatsApp automáticas e integração automática com pagamentos ainda não estão incluídas. O Multicaixa Express é registado como pagamento manual: o administrador confirma o recebimento na sua conta antes de autorizar a recarga.

**Nunca pedir nem guardar a palavra-passe do Free Fire.** Só é necessário o ID do jogador.
