// ===== CONFIGURAÇÕES =====
const CATEGORIAS = {
  "Alimentação": "#22c55e",
  "Moradia": "#8b5cf6",
  "Transporte": "#f59e0b",
  "Contas": "#3b82f6",
  "Saúde": "#ef4444",
  "Educação": "#06b6d4",
  "Lazer": "#ec4899",
  "Outros": "#94a3b8",
  "Salário": "#10b981"
};

const CATS_DESPESA = Object.keys(CATEGORIAS).filter(function (c) {
  return c !== "Salário";
});

// ===== FUNÇÕES AUXILIARES =====
function lerDados(chave, padrao) {
  try {
    return JSON.parse(localStorage.getItem(chave)) || padrao;
  } catch (erro) {
    return padrao;
  }
}

function gravar(chave, valor) {
  localStorage.setItem(chave, JSON.stringify(valor));
}

function hoje() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function formatar(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data) {
  return data.split("-").reverse().join("/");
}

function formatarPct(valor) {
  return valor.toFixed(1).replace(".", ",") + "%";
}

function compacto(valor) {
  if (valor >= 1000) {
    return String(+(valor / 1000).toFixed(2)).replace(".", ",") + "k";
  }
  return String(+valor.toFixed(2)).replace(".", ",");
}

function diasNoMes(ym) {
  const p = ym.split("-").map(Number);
  return new Date(p[0], p[1], 0).getDate();
}

