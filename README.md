# Ilha Livre 3D

Mundo aberto em 3D no navegador: uma ilha inteira criada por código, com
estrada, morros, praias, árvores, água, ciclo de dia e noite e
sombras em tempo real. Feito com HTML, CSS, JavaScript e a biblioteca
**Three.js** (que já vem dentro da pasta `lib`, então funciona sem internet).

## Como rodar

1. Extraia o .zip (botão direito → **Extrair Tudo**).
2. Abra a pasta `ilha-3d` no VS Code (Ctrl+K, Ctrl+O).
3. Rode o `index.html` com o **Live Server** ou dê dois cliques nele.

Se ficar lento no seu computador, use o botão **Gráficos: Leve** no menu (ou o comando `/graficos leve`)
(ele desliga as sombras, a grama e os efeitos, que são a parte mais pesada).

## Jogar no celular

O jogo detecta sozinho quando está num celular e:

- liga **controles de toque**: analógico à esquerda (anda/dirige), botões **E** (ação), **F** (usar/soco),
  **⤒** (pular · freio · subir) e **⚡** (correr · nitro · mergulhar) à direita, e atalhos no alto
  (pausa, câmera, voltar à estrada, pausar trabalho, som). **Arraste o dedo na tela** para girar a câmera
  e **toque no inventário** para escolher o item;
- começa no gráfico **Leve**, com menos árvores, bichos e moradores, e resolução menor;
- deixa o HUD compacto e pede para **deitar o celular**.

- **Dirigindo no celular:** aparecem os pedais **ACELERA** e **FREIA / RÉ**. É só segurar o pedal que o carro vai acelerando, e o analógico serve só para virar.
- **Botão 🌤️:** abre o menu "Tempo e clima" para escolher manhã, meio-dia, tarde ou noite, parar o relógio, sol, chuva ou neve, ou **digitar um comando** (igual ao console do computador).

### Publicar no GitHub Pages (para abrir no celular por um link)

1. Crie uma conta em **github.com** (é de graça).
2. Clique em **New repository**, dê o nome `ilha-3d`, marque **Public** e clique em **Create repository**.
3. Na página do repositório, clique em **uploading an existing file** e arraste **o conteúdo da pasta**
   `ilha-3d` (o `index.html`, as pastas `css`, `js` e `lib`). Clique em **Commit changes**.
4. Vá em **Settings → Pages**. Em *Branch*, escolha **main** e a pasta **/ (root)**, e clique em **Save**.
5. Depois de 1 ou 2 minutos aparece o link: `https://SEU-USUARIO.github.io/ilha-3d/`.
6. Abra o link no **Chrome do celular**. No menu ⋮ do Chrome, **Adicionar à tela inicial** cria um
   atalho com ícone, como se fosse um app.

Quando mudar alguma coisa no código, é só subir os arquivos de novo (passo 3) que o link atualiza.

## Controles

| Tecla          | Ação                                   |
|----------------|----------------------------------------|
| E              | sair/entrar no carro ou no barco, pegar itens, usar objetos |
| 1 a 6          | escolher item do inventário            |
| F              | usar o item (comer, curar, golpear, atirar, pescar) |
| W / ↑          | acelerar (a pé: andar)                 |
| S / ↓          | frear e dar ré                         |
| A D / ← →      | virar                                  |
| Espaço         | freio de mão (a pé: pular · nadando: subir) |
| Shift          | nitro (a pé: correr · nadando: mergulhar) |
| C              | trocar câmera (perto, longe, capô)     |
| R              | voltar para a estrada                  |
| J              | pausar/voltar ao trabalho (Nova Vida)  |
| T ou /         | abrir o console de comandos            |
| H              | mostrar/esconder a ajuda               |
| P / Esc        | pausa                                  |
| M              | som                                    |

## Modo Nova Vida

Você chega na ilha de barco, **sem dinheiro**, só com os documentos e a roupa do corpo.

1. Peça emprego direto no balcão (tecla **E**) da **🍔 Lanchonete** (entregador), da **🐟 Peixaria**
   (pescador) ou da **🪵 Serraria** (lenhador), ou veja todas as vagas na **💼 Central de Empregos**,
   na praça (é lá que contratam taxista).
