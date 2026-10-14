/************************************************
 * FH / SH ENGINE – FINAL (FIXED)
 ***********************************************/

const FHSH = {
  expectedMove: null,
  lastTrade: null,
  trades: []
};

/************************************************
 * HELPERS
 ***********************************************/
function normalizeSymbol(symbol) {
  return String(symbol || "")
    .toLowerCase()
    .replace(" mini", "")
    .replace("micro ", "")
    .replace(/\s+/g, "")
    .trim();
}

function syncSymbols(value) {
  const em = document.getElementById("expectedSymbol");
  const trade = document.getElementById("contract");
  if (em && em.value !== value) em.value = value;
  if (trade && trade.value !== value) trade.value = value;
}

document.getElementById("expectedSymbol")
  ?.addEventListener("change", e => syncSymbols(e.target.value));

document.getElementById("contract")
  ?.addEventListener("change", e => syncSymbols(e.target.value));

const CONTRACT_SYMBOL_MAP = {
  GOLD_MINI: "gold",
  SILVER_MICRO: "silver"
};

/************************************************
 * SNAPSHOT HELPERS
 ***********************************************/
function getValidMarketSnapshots() {
  try {
    return (JSON.parse(localStorage.getItem("cj_trader_snapshots")) || [])
      .filter(r =>
        r.date &&
        Number.isFinite(Number(r.open)) &&
        Number.isFinite(Number(r.close))
      );
  } catch {
    return [];
  }
}

function countUniqueDays(rows) {
  return new Set(rows.map(r => r.date)).size;
}

function getMonthFromSnapshots(rows) {
  if (!rows.length) return "—";
  const d = new Date(rows[0].date);
  return d.toLocaleString("default", { month: "long", year: "numeric" });
}

function getSessionRows(source, symbol) {
  const target = CONTRACT_SYMBOL_MAP[symbol] || normalizeSymbol(symbol);
  return source.filter(r => {
    const snapSymbol = normalizeSymbol(r.symbolType || r.symbol || "");
    return snapSymbol === target;
  });
}

/************************************************
 * EXPECTED MOVE
 ***********************************************/
function applyExpectedGap(rows, label) {
  let gaps = [];
  let high = -Infinity;
  let low = Infinity;
  let buy = 0;
  let sell = 0;

  rows.forEach(r => {
    const o = Number(r.open);
    const c = Number(r.close);
    if (!Number.isFinite(o) || !Number.isFinite(c)) return;

    let gap = Math.abs(c - o);
    if (gap > 8000) gap = Math.round(gap / 10);
    if (gap < 10 || gap > 3000) return;

    gaps.push(gap);
    high = Math.max(high, o, c);
    low = Math.min(low, o, c);

    if (r.trend === "Buy") buy++;
    if (r.trend === "Sell") sell++;
  });

  if (gaps.length < 10) {
    alert("Expected Move data invalid");
    FHSH.expectedMove = null;
    return;
  }

  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  FHSH.expectedMove =
    gaps.length % 2 ? gaps[mid] : Math.round((gaps[mid - 1] + gaps[mid]) / 2);

  document.getElementById("expectedMoveSourceText").textContent =
    `Source: ${label}`;
  document.getElementById("jsonStatus").textContent =
    label.includes("JSON")
      ? "JSON loaded successfully"
      : "Using Market Snapshot data";

  document.getElementById("emMonth").textContent = getMonthFromSnapshots(rows);
  document.getElementById("emTrades").textContent = rows.length;
  document.getElementById("emBuy").textContent = buy;
  document.getElementById("emSell").textContent = sell;
  document.getElementById("emHigh").textContent = high;
  document.getElementById("emLow").textContent = low;
  document.getElementById("emValue").textContent = FHSH.expectedMove;
}

