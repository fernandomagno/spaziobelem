const form = document.getElementById("formCadastro");
const mensagem = document.getElementById("mensagem");
const campoApto = document.getElementById("apto");
const listaVeiculos = document.getElementById("listaVeiculos");

function adicionarVeiculo(veiculo = {}) {
  const linha = document.createElement("div");
  linha.className = "linha-veiculo";

  const campoTipo = document.createElement("label");
  campoTipo.textContent = "Tipo";
  const tipo = document.createElement("select");
  tipo.name = "tipo-veiculo";
  tipo.add(new Option("Selecione...", ""));
  tipo.add(new Option("Carro", "Carro"));
  tipo.add(new Option("Moto", "Moto"));
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
adicionarVeiculo();

Array.from({ length: 120 }, (_, indice) => {
  const andar = Math.floor(indice / 8) + 1;
  const numero = andar * 10 + (indice % 8) + 1;
  const opcao = document.createElement("option");
  opcao.value = String(numero);
  opcao.textContent = `Apto ${numero}`;
  campoApto.appendChild(opcao);
});

function mostrar(texto, sucesso) {
  mensagem.textContent = texto;
  mensagem.className = "mensagem " + (sucesso ? "sucesso" : "erro");
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(form));
  dados.veiculos = [...listaVeiculos.querySelectorAll(".linha-veiculo")].map(linha => ({
    tipo: linha.querySelector("[name='tipo-veiculo']").value,
    placa: linha.querySelector("[name='placa-veiculo']").value,
    marca_modelo: linha.querySelector("[name='marca-modelo-veiculo']").value
  }));

  try {
    const resp = await fetch("/api/moradores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
    const resultado = await resp.json();

    if (!resp.ok) return mostrar(resultado.erro || "Erro ao salvar.", false);

    mostrar(`Morador "${resultado.morador}" cadastrado com sucesso!`, true);
    form.reset();
    listaVeiculos.replaceChildren();
    adicionarVeiculo();
    form.tipo.focus();
  } catch {
    mostrar("Não foi possível conectar ao servidor.", false);
  }
});