function mesAnterior(ym) {
  const p = ym.split("-").map(Number);
  const d = new Date(p[0], p[1] - 2, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

// até que dia desenhar os gráficos (no mês atual, vai só até hoje)
function ultimoDia(ym) {
  if (ym === hoje().slice(0, 7)) {
    return Number(hoje().slice(8, 10));
  }
  return diasNoMes(ym);
}

function cor(categoria) {
  return CATEGORIAS[categoria] || "#94a3b8";
}

function criar(tag, classe, texto) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function passoBonito(x) {
  if (x <= 0) return 25;
  const exp = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / exp;
  const bonito = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return bonito * exp;
}

// ===== DADOS SALVOS =====
let movimentacoes = lerDados("movimentacoes", []);
let metas = lerDados("metas", {});
let mes = hoje().slice(0, 7);

// garante os campos novos nas movimentações antigas
movimentacoes.forEach(function (mov, i) {
  if (!mov.id) mov.id = Date.now() + i;
  if (!mov.categoria) mov.categoria = "Outros";
  if (!mov.data) mov.data = hoje();
  if (!mov.pagamento) mov.pagamento = "Outro";
});

// ===== ELEMENTOS DA PÁGINA =====
const campoMes = document.getElementById("mes");
const filtro = document.getElementById("filtro");
const dialogo = document.getElementById("dialogo");
const form = document.getElementById("form-movimentacao");
const campoData = document.getElementById("data");
const selTipo = document.getElementById("tipo");
const selCat = document.getElementById("categoria");
const switchTema = document.getElementById("tema-switch");

Object.keys(CATEGORIAS).forEach(function (cat) {
  const opcao = document.createElement("option");
  opcao.textContent = cat;
  selCat.appendChild(opcao);
});

// ===== CÁLCULOS =====
function resumo(lista) {
  let receitas = 0;
  let despesas = 0;
  const porCategoria = {};

  lista.forEach(function (m) {
    if (m.tipo === "receita") {
      receitas += m.valor;
    } else {
      despesas += m.valor;
      porCategoria[m.categoria] = (porCategoria[m.categoria] || 0) + m.valor;
    }
  });

  return { receitas: receitas, despesas: despesas, saldo: receitas - despesas, porCategoria: porCategoria };
}

// valor acumulado dia a dia ("despesa", "receita" ou "saldo")
function serieAcumulada(lista, ate, tipo) {
  const dias = new Array(ate).fill(0);

  lista.forEach(function (m) {
    const d = parseInt(m.data.slice(8, 10), 10) - 1;
    if (d < 0 || d >= ate) return;
    if (tipo === "saldo") {
      dias[d] += m.tipo === "receita" ? m.valor : -m.valor;
    } else if (m.tipo === tipo) {
      dias[d] += m.valor;
    }
  });

  let acumulado = 0;
  return dias.map(function (v) {
    acumulado += v;
    return acumulado;
  });
}

// ===== DESENHO DOS GRÁFICOS =====
function desenharSpark(id, valores, corLinha) {
  const svg = document.getElementById(id);
  if (valores.length < 2) {
    svg.innerHTML = "";
    return;
  }

  const max = Math.max.apply(null, valores.concat([0]));
  const min = Math.min.apply(null, valores.concat([0]));
  const faixa = max - min || 1;

  const pontos = valores.map(function (v, i) {
    return [(i / (valores.length - 1)) * 120, 33 - ((v - min) / faixa) * 29];
  });

  const linha = pontos.map(function (p, i) {
    return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1);
  }).join(" ");

  svg.innerHTML =
    '<path d="' + linha + ' L120 36 L0 36 Z" fill="' + corLinha + '" opacity="0.14"/>' +
    '<path d="' + linha + '" fill="none" stroke="' + corLinha + '" stroke-width="2" ' +
    'vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>';
}

function desenharDonut(porCategoria, total) {
  const svg = document.getElementById("donut");
  const R = 70;
  const C = 2 * Math.PI * R;

  let html = '<circle cx="100" cy="100" r="' + R + '" fill="none" stroke="var(--trilho)" stroke-width="26"/>';

  if (total > 0) {
    let acumulado = 0;
    Object.keys(porCategoria)
      .sort(function (a, b) { return porCategoria[b] - porCategoria[a]; })
      .forEach(function (cat) {
        const parte = (porCategoria[cat] / total) * C;
        html +=
          '<circle cx="100" cy="100" r="' + R + '" fill="none" stroke="' + cor(cat) + '" stroke-width="26" ' +
          'stroke-dasharray="' + parte.toFixed(2) + ' ' + (C - parte).toFixed(2) + '" ' +
          'stroke-dashoffset="' + (-acumulado).toFixed(2) + '" transform="rotate(-90 100 100)">' +
          '<title>' + cat + ': ' + formatar(porCategoria[cat]) + '</title></circle>';
        acumulado += parte;
      });
  }

  svg.innerHTML = html;
}

function desenharTendencia(serie, ym) {
  const svg = document.getElementById("tendencia");
  const n = diasNoMes(ym);
  const L = 400, A = 240, esq = 44, dir = 12, topo = 14, base = 30;
  const largura = L - esq - dir;
  const altura = A - topo - base;

  const maxSerie = Math.max.apply(null, serie.concat([0]));
  const passo = passoBonito(maxSerie / 4);
  const max = passo * 4;

  function x(dia) {
    return esq + ((dia - 1) / Math.max(n - 1, 1)) * largura;
  }
  function y(valor) {
    return topo + altura - (valor / max) * altura;
  }

  let html =
    '<defs><linearGradient id="grad-area" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" style="stop-color:var(--acento);stop-opacity:0.35"/>' +
    '<stop offset="100%" style="stop-color:var(--acento);stop-opacity:0"/>' +
    '</linearGradient></defs>';

  // linhas de grade e valores do eixo vertical
  for (let i = 0; i <= 4; i++) {
    const valor = passo * i;
    const yy = y(valor);
    html += '<line class="grade-linha" x1="' + esq + '" x2="' + (L - dir) + '" y1="' + yy + '" y2="' + yy + '"/>';
    html += '<text class="eixo-texto" x="' + (esq - 8) + '" y="' + (yy + 3) + '" text-anchor="end">' + compacto(valor) + '</text>';
  }

  // dias no eixo horizontal
  [1, 8, 15, 22, n]
    .filter(function (d, i, arr) { return d <= n && arr.indexOf(d) === i; })
    .forEach(function (d) {
      html += '<text class="eixo-texto" x="' + x(d) + '" y="' + (A - 8) + '" text-anchor="middle">' + d + '</text>';
    });

  if (serie.length) {
    const pontos = serie.map(function (v, i) {
      return [x(i + 1), y(v)];
    });

    const linha = pontos.map(function (p, i) {
      return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1);
    }).join(" ");

    const ultimo = pontos[pontos.length - 1];
    const chao = topo + altura;

    html += '<path d="' + linha + ' L' + ultimo[0].toFixed(1) + ' ' + chao + ' L' + pontos[0][0].toFixed(1) + ' ' + chao + ' Z" fill="url(#grad-area)"/>';
    html += '<path class="linha-tend" d="' + linha + '"/>';

    // áreas invisíveis que mostram o valor ao passar o mouse
    pontos.forEach(function (p, i) {
      html += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="7" fill="transparent">' +
        '<title>Dia ' + (i + 1) + ': ' + formatar(serie[i]) + '</title></circle>';
    });

    html += '<circle class="ponto-tend" cx="' + ultimo[0].toFixed(1) + '" cy="' + ultimo[1].toFixed(1) + '" r="4.5"/>';
  }

  svg.innerHTML = html;
}