function refreshExpectedMoveFromTable() {
  const symbol = document.getElementById("expectedSymbol")?.value;
  if (!symbol) return alert("Select symbol");

  const snaps = getValidMarketSnapshots();
  const rows = getSessionRows(snaps, symbol);

  if (countUniqueDays(rows) < 10)
    return alert("Need at least 10 trading days");

  applyExpectedGap(rows, "Trades Table (Auto – Market Open & Close)");
}

function setupExpectedMove() {
  const jsonInput = document.getElementById("expectedJsonFile");
  const symbolEl = document.getElementById("expectedSymbol");
  const loadBtn = document.getElementById("loadExpectedMoveBtn");

  loadBtn?.addEventListener("click", () => {
    if (!symbolEl.value) return alert("Select symbol");
    if (!jsonInput.files.length) return alert("Upload Monthly JSON");

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        const snaps = Array.isArray(json.snapshots) ? json.snapshots : json;
        const rows = getSessionRows(snaps, symbolEl.value);

        if (countUniqueDays(rows) < 10)
          return alert("Need at least 10 days");

        applyExpectedGap(rows, `Monthly JSON (${getMonthFromSnapshots(rows)})`);
      } catch {
        alert("Invalid JSON");
      }
    };
    reader.readAsText(jsonInput.files[0]);
  });
}

/************************************************
 * ANALYZE
 ***********************************************/
function autoAnalyzeTrade() {
  if (!Number.isFinite(FHSH.expectedMove)) return;

  const opening = Number(document.getElementById("openingPoint").value);
  const entry = Number(document.getElementById("currentPoint").value);
  const trend = document.getElementById("trend").value;
  const session = document.getElementById("session").value;
  const symbol = document.getElementById("contract").value;

  if (!opening || !entry) return;

  const gap = Math.round(FHSH.expectedMove);

  let target, stoploss;
  if (trend === "BUY") {
    target = entry + gap;
    stoploss = Math.max(opening, entry - Math.round(gap / 2));
  } else {
    target = entry - gap;
    stoploss = Math.min(opening, entry + Math.round(gap / 2));
  }

  document.getElementById("outEntry").textContent = entry;
  document.getElementById("outTarget").textContent = target;
  document.getElementById("outSL").textContent = stoploss;
  document.getElementById("outConfidence").textContent =
    gap >= 300 ? "HIGH" : "NORMAL";
  document.getElementById("outSummary").textContent =
    `${session} | ${trend} | Entry ${entry} | EM ${gap}`;

  FHSH.lastTrade = {
    date: document.getElementById("tradeDate").value,
    time: new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
    symbol,
    entry,
    target,
    stoploss,
    trend
  };
}








