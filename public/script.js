$(document).ready(function () {

    // Função para data local no formato YYYY-MM-DD
    function dataHoje() {
        return new Date().toLocaleDateString('fr-CA');
    }

    // Se houver campos de filtro de data, preencha com a data de hoje
    if ($('#filtro-baixa-inicio').length) {
        $('#filtro-baixa-inicio').val(dataHoje());
    }
    if ($('#filtro-baixa-fim').length) {
        $('#filtro-baixa-fim').val(dataHoje());
    }

    const tabelaCreditos = $('#tabela-creditos').DataTable({
      info: false,
      paging: false,
      searching: false,
      scrollX: true,
      scrollY: '200px',
      scrollCollapse: true,
      colReorder: true,
      destroy: true
    });

    const tabelaDebitos = $('#tabela-debitos').DataTable({
      info: false,
      paging: false,
      searching: false,
      scrollX: true,
      scrollY: '200px',
      scrollCollapse: true,
      colReorder: true,
      destroy: true
    });

    const formatarData = (iso) => iso ? iso.split('-').reverse().join('/') : '';
    const formatarValor = (v) => parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    function atualizarTotaisSelecionados() {
      let totalCreditoSel = 0;
      let totalDebitoSel = 0;

      $('.seletor:checked').each(function () {
        const tipo = $(this).data('tipo');
        const valor = parseFloat($(this).data('valor'));
        if (tipo === 'credito') totalCreditoSel += valor;
        else if (tipo === 'debito') totalDebitoSel += valor;
      });

      $('#selecionado-creditos').text(formatarValor(totalCreditoSel));
      $('#selecionado-debitos').text(formatarValor(totalDebitoSel));
      const diferenca = totalCreditoSel - totalDebitoSel;
      const $diferenca = $('#diferenca-selecionados');

      $diferenca
        .text(formatarValor(diferenca))
        .removeClass('valor-positivo valor-negativo')
        .addClass(diferenca >= 0 ? 'valor-positivo' : 'valor-negativo');
    }

    function carregarDados(filtros = {}) {
      fetch('/api/lancamentos')
        .then(res => res.json())
        .then(data => {
          if (!Array.isArray(data)) throw new Error("Dados inválidos");

          const tipoSelecionado = $('input[name="tipo"]:checked').val();
          const filtrado = data.filter(item => {
            if (tipoSelecionado !== 'todos' && item.tipo !== tipoSelecionado) return false;
            if (filtros.parceiro && !item.nomeFornecedor.toLowerCase().includes(filtros.parceiro.toLowerCase())) return false;
              if (filtros.codfornecedor && !(item.codFornecedor && item.codFornecedor.toLowerCase().includes(filtros.codfornecedor.toLowerCase()))) return false; // <-- ADICIONE ESTA LINHA

            if (filtros.doc && !(item.NF && item.NF.includes(filtros.doc))) return false;
            if (filtros.filial && item.filial !== filtros.filial) return false;
            if (filtros.vencInicio && item.dataVencimento < filtros.vencInicio) return false;
            if (filtros.vencFim && item.dataVencimento > filtros.vencFim) return false;
            if (filtros.emissaoInicio && item.dataEmissao < filtros.emissaoInicio) return false;
            if (filtros.emissaoFim && item.dataEmissao > filtros.emissaoFim) return false;
            if (filtros.inclusaoInicio && item.dataInclusao < filtros.inclusaoInicio) return false;
            if (filtros.inclusaoFim && item.dataInclusao > filtros.inclusaoFim) return false;
            if (item.dataPagamento && item.dataPagamento.trim() !== "") return false;
            if (item.transacao && item.transacao.trim() !== "") return false;
            return true;
          });

          tabelaCreditos.clear();
          tabelaDebitos.clear();

          let qtdCred = 0, qtdDeb = 0, totalCred = 0, totalDeb = 0;

          filtrado.forEach(item => {
            const checkbox = `<input type="checkbox" class="seletor" data-tipo="${item.tipo}" data-valor="${item.valor}">`;
            const row = [
              checkbox,
              formatarData(item.dataInclusao),
              formatarData(item.dataVencimento),
              item.NF,
              formatarValor(item.valor),
              formatarData(item.dataEmissao),
              item.filial,
              item.codFornecedor,
              item.nomeFornecedor,
              item.historico,
              item.observacoes,
              item.transacao || '',
              formatarData(item.dataPagamento),
            ];

            if (item.tipo === 'credito') {
              tabelaCreditos.row.add(row).node().setAttribute('data-id', item.id);
              qtdCred++; totalCred += parseFloat(item.valor);
            } else if (item.tipo === 'debito') {
              tabelaDebitos.row.add(row).node().setAttribute('data-id', item.id);
              qtdDeb++; totalDeb += parseFloat(item.valor);
            }
          });
tabelaCreditos.draw();
tabelaDebitos.draw();
          $('#qtd-creditos').text(qtdCred);
          $('#total-creditos').text(formatarValor(totalCred));
          $('#qtd-debitos').text(qtdDeb);
          $('#total-debitos').text(formatarValor(totalDeb));

          atualizarTotaisSelecionados();
        })
        .catch(err => {
          console.error("Erro ao carregar dados:", err);
          alert("Erro ao carregar dados do servidor.");
        });
    }

    $('#btn-pesquisar').on('click', () => {
      const filtros = {
        parceiro: $('#filtro-parceiro').val(),
        codfornecedor: $('#filtro-codfornecedor').val(), // <-- ADICIONE ESTA LINHA

        doc: $('#filtro-doc').val(),
        filial: $('#filtro-filial').val(),
        vencInicio: $('#venc-inicio').val(),
        vencFim: $('#venc-fim').val(),
        emissaoInicio: $('#emissao-inicio').val(),
        emissaoFim: $('#emissao-fim').val(),
        inclusaoInicio: $('#inclusao-inicio').val(),
        inclusaoFim: $('#inclusao-fim').val()
      };
      carregarDados(filtros);
    });

    $('#btn-limpar').on('click', () => {
      $('#filtros')[0].reset();
      carregarDados();
    });

    $(document).on('change', '.seletor', () => {
      atualizarTotaisSelecionados();
    });

    // Duplo clique para editar
    $('#tabela-creditos tbody, #tabela-debitos tbody').on('dblclick', 'tr', function () {
      const tabela = $(this).closest('table').attr('id');
      const data = (tabela === 'tabela-creditos'
        ? $('#tabela-creditos').DataTable()
        : $('#tabela-debitos').DataTable()
      ).row(this).data();

      fetch('/api/lancamentos')
        .then(res => res.json())
        .then(lancamentos => {
          const textoNF = data[3];
          const valorLimpo = parseFloat(data[4].replace(/[^\d,-]/g, '').replace(',', '.'));
          const lancamento = lancamentos.find(l => l.NF === textoNF && parseFloat(l.valor) === valorLimpo);

          if (!lancamento) return alert('Lançamento não encontrado.');

          console.log('Abrindo modal para edição do ID:', lancamento.id);

          $('#edit-id').val(lancamento.id);
          $('#edit-tipo').val(lancamento.tipo);
          $('#edit-inclusao').val(lancamento.dataInclusao);
          $('#edit-vencimento').val(lancamento.dataVencimento);
          $('#edit-nf').val(lancamento.NF);
          $('#edit-valor').val(lancamento.valor);
          $('#edit-emissao').val(lancamento.dataEmissao);
          $('#edit-filial').val(lancamento.filial);
          $('#edit-codfornecedor').val(lancamento.codFornecedor);
          $('#edit-nomefornecedor').val(lancamento.nomeFornecedor);
          $('#edit-historico').val(lancamento.historico);
          $('#edit-observacoes').val(lancamento.observacoes);

          $('#modal-editar').fadeIn();
        });
    });

    // Cancelar edição
    $('#form-editar button[type="button"]').on('click', () => {
      $('#modal-editar').fadeOut();
    });

    // Salvar edição
    $('#form-editar').on('submit', function (e) {
      e.preventDefault();
      const id = $('#edit-id').val();
      console.log('Enviando PUT para ID:', id);

      const atualizado = {
        tipo: $('#edit-tipo').val(),
        dataInclusao: $('#edit-inclusao').val(),
        dataVencimento: $('#edit-vencimento').val(),
        NF: $('#edit-nf').val(),
        valor: parseFloat($('#edit-valor').val()),
        dataEmissao: $('#edit-emissao').val(),
        filial: $('#edit-filial').val(),
        codFornecedor: $('#edit-codfornecedor').val(),
        nomeFornecedor: $('#edit-nomefornecedor').val(),
        historico: $('#edit-historico').val(),
        observacoes: $('#edit-observacoes').val(),
        transacao: $('#edit-transacao').val(),
        dataPagamento: $('#edit-dataPagamento').val(),
      };

console.log('Enviando para o backend:', novoLancamento);
fetch('/api/lancamentos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(novoLancamento)
})
        .then(res => {
          if (!res.ok) throw new Error('Falha ao salvar');
          return res.json();
        })
        .then(() => {
          console.log('Atualização concluída');
          $('#modal-editar').fadeOut();
          carregarDados();
        })
        .catch(err => {
          console.error('Erro ao enviar PUT:', err);
          alert('Erro ao salvar alterações.');
        });
    });

    // Abrir modal e preencher data de hoje
    $('#btn-novo').on('click', function () {
        const hoje = dataHoje();
        $('#inc-inclusao').val(hoje);
        $('#modal-incluir').css('display', 'flex');
        $('#modal-incluir').fadeIn();
    });

    // Cancelar inclusão
    $('#btn-cancelar-inclusao').on('click', function () {
      $('#modal-incluir').fadeOut();
      $('#modal-incluir').css('display', 'none');
    });

    // Submeter novo lançamento
    $('#form-incluir').on('submit', function (e) {
      e.preventDefault();

      const hoje = dataHoje();

      const novoLancamento = {
        id: Date.now(),
        tipo: $('input[name="inc-tipo"]:checked').val(),
        filial: $('#inc-filial').val(),
        codFornecedor: $('#inc-codfornecedor').val(),
        nomeFornecedor: $('#inc-nomefornecedor').val(),
        valor: parseFloat($('#inc-valor').val()),
        dataVencimento: $('#inc-vencimento').val(),
        dataEmissao: $('#inc-emissao').val(),
        dataInclusao: hoje,
        NF: $('#inc-nf').val(),
        historico: $('#inc-historico').val(),
        observacoes: $('#inc-observacoes').val(),
        transacao: '',
        dataPagamento: '',
      };

      
      fetch('/api/lancamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoLancamento)
      })
        .then(res => {
          if (!res.ok) throw new Error('Erro ao incluir');
          return res.json();
        })
        .then(() => {
          $('#modal-incluir').fadeOut();
          carregarDados();
        })
        .catch(err => {
          console.error('Erro na inclusão:', err);
          alert('Erro ao salvar novo lançamento.');
        });
    });

    $('#btn-limpar-inclusao').on('click', function () {
      $('#form-incluir')[0].reset();
      const hoje = dataHoje();
      $('#inc-inclusao').val(hoje);
    });

    // Carregar dados ao iniciar
    carregarDados();


