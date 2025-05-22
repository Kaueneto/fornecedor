const { Console } = require('console');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

const lancamentosPath = path.join(__dirname, 'lancamentos.jsonl');
const COUNTER_FILE = path.join(__dirname, 'transacao_counter.json');
const fornecedoresPath = path.join(__dirname, 'fornecedores.jsonl');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Função auxiliar segura para ler JSON
function lerDados() {
  try {
    const raw = fs.readFileSync(lancamentosPath, 'utf8');
    return raw
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => JSON.parse(line));
  } catch (err) {
    console.error('Erro ao ler lancamentos.jsonl:', err.message);
    return [];
  }
}

function proximaTransacao() {
  let ultimo = 1000;
  try {
    ultimo = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8')).ultimo;
  } catch {}
  ultimo++;
  fs.writeFileSync(COUNTER_FILE, JSON.stringify({ ultimo }));
  return ultimo.toString();
}

// Pega a data local no formato YYYY-MM-DD
function dataLocalHoje() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// GET: retorna todos os lançamentos
app.get('/api/lancamentos', (req, res) => {
  if (req.query.formato === 'jsonl') {
    const lancamentosPath = path.join(__dirname, 'lancamentos.jsonl');
    if (fs.existsSync(lancamentosPath)) {
      res.setHeader('Content-Type', 'application/jsonl');
      return res.send(fs.readFileSync(lancamentosPath, 'utf8'));
    } else {
      return res.send('');
    }
  }
  // Retorno padrão (JSON array)
  const data = lerDados();
  res.json(data);
});

// POST: cria um novo lançamento
app.post('/api/lancamentos', (req, res) => {
  const novo = {
    id: Date.now(),
    ...req.body
  };

  const fornecedoresPath = path.join(__dirname, 'fornecedores.jsonl');
  const extratoPath = path.join(__dirname, 'extrato.jsonl');
  const lancamentosPath = path.join(__dirname, 'lancamentos.jsonl');

  // 1. Atualizar saldo do fornecedor
  let fornecedores = [];
  if (fs.existsSync(fornecedoresPath)) {
    fornecedores = fs.readFileSync(fornecedoresPath, 'utf8')
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => JSON.parse(line));
  }
  const fornecedor = fornecedores.find(f => f.codigo === novo.codFornecedor);
  if (!fornecedor) {
    return res.status(400).json({ erro: 'Fornecedor não encontrado.' });
  }

  // 2. Calcular novo saldo
  let valor = Number(novo.valor);
  let tipoMov = (novo.tipo === 'credito' || novo.tipo === 'entrada') ? 'entrada' : 'saida';
  let saldoAnterior = fornecedor.posicaoSaldo || 0;
  let saldoNovo = tipoMov === 'entrada' ? saldoAnterior + valor : saldoAnterior - valor;

  // 3. Atualizar saldo no fornecedor
  fornecedor.posicaoSaldo = saldoNovo;
  // Atualiza o array de fornecedores
  fornecedores = fornecedores.map(f => f.codigo === fornecedor.codigo ? fornecedor : f);
  // Salva todos novamente
  fs.writeFileSync(fornecedoresPath, fornecedores.map(f => JSON.stringify(f)).join('\n') + '\n');

  // 4. Registrar no extrato
  const registroExtrato = {
    codFornecedor: fornecedor.codigo,
    nomeFornecedor: fornecedor.nome,
    tipoMov: tipoMov,
    dataMov: new Date().toISOString().slice(0, 10), // data no formato YYYY-MM-DD
    valor: valor,
    saldo: saldoNovo
  };
  fs.appendFileSync(extratoPath, JSON.stringify(registroExtrato) + '\n');

  // 5. Registrar lançamento normalmente
  fs.appendFileSync(lancamentosPath, JSON.stringify(novo) + '\n');

  res.status(201).json(novo);
});

