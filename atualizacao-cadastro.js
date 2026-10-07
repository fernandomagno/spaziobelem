const unidades = Array.from({ length: 120 }, (_, indice) => {
  const andar = Math.floor(indice / 8) + 1;
  const numero = andar * 10 + (indice % 8) + 1;
  return { andar, numero: String(numero) };
});

const andares = document.getElementById("andares");
const mensagem = document.getElementById("mensagemRelatorio");
const busca = document.getElementById("buscaUnidade");
const filtro = document.getElementById("filtroStatus");
let moradores = [];

const normalizar = valor => String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const numeroApto = valor => String(valor ?? "").replace(/\D/g, "");

function atualizarResumo(cadastrosPorApto) {
  const cadastradas = unidades.filter(unidade => cadastrosPorApto.has(unidade.numero)).length;
  document.getElementById("totalCadastradas").textContent = cadastradas;
  document.getElementById("totalPendentes").textContent = unidades.length - cadastradas;
}

function renderizar() {
  const cadastrosPorApto = new Map();
  moradores.forEach(morador => {
    const numero = numeroApto(morador.apto);
    if (!cadastrosPorApto.has(numero)) cadastrosPorApto.set(numero, []);
    cadastrosPorApto.get(numero).push(morador.morador);
  });
  atualizarResumo(cadastrosPorApto);

  const termo = normalizar(busca.value);
  const statusSelecionado = filtro.value;
  const filtradas = unidades.filter(unidade => {
    const nomes = cadastrosPorApto.get(unidade.numero) ?? [];
    const cadastrada = nomes.length > 0;
    if (statusSelecionado === "cadastrada" && !cadastrada) return false;
    if (statusSelecionado === "pendente" && cadastrada) return false;
    return !termo || normalizar(unidade.numero).includes(termo) || nomes.some(nome => normalizar(nome).includes(termo));
  });

  andares.replaceChildren();
  for (let andar = 1; andar <= 15; andar++) {
    const unidadesDoAndar = filtradas.filter(unidade => unidade.andar === andar);
    if (unidadesDoAndar.length === 0) continue;

    const secao = document.createElement("section");
    secao.className = "andar-relatorio";
    const titulo = document.createElement("h2");
    titulo.textContent = `${andar}º andar`;
    const grade = document.createElement("div");
    grade.className = "grade-unidades";

    unidadesDoAndar.forEach(unidade => {
      const nomes = cadastrosPorApto.get(unidade.numero) ?? [];
      const item = document.createElement("article");
      item.className = `unidade-relatorio ${nomes.length ? "cadastrada" : "pendente"}`;

      const numero = document.createElement("strong");
      numero.className = "numero-unidade";
      numero.textContent = unidade.numero;
      const status = document.createElement("span");
      status.className = "status-unidade";
      status.textContent = nomes.length ? "Cadastrado" : "Sem cadastro";
      item.append(numero, status);

      if (nomes.length) {
        const moradoresUnidade = document.createElement("span");
        moradoresUnidade.className = "moradores-unidade";
        moradoresUnidade.textContent = [...new Set(nomes)].join(", ");
        item.appendChild(moradoresUnidade);
      }
      grade.appendChild(item);
    });

    secao.append(titulo, grade);
    andares.appendChild(secao);
  }

  mensagem.textContent = filtradas.length ? `${filtradas.length} unidade(s) exibida(s)` : "Nenhuma unidade corresponde aos filtros.";
  mensagem.className = "mensagem mensagem-relatorio";
}

busca.addEventListener("input", renderizar);
filtro.addEventListener("change", renderizar);

fetch("/api/v1/moradores")
  .then(resposta => {
    if (!resposta.ok) throw new Error("Falha ao carregar moradores");
    return resposta.json();
  })
  .then(dados => {
    moradores = dados;
    renderizar();
  })
  .catch(() => {
    mensagem.textContent = "Não foi possível carregar os cadastros. Tente atualizar a página.";
    mensagem.className = "mensagem erro";
  });