// ===== ATUALIZAÇÃO DA TELA =====
function mostrarVariacao(id, atual, anterior, altaEhBoa) {
  const el = document.getElementById(id);
  el.className = "variacao";

  if (!anterior) {
    el.textContent = "Sem dados do mês anterior";
    return;
  }

  const pct = ((atual - anterior) / Math.abs(anterior)) * 100;
  const subiu = pct >= 0;
  el.textContent = (subiu ? "↗ " : "↘ ") + formatarPct(Math.abs(pct)) + " vs. mês anterior";
  el.classList.add(subiu === altaEhBoa ? "bom" : "ruim");
}

function atualizarCards(r, ra, doMes) {
  document.getElementById("total-despesas").textContent = formatar(r.despesas);
  document.getElementById("total-receitas").textContent = formatar(r.receitas);
  document.getElementById("total-saldo").textContent = formatar(r.saldo);

  mostrarVariacao("var-despesas", r.despesas, ra.despesas, false);
  mostrarVariacao("var-receitas", r.receitas, ra.receitas, true);
  mostrarVariacao("var-saldo", r.saldo, ra.saldo, true);

  const ate = ultimoDia(mes);
  desenharSpark("spark-despesas", serieAcumulada(doMes, ate, "despesa"), "#8b5cf6");
  desenharSpark("spark-receitas", serieAcumulada(doMes, ate, "receita"), "#22c55e");
  desenharSpark("spark-saldo", serieAcumulada(doMes, ate, "saldo"), "#f59e0b");

  // orçamento usado (só conta categorias que têm meta)
  let totalMetas = 0;
  let gastoComMeta = 0;
  Object.keys(metas).forEach(function (cat) {
    totalMetas += metas[cat];
    gastoComMeta += r.porCategoria[cat] || 0;
  });

  const texto = document.getElementById("orc-pct");
  const barra = document.getElementById("orc-barra");
  const detalhe = document.getElementById("orc-detalhe");

  if (totalMetas > 0) {
    const pct = Math.round((gastoComMeta / totalMetas) * 100);
    texto.textContent = pct + "%";
    barra.style.width = Math.min(pct, 100) + "%";
    barra.classList.toggle("estourou", pct > 100);
    detalhe.textContent = "de " + formatar(totalMetas);
  } else {
    texto.textContent = "—";
    barra.style.width = "0%";
    barra.classList.remove("estourou");
    detalhe.textContent = "Defina metas em Orçamentos";
  }
}

function atualizarCategorias(r) {
  document.getElementById("donut-total").textContent = formatar(r.despesas);
  desenharDonut(r.porCategoria, r.despesas);

  const legenda = document.getElementById("legenda");
  const destaque = document.getElementById("top-categoria");
  legenda.innerHTML = "";

  const cats = Object.keys(r.porCategoria).sort(function (a, b) {
    return r.porCategoria[b] - r.porCategoria[a];
  });

  if (!cats.length) {
    legenda.appendChild(criar("li", "suave", "Nenhum gasto neste período."));
    destaque.textContent = "Cadastre despesas para ver a distribuição por categoria.";
    return;
  }

  cats.forEach(function (cat) {
    const valor = r.porCategoria[cat];
    const li = criar("li");
    const ponto = criar("span", "ponto");
    ponto.style.background = cor(cat);
    li.appendChild(ponto);
    li.appendChild(criar("span", "", cat));
    li.appendChild(criar("span", "leg-valor", formatar(valor)));
    li.appendChild(criar("span", "leg-pct", formatarPct((valor / r.despesas) * 100)));
    legenda.appendChild(li);
  });

  const topo = cats[0];
  destaque.innerHTML =
    "★ Categoria principal: <strong>" + topo + "</strong> (" +
    formatarPct((r.porCategoria[topo] / r.despesas) * 100) + ")";
}