// Atualizar lançamento por ID
app.put('/api/lancamentos/:id', (req, res) => {
  const id = req.params.id;
  const atualizado = req.body;
  try {
    if (!fs.existsSync(lancamentosPath)) return res.status(404).end();
    const raw = fs.readFileSync(lancamentosPath, 'utf8');
    const lancamentos = raw
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => JSON.parse(line));
    let encontrado = false;
    const novos = lancamentos.map(l => {
      if (String(l.id) === String(id)) {
        encontrado = true;
        return { ...l, ...atualizado };
      }
      return l;
    });
    if (!encontrado) return res.status(404).json({ erro: 'Lançamento não encontrado' });
    fs.writeFileSync(lancamentosPath, novos.map(l => JSON.stringify(l)).join('\n') + '\n');
    res.json(atualizado);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar lançamento' });
  }
});

// DELETE: remove um lançamento
app.delete('/api/lancamentos/:id', (req, res) => {
  const { id } = req.params;
  const lancamentosPath = path.join(__dirname, 'lancamentos.jsonl');

  try {
    // Ler todos os lançamentos do arquivo JSONL
    const lancamentos = fs
      .readFileSync(lancamentosPath, 'utf8')
      .split('\n')
      .filter(line => line.trim() !== '') // Remove linhas vazias
      .map(line => JSON.parse(line)); // Converte cada linha em objeto JSON

    // Filtrar o lançamento a ser removido
    const novosLancamentos = lancamentos.filter(l => String(l.id) !== String(id));

    if (novosLancamentos.length === lancamentos.length) {
      console.warn('Lançamento não encontrado para remoção:', id);
      return res.status(404).send('Lançamento não encontrado');
    }

    // Reescrever o arquivo JSONL sem o lançamento removido
    fs.writeFileSync(
      lancamentosPath,
      novosLancamentos.map(l => JSON.stringify(l)).join('\n') + '\n'
    );

    console.log('Lançamento removido do JSONL:', id);
    res.sendStatus(204);
  } catch (err) {
    console.error('Erro ao remover no JSONL:', err);
    res.status(500).send('Erro ao remover o lançamento.');
  }
});

app.post('/api/baixa', (req, res) => {
  const { dataPagamento, titulos } = req.body;
  if (!dataPagamento || !Array.isArray(titulos)) {
    return res.status(400).send('Dados inválidos');
  }

  const lancamentos = lerDados();
  const transacao = proximaTransacao();

  // Atualiza os lançamentos baixados
  titulos.forEach(titulo => {
    const idx = lancamentos.findIndex(l => String(l.id) === String(titulo.id));
    if (idx !== -1) {
      lancamentos[idx].dataPagamento = dataPagamento;
      lancamentos[idx].transacao = transacao;
    }
  });

  fs.writeFileSync(
    lancamentosPath,
    lancamentos.map(l => JSON.stringify(l)).join('\n') + '\n'
  );

  // Calcula os dados para o registro de pagamento
  const creditos = titulos.filter(t => {
    const l = lancamentos.find(lan => String(lan.id) === String(t.id));
    return l && l.tipo === 'credito';
  });
  const debitos = titulos.filter(t => {
    const l = lancamentos.find(lan => String(lan.id) === String(t.id));
    return l && l.tipo === 'debito';
  });

  const qtdeTitCred = creditos.length;
  const qtdeTitDeb = debitos.length;
  const ValorTotalCred = creditos.reduce((soma, t) => soma + Number(t.valor), 0).toFixed(2);
  const ValorTotaldeb = debitos.reduce((soma, t) => soma + Number(t.valor), 0).toFixed(2);
  const Saldo = (ValorTotalCred - ValorTotaldeb).toFixed(2);

  // Salva o registro no pagamentos.jsonl
  const pagamentoPath = path.join(__dirname, 'pagamentos.jsonl');
  const registroPagamento = {
    transacao,
    dataBaixa: dataPagamento,
    qtdeTitCred,
    qtdeTitDeb,
    ValorTotalCred,
    ValorTotaldeb,
    Saldo
  };
  fs.appendFileSync(pagamentoPath, JSON.stringify(registroPagamento) + '\n');

  res.json({ ok: true, transacao });
});