2. Escolha um emprego. No primeiro, você ganha uma **bicicleta** e um **quartinho** emprestados.
3. Trabalhe, junte dinheiro e compre coisas melhores.

| Emprego | Como funciona |
|---------|---------------|
| 📦 Entregador | Busca o pedido na Lanchonete e entrega numa casa. No prazo = gorjeta |
| 🚕 Taxista | Pega passageiros na beira da estrada e leva ao destino (precisa de carro) |
| 🎣 Pescador | Usa o barco da cooperativa e vende os peixes na Peixaria |
| 🪓 Lenhador | Derruba árvores com o machado (4 golpes) e vende as toras na Serraria |

Cada emprego sobe de **nível** (até o 5) conforme você trabalha, e cada nível paga 20% a mais.

- **🚗 Concessionária**: moto (R$ 1.800), carro popular (R$ 4.500) e carro esportivo (R$ 16.000).
- **🏠 Imobiliária**: casa simples (R$ 5.000), casa boa com piscina (R$ 12.000) e casa de praia (R$ 28.000).
- **🍔 Lanchonete**: comida e remédios.
- **Durma** na cama da sua casa depois das 18h: passa a noite e **salva o jogo**
  (ele também salva sozinho a cada minuto e em cada compra).
- **Objetivo**: ter a Casa de praia e o carro esportivo.
- Para testar: `/dinheiro 5000` no console.

## História principal e missões (Nova Vida)

- **📖 História principal, "O tesouro do Barba-Ruiva"** (com o Tião do farol):
  1. **O mapa do pirata**: ache os 3 pedaços do mapa espalhados pela ilha.
  2. **A chave do Barba-Ruiva**: mergulhe perto do farol e pegue a chave de ouro.
  3. **O tesouro da ilha**: de noite, suba até o X no ponto mais alto da ilha e abra o baú. É o **final da história**!
- **Missões novas**: café da manhã da Dona Maria (feira), nadar com golfinhos (Lucas), hat-trick no campo (Rafael), banhista em perigo (Bia, salva-vidas), entrega da feira (Seu Antônio), pane seca (Juliana, posto) e o ladrão de bicicletas (Cabo Marcos, delegacia). Ao todo são **17 missões**.
- Alguns moradores têm várias missões, uma depois da outra: quando você termina uma, aparece outro "!".
- **📜 Diário de missões**: tecla **N** (no celular, o botão 📜). Mostra o que já foi feito, o que está disponível, quem pede cada missão e onde a pessoa trabalha. Dá para desistir da missão atual por ali.

## Missões, eventos e a pista de pouso

Na Nova Vida, alguns moradores têm um **"!" amarelo** em cima da cabeça (e um ponto amarelo no minimapa):
eles precisam de ajuda. Converse com **E** para aceitar. O alvo aparece com uma **luz roxa**,
na bússola e no quadro de missão no alto da tela.

| Quem | Missão |
|------|--------|
| 🐈 Dona Maria | achar o gato Bolinha, escondido debaixo de uma árvore |
| 🐟 Seu João | levar 3 peixes para o almoço |
| 💊 Tia Cida | arrumar um remédio e levar para a vizinha |
| 📦 Pedro | levar uma encomenda até o píer em 90 segundos |
| 💎 Lucas | mergulhar e resgatar o baú do avô no fundo do mar |
| ⚽ Rafael | fazer um gol no Campo da Ilha |
| ✈️ Comandante Rita | aparece depois que você ajudar 4 pessoas: libera a pista e o avião! |

De tempos em tempos acontece um **evento surpresa** perto de você (luz laranja): pneu furado
na estrada, turista perdido que vai junto com você, pacote caído para entregar.
Missões e eventos contam para liberar a pista e pagam em dinheiro.
As missões e os eventos são **só da Nova Vida**. No **modo livre** não tem missão: o avião já fica
liberado dentro do hangar, e a porta abre sozinha quando você chega perto.

### Pilotando o avião

| Tecla | Ação |
|-------|------|
| E | entrar / sair (parado no chão) |
| W / S | mais potência / menos potência (no chão, S freia) |
| Espaço / Shift | levantar / abaixar o nariz |
| A / D | inclinar e fazer curva |