function getTitulosSelecionados(tipo) {
  const tabela = tipo === 'creditos' ? $('#tabela-creditos').DataTable() : $('#tabela-debitos').DataTable();
  const selecionados = [];
  tabela.rows().every(function() {
    const $row = $(this.node());
    const checked = $row.find('input[type="checkbox"]').prop('checked');
    if (checked) {
      const data = this.data();
      selecionados.push({
        id: $row.data('id'), // <-- Certifique-se de armazenar o id na linha
        nf: data[3],
        fornecedor: data[8],
        valor: Number(data[4].replace(/[^\d,-]/g, '').replace(',', '.')),
        vencimento: data[2]
      });
    }
  });
  return selecionados;
}


$('#btn-baixar').on('click', function () {
  const creditosSelecionados = getTitulosSelecionados('creditos');
  const debitosSelecionados = getTitulosSelecionados('debitos');

  preencherTabelaBaixa('#tabela-baixa-creditos', creditosSelecionados);
  preencherTabelaBaixa('#tabela-baixa-debitos', debitosSelecionados);

  // Formatação numérica simples (sem R$)
  const formatarNumero = v => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalCreditos = creditosSelecionados.reduce((soma, t) => soma + Number(t.valor), 0);
  const totalDebitos = debitosSelecionados.reduce((soma, t) => soma + Number(t.valor), 0);

  $('#total-baixa-creditos').val(formatarNumero(totalCreditos));
  $('#total-baixa-debitos').val(formatarNumero(totalDebitos));
  $('#qtde-baixa-creditos').text(creditosSelecionados.length);
  $('#qtde-baixa-debitos').text(debitosSelecionados.length);

  const diferenca = totalCreditos - totalDebitos;
  $('#diferenca-baixa').val(formatarNumero(diferenca));

  if (diferenca !== 0) {
    $('#pergunta-diferenca').show();
    if (diferenca > 0) {
      $('#texto-diferenca').text('Os títulos selecionados deixaram um valor positivo. Será gerada diferença CRÉDITO.');
    } else {
      $('#texto-diferenca').text('Os títulos selecionados deixaram um valor negativo. Será gerada diferença DÉBITO.');
    }
  } else {
    $('#pergunta-diferenca').hide();
  }

  $('#modal-baixa').css('display', 'flex');
});