app.get('/api/pagamento', (req, res) => {
  const pagamentosPath = path.join(__dirname, 'pagamentos.jsonl');
  try {
    if (!fs.existsSync(pagamentosPath)) return res.json([]);
    const raw = fs.readFileSync(pagamentosPath, 'utf8');
    const pagamentos = raw
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => JSON.parse(line));
    res.json(pagamentos);
  } catch (err) {
    console.error('Erro ao ler pagamentos.jsonl:', err);
    res.status(500).json([]);
  }
});

app.get('/api/posicao-financeira', (req, res) => {
  const { fornecedor = '', inicio = '', fim = '', tipoData = 'inclusao' } = req.query;
  // Carregue seus lançamentos do banco ou arquivo
  const lancamentos = lerDados();

  // Filtro e cálculo (ajuste conforme sua estrutura de dados)
  const filtrados = lancamentos.filter(l => {
    if (fornecedor && !l.nomeFornecedor.toLowerCase().includes(fornecedor.toLowerCase())) return false;
    let dataRef = l.dataInclusao;
    if (tipoData === 'emissao') dataRef = l.dataEmissao;
    if (tipoData === 'vencimento') dataRef = l.dataVencimento;
    if (inicio && dataRef < inicio) return false;
    if (fim && dataRef > fim) return false;
    return true;
  });

  const abertos = filtrados.filter(l => !l.dataPagamento);
  const pagos = filtrados.filter(l => l.dataPagamento);

  function resumo(arr, tipo) {
    const lista = arr.filter(l => l.tipo === tipo);
    return {
      qtde: lista.length,
      valor: lista.reduce((soma, l) => soma + Number(l.valor), 0)
    };
  }

  res.json({
    abertoCredito: resumo(abertos, 'credito'),
    abertoDebito: resumo(abertos, 'debito'),
    pagoCredito: resumo(pagos, 'credito'),
    pagoDebito: resumo(pagos, 'debito')
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// POST: cadastra um novo fornecedor
app.post('/api/fornecedores', (req, res) => {
  const { codigo, nome } = req.body;
  if (!codigo || !nome) {
    return res.status(400).json({ erro: 'Código e nome são obrigatórios.' });
  }
  const fornecedor = {
    id: Date.now(),
    codigo,
    nome,
    posicaoSaldo: 0 
  };
  const fornecedoresPath = path.join(__dirname, 'fornecedores.jsonl');
  try {
    fs.appendFileSync(fornecedoresPath, JSON.stringify(fornecedor) + '\n');
    res.status(201).json(fornecedor);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao salvar fornecedor.' });
  }
});

// GET: lista todos os fornecedores
app.get('/api/fornecedores', (req, res) => {
  try {
    if (!fs.existsSync(fornecedoresPath)) return res.json([]);
    const raw = fs.readFileSync(fornecedoresPath, 'utf8');
    const lista = raw
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => JSON.parse(line));
    res.json(lista); // saldo deve estar presente em cada objeto
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao ler fornecedores' });
  }
});

// DELETE: remove fornecedor por código
app.delete('/api/fornecedores/:codigo', (req, res) => {
  const codigo = req.params.codigo;
  try {
    if (!fs.existsSync(fornecedoresPath)) return res.status(404).end();
    const raw = fs.readFileSync(fornecedoresPath, 'utf8');
    const fornecedores = raw
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => JSON.parse(line));
    const filtrado = fornecedores.filter(f => f.codigo !== codigo);
    fs.writeFileSync(fornecedoresPath, filtrado.map(f => JSON.stringify(f)).join('\n') + (filtrado.length ? '\n' : ''));
    res.status(204).end();
  } catch (err) {
    res.status(500).end();
  }
});

app.get('/api/extrato', (req, res) => {
  try {
    // Supondo que o extrato está no arquivo 'extrato.jsonl' ou pode ser gerado a partir dos lançamentos
    const extratoPath = path.join(__dirname, 'extrato.jsonl');
    if (!fs.existsSync(extratoPath)) return res.json([]);
    const raw = fs.readFileSync(extratoPath, 'utf8');
    const lista = raw
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => JSON.parse(line));
    res.json(lista);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao ler extrato' });
  }
});