Acelere na pista e, passando de ~85 km/h, segure **Espaço** para decolar. Para pousar, alinhe com
a pista e **tire a potência (S)**: ele desce sozinho. Chegue com as asas retas e sem mergulhar.
Bater em árvore, casa ou cair na água é pouso forçado (o avião volta para o hangar).
Atalho de teste: `/aviao` no console libera o avião.
Outros atalhos de teste: `/policia 3` (estrelas de procurado) e `/gasolina 100` (enche o tanque na Nova Vida).

## Lagos e rios

- Cada ilha ganha **2 lagos** e até **2 rios**. Um rio sai de um lago e outro nasce num morro, e os dois descem até o mar.
- O rio que nasce no morro começa como um **fio d'água** (uma nascente entre pedras, com bolhinhas) e vai **engrossando** até virar rio largo perto do mar.
- Onde o rio cruza uma estrada tem **ponte de verdade**: o carro passa por cima e, por baixo, a água corre. Dá para nadar ou andar pelo rio passando embaixo da ponte. Se o rio cruza de viés, a ponte fica mais comprida.
- Dá para **nadar e mergulhar** nos lagos, **pescar** neles e nos rios, e o carro **afunda** se entrar no lago. O rio é rasinho e dá para atravessar devagar.
- Casas, árvores e construções não nascem dentro da água. No minimapa, lagos e rios aparecem em azul.
- Tudo é calculado em `js/aguadoce.js`: o rio "desce o morro" passo a passo, sempre pelo lado mais baixo, até chegar no mar.

## Polícia (estilo GTA, sem ninguém morrer)

- Bater em morador, atropelar alguém, bater forte no trânsito ou de frente numa viatura dá **estrelas de procurado** (até ★★★★★). Quanto mais estrelas, mais viaturas e mais rápidas.
- Para se livrar: **suma da vista** da polícia e das testemunhas. Esconda-se **dentro de uma casa**, **no meio do mato**, **debaixo d'água**, atrás de casas e morros, ou fuja para bem longe. Quando as estrelas piscam, estão te procurando; fique escondido até elas sumirem.
- Se uma viatura te pegar parado, você é **preso**: na Nova Vida paga multa e o veículo vai para o pátio. Na porta da 🚔 Delegacia dá para se entregar e pagar só metade da multa.
- Os moradores continuam não morrendo: caem, reclamam e levantam.

## Lugares novos

- ⛽ **Posto de gasolina**: na Nova Vida a gasolina acaba. Pare nas bombas e aperte E para abastecer. Se acabar no meio do caminho, aperte **R** e o guincho te leva ao posto por R$ 40.
- 🚦 **Semáforos** nos cruzamentos: os carros e motos dos moradores param no vermelho.
- ⚽ **Campo de futebol** com bola de verdade: encoste para conduzir, F (mão vazia) chuta. Faça gol!
- 🧺 **Feira** perto da praça (6h às 14h): frutas, pastel e água de coco.
- 🗼 **Farol**: de noite o facho de luz gira.
- 🛟 **Salva-vidas** na praia: a bandeira mostra se o mar está calmo, e ele te tira da água se você estiver se afogando.

## Estações e datas especiais

No menu, o botão **Estação** troca entre: Automática (segue a data de verdade, com as estações do Brasil), Ciclo (muda a cada 2 dias do jogo) ou uma estação fixa. Também dá com `/estacao natal`, `/outono` etc.

- 🌸 **Primavera**: ipês rosas e amarelos, grama bem verde com florzinhas e pétalas caindo.
- ☀️ **Verão**: tudo verde e quase nunca neva.
- 🍂 **Outono**: folhas vermelhas, laranjas e amarelas caindo das árvores, e a grama seca.
- ❄️ **Inverno**: a maioria das árvores fica só nos galhos, e neva mais.
- 🎃 **Halloween** (24/out a 2/nov): abóboras com cara na porta das casas, que acendem de noite, morcegos, neblina roxa e chapéu de bruxa nos moradores.
- 🎄 **Natal** (dezembro até 6/jan): árvore de Natal gigante perto da praça, com presentes, pisca-pisca nas casas e gorro de Papai Noel.