function printFHSHTableIsolated() {
  const original = document.querySelector("#fhshPrintArea table");
  if (!original) {
    alert("Table not found");
    return;
  }

  // Clone table so UI is untouched
  const table = original.cloneNode(true);

  // Columns to REMOVE (0-based)
  const removeCols = [7, 9]; // Outcome, Action

  // Remove header cells
  removeCols.slice().reverse().forEach(i => {
    table.querySelectorAll("thead tr th")[i]?.remove();
  });

  // Remove body cells
  table.querySelectorAll("tbody tr").forEach(row => {
    removeCols.slice().reverse().forEach(i => {
      row.children[i]?.remove();
    });
  });

  // Clean result column text (remove colors if any)
  table.querySelectorAll("td").forEach(td => {
    td.style.color = "#000";
  });

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>FH / SH Trades</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 12mm;
          color: #000;
        }

        h2 {
          text-align: center;
          margin-bottom: 12px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        th {
          background: #f0f0f0;
          font-weight: bold;
        }

        th, td {
          border: 1px solid #000;
          padding: 6px 8px;
          text-align: center;
          white-space: nowrap;
        }
      </style>
    </head>
    <body>
      <h2>FH / SH Trades</h2>
      ${table.outerHTML}
    </body>
    </html>
  `);
  doc.close();

  iframe.contentWindow.focus();
  iframe.contentWindow.print();

  setTimeout(() => {
    document.body.removeChild(iframe);
  }, 1000);
}


















/************************************************
 * SAVE + TABLE
 ***********************************************/
function saveFHSHSnapshot() {
  if (!FHSH.lastTrade) return alert("Analyze trade first");
  FHSH.trades.push(FHSH.lastTrade);
  persistFHSH();
  FHSH.lastTrade = null;
  renderFHSHTable();
}

function renderFHSHTable() {
  const tbody = document.getElementById("tradeTableBody");
  tbody.innerHTML = "";

  FHSH.trades.forEach((t, i) => {
    const points = t.trend === "BUY" ? t.target - t.entry : t.entry - t.target;

    tbody.innerHTML += `
      <tr>
        <td>${t.date}</td>
        <td>${t.time}</td>
        <td>${t.symbol.replace("_", " ")}</td>
        <td>${t.entry}</td>
        <td>${t.target}</td>
        <td>${t.stoploss}</td>
        <td>${points}</td>
        <td>
          <select class="form-select form-select-sm fhsh-outcome" data-index="${i}">
            <option value="">--</option>
            <option value="WIN">WIN</option>
            <option value="LOSS">LOSS</option>
          </select>
        </td>
        <td class="fhsh-result">—</td>
        <td>
          <button class="btn btn-sm text-danger fw-bold border-0" data-index="${i}">×</button>
        </td>
      </tr>`;
  });

  wireFHSHOutcome();
  wireFHSHDelete();
}

function wireFHSHOutcome() {
  document.querySelectorAll(".fhsh-outcome").forEach(sel => {
    sel.onchange = e => {
      const cell = e.target.closest("tr").querySelector(".fhsh-result");
      if (e.target.value === "WIN") {
        cell.textContent = "SUCCESS";
        cell.style.color = "green";
      } else if (e.target.value === "LOSS") {
        cell.textContent = "FAILURE";
        cell.style.color = "red";
      } else {
        cell.textContent = "—";
        cell.style.color = "";
      }
    };
  });
}

function wireFHSHDelete() {
  document.querySelectorAll("#tradeTableBody button").forEach(btn => {
    btn.onclick = e => {
      const index = Number(e.target.dataset.index);

      window.confirmAction("Delete FH / SH trade?", () => {
        FHSH.trades.splice(index, 1);
        persistFHSH();
        renderFHSHTable();
        showToast("FH / SH trade deleted", "danger");
      });
    };
  });
}

function persistFHSH() {
  localStorage.setItem("cj_fhsh_trades", JSON.stringify(FHSH.trades));
}

function loadFHSHFromStorage() {
  const saved = JSON.parse(localStorage.getItem("cj_fhsh_trades") || "[]");
  FHSH.trades = saved;
  renderFHSHTable();
}

/************************************************
 * EXPORT PDF
 ***********************************************/
function exportFHSHPDF() {
  if (!FHSH.trades.length) {
    alert("No FH / SH trades to export");
    return;
  }

  document.body.classList.remove("print-srb");
  document.body.classList.add("fhsh-print");

  setTimeout(() => {
    printFHSHTableIsolated();
    document.body.classList.remove("fhsh-print");
  }, 300);
}

/************************************************
 * DOM READY
 ***********************************************/
document.addEventListener("DOMContentLoaded", () => {

  loadFHSHFromStorage();
  setupExpectedMove();

  document.getElementById("refreshExpectedMoveBtn")
    ?.addEventListener("click", refreshExpectedMoveFromTable);

  document.getElementById("analyzeBtn")
    ?.addEventListener("click", autoAnalyzeTrade);

  document.getElementById("currentPoint")
    ?.addEventListener("input", autoAnalyzeTrade);

  document.getElementById("saveFHSHBtn")
    ?.addEventListener("click", saveFHSHSnapshot);

  const pdfBtn = document.getElementById("fhshExportPDF");
  if (pdfBtn) {
    pdfBtn.addEventListener("click", exportFHSHPDF);
    console.log("FHSH Export PDF wired");
  }
});
