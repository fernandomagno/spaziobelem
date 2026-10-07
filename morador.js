const apto = decodeURIComponent(location.pathname.split("/")[3] ?? "");
const resultados = document.getElementById("resultados");
const resumo = document.getElementById("resumo");

document.title = `Morador / ${apto}`;
document.getElementById("titulo").textContent = `Morador / Apto ${apto}`;
document.getElementById("migalha").textContent = `Apto ${apto}`;

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function aviso(texto) {
  resultados.appendChild(el("p", "vazio", texto));
}

function iniciais(nome) {
  const partes = nome.trim().split(/\s+/);
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

function blocoResumo(rotulo, valor) {
  const box = el("div", "resumo-item");
  box.append(el("span", "resumo-valor", valor), el("span", "resumo-rotulo", rotulo));
  return box;
}

function campo(rotulo, conteudo) {
  const item = el("div", "dado");
  item.appendChild(el("span", "dado-rotulo", rotulo));
  const valor = el("span", "dado-valor");
  if (conteudo instanceof Node) valor.appendChild(conteudo);
  else valor.textContent = conteudo ?? "-";
  item.appendChild(valor);
  return item;
}

function placa(texto) {
  if (!texto) return "-";
  const p = el("span", "placa");
  p.append(el("span", "placa-topo", "BRASIL"), el("span", "placa-numero", texto));
  return p;
}

function contarVeiculos(moradores) {
  const placasCarro = new Set();
  let outrosVeiculos = 0;

  moradores.forEach(m => {
    const veiculos = m.veiculos?.length ? m.veiculos : m.veiculo ? [{ tipo: m.veiculo, placa: m.placa }] : [];
    veiculos.forEach(veiculo => {
      const placaNormalizada = String(veiculo.placa ?? "").toUpperCase().replace(/[\s-]/g, "");
      if (veiculo.tipo === "Carro" && placaNormalizada) placasCarro.add(placaNormalizada);
      else outrosVeiculos += 1;
    });
  });

  return placasCarro.size + outrosVeiculos;
}

function perfil(m) {
  const card = el("article", "perfil");

  const topo = el("div", "perfil-topo");
  topo.appendChild(el("div", "avatar", iniciais(m.morador)));
  const identificacao = el("div");
  identificacao.appendChild(el("h3", null, m.morador));
  const classeTipo = m.tipo === "Proprietário" ? "tag-proprietario" : m.tipo === "Locatário" ? "tag-locatario" : "tag-indefinido";
  identificacao.appendChild(el("span", `tag ${classeTipo}`, m.tipo ?? "Tipo não informado"));
  topo.appendChild(identificacao);
  card.appendChild(topo);

  const veiculos = m.veiculos?.length ? m.veiculos : m.veiculo ? [{ tipo: m.veiculo, placa: m.placa, marca_modelo: m.marca_modelo }] : [];
  const descricaoVeiculos = veiculos.length
    ? veiculos.map(v => [v.tipo, v.placa, v.marca_modelo].filter(Boolean).join(" · ")).join(" | ")
    : "Sem veículo";
  const dados = el("div", "perfil-dados");
  dados.append(
    campo("Apto", m.apto),
    campo("E-mail", m.email),
    campo("Bicicleta", m.bicicleta),
    campo("Pet", [m.pet, m.nome_pet].filter(Boolean).join(" · ")),
    campo("Carros e motos", descricaoVeiculos)
  );
  card.appendChild(dados);
  return card;
}

fetch("/api/v1/moradores")
  .then(resp => resp.json())
  .then(moradores => {
    const doApto = moradores.filter(m => m.apto.trim().toLowerCase() === apto.trim().toLowerCase());
    if (doApto.length === 0) return aviso("Nenhum morador encontrado neste apto.");

    resumo.append(
      blocoResumo("Apartamento", apto),
      blocoResumo(doApto.length === 1 ? "Morador" : "Moradores", doApto.length),
      blocoResumo("Veículos", contarVeiculos(doApto))
    );
    doApto.forEach(m => resultados.appendChild(perfil(m)));
  })
  .catch(() => aviso("Não foi possível conectar ao servidor."));
