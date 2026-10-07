const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const PORTA = Number(process.env.PORT) || 3000;
const PASTA = __dirname;
const TIPOS = ["Proprietário", "Locatário", "Outros"];
const VEICULOS = ["Carro", "Moto"];

const db = new DatabaseSync(path.join(PASTA, "moradores.db"));
const ESTRUTURA = `(
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio   TEXT,
    morador      TEXT NOT NULL,
    email        TEXT,
    bicicleta    TEXT,
    pet          TEXT,
    nome_pet     TEXT,
    apto         TEXT NOT NULL,
    veiculo      TEXT CHECK (veiculo IN ('Carro', 'Moto')),
    placa        TEXT,
    marca_modelo TEXT,
    tipo         TEXT CHECK (tipo IN ('Proprietário', 'Locatário', 'Outros')),
    ativo        INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
  )`;
db.exec(`CREATE TABLE IF NOT EXISTS moradores ${ESTRUTURA}`);
// Bancos criados antes destas colunas existirem
const colunas = db.prepare("PRAGMA table_info(moradores)").all().map(c => c.name);
const novasColunas = {
  condominio: "TEXT",
  email: "TEXT",
  bicicleta: "TEXT",
  pet: "TEXT",
  nome_pet: "TEXT",
  veiculo: "TEXT CHECK (veiculo IN ('Carro', 'Moto'))",
  marca_modelo: "TEXT",
  ativo: "INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))"
};
for (const [nome, definicao] of Object.entries(novasColunas)) {
  if (!colunas.includes(nome)) db.exec(`ALTER TABLE moradores ADD COLUMN ${nome} ${definicao}`);
}
// SQLite não altera NOT NULL/CHECK com ALTER; recria a tabela mantendo os dados
const tipoNotNull = db.prepare("PRAGMA table_info(moradores)").all().find(c => c.name === "tipo").notnull;
const sqlTabela = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'moradores'").get().sql;
const tipoBicicleta = db.prepare("PRAGMA table_info(moradores)").all().find(c => c.name === "bicicleta").type;
if (tipoNotNull || sqlTabela.includes("Inquilino") || !sqlTabela.includes("'Outros'") || tipoBicicleta !== "TEXT") {
  db.exec(`
    BEGIN;
    CREATE TABLE moradores_novo ${ESTRUTURA};
    INSERT INTO moradores_novo (id, condominio, morador, email, bicicleta, pet, nome_pet, apto, veiculo, placa, marca_modelo, tipo, ativo)
      SELECT id, condominio, morador, email,
             CASE WHEN typeof(bicicleta) = 'integer' THEN CASE WHEN bicicleta = 1 THEN 'Sim' ELSE NULL END ELSE CAST(bicicleta AS TEXT) END,
             pet, nome_pet, apto, veiculo, placa, marca_modelo,
             CASE tipo WHEN 'Inquilino' THEN 'Locatário' ELSE tipo END, ativo FROM moradores;
    DROP TABLE moradores;
    ALTER TABLE moradores_novo RENAME TO moradores;
    COMMIT;
  `);
}
db.exec(`CREATE TABLE IF NOT EXISTS veiculos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  morador_id INTEGER NOT NULL REFERENCES moradores(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('Carro', 'Moto')),
  placa TEXT,
  marca_modelo TEXT
)`);
db.exec(`INSERT INTO veiculos (morador_id, tipo, placa, marca_modelo)
  SELECT m.id, m.veiculo, m.placa, m.marca_modelo FROM moradores m
  WHERE m.veiculo IN ('Carro', 'Moto')
    AND NOT EXISTS (SELECT 1 FROM veiculos v WHERE v.morador_id = m.id)`);
db.exec(`CREATE TABLE IF NOT EXISTS movimentacoes_veiculos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  morador_id INTEGER NOT NULL,
  morador TEXT NOT NULL,
  apto TEXT NOT NULL,
  placa TEXT NOT NULL,
  marca_modelo TEXT,
  movimento TEXT NOT NULL CHECK (movimento IN ('Entrada', 'Saída')),
  registrado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
)`);
const colunasMovimentacoes = db.prepare("PRAGMA table_info(movimentacoes_veiculos)").all().map(coluna => coluna.name);
if (!colunasMovimentacoes.includes("marca_modelo")) {
  db.exec("ALTER TABLE movimentacoes_veiculos ADD COLUMN marca_modelo TEXT");
  db.exec("UPDATE movimentacoes_veiculos SET marca_modelo = (SELECT marca_modelo FROM moradores WHERE moradores.id = movimentacoes_veiculos.morador_id) WHERE marca_modelo IS NULL");
}

