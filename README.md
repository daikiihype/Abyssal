# ABYSSAL

Jogo 2D de exploração submarina em pixel art, para Android (paisagem, offline, single-player).
Pilote o submarino, colete cristais bioluminescentes, fuja das criaturas e **volte à estação antes que o oxigênio acabe**.

## Tecnologia (e por quê)

- **Jogo:** HTML5 Canvas 2D em JavaScript puro (módulos ES, **zero dependências**), resolução lógica 480×270 ampliada sem suavização.
- **App Android:** projeto Gradle nativo mínimo (`android/`) com uma `WebView` em tela cheia que serve os arquivos locais (`www/`). Sem permissões Android, sem internet.
- **Por que não Godot/Expo:** o ambiente onde o projeto foi desenvolvido não tinha acesso ao Android SDK/Godot/Expo. Com Canvas foi possível **executar e testar o jogo de verdade** (Chromium headless, toque multitoque simulado). Para um jogo 2D pequeno, o desempenho é folgado.

## Como jogar

| Controle | Ação |
|---|---|
| Direcional virtual (esquerda) | Pilota o submarino. Mantenha o dedo; pode começar em qualquer ponto da metade esquerda. |
| Botão do farol (direita) | Liga/desliga o farol. **Farol aceso ilumina, mas atrai medusas de mais longe.** |
| Botão ❚❚ (canto superior direito) | Pausa |
| Teclado (teste no PC) | Setas/WASD mover, `L`/Espaço farol, `P`/Esc pausa, Enter confirma |

- **Cristais:** pequeno = 1 (100 pts), médio = 3 (300 pts), grande = 5 (500 pts). Os mais valiosos ficam mais longe e em ruínas.
- **Peixe-lanterna (vermelho):** patrulha um trecho de ida e volta.
- **Medusa (roxa):** fica parada até você chegar perto; aí persegue (mais lenta que você) e desiste se você se afastar.
- **Integridade:** 3 pontos. Dano dá 1,6 s de invulnerabilidade.
- **Oxigênio:** 170 s no total, não diminui na pausa.
- **Extração:** volte à baia da estação (moldura tracejada à esquerda) depois de ter se afastado dela. Cristais não extraídos são perdidos na derrota.
- **Pontuação (vitória):** cristais × 100 + 3 × % de oxigênio restante + 50 × integridade restante. Recorde salvo no aparelho.
- Cada expedição sorteia (por semente) posições de cristais e perigos, sempre em locais alcançáveis e longe da estação.

## Estrutura

```
www/                 o jogo (index.html, js/, assets/)
  js/config.js         constantes
  js/level.js          mapa fixo + sorteio justo de cristais/perigos por semente
  js/sim.js            simulação pura (oxigênio, vida, cristais, criaturas, extração)
  js/physics.js        colisão com o cenário
  js/render.js hud.js screens.js font.js   desenho, interface, fonte pixel própria
  js/controls.js       toque multitoque + teclado
  js/audio.js storage.js layout.js assets.js main.js
  assets/              sprites PNG e sons WAV (gerados por tools/gen_assets.py)
android/             projeto Android (Gradle) que empacota www/ numa WebView
tools/gen_assets.py  gera TODA a arte e o áudio (original, sem terceiros)
tools/serve.mjs      servidor local simples
tests/               testes automatizados (sim + ponta a ponta)
.github/workflows/   gera o APK na nuvem
```

## Rodar no computador

Requer apenas Node 18+ (para o servidor) e um navegador:

```bash
node tools/serve.mjs 8080     # abra http://127.0.0.1:8080
```
Parâmetro opcional `?seed=123` inicia direto uma expedição com aquela semente.

## Testes

```bash
npm test               # tudo (precisa do pacote "playwright" instalado globalmente ou via npm i -D playwright)
npm run test:sim       # só a simulação (Node puro, sem dependências)
```
Detalhes e resultados em [`docs/RELATORIO_DE_TESTES.md`](docs/RELATORIO_DE_TESTES.md).

## Gerar o APK (jeito mais fácil, sem instalar nada)

1. Crie um repositório no GitHub (privado serve) e envie o conteúdo desta pasta (botão *Add file → Upload files*, ou `git push`).
2. Abra a aba **Actions → Build APK → Run workflow** (também roda sozinho a cada envio).
3. Ao terminar (~5 min), abra a execução e baixe o artefato **ABYSSAL-APK** (um .zip com `ABYSSAL-Android-debug.apk`).
4. Passe o APK ao celular e instale (veja abaixo).

O APK `debug` é assinado com a chave de depuração do Android e instala normalmente. É o "APK de teste".

### Versão final assinada (release)

Gere uma chave **uma vez** e guarde-a em local seguro (sem ela não dá para atualizar o app depois):

```bash
keytool -genkeypair -v -keystore abyssal-release.jks -alias abyssal -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 abyssal-release.jks     # copie a saída
```
No GitHub: *Settings → Secrets and variables → Actions* e crie `ABYSSAL_KEYSTORE_BASE64` (a saída acima), `ABYSSAL_KEYSTORE_PASSWORD`, `ABYSSAL_KEY_ALIAS` (`abyssal`) e `ABYSSAL_KEY_PASSWORD`. Rode o workflow de novo: o artefato passa a incluir `ABYSSAL-Android.apk` (release assinado). **Nunca** coloque o `.jks` no repositório (já está no `.gitignore`).

### Gerar localmente (opcional)

Precisa de JDK 17 e Android SDK (Android Studio instala tudo). Em `android/`:
```bash
./gradlew assembleDebug      # -> app/build/outputs/apk/debug/app-debug.apk
```
Também é possível abrir a pasta `android/` no Android Studio e usar *Run*. O build copia `www/` automaticamente para dentro do app.

## Instalar no Android

1. Copie o `.apk` para o celular (cabo, Drive, e-mail...).
2. Abra o arquivo; se pedir, permita *instalar apps desta fonte* para o app que você usou (Arquivos/Chrome).
3. Instale e abra **ABYSSAL**. Funciona sem internet.

## Desenvolver / alterar

- Edite o código em `www/js/`; teste no navegador; `npm run test:sim`.
- Mudou sprites/sons? Edite `tools/gen_assets.py` e rode `python3 tools/gen_assets.py` (requer Pillow e numpy).
- Para balancear: `config.js` (oxigênio, velocidades, pontos) e `level.js` (zonas e quantidades).
- Depois, gere novo APK pelo workflow (aumente `versionCode`/`versionName` em `android/app/build.gradle` a cada versão).

## Procedência dos recursos

Todos os sprites, ícones, texturas, a fonte bitmap e os sons foram **gerados por código neste projeto** (`tools/gen_assets.py`, `www/js/font.js`). Não há recursos de terceiros nem URLs externas.