## Rotina da ilha

- Um dia inteiro dura **15 minutos**: madrugada 2,5 min, manhã 4,5 min, tarde 4,5 min e noite 3,5 min. Para mudar, edite `periodos` em `js/config.js`.
- Os moradores têm casa, profissão e horário: trabalham de manhã e à tarde, almoçam ao meio-dia, vão para o campo, a praia ou a praça no fim da tarde e dormem em casa à noite. Converse para saber o que cada um faz.
- As lojas têm horário (a Central de Empregos, por exemplo, abre das 8h às 18h). Fora do horário aparece a placa **FECHADO**.
- De madrugada metade dos carros dos moradores fica em casa.

## Empregos e níveis

- Os níveis são **Aprendiz → Ajudante → Profissional → Experiente → Chefe** e pagam 100%, 120%, 145%, 175% e 210%. Do Profissional para cima você ganha um bônus todo dia ao acordar.
- Os ganhos foram equilibrados: a tora agora paga R$ 6 e o peixe R$ 10. Você carrega no máximo 12 toras ou 15 peixes por vez, e árvore grande precisa de mais machadadas.

## Salvar no modo livre

- O modo livre salva sozinho a cada 20 segundos e quando você sai. No menu aparece **Continuar modo livre**.

## Pessoas com jeito de gente

- Você e os moradores têm anatomia de gente: tronco "torneado" com peito, cintura e quadril (diferente para homem e mulher), braços com bíceps e antebraço, coxa e panturrilha, mãos com dedos e polegar, tênis com sola e cadarço, e rosto com mandíbula, queixo, nariz com narinas, lábios, pálpebras, íris e pupilas. Alguns têm barba e cores de olho diferentes. Cada pessoa continua sendo só 9 malhas (`js/corpo.js`).
- **Rosto pintado:** a cabeça é uma esfera "esculpida" (mandíbula, queixo, nuca) e o rosto é desenhado numa textura: olhos com cílios, íris e brilho, sobrancelhas fio a fio, lábios, bochechas, barba por fazer e a linha do cabelo.
- **Vida:** todo mundo pisca, respira e vira a cabeça. Os moradores olham para você quando você chega perto.

## Socos

- Com a mão vazia, o F dá socos alternando as duas mãos: direita, esquerda, direita...

## Trânsito e quintais

- Os moradores agora têm **carros e motos** que dão a volta na ilha pela estrada, cada um na sua mão. Eles freiam para não bater no da frente nem em você, **buzinam** se você ficar parado no caminho e, se te pegarem a pé, tiram vida. Cuidado ao atravessar!
- As casas dos moradores ganharam **quintal com cerca e portão**, **caminho de piso** da porta até a rua, **calçada**, canteiros de flores, arbustos, varal e banco.

## Moradores e briga

Na vila moram 18 pessoas, cada uma com nome e roupa própria. Elas passeiam pela praça,
pelas casas e pelos quiosques, e de noite vão para casa. Chegue perto e aperte **E** para
**conversar** (na Nova Vida elas dão dicas de trabalho). Se você passar de carro rápido,
elas pulam para o lado; se atropelar, caem, reclamam e levantam.

**F com a mão vazia dá um soco.** O facão, o machado e a vara de pescar também servem de arma
(o machado derruba; se não tiver ninguém na frente, ele corta árvore e a vara pesca).
Ninguém morre: quem apanha cai, reclama e sai correndo.

## Nadar e o fundo do mar

Entre no mar andando pela praia: quando a água passa do peito, você começa a **nadar**.
**Shift** mergulha e **Espaço** sobe. Debaixo d'água a barra de **fôlego** vai acabando
(uns 25 segundos); sem ar, você perde vida. Para sair, nade até o raso ou aperte **E**
na beirada do píer.

No mar vivem cardumes de peixes coloridos, golfinhos, **tartarugas**, **arraias**,
**águas-vivas** (brilham à noite e queimam se você encostar) e **tubarões**: se você estiver
nadando no fundo e um tubarão te vir, ele vem morder. Fuja para o raso, para o píer ou para o barco!
No fundo tem algas, corais, estrelas-do-mar, ouriços e conchas, com a luz do sol dançando na areia.
O barco tem uma **vara de pescar** guardada.

