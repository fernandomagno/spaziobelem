const formMovimentacao = document.getElementById("formMovimentacao");
const selecaoVeiculo = document.getElementById("veiculo");
const corpoTabela = document.getElementById("corpoTabela");
const mensagem = document.getElementById("mensagem");

function mostrar(texto, sucesso = false) {
  mensagem.textContent = texto;
  mensagem.className = `mensagem ${sucesso ? "sucesso" : "erro"}`;
}

function formatarData(valor) {
  const data = new Date(valor.replace(" ", "T"));
  return Number.isNaN(data.getTime())
    ? valor
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}

function mostrarMovimentacoes(movimentacoes) {
  corpoTabela.replaceChildren();
  if (movimentacoes.length === 0) {
    const linha = corpoTabela.insertRow();
    const celula = linha.insertCell();
    celula.colSpan = 6;
    celula.className = "vazio";
    celula.textContent = "Nenhuma movimentação registrada.";
    return;
  }

  movimentacoes.forEach(movimentacao => {
    const linha = corpoTabela.insertRow();
    [formatarData(movimentacao.registrado_em), movimentacao.apto, movimentacao.morador, movimentacao.placa, movimentacao.marca_modelo ?? "-", movimentacao.movimento].forEach(valor => {
      linha.insertCell().textContent = valor;
    });
  });
}

async function carregar() {
  try {
    const resposta = await fetch("/api/v1/movimentacoes");
    if (!resposta.ok) throw new Error("Falha ao carregar movimentações.");
    const dados = await resposta.json();
    const selecionado = selecaoVeiculo.value;
    selecaoVeiculo.replaceChildren(new Option("Selecione um carro...", ""));
    dados.veiculos.forEach(veiculo => {
      selecaoVeiculo.add(new Option(`${veiculo.placa} · ${veiculo.morador} · Apto ${veiculo.apto}`, veiculo.id));
    });
    if (dados.veiculos.some(veiculo => String(veiculo.id) === selecionado)) selecaoVeiculo.value = selecionado;
    if (dados.veiculos.length === 0) selecaoVeiculo.options[0].textContent = "Nenhum carro ativo com placa cadastrada";
    mostrarMovimentacoes(dados.movimentacoes);
  } catch {
    mostrar("Não foi possível carregar os dados.");
  }
}

formMovimentacao.addEventListener("submit", async evento => {
  evento.preventDefault();
  const botoes = [...formMovimentacao.querySelectorAll("button[type='submit']")];
  const movimento = evento.submitter?.value;
  botoes.forEach(botao => botao.disabled = true);

  try {
    const resposta = await fetch("/api/v1/movimentacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ veiculo_id: selecaoVeiculo.value, movimento })
    });
    const resultado = await resposta.json();
    if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível registrar a movimentação.");
    mostrar(`${resultado.movimento} registrada para ${resultado.placa}.`, true);
    await carregar();
  } catch (erro) {
    mostrar(erro.message || "Não foi possível conectar ao servidor.");
  } finally {
    botoes.forEach(botao => botao.disabled = false);
  }
});

carregar();