// Função para preencher a tabela do modal
function preencherTabelaBaixa(selector, titulos) {
  const $tbody = $(selector + ' tbody');
  $tbody.empty();
  titulos.forEach(t => {
    $tbody.append(`<tr>
      <td>${t.nf || ''}</td>
      <td>${t.fornecedor || ''}</td>
      <td>${Number(t.valor).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
      <td>${t.vencimento || ''}</td>
    </tr>`);
  });
}
function gerarTransacao() {
  return 'TRX' + Date.now();
}
// Fechar modal
$('#btn-cancelar-baixa').on('click', function () {
  $('#modal-baixa').hide();
});

// Lógica para confirmar baixa e gerar diferença
$('#btn-confirmar-baixa').on('click', function () {
  const dataBaixa = dataHoje();
  const creditosSelecionados = getTitulosSelecionados('creditos');
  const debitosSelecionados = getTitulosSelecionados('debitos');
  const todosSelecionados = [...creditosSelecionados, ...debitosSelecionados];

  fetch('/api/baixa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataPagamento: dataBaixa,
      titulos: todosSelecionados
    })
  })
  .then(res => {
    if (!res.ok) throw new Error('Erro ao baixar');
    return res.json();
  })
  .then((res) => {
    $('#modal-baixa').hide();
    carregarDados();
    alert('Baixa realizada com sucesso! Nº transação: ' + res.transacao);
  })
  .catch(err => {
    alert('Erro ao realizar baixa: ' + err.message);
  });
});

$('#btn-gerar-diferenca').on('click', function () {
  // Implemente a geração do título de diferença aqui
  $('#modal-baixa').hide();
});


$('#btn-nao-gerar-diferenca').on('click', function () {
  // Continue sem gerar diferença
  $('#modal-baixa').hide();
});




$('#btn-excluir-selecionados').on('click', function () {
  const creditosSelecionados = getTitulosSelecionados('creditos');
  const debitosSelecionados = getTitulosSelecionados('debitos');
  const todosSelecionados = [...creditosSelecionados, ...debitosSelecionados];

  if (todosSelecionados.length === 0) {
    alert('Selecione pelo menos um lançamento para excluir.');
    return;
  }

  if (!confirm('Tem certeza que deseja excluir os lançamentos selecionados?')) return;

  // Para cada título, faça uma requisição DELETE
  let excluidos = 0;
  let erros = 0;

  todosSelecionados.forEach(titulo => {
    // Você pode precisar ajustar o critério de identificação (ex: usar id se existir)
    fetch(`/api/lancamentos/${encodeURIComponent(titulo.id)}`, {
      method: 'DELETE'
    })
    .then(res => {
      if (res.ok) excluidos++;
      else erros++;
    })
    .catch(() => { erros++; })
    .finally(() => {
      // Quando terminar todos, recarregue a tabela
      if (excluidos + erros === todosSelecionados.length) {
        carregarDados();
        if (erros === 0) {
          alert('Lançamentos excluídos com sucesso!');
        } else {
          alert('Alguns lançamentos não puderam ser excluídos.');
        }
      }
    });
  });
});






});

document.addEventListener('DOMContentLoaded', () => {
  const editValorInput = document.getElementById('edit-valor');

  if (editValorInput) {
    // Permitir digitação de vírgula e validar no envio
    editValorInput.addEventListener('input', (event) => {
      const valor = event.target.value;

      // Permitir apenas números, vírgulas e pontos
      if (!/^[\d.,]*$/.test(valor)) {
        event.target.value = valor.slice(0, -1); // Remove o último caractere inválido
      }
    });

    // Converter vírgula para ponto no envio (opcional)
    editValorInput.addEventListener('blur', (event) => {
      const valor = event.target.value;
      event.target.value = valor.replace(',', '.'); // Substitui vírgula por ponto
    });
  }


// ...existing code...

$(document).ready(function () {
  // ...existing code...

  // Abrir modal ao clicar no botão
  $('#btn-cadastrar-fornecedor').on('click', function() {
    $('#modal-fornecedor').fadeIn();
    $('#forn-codigo').val('');
    $('#forn-nome').val('');
  });

  // Fechar modal ao clicar em cancelar
  $('#btn-cancelar-fornecedor').on('click', function() {
    $('#modal-fornecedor').fadeOut();
  });

  // Salvar fornecedor (exemplo: só exibe alerta, adapte para salvar de verdade)
  $('#form-fornecedor').on('submit', function(e) {
    e.preventDefault();
    const codigo = $('#forn-codigo').val().trim();
    const nome = $('#forn-nome').val().trim();
    if (!codigo || !nome) {
      alert('Preencha todos os campos!');
      return;
    }
    // Aqui você pode fazer um fetch POST para salvar no backend, se desejar
    alert('Fornecedor cadastrado:\nCódigo: ' + codigo + '\nNome: ' + nome);
    $('#modal-fornecedor').fadeOut();
  });
});




});

