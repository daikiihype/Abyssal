# Relatório de testes — ABYSSAL 1.0.0

Execução: `npm test` (Node 22 + Chromium headless via Playwright) → **34 testes, 34 aprovados**.
Este relatório lista apenas o que foi realmente executado. Itens que exigem aparelho real estão em "Pendentes".

## Automatizados (executados)

| # | Item da especificação | Teste |
|---|---|---|
| 1 | Jogo inicia sem erros críticos | e2e "inicia sem erros" (nenhum erro de página/console) |
| 2 | Movimento nas 4 direções | sim "quatro direções"; e2e com toque real no direcional |
| 3 | Não atravessa paredes | sim: 5 sementes × 2 min de entradas aleatórias, checando sobreposição a cada passo |
| 4 | Limites do cenário | sim "bate no fundo/superfície" |
| 5 | Cristal não coletado 2× | sim "cristais não são coletados duas vezes" |
| 6 | Pontuação correta | sim "pontuação final" (cristais + bônus O₂ + bônus casco) |
| 7 | Oxigênio diminui | sim (taxa = 100/170 %/s) |
| 8 | Derrota em O₂ = 0 | sim + e2e (tela de resultado) |
| 9 | Integridade ≥ 0 | sim |
| 10 | Invulnerabilidade pós-dano | sim (bloqueia 1,6 s; volta a causar dano depois) |
| 11 | Comportamento das criaturas | sim: patrulha vai e volta; medusa percebe (respeitando o farol), persegue, desiste e volta |
| 12 | Extração encerra a partida | sim (só arma após se afastar; sem O₂/casco não extrai) |
| 13 | Derrota encerra a partida | sim + e2e |
| 14 | Pausa congela tudo | sim (tempo, O₂, posição, criaturas) + e2e com botão de pausa |
| 15 | Reiniciar sem estado residual | sim + e2e (confirmação, estado limpo) |
| 16 | Recorde persiste | sim (Store) + e2e (nova página no mesmo perfil mantém o recorde) |
| 17 | Toques simultâneos | e2e via CDP: direcional + botão do farol ao mesmo tempo; cancelamento de toque |
| 18 | Legibilidade em várias proporções | e2e: 7 tamanhos/DPR (incl. 4:3, 16:10, 19,5:9); botões dentro da tela; capturas em `tests/screenshots/` |
| 19 | Funciona offline | e2e: zero requisições a hosts externos |
| 20 | Sem Expo Go/servidor de dev | Arquitetura: app = WebView + arquivos locais (nenhum servidor) |
| — | Mapas justos | 80 sementes: cristais alcançáveis, espaçamento ≥ 60 px, perigos ≥ 330 px da estação, rotas de patrulha livres |
| — | Calibração | ida e volta ao cristal mais distante ≈ 72 s de 170 s de oxigênio |
| — | Bot completo | um bot segue caminhos, coleta ≥ 4 cristais e extrai: partida inteira vence |
| — | Ciclo de vida | pausa por perda de foco/`visibilitychange`/ganchos do Android; botão voltar |
| — | Desempenho | ~60 fps no Chromium headless **sem GPU** (software) |

## Pendentes (precisam de aparelho/ambiente que não havia)

- **Compilação do APK e instalação em aparelho Android real** (o ambiente de desenvolvimento bloqueia o download do Android SDK). O workflow `.github/workflows/build-apk.yml` faz o build na nuvem; o código Java e os XML foram verificados apenas quanto à sintaxe aqui.
- Desempenho e sensação de toque em celulares reais; som no WebView do Android; comportamento com recorte de tela (notch).
- Calibração de dificuldade com jogadores reais (números atuais: O₂ 170 s, velocidade 92 px/s).