function atualizarTendencia(r, ra, doMes) {
  desenharTendencia(serieAcumulada(doMes, ultimoDia(mes), "despesa"), mes);

  const el = document.getElementById("comparativo");
  if (!ra.despesas) {
    el.textContent = "Sem despesas no mês anterior para comparar.";
    return;
  }

  const diferenca = r.despesas - ra.despesas;
  const pct = (Math.abs(diferenca) / ra.despesas) * 100;
  const verbo = diferenca >= 0 ? "a mais" : "a menos";
  el.innerHTML =
    "Você gastou <strong>" + formatar(Math.abs(diferenca)) + "</strong> " + verbo +
    " que no mês anterior (" + formatarPct(pct) + ").";
}

function atualizarOrcamentos(r) {
  const grade = document.getElementById("grade-orcamentos");
  grade.innerHTML = "";

  CATS_DESPESA.forEach(function (cat) {
    const gasto = r.porCategoria[cat] || 0;
    const meta = metas[cat] || 0;
    const pct = meta ? Math.round((gasto / meta) * 100) : 0;

    const card = criar("div", "orc-card");
    card.style.setProperty("--cor", cor(cat));

    const topo = criar("div", "orc-topo");
    const ponto = criar("span", "ponto");
    ponto.style.background = cor(cat);
    const botao = criar("button", "menu-pontos", "⋮");
    botao.type = "button";
    botao.title = "Definir meta mensal";
    botao.addEventListener("click", function () {
      definirMeta(cat);
    });
    topo.appendChild(ponto);
    topo.appendChild(criar("span", "nome", cat));
    topo.appendChild(botao);

    const valor = criar(
      "div",
      "orc-valor",
      formatar(gasto) + " / " + (meta ? formatar(meta) : "sem meta")
    );

    const barra = criar("div", "barra");
    const fill = criar("div", "barra-fill");
    fill.style.width = Math.min(pct, 100) + "%";
    if (pct > 100) fill.classList.add("estourou");
    barra.appendChild(fill);

    card.appendChild(topo);
    card.appendChild(valor);
    card.appendChild(barra);
    card.appendChild(criar("div", "orc-pct", meta ? pct + "%" : "—"));
    grade.appendChild(card);
  });
}

function atualizarTabela(doMes) {
  const corpo = document.getElementById("lista");
  corpo.innerHTML = "";

  const filtradas = doMes
    .filter(function (m) {
      return filtro.value === "todas" || m.tipo === filtro.value;
    })
    .sort(function (a, b) {
      return b.data.localeCompare(a.data) || b.id - a.id;
    });

  if (!filtradas.length) {
    const tr = criar("tr");
    const td = criar("td", "vazio", "Nenhuma movimentação neste período.");
    td.colSpan = 6;
    tr.appendChild(td);
    corpo.appendChild(tr);
    return;
  }

  filtradas.forEach(function (mov) {
    const tr = criar("tr");

    tr.appendChild(criar("td", "", formatarData(mov.data)));
    tr.appendChild(criar("td", "desc", mov.descricao));

    const tdCat = criar("td");
    const badge = criar("span", "badge", mov.categoria);
    badge.style.setProperty("--cor", cor(mov.categoria));
    tdCat.appendChild(badge);
    tr.appendChild(tdCat);

    tr.appendChild(criar("td", "suave", mov.pagamento));

    const sinal = mov.tipo === "receita" ? "+ " : "- ";
    tr.appendChild(criar("td", "dir mov-valor " + mov.tipo, sinal + formatar(mov.valor)));

    const tdAcao = criar("td", "dir");
    const botao = criar("button", "icone-btn");
    botao.type = "button";
    botao.title = "Excluir";
    botao.setAttribute("aria-label", "Excluir movimentação");
    botao.innerHTML = '<svg class="ico"><use href="#i-trash"/></svg>';
    botao.addEventListener("click", function () {
      excluir(mov.id);
    });
    tdAcao.appendChild(botao);
    tr.appendChild(tdAcao);

    corpo.appendChild(tr);
  });
}

function atualizarBanner(r) {
  const el = document.getElementById("banner-texto");
  if (r.saldo > 0) {
    el.textContent = "Você está no caminho certo: sobraram " + formatar(r.saldo) + " neste período.";
  } else if (r.saldo < 0) {
    el.textContent = "Suas despesas passaram das receitas em " + formatar(Math.abs(r.saldo)) + ". Que tal revisar os gastos?";
  } else {
    el.textContent = "Cadastre suas receitas e despesas para acompanhar quanto sobra a cada mês.";
  }
}

