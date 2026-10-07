const corpoTabela = document.getElementById("corpoTabela");
const mensagem = document.getElementById("mensagem");

function mostrar(texto, sucesso = false) {
  mensagem.textContent = texto;
  mensagem.className = `mensagem ${sucesso ? "sucesso" : "erro"}`;
}

async function carregar() {
  try {
    const resposta = await fetch("/api/v1/moradores");
    if (!resposta.ok) throw new Error("Falha ao carregar moradores");
    const moradores = await resposta.json();
    corpoTabela.replaceChildren();

    if (moradores.length === 0) {
      const linha = corpoTabela.insertRow();
      const celula = linha.insertCell();
      celula.colSpan = 5;
      celula.className = "vazio";
      celula.textContent = "Nenhum morador ativo.";
      return;
    }

    moradores.forEach(morador => {
      const linha = corpoTabela.insertRow();
      [morador.morador, morador.apto, morador.tipo, morador.veiculo ?? "-"].forEach(valor => {
        linha.insertCell().textContent = valor ?? "-";
      });
      const acao = linha.insertCell();
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "botao-inativar";
      botao.textContent = "Inativar";
      botao.addEventListener("click", () => inativar(morador, botao));
      acao.appendChild(botao);
    });
  } catch {
    mostrar("Não foi possível carregar os moradores.");
  }
}

async function inativar(morador, botao) {
  if (!window.confirm(`Confirma a inativação de ${morador.morador}, apto ${morador.apto}?`)) return;
  botao.disabled = true;

  try {
    const resposta = await fetch(`/api/v1/moradores/${encodeURIComponent(morador.id)}`, { method: "PATCH" });
    const resultado = await resposta.json();
    if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível inativar o morador.");
    mostrar(`${morador.morador} foi inativado.`, true);
    await carregar();
  } catch (erro) {
    mostrar(erro.message || "Não foi possível conectar ao servidor.");
    botao.disabled = false;
  }
}

carregar();