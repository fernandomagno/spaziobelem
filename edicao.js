const form = document.getElementById("formEdicao");
const selecao = document.getElementById("selecao");
const campos = document.getElementById("campos");
const mensagem = document.getElementById("mensagem");
const listaVeiculos = document.getElementById("listaVeiculos");
const CAMPOS = ["tipo", "morador", "email", "bicicleta", "pet", "nome_pet", "apto"];
let moradores = [];

function adicionarVeiculo(veiculo = {}) {
  const linha = document.createElement("div");
  linha.className = "linha-veiculo";
  const campoTipo = document.createElement("label");
  campoTipo.textContent = "Tipo";
  const tipo = document.createElement("select");
  tipo.name = "tipo-veiculo";
  [["Selecione...", ""], ["Carro", "Carro"], ["Moto", "Moto"]].forEach(([rotulo, valor]) => tipo.add(new Option(rotulo, valor)));
  tipo.value = veiculo.tipo ?? "";
  campoTipo.appendChild(tipo);

  const campoPlaca = document.createElement("label");
  campoPlaca.textContent = "Placa";
  const placa = document.createElement("input");
  placa.name = "placa-veiculo";
  placa.maxLength = 8;
  placa.placeholder = "Ex.: ABC1D23";
  placa.value = veiculo.placa ?? "";
  campoPlaca.appendChild(placa);

  const campoMarca = document.createElement("label");
  campoMarca.textContent = "Marca/Modelo";
  const marcaModelo = document.createElement("input");
  marcaModelo.name = "marca-modelo-veiculo";
  marcaModelo.maxLength = 60;
  marcaModelo.placeholder = "Ex.: Fiat / Argo";
  marcaModelo.value = veiculo.marca_modelo ?? "";
  campoMarca.appendChild(marcaModelo);

  const remover = document.createElement("button");
  remover.type = "button";
  remover.className = "botao-remover-veiculo";
  remover.textContent = "Remover";
  remover.addEventListener("click", () => {
    linha.remove();
    atualizarBotoesVeiculo();
  });
  linha.append(campoTipo, campoPlaca, campoMarca, remover);
  listaVeiculos.appendChild(linha);
  atualizarBotoesVeiculo();
}

function atualizarBotoesVeiculo() {
  const botoes = listaVeiculos.querySelectorAll(".botao-remover-veiculo");
  botoes.forEach(botao => botao.disabled = botoes.length === 1);
}

document.getElementById("adicionarVeiculo").addEventListener("click", () => adicionarVeiculo());

function mostrar(texto, sucesso) {
  mensagem.textContent = texto;
  mensagem.className = "mensagem " + (sucesso ? "sucesso" : "erro");
}

async function carregar(idSelecionado) {
  try {
    const resp = await fetch("/api/v1/moradores");
    moradores = await resp.json();
  } catch {
    return mostrar("Não foi possível conectar ao servidor.", false);
  }

  selecao.innerHTML = "";
  const vazio = new Option(moradores.length ? "Selecione..." : "Nenhum morador cadastrado", "");
  selecao.add(vazio);
  moradores.forEach(m => selecao.add(new Option(`${m.morador} - Apto ${m.apto}`, m.id)));

  if (idSelecionado) selecao.value = idSelecionado;
  preencher();
}

function preencher() {
  const m = moradores.find(x => String(x.id) === selecao.value);
  campos.disabled = !m;
  CAMPOS.forEach(c => form.elements[c].value = m?.[c] ?? "");
  if (m?.pet && ![...form.elements.pet.options].some(opcao => opcao.value === m.pet)) {
    form.elements.pet.add(new Option(m.pet, m.pet));
    form.elements.pet.value = m.pet;
  }
  listaVeiculos.replaceChildren();
  const veiculos = m?.veiculos?.length ? m.veiculos : m?.veiculo ? [{ tipo: m.veiculo, placa: m.placa, marca_modelo: m.marca_modelo }] : [{}];
  veiculos.forEach(adicionarVeiculo);
}

selecao.addEventListener("change", () => {
  mensagem.textContent = "";
  preencher();
});

document.getElementById("limparEdicao").addEventListener("click", () => {
  selecao.value = "";
  mensagem.textContent = "";
  preencher();
});

form.addEventListener("submit", async e => {
  e.preventDefault();
  const id = selecao.value;
  const dados = Object.fromEntries(CAMPOS.map(c => [c, form.elements[c].value]));
  dados.veiculos = [...listaVeiculos.querySelectorAll(".linha-veiculo")].map(linha => ({
    tipo: linha.querySelector("[name='tipo-veiculo']").value,
    placa: linha.querySelector("[name='placa-veiculo']").value,
    marca_modelo: linha.querySelector("[name='marca-modelo-veiculo']").value
  }));

  try {
    const resp = await fetch(`/api/moradores/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
    const resultado = await resp.json();
    if (!resp.ok) return mostrar(resultado.erro || "Erro ao salvar.", false);

    await carregar(id);
    mostrar(`Morador "${resultado.morador}" atualizado com sucesso!`, true);
  } catch {
    mostrar("Não foi possível conectar ao servidor.", false);
  }
});

carregar();