$(document).ready(function () {
  // Abrir modal
  $('#btn-cadastrar-fornecedor').on('click', function() {
    $('#modal-fornecedor').fadeIn();
    $('#forn-codigo').val('');
    $('#forn-nome').val('');
    $('#btn-excluir-fornecedor').prop('disabled', true);
    $('#tabela-fornecedores tbody').empty();
  });

  // Fechar modal
  $('#btn-cancelar-fornecedor').on('click', function() {
    $('#modal-fornecedor').fadeOut();
  });

  // Cadastrar fornecedor
  $('#btn-cadastrar-fornecedor-modal').on('click', function() {
    const codigo = $('#forn-codigo').val().trim();
    const nome = $('#forn-nome').val().trim();
    if (!codigo || !nome) {
      alert('Preencha código e nome!');
      return;
    }
    $.ajax({
      url: '/api/fornecedores',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ codigo, nome, }),
      success: function() {
        alert('Fornecedor cadastrado!');
        $('#forn-codigo').val('');
        $('#forn-nome').val('');
        pesquisarFornecedores();
      },
      error: function() {
        alert('Erro ao cadastrar fornecedor!');
      }
    });
  });

  // Pesquisar fornecedores
  $('#btn-pesquisar-fornecedor').on('click', function() {
    pesquisarFornecedores();
  });

  function pesquisarFornecedores() {
    const cod = $('#forn-codigo').val().trim().toLowerCase();
    const nome = $('#forn-nome').val().trim().toLowerCase();
    $.get('/api/fornecedores', function(lista) {
      const filtrado = lista.filter(f =>
        (!cod || (f.codigo && f.codigo.toLowerCase().includes(cod))) &&
        (!nome || (f.nome && f.nome.toLowerCase().includes(nome)))
      );
      const tbody = $('#tabela-fornecedores tbody');
      tbody.empty();
      filtrado.forEach(f => {
        tbody.append(`<tr data-codigo="${f.codigo}" data-nome="${f.nome}"><td>${f.codigo}</td><td>${f.nome}</td><td>${f.saldo !== undefined ? f.saldo : '--'}</td></tr>`);
      });
      $('#btn-excluir-fornecedor').prop('disabled', true);
    });
  }

  // Selecionar linha
  $('#tabela-fornecedores').on('click', 'tr', function() {
    $('#tabela-fornecedores tr').removeClass('selected');
    $(this).addClass('selected');
    $('#btn-excluir-fornecedor').prop('disabled', false);
    // Preenche inputs ao clicar na linha
    $('#forn-codigo').val($(this).data('codigo'));
    $('#forn-nome').val($(this).data('nome'));
  });

  // Excluir fornecedor
  $('#btn-excluir-fornecedor').on('click', function() {
    const linha = $('#tabela-fornecedores tr.selected');
    if (!linha.length) return;
    const codigo = linha.data('codigo');
    if (!confirm('Excluir fornecedor código ' + codigo + '?')) return;
    $.ajax({
      url: '/api/fornecedores/' + encodeURIComponent(codigo),
      method: 'DELETE',
      success: function() {
        pesquisarFornecedores();
        $('#btn-excluir-fornecedor').prop('disabled', true);
        $('#forn-codigo').val('');
        $('#forn-nome').val('');
      },
      error: function() {
        alert('Erro ao excluir fornecedor!');
      }
    });
  });

  // Autopreencher nome ao digitar código
  $('#forn-codigo').on('blur', function() {
    const codigo = $(this).val().trim();
    if (!codigo) return;
    $.get('/api/fornecedores', function(lista) {
      const fornecedor = lista.find(f => f.codigo.toLowerCase() === codigo.toLowerCase());
      if (fornecedor) {
        $('#forn-nome').val(fornecedor.nome);
      }
    });
  });
});


