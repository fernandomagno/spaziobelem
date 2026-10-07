const config = {
  morador:    { rotulo: "Nome do Morador",    placeholder: "Ex.: João Silva" },
  placa:      { rotulo: "Placa do Carro",     placeholder: "Ex.: ABC1D23" },
  apto:       { rotulo: "Número do Apto",     placeholder: "Ex.: 101" }
};

let tipoAtual = "morador";

const campo = document.getElementById("campoBusca");
const rotulo = document.getElementById("rotulo");
const resultados = document.getElementById("resultados");

document.getElementById("limparPesquisa").addEventListener("click", () => {
  campo.value = "";
  resultados.replaceChildren();
  campo.focus();
});

document.querySelectorAll(".opcao").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".opcao").forEach(b => b.classList.remove("ativa"));
    btn.classList.add("ativa");
    tipoAtual = btn.dataset.tipo;
    rotulo.textContent = config[tipoAtual].rotulo;
    campo.placeholder = config[tipoAtual].placeholder;
    campo.value = "";
    resultados.innerHTML = "";
    campo.focus();
  });
});

const normalizar = txt => String(txt ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s-]/g, "").toLowerCase();

document.getElementById("formBusca").addEventListener("submit", async e => {
  e.preventDefault();
  const termo = normalizar(campo.value);
  try {
    const resp = await fetch("/api/v1/moradores");
    const moradores = await resp.json();
    exibir(moradores.filter(m => {
      const valor = tipoAtual === "placa" && m.veiculos?.length
        ? m.veiculos.map(veiculo => veiculo.placa).filter(Boolean).join(" ")
        : m[tipoAtual];
      return normalizar(valor).includes(termo);
    }));
  } catch {
    resultados.innerHTML = "";
    const p = document.createElement("p");
    p.className = "vazio";
    p.textContent = "Não foi possível conectar ao servidor.";
    resultados.appendChild(p);
  }
});

function exibir(lista) {
  resultados.innerHTML = "";
  if (lista.length === 0) {
    const p = document.createElement("p");
    p.className = "vazio";
    p.textContent = "Nenhum resultado encontrado.";
    resultados.appendChild(p);
    return;
  }
  lista.forEach(m => {
    const card = document.createElement("div");
    card.className = "card";
    const botao = document.createElement("a");
    botao.className = "botao-expandir";
    botao.href = `/v1/morador/${encodeURIComponent(m.apto)}`;
    botao.textContent = "Expandir";
    card.appendChild(botao);
    const linhas = [
      ["h3", m.morador],
      ["p", `Apto: ${m.apto}`],
      ["p", `Carro/Moto: ${m.veiculo ?? "-"}`],
      ["p", `Placa: ${m.placa ?? "-"}`],
      ["p", `Marca/Modelo: ${m.marca_modelo ?? "-"}`]
    ];
    linhas.forEach(([tag, texto]) => {
      const el = document.createElement(tag);
      el.textContent = texto;
      card.appendChild(el);
    });
    resultados.appendChild(card);
  });
}