## O que fazer na ilha (modo livre)

- **40 moedas**: na estrada, nos morros, nas praias e dentro das casas.
- **Estradas e vila**: além do anel em volta da ilha, duas estradas cortam o meio
  dela e se cruzam numa **praça com rotatória e chafariz**, com uma vila em volta.
- **Casas**: 14 casas perto das estradas (quase metade na vila), cada uma com sala, cozinha, quarto,
  banheiro e escritório mobiliados. Desça do carro (E), suba a escadinha e a
  porta abre sozinha. Lá dentro o telhado some e a câmera sobe. Dá para ligar
  a TV, o fogão, o chuveiro, o computador e a luz (E perto deles). Cada casa
  esconde uma moeda.
- **Animais**: caranguejos na praia, capivaras na grama perto da água, cabras
  nos morros, galinhas nos quintais e javalis na mata. Todos fogem de você e
  do carro, menos o **javali**, que avança se você estiver a pé! No mar há
  **cardumes de peixes** coloridos e **golfinhos** que saltam; no céu, gaivotas.
  Nenhum animal morre: quando atingidos, eles ficam tontos ou fogem.
- **Barco**: perto da largada tem um **píer** com um barco. Ande até ele, aperte E
  e saia pelo mar (W/S/A/D, Shift = turbo). Dá para **pescar do barco** em
  qualquer lugar do mar, com a vara na mão (F). Para descer, aperte E perto do
  píer ou da praia. R leva o barco de volta ao píer. Se for para o raso, ele encalha!
- **Fundo do mar**: quase 2 mil **algas** que balançam com a correnteza e corais
  coloridos perto da costa (dá para ver pela água, principalmente de barco).
- **Sobrevivência**: a barra de **fome** cai com o tempo. Com fome zerada você
  perde vida; bem alimentado, a vida se recupera sozinha. Se a vida acabar,
  você desmaia e acorda perto do carro.
- **Itens** (inventário de 6 espaços):
  - Comida: banana e maçã (embaixo das árvores), coco (praia), sanduíche e água
    (cozinhas) e peixe (pescando!).
  - Remédios: curativo, remédio e kit médico (banheiros e quartos).
  - Facão: golpe de perto, que deixa o javali tonto e faz ele fugir.
  - Estilingue: atira pedras (pegue pedras perto das encostas), com mira assistida.
  - Sinalizador: dispara um sinal luminoso que ilumina a noite e espanta os bichos.
  - Vara de pescar: fique na beira, de frente para a água, e aperte F. Quando
    aparecer "Fisgou!", aperte F rápido. Perto dos cardumes o peixe morde mais rápido.
- **Maior salto**: quanto tempo você consegue ficar no ar.
- **Gerar outra ilha**: cria uma ilha totalmente nova a partir de outro número
  (a "semente"). A mesma semente sempre gera a mesma ilha.

### Clima e comandos (estilo Minecraft)

O clima muda sozinho a cada 3–6 minutos: **sol**, **chuva** (com relâmpagos e
trovões) ou **neve** (que vai cobrindo o chão, as árvores e os telhados de branco).
Com chuva o carro escorrega mais; com neve, escorrega bem mais.