function atualizarTela() {
  const doMes = movimentacoes.filter(function (m) {
    return m.data.startsWith(mes);
  });
  const doAnterior = movimentacoes.filter(function (m) {
    return m.data.startsWith(mesAnterior(mes));
  });

  const r = resumo(doMes);
  const ra = resumo(doAnterior);

  atualizarCards(r, ra, doMes);
  atualizarCategorias(r);
  atualizarTendencia(r, ra, doMes);
  atualizarOrcamentos(r);
  atualizarTabela(doMes);
  atualizarBanner(r);
}

// ===== AÇÕES =====
function excluir(id) {
  if (confirm("Deseja excluir esta movimentação?")) {
    movimentacoes = movimentacoes.filter(function (mov) {
      return mov.id !== id;
    });
    gravar("movimentacoes", movimentacoes);
    atualizarTela();
  }
}

function definirMeta(categoria) {
  const resposta = prompt(
    "Meta mensal para " + categoria + " (R$).\nDeixe vazio para remover a meta:",
    metas[categoria] || ""
  );
  if (resposta === null) return;

  const valor = parseFloat(resposta.replace(",", "."));
  if (isNaN(valor) || valor <= 0) {
    delete metas[categoria];
  } else {
    metas[categoria] = valor;
  }

  gravar("metas", metas);
  atualizarTela();
}

function ajustarCategoria() {
  selCat.value = selTipo.value === "receita" ? "Salário" : "Alimentação";
}

function abrirDialogo() {
  campoData.value = hoje();
  ajustarCategoria();
  dialogo.showModal();
}

document.getElementById("btn-nova").addEventListener("click", abrirDialogo);
document.getElementById("btn-nova-lateral").addEventListener("click", abrirDialogo);
document.getElementById("cancelar").addEventListener("click", function () {
  dialogo.close();
});

// clicar fora da janela também fecha
dialogo.addEventListener("click", function (e) {
  if (e.target === dialogo) dialogo.close();
});

selTipo.addEventListener("change", ajustarCategoria);

form.addEventListener("submit", function (evento) {
  evento.preventDefault();

  const nova = {
    id: Date.now(),
    descricao: document.getElementById("descricao").value.trim(),
    valor: parseFloat(document.getElementById("valor").value),
    data: campoData.value,
    tipo: selTipo.value,
    categoria: selCat.value,
    pagamento: document.getElementById("pagamento").value
  };

  movimentacoes.push(nova);
  gravar("movimentacoes", movimentacoes);

  // vai para o mês da movimentação, para você ver o que acabou de cadastrar
  mes = nova.data.slice(0, 7);
  campoMes.value = mes;

  form.reset();
  dialogo.close();
  atualizarTela();
});

campoMes.addEventListener("change", function () {
  mes = campoMes.value || hoje().slice(0, 7);
  atualizarTela();
});

filtro.addEventListener("change", atualizarTela);

// ===== MODO CLARO / ESCURO =====
function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema;
  switchTema.setAttribute("aria-checked", tema === "dark" ? "true" : "false");
  document.getElementById("tema-nome").textContent = tema === "dark" ? "Escuro" : "Claro";
  try {
    localStorage.setItem("tema", tema);
  } catch (erro) {}
}

switchTema.addEventListener("click", function () {
  aplicarTema(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

// ===== MENU LATERAL =====
document.querySelectorAll(".menu a").forEach(function (link) {
  link.addEventListener("click", function () {
    document.querySelectorAll(".menu a").forEach(function (a) {
      a.classList.remove("ativo");
    });
    link.classList.add("ativo");
  });
});

// ===== SAUDAÇÃO =====
function saudacao() {
  const hora = new Date().getHours();
  const texto = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  document.getElementById("saudacao").textContent = texto + "! 👋";
}

// ===== EFEITO DE LUZ COM O MOUSE =====
document.addEventListener("mousemove", function (e) {
  document.body.style.setProperty("--mx", e.clientX + "px");
  document.body.style.setProperty("--my", e.clientY + "px");

  const alvo = e.target.closest(".card, .painel");
  if (alvo) {
    const area = alvo.getBoundingClientRect();
    alvo.style.setProperty("--x", e.clientX - area.left + "px");
    alvo.style.setProperty("--y", e.clientY - area.top + "px");
  }
});

// ===== INÍCIO =====
campoMes.value = mes;
aplicarTema(document.documentElement.dataset.theme || "dark");
saudacao();
atualizarTela();