const listar = db.prepare("SELECT id, condominio, morador, email, bicicleta, pet, nome_pet, apto, veiculo, placa, marca_modelo, tipo FROM moradores ORDER BY morador");
const listarAtivos = db.prepare("SELECT id, condominio, morador, email, bicicleta, pet, nome_pet, apto, veiculo, placa, marca_modelo, tipo FROM moradores WHERE ativo = 1 ORDER BY morador");
const listarVeiculos = db.prepare("SELECT id, morador_id, tipo, placa, marca_modelo FROM veiculos WHERE morador_id = ? ORDER BY id");
const listarCarrosAtivos = db.prepare("SELECT v.id, m.morador, m.apto, v.placa, v.marca_modelo FROM veiculos v JOIN moradores m ON m.id = v.morador_id WHERE m.ativo = 1 AND v.tipo = 'Carro' AND v.placa IS NOT NULL AND TRIM(v.placa) <> '' ORDER BY v.placa");
const listarMovimentacoes = db.prepare("SELECT id, morador_id, morador, apto, placa, marca_modelo, movimento, registrado_em FROM movimentacoes_veiculos ORDER BY id DESC LIMIT 50");
const listarMovimentacaoPorId = db.prepare("SELECT id, morador_id, morador, apto, placa, marca_modelo, movimento, registrado_em FROM movimentacoes_veiculos WHERE id = ?");
const inserirMovimentacao = db.prepare("INSERT INTO movimentacoes_veiculos (morador_id, morador, apto, placa, marca_modelo, movimento) SELECT m.id, m.morador, m.apto, v.placa, v.marca_modelo, ? FROM veiculos v JOIN moradores m ON m.id = v.morador_id WHERE v.id = ? AND m.ativo = 1 AND v.tipo = 'Carro' AND v.placa IS NOT NULL AND TRIM(v.placa) <> ''");
const inserir = db.prepare("INSERT INTO moradores (condominio, morador, email, bicicleta, pet, apto, veiculo, placa, marca_modelo, tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
const atualizar = db.prepare("UPDATE moradores SET tipo = ?, morador = ?, email = CASE WHEN ? THEN ? ELSE email END, bicicleta = CASE WHEN ? THEN ? ELSE bicicleta END, pet = CASE WHEN ? THEN ? ELSE pet END, apto = ?, veiculo = ?, placa = ?, marca_modelo = ? WHERE id = ?");
const atualizarNomePet = db.prepare("UPDATE moradores SET nome_pet = ? WHERE id = ?");
const removerVeiculos = db.prepare("DELETE FROM veiculos WHERE morador_id = ?");
const inserirVeiculo = db.prepare("INSERT INTO veiculos (morador_id, tipo, placa, marca_modelo) VALUES (?, ?, ?, ?)");
const sincronizarVeiculoPrincipal = db.prepare("UPDATE moradores SET veiculo = ?, placa = ?, marca_modelo = ? WHERE id = ?");
const inativar = db.prepare("UPDATE moradores SET ativo = 0 WHERE id = ? AND ativo = 1");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

function json(res, status, dados) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(dados));
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let corpo = "";
    req.on("data", parte => {
      corpo += parte;
      if (corpo.length > 1e5) reject(new Error("Corpo muito grande"));
    });
    req.on("end", () => resolve(corpo));
    req.on("error", reject);
  });
}