Aperte **T** ou **/** para abrir o console, digite o comando e aperte **Enter**
(**Esc** fecha):

| Comando                        | O que faz                                  |
|--------------------------------|--------------------------------------------|
| `/tempo manhã`                 | 7h (também: `dia`, `meio-dia`, `tarde`, `entardecer`, `noite`, `madrugada`, `meia-noite`) |
| `/tempo 14:30`                 | hora exata                                 |
| `/tempo parar` / `continuar`   | congela ou solta o relógio                 |
| `/clima sol` / `chuva` / `neve`| muda o clima na hora                       |
| `/dar pedras 10`               | ganha um item (ex.: `/dar facão`)          |
| `/graficos bonito` / `leve`    | troca a qualidade dos gráficos             |
| `/ajuda`                       | lista os comandos                          |

Também funciona em inglês: `/time set night`, `/weather rain`, `/give`.
As chances de cada clima ficam em `config.js` → `clima`.

### Gráficos: Bonito e Leve

No modo **Bonito** (o padrão), a ilha ganha:

- **Água com shader**: ondas, reflexo do céu, brilho do sol, água verde-clara
  no raso e azul-escura no fundo, e espuma andando na beira da praia.
- **Céu de verdade**: degradê do horizonte até o alto, sol com brilho em volta
  e nuvens que se mexem (ficam cinzas e fecham o céu quando chove).
- **Grama**: 55 mil folhinhas balançando ao vento (a neve enterra a grama).
- **Árvores**: copas feitas de várias bolas irregulares com sombra por dentro, pinheiros
  em camadas com a borda recortada, coqueiros na praia, e tudo balança com o vento
  (mais forte quando chove).
- **Chão com textura**: um granulado que tira a cara de "plástico liso".
- **Pós-processamento**: brilho (*bloom*) nas luzes fortes, cores corrigidas,
  cantos levemente escuros e antisserrilhado.

O modo **Leve** desliga grama, nuvens, sombras e pós-processamento, para rodar
bem em computador mais fraco. A escolha fica salva no navegador.

## Como funciona por dentro

- **Relevo** (`terreno.js`): uma função de "ruído" (em `utils.js`) gera
  números que variam suavemente. Somando várias camadas desse ruído, umas
  grandes e outras pequenas, aparecem morros e vales. Uma máscara circular
  afunda as bordas e transforma tudo em ilha.
- **Estradas**: o anel dá a volta na ilha; as transversais são curvas suaves
  (Catmull-Rom) que saem do anel, passam pela praça e voltam ao anel do outro lado.
  A altura delas segue o relevo suavizado e é corrigida aos poucos perto dos
  cruzamentos, para não criar degraus. O terreno perto dela
  é aplainado, e por cima vai uma "fita" 3D com textura de asfalto desenhada
  num canvas.
- **Árvores** (`natureza.js`): mais de mil, desenhadas com `InstancedMesh`.
  A placa de vídeo recebe um modelo só e desenha todas as cópias de uma vez.
- **Física do carro** (`carro.js`): a velocidade é separada em "para frente"
  e "de lado" (derrapagem). Na vertical, a gravidade puxa o carro para baixo.
  Quando o chão "some", no fim de uma rampa, o carro voa.
- **Dia e noite** (`ceu.js`): o sol dá a volta no céu. A cor do céu, a
  neblina, as estrelas e os faróis do carro mudam com a hora.
- **Casas** (`casas.js`): cada casa é montada em "coordenadas locais" (o centro
  da casa é o ponto 0,0) e depois girada para olhar para a estrada. As paredes
  são caixas com vãos de porta e janela. Para as colisões, cada parede e móvel
  vira um retângulo: o personagem é um círculo e é empurrado para fora deles.
- **Animais** (`animais.js`): cada bicho tem um *estado* (parado, andando,
  fugindo, atacando, tonto) que muda conforme o que acontece em volta. Isso se
  chama **máquina de estados**, uma técnica muito usada em IA de jogos. Os peixes
  usam `InstancedMesh`, então os 128 são desenhados de uma vez só.
- **Algas** (`fundo-do-mar.js`): o balanço é feito num *shader* que roda na placa
  de vídeo. O código pega o shader padrão do Three.js e acrescenta uma linha que
  empurra a ponta de cada alga com uma onda (seno) que muda com o tempo.
- **Partículas** (`particulas.js`): poeira, água e nitro usam um pequeno
  *shader*, um programa que roda direto na placa de vídeo.

## Organização do projeto

```
ilha-3d/
├── index.html          estrutura, HUD e ordem dos scripts
├── css/style.css       aparência do HUD e das telas
├── lib/three.min.js    biblioteca 3D Three.js (licença MIT, em lib/THREE-LICENSE.txt)
└── js/
    ├── config.js       números do jogo (tamanho da ilha, carro, duração do dia)
    ├── utils.js        funções de ajuda e o gerador de ruído
    ├── entrada.js      teclado
    ├── som.js          motor e efeitos sonoros gerados por código
    ├── terreno.js      relevo, estrada e água
    ├── casas.js        casas, cômodos, móveis, porta, objetos e colisões
    ├── natureza.js     árvores, pinheiros, coqueiros e pedras (modelos, batidas e corte)
    ├── fundo-do-mar.js algas (com shader de balanço), corais, estrelas-do-mar, ouriços e conchas
    ├── modelos.js      ajuda para montar modelos 3D com caixas e esferas
    ├── itens.js        catálogo de itens, inventário e itens no mundo
    ├── animais.js      animais de terra, peixes, golfinhos e gaivotas
    ├── moradores.js    os moradores da vila (rotina, conversa, reações)
    ├── historias.js    missões dos moradores e eventos surpresa
    ├── aviao.js        aeroclube (hangar, biruta) e o avião (física de voo)
    ├── vida-marinha.js tubarões, águas-vivas, tartarugas, arraias e a visão debaixo d'água
    ├── graficos.js     modo Bonito/Leve, pós-processamento e mapas de altura/grama
    ├── agua.js         shader da água (ondas, reflexo, espuma)
    ├── ceu.js          dia e noite, cúpula do céu com nuvens, lua, estrelas e luzes
    ├── clima.js        chuva, neve, relâmpagos e neve acumulando (shader)
    ├── grama.js        grama que acompanha a câmera (calculada na placa de vídeo)
    ├── particulas.js   poeira, água e chamas
    ├── carro.js        bicicleta, moto, carro popular e esportivo (modelos e física)
    ├── pessoa.js       o personagem a pé (andar, correr, pular, escadas, nadar e mergulhar)
    ├── barco.js        o píer e o barco (física na água, encalhar, espuma)
    ├── camera.js       câmera que segue o carro
    ├── acoes.js        vida, fome e o que cada item faz (golpe, tiro, pesca...)
    ├── missoes.js      moedas, corrida com anéis, saltos e recorde
    ├── hud.js          painéis, bússola e minimapa
    ├── comandos.js     console de comandos (/tempo, /clima, /dar)
    ├── quintais.js     cercas, caminhos, calçadas e jardins das casas
    ├── corpo.js        o corpo das pessoas (cotovelo, joelho, rosto, cabelo, roupa)
    ├── aguadoce.js     lagos, rios e pontes
    ├── trafego.js      carros e motos dos moradores na estrada
    ├── semaforos.js    semáforos nos cruzamentos
    ├── atracoes.js     posto, delegacia, campo, feira, farol, salva-vidas e a gasolina
    ├── policia.js      estrelas de procurado, viaturas, esconderijo e prisão
    ├── salvar-livre.js salvamento do modo livre
    ├── estacoes.js     estações do ano, Halloween e Natal
    ├── toque.js        controles de toque para celular (analógico, botões, câmera)
    ├── dialogo.js      janela com botões (lojas, empregos)
    ├── lugares.js      quiosques da Nova Vida (onde ficam, modelo, balcão)
    ├── empregos.js     os trabalhos, tarefas, prazos, níveis e o marcador de destino
    ├── vida.js         modo Nova Vida: dinheiro, compras, casa, dormir e salvar
    └── jogo.js         o "maestro": cena 3D, estados e loop principal
```

## Desafios para treinar

1. **Fácil:** em `config.js`, mude `alturaMontanhas` para 120 e veja a ilha virar uma serra.
2. **Fácil:** mude a cor do carro em `carro.js` (procure `0xe11d48`).
3. **Médio:** aumente `moedas` para 80 (ou coloque as rampas de volta mudando `rampas` para 6).
4. **Médio:** em `config.js`, aumente `casas` para 12 (elas se espalham sozinhas).
5. **Médio:** em `casas.js`, coloque uma piscina no quintal das casas.
6. **Médio:** em `itens.js`, crie um item novo (por exemplo, "Pizza" que tira 60 de fome)
   e coloque ele nas cozinhas das casas.
7. **Médio:** em `animais.js`, crie um animal novo (uma tartaruga na praia?) copiando
   o caranguejo e mudando o modelo.
8. **Difícil:** adicione chuva: partículas caindo do céu em volta do carro,
   que aparecem aleatoriamente de vez em quando.
