# Diploma de Honra ao Mérito — Gerador

Gerador web do **Diploma de Honra ao Mérito** da Direita Espírito Santo Oficial.
O usuário preenche o nome do homenageado, a cidade/UF, a data e as assinaturas, e o
diploma é montado em tempo real sobre a arte oficial — no próprio navegador.

> **Bloqueio de geração:** o botão **Gerar meu diploma** fica desabilitado até que
> *todos* os campos obrigatórios (nome, cidade/UF, data, presidente, coordenador)
> estejam preenchidos **e** os termos de uso aceitos. O contador abaixo do botão
> mostra quantos campos ainda faltam, e o download/compartilhamento só aparecem
> depois que o diploma é gerado. Qualquer alteração nos dados esconde o resultado
> e exige gerar novamente.

![Prévia](public/assets/img/diploma-base.webp)

## Como rodar

```bash
npm start          # http://localhost:3000
```

Não há dependências externas: o servidor é um `http` puro do Node (>= 18) que
serve a pasta `public/`.

## Como funciona

- `public/assets/img/diploma-base.png|webp` — arte oficial do certificado com os
  campos variáveis apagados (nome, data e assinaturas), preservando molduras,
  ornamentos e a linha dourada.
- `public/assets/js/certificate.js` — renderizador. Desenha a arte no `<canvas>` e
  posiciona os textos nas coordenadas exatas dos campos originais
  (`LAYOUT` / `COLORS`), com ajuste automático de corpo para nomes longos
  (uma linha grande → duas linhas equilibradas).
- `public/assets/js/app.js` — interface: prévia ao vivo, zoom/arraste, bloqueio e
  validação dos campos obrigatórios, download em PNG 3072×2048, compartilhamento
  nativo e impressão em A4.
- `assets-origem/diploma-modelo-original.png` — modelo original enviado, guardado
  como referência (não é usado em produção).

## Regras de preenchimento

| Campo | Obrigatório |
| --- | --- |
| Seu nome (homenageado) | sim |
| Cidade ou estado | sim |
| Data do diploma | sim |
| Nome da presidente | sim |
| Nome do coordenador geral | sim |
| Termos de uso | sim |

Todo o processamento é local (client-side): nome, cidade e data não são enviados
para nenhum servidor.

## Estrutura

```
public/
  index.html
  assets/
    css/styles.css
    js/certificate.js
    js/app.js
    img/diploma-base.png|webp
    fonts/ (woff2)
assets-origem/diploma-modelo-original.png
server.js
```

## Aviso

O arquivo gerado é um **diploma honorário**, de caráter simbólico e comemorativo,
sem valor de documento oficial.