function validar(dados) {
  const veiculos = Array.isArray(dados.veiculos) ? dados.veiculos : [];
  if (!Array.isArray(dados.veiculos) && dados.veiculo) veiculos.push(dados);
  const veiculosValidos = [];
  for (const veiculo of veiculos) {
    const tipo = String(veiculo.tipo ?? veiculo.veiculo ?? "").trim();
    const placa = String(veiculo.placa ?? "").trim().toUpperCase().replace(/[\s-]/g, "") || null;
    const marca_modelo = String(veiculo.marca_modelo ?? "").trim() || null;
    if (!tipo && !placa && !marca_modelo) continue;
    if (!VEICULOS.includes(tipo)) return { erro: "Selecione Carro ou Moto para cada veículo" };
    if (placa && placa.length > 8) return { erro: "A placa deve ter até 8 caracteres" };
    if (marca_modelo && marca_modelo.length > 60) return { erro: "A marca/modelo deve ter até 60 caracteres" };
    veiculosValidos.push({ tipo, placa, marca_modelo });
  }
  if (veiculosValidos.length > 20) return { erro: "É permitido cadastrar até 20 veículos por morador" };
  const m = {
    condominio: String(dados.condominio ?? "").trim() || null,
    morador: String(dados.morador ?? "").trim(),
    email: dados.email === undefined ? undefined : String(dados.email ?? "").trim() || null,
    bicicleta: dados.bicicleta === undefined ? undefined : String(dados.bicicleta ?? "").trim() || null,
    pet: dados.pet === undefined ? undefined : String(dados.pet ?? "").trim() || null,
    nome_pet: dados.nome_pet === undefined ? undefined : String(dados.nome_pet ?? "").trim() || null,
    apto: String(dados.apto ?? "").trim(),
    veiculos: veiculosValidos,
    veiculo: veiculosValidos[0]?.tipo ?? null,
    placa: veiculosValidos[0]?.placa ?? null,
    marca_modelo: veiculosValidos[0]?.marca_modelo ?? null,
    tipo: String(dados.tipo ?? "").trim() || null
  };
  if (!m.tipo) return { erro: "Informe se o morador é Proprietário ou Locatário" };
  if (!m.morador || !m.apto) return { erro: "Morador e Apto são obrigatórios" };
  if (m.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) return { erro: "Informe um e-mail válido" };
  if (m.bicicleta && m.bicicleta.length > 120) return { erro: "A descrição da bicicleta deve ter até 120 caracteres" };
  if (m.pet && m.pet.length > 120) return { erro: "A descrição do pet deve ter até 120 caracteres" };
  if (m.nome_pet && m.nome_pet.length > 120) return { erro: "O nome do pet deve ter até 120 caracteres" };
  if (!TIPOS.includes(m.tipo)) return { erro: "Tipo deve ser Proprietário, Locatário ou Outros" };
  return { m };
}

function salvarVeiculos(moradorId, veiculos) {
  removerVeiculos.run(moradorId);
  veiculos.forEach(veiculo => inserirVeiculo.run(moradorId, veiculo.tipo, veiculo.placa, veiculo.marca_modelo));
  const principal = veiculos[0];
  sincronizarVeiculoPrincipal.run(principal?.tipo ?? null, principal?.placa ?? null, principal?.marca_modelo ?? null, moradorId);
}

function transacionar(operacao) {
  db.exec("BEGIN");
  try {
    const resultado = operacao();
    db.exec("COMMIT");
    return resultado;
  } catch (erro) {
    db.exec("ROLLBACK");
    throw erro;
  }
}

function incluirVeiculos(moradores) {
  return moradores.map(morador => ({ ...morador, veiculos: listarVeiculos.all(morador.id).map(({ id, tipo, placa, marca_modelo }) => ({ id, tipo, placa, marca_modelo })) }));
}

async function lerJson(req) {
  try {
    return JSON.parse(await lerCorpo(req));
  } catch {
    return null;
  }
}

async function api(req, res, id) {
  if (req.method === "GET" && !id) return json(res, 200, incluirVeiculos(listar.all()));

  if (req.method === "POST" && !id) {
    const dados = await lerJson(req);
    if (!dados) return json(res, 400, { erro: "JSON inválido" });
    const { m, erro } = validar(dados);
    if (erro) return json(res, 400, { erro });

    const criar = () => transacionar(() => {
      const { lastInsertRowid } = inserir.run(m.condominio, m.morador, m.email ?? null, m.bicicleta ?? null, m.pet ?? null, m.apto, m.veiculo, m.placa, m.marca_modelo, m.tipo);
      const idNovo = Number(lastInsertRowid);
      atualizarNomePet.run(m.nome_pet ?? null, idNovo);
      salvarVeiculos(idNovo, m.veiculos);
      return idNovo;
    });
    const idNovo = criar();
    return json(res, 201, { id: idNovo, ...m });
  }

  if (req.method === "PUT" && id) {
    const dados = await lerJson(req);
    if (!dados) return json(res, 400, { erro: "JSON inválido" });
    const { m, erro } = validar(dados);
    if (erro) return json(res, 400, { erro });

    const salvar = () => transacionar(() => {
      const resultado = atualizar.run(m.tipo, m.morador, m.email !== undefined ? 1 : 0, m.email ?? null, m.bicicleta !== undefined ? 1 : 0, m.bicicleta ?? null, m.pet !== undefined ? 1 : 0, m.pet ?? null, m.apto, m.veiculo, m.placa, m.marca_modelo, id);
      if (resultado.changes) {
        atualizarNomePet.run(m.nome_pet ?? null, id);
        salvarVeiculos(id, m.veiculos);
      }
      return resultado;
    });
    const { changes } = salvar();
    if (changes === 0) return json(res, 404, { erro: "Morador não encontrado" });
    return json(res, 200, { id, ...m });
  }

  json(res, 405, { erro: "Método não permitido" });
}

