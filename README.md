# ⚡ JarvisCripto — o cérebro do investimento

App de análise de criptomoedas com gráficos limpos, mercado completo, notícias e um analista de IA (Claude) que enxerga o gráfico.

## Áreas (Fase 1 — MVP)

- **Dashboard** — mercado total, dominância do BTC, Medo & Ganância, maiores altas/baixas do dia e as manchetes que importam.
- **Mercado** — 100 principais moedas com preço, variações 1h/24h/7d, volume, mini-gráfico e ordenação. Clique em qualquer uma para abrir sua página.
- **Página da moeda** — gráfico **limpo por camadas** (você liga só o que quer: EMAs, Bollinger, RSI, MACD, volume, padrões) com **vela e preço em tempo real** (WebSocket da Bybit) + abas de **Análise IA**, **🐋 Baleias**, **Notícias** e **Dados**.
- **🐋 Baleias** — posicionamento dos grandes players: proporção long/short das contas, funding, open interest e **liquidações ao vivo** (aparecem quando uma posição alavancada é estourada).
- **Notícias** — feed global (5 fontes RSS + keyword de impacto) com filtro por alta/baixa/neutro.

## O Jarvis gênio (análise IA)

Ao pedir a análise, o servidor reúne e entrega ao Claude:
- **Multi-timeframe** (1h + 4h + diário) com foco em **confluência**
- Indicadores, divergências, suportes/resistências e padrões de vela
- **Derivativos** da Bybit (funding rate + open interest + proporção long/short das contas) — posicionamento das baleias que o spot não mostra
- Dominância do mercado, Medo & Ganância, fundamentos da moeda e **notícias recentes**
- A **imagem do gráfico** — o Claude enxerga o formato do preço (visão)

A saída é estruturada: veredito, tese, invalidação, plano de trade (entrada/alvos/stop/tamanho), riscos, recomendação e confiança calibrada. Roda em esforço máximo (`xhigh`).

## Stack

- **Backend**: Node.js + TypeScript + Express (`server/`)
- **Frontend**: React + Vite + React Router + lightweight-charts (`web/`)
- **IA**: Claude (`claude-opus-4-8`) com saída JSON estruturada e visão
- **Dados**: Bybit (spot + derivativos), CoinGecko (mercado/fundamentos), RSS/CryptoPanic (notícias), alternative.me (Medo & Ganância) — tudo grátis

## Como rodar

1. Instalar (na raiz): `npm install`
2. Configurar chave: `copy server\.env.example server\.env` e editar (ver arquivo). Só a análise IA precisa da chave — o resto funciona sem.
3. Rodar: `npm run dev:server` (API :3001) e `npm run dev:web` (interface :5173)

## APIs opcionais (grátis)

Tudo funciona sem elas, mas melhoram partes:
- **CryptoPanic** (`CRYPTOPANIC_TOKEN`) — notícias com voto da comunidade (viés alta/baixa)
- **CryptoCompare** (`CRYPTOCOMPARE_KEY`) — notícias agregadas de muitas fontes

## Roadmap (próximas fases)

- **Carteira do grupo** — aportes dos 3, preço médio, P/L por pessoa, análise da carteira inteira pelo Jarvis
- **Alertas** (rompimentos, RSI extremo, grandes liquidações) e relatório diário
- **Watchlist** e comparação entre moedas
- **Bot no Telegram**

> ⚠️ Análises geradas por IA a partir de dados técnicos. Não são recomendação financeira.