function apiV1(req, res, id) {
  if (req.method === "GET" && !id) return json(res, 200, incluirVeiculos(listarAtivos.all()));

  if (req.method === "PATCH" && id) {
    const { changes } = inativar.run(id);
    if (changes === 0) return json(res, 404, { erro: "Morador não encontrado ou já inativo" });
    return json(res, 200, { id, ativo: false });
  }

  return json(res, 405, { erro: "Método não permitido" });
}

async function apiMovimentacoesV1(req, res) {
  if (req.method === "GET") {
    return json(res, 200, { veiculos: listarCarrosAtivos.all(), movimentacoes: listarMovimentacoes.all() });
  }

  if (req.method === "POST") {
    const dados = await lerJson(req);
    if (!dados) return json(res, 400, { erro: "JSON inválido" });
    const veiculoId = Number(dados.veiculo_id);
    const movimento = String(dados.movimento ?? "").trim();
    if (!Number.isSafeInteger(veiculoId) || veiculoId < 1) return json(res, 400, { erro: "Selecione um carro" });
    if (!["Entrada", "Saída"].includes(movimento)) return json(res, 400, { erro: "Movimentação inválida" });

    const resultado = inserirMovimentacao.run(movimento, veiculoId);
    if (resultado.changes === 0) return json(res, 404, { erro: "Carro ativo não encontrado" });
    return json(res, 201, listarMovimentacaoPorId.get(Number(resultado.lastInsertRowid)));
  }

  return json(res, 405, { erro: "Método não permitido" });
}

function arquivoEstatico(req, res) {
  const url = new URL(req.url, "http://localhost");
  let nome;
  try {
    nome = /^\/v[123]\/?$/.test(url.pathname) ? `${url.pathname.slice(1, 3)}/index.html`
      : /^\/v[123]\/morador\/[^/]+$/.test(url.pathname) ? `${url.pathname.slice(1, 3)}/morador.html`
      : decodeURIComponent(url.pathname).slice(1);
  } catch {
    res.writeHead(400);
    return res.end("Endereço inválido");
  }
  const caminhos = [path.resolve(PASTA, nome)];
  if (nome.startsWith("v1/")) caminhos.push(path.resolve(PASTA, nome.slice(3)));
  const tipo = MIME[path.extname(caminhos[0])];

  // Impede acesso fora da pasta e a arquivos que não sejam do site (ex.: moradores.db)
  if (!tipo || caminhos.some(caminho => !caminho.startsWith(PASTA + path.sep) || caminho === __filename)) {
    res.writeHead(404);
    return res.end("Não encontrado");
  }

  function enviarArquivo(indice = 0) {
    fs.readFile(caminhos[indice], (erro, conteudo) => {
      if (erro && indice + 1 < caminhos.length) return enviarArquivo(indice + 1);
      if (erro) {
        res.writeHead(404);
        return res.end("Não encontrado");
      }
      res.writeHead(200, { "Content-Type": tipo });
      res.end(conteudo);
    });
  }

  enviarArquivo();
}

http.createServer((req, res) => {
  const caminhoUrl = req.url.split("?")[0];
  // Endereços antigos da primeira versão, que agora fica em /v1
  if (caminhoUrl === "/" || /^\/morador\/[^/]+$/.test(caminhoUrl)) {
    res.writeHead(302, { Location: "/v1" + caminhoUrl });
    return res.end();
  }
  const rotaV1 = caminhoUrl.match(/^\/api\/v1\/moradores(?:\/(\d+))?$/);
  if (rotaV1) {
    apiV1(req, res, rotaV1[1] ? Number(rotaV1[1]) : null);
    return;
  }
  if (caminhoUrl === "/api/v1/movimentacoes") {
    apiMovimentacoesV1(req, res).catch(() => json(res, 500, { erro: "Erro interno" }));
    return;
  }
  const rota = caminhoUrl.match(/^\/api\/moradores(?:\/(\d+))?$/);
  if (rota) {
    api(req, res, rota[1] ? Number(rota[1]) : null).catch(() => json(res, 500, { erro: "Erro interno" }));
  } else {
    arquivoEstatico(req, res);
  }
}).listen(PORTA, () => console.log(`Servidor rodando em http://localhost:${PORTA}`));
