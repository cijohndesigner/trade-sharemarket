/* ===============================
   SRB – Session Reflection Breakout
   CLEAN + LOCKED VERSION
   STORAGE-SAFE
================================ */

let srbRowToDelete = null;
window.srbLastAnalysisResult = null;

/* ===============================
   RESULT FROM OUTCOME (FINAL)
================================ */
function getFinalResultFromOutcome(outcome) {
  if (!outcome) return "—";

  const value = outcome.trim().toUpperCase();

  if (value === "WIN") return "SUCCESS";
  if (value === "LOSS") return "FAILURE";
  if (value === "BE") return "NEUTRAL";

  return "—";
}

function getResultClass(outcome) {
  if (!outcome) return "";

  const value = outcome.trim().toUpperCase();

  if (value === "WIN") return "srb-success";
  if (value === "LOSS") return "srb-failure";
  if (value === "BE") return "srb-neutral";

  return "";
}
/* ===============================
   STORAGE HELPERS (NO localStorage)
================================ */
function loadSRB() {
  const list = window.getSRBSnapshots ? window.getSRBSnapshots() : [];

  // 🔥 MIGRATION: add missing IDs to old rows
  let changed = false;

  list.forEach(r => {
    if (!r.id) {
      r.id =
        "srb_" +
        Date.now() +
        "_" +
        Math.random().toString(36).slice(2);
      changed = true;
    }
  });

  if (changed) {
    saveSRB(list); // persist fixed rows
  }

  return list;
}


function saveSRB(list) {
  if (window.setSRBSnapshots) {
    window.setSRBSnapshots(list);
  }
}

/* ===============================
   MAIN ENTRY
================================ */
document.addEventListener("DOMContentLoaded", () => {
  startTime();
  updateMarketSession();
  initSRB();
  initSRBSaveSnapshot();
  renderSRBTable(loadSRB());
  //initSRBCSVExport();
  //initSRBPDFExport();
});

/* ===============================
   TIME
================================ */
function startTime() {
  const el = document.getElementById("currentTime");
  if (!el) return;
  const tick = () => {
    el.innerText = new Date().toLocaleTimeString("en-IN");
  };
  tick();
  setInterval(tick, 1000);
}

/* ===============================
   MARKET SESSION
================================ */
function updateMarketSession() {
  const el = document.getElementById("marketSessionStatus");
  if (!el) return;

  const hour = new Date().getHours();
  let text = "Market Closed";
  let color = "#dc2626";

  if (hour >= 8 && hour < 16) {
    text = "London Session (Running)";
    color = "#2563eb";
  } else if (hour >= 18 && hour < 23) {
    text = "New York Session (Running)";
    color = "#16a34a";
  }

  el.innerText = text;
  el.style.color = color;
}
setInterval(updateMarketSession, 60000);

/* ===============================
   HELPERS
================================ */
function getStatus(points) {
  if (points >= 50) return "HIGH";
  if (points >= 20) return "OK";
  return "LOW";
}

function getMomentum(points) {
  if (points >= 50) return "FAST";
  if (points >= 20) return "OK";
  return "SLOW";
}

function getSRBDate() {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit"
  });
}

/* ===============================
   SRB ANALYSIS
================================ */
function initSRB() {
  const openEl = document.getElementById("srb-open-price");
  const currentEl = document.getElementById("srb-current-price");
  const pointsEl = document.getElementById("srb-points");
  const trendEl = document.getElementById("srb-trend");
  const statusEl = document.getElementById("srb-momentum");
  const resultEl = document.getElementById("srb-result");
  const arrowEl = document.getElementById("srb-arrow");
  const tp1El = document.getElementById("srb-tp1");
  const tp2El = document.getElementById("srb-tp2");
  const slEl  = document.getElementById("srb-sl");
  const analyzeBtn = document.getElementById("analyzeBtn");
  if (!analyzeBtn) return;

  function updateLeft() {
    const open = parseFloat(openEl.value);
    const current = parseFloat(currentEl.value);
    if (isNaN(open) || isNaN(current)) return;
    const pts = current - open;
    pointsEl.innerText = pts.toFixed(2);
    trendEl.innerText = pts >= 0 ? "BUY" : "SELL";
    statusEl.innerText = getStatus(Math.abs(pts));
  }

  openEl.addEventListener("input", updateLeft);
  currentEl.addEventListener("input", updateLeft);

  analyzeBtn.addEventListener("click", () => {
    const open = parseFloat(openEl.value);
    const current = parseFloat(currentEl.value);
    if (isNaN(open) || isNaN(current)) {
      alert("Enter Open & Current price");
      return;
    }

    const pts = current - open;
    const trend = pts >= 0 ? "BUY" : "SELL";
    const momentum = getMomentum(Math.abs(pts));
    const tf = document.getElementById("timeframe").value;
    const session = document.getElementById("sessionScope").value;
    const mode = document.getElementById("analysisMode").value;

    let sessionControl = "No Session Control";
    if (momentum === "FAST") sessionControl = session + " Dominant";
    else if (momentum === "OK") sessionControl = session + " Active";

    let marketIntent =
      momentum === "FAST" ? "Confirmed" :
      momentum === "OK" ? "Weak" : "Failed";

    let finalResult = trend;
    if (marketIntent === "Failed") finalResult = "NO TRADE";
    if (mode === "Strict" && marketIntent !== "Confirmed")
      finalResult = "NO TRADE";

    let confidence = "MEDIUM";
    if (finalResult === "NO TRADE") confidence = "LOW";
    else if (marketIntent === "Confirmed" && sessionControl.includes("Dominant"))
      confidence = "HIGH";

    resultEl.className = "";

// set text
resultEl.textContent = finalResult;

// apply color class
if (finalResult === "BUY") {
  resultEl.classList.add("srb-result-buy");
} else if (finalResult === "SELL") {
  resultEl.classList.add("srb-result-sell");
} else {
  resultEl.classList.add("srb-result-nt");
}

// arrow
arrowEl.textContent =
  finalResult === "BUY" ? "▲" :
  finalResult === "SELL" ? "▼" : "–";

    document.getElementById("confidence").innerText = confidence;
    document.getElementById("sessionControl").innerText = sessionControl;
    document.getElementById("marketIntent").innerText = marketIntent;
    document.getElementById("srb-summary").innerText =
      `TF ${tf} | Momentum ${momentum} | ${sessionControl}`;

    tp1El.innerText = tp2El.innerText = slEl.innerText = "—";

    if (finalResult !== "NO TRADE") {
      const TP1 = 50, TP2 = 100, SL = 40;
      if (finalResult === "BUY") {
        tp1El.innerText = (current + TP1).toFixed(2);
        tp2El.innerText = (current + TP2).toFixed(2);
        slEl.innerText  = (current - SL).toFixed(2);
      } else {
        tp1El.innerText = (current - TP1).toFixed(2);
        tp2El.innerText = (current - TP2).toFixed(2);
        slEl.innerText  = (current + SL).toFixed(2);
      }
    }

    window.srbLastAnalysisResult = {
      date: getSRBDate(),
      session,
      result: finalResult,
      confidence,
      trend,
      points: pts.toFixed(2)
    };
  });
}

/* ===============================
   SAVE SNAPSHOT
================================ */
function initSRBSaveSnapshot() {
  const btn = document.getElementById("srb-saveSnapshot");
  if (!btn) return;

  btn.addEventListener("click", () => {
    if (!window.srbLastAnalysisResult) {
      alert("Run Analyze SRB first");
      return;
    }
    if (window.srbLastAnalysisResult.result === "NO TRADE") {
      alert("NO TRADE cannot be saved");
      return;
    }

    const list = loadSRB();
    list.unshift({
  id: "srb_" + Date.now(),
  ...window.srbLastAnalysisResult,
  outcome: "Pending"
});
    saveSRB(list);
    renderSRBTable(list);
  });
}

/* ===============================
   TABLE
================================ */
function renderSRBTable(data = []) {
  const tbody = document.getElementById("srbTableBody");
  if (!tbody) {
    console.error("SRB screen table body not found");
    return;
  }
  

  tbody.innerHTML = "";

  data.forEach(row => {
    const tr = document.createElement("tr");
    tr.dataset.id = row.id;

    const resultClass =
      row.result === "BUY"
        ? "print-buy"
        : row.result === "SELL"
        ? "print-sell"
        : "";

    tr.innerHTML = `
      <td>${row.date || "-"}</td>
      <td>${row.session || "-"}</td>
      
      <td>${row.confidence || "-"}</td>
      <td class="${resultClass}">${row.trend || "-"}</td>
      <td>${row.points || "-"}</td>
      <td>
  <select class="srb-outcome" data-id="${row.id}">
    <option value="Pending" ${row.outcome === "Pending" ? "selected" : ""}>Pending</option>
    <option value="WIN" ${row.outcome === "WIN" ? "selected" : ""}>WIN</option>
    <option value="LOSS" ${row.outcome === "LOSS" ? "selected" : ""}>LOSS</option>
    <option value="BE" ${row.outcome === "BE" ? "selected" : ""}>BE</option>
  </select>
</td>

<td class="${getResultClass(row.outcome)}">
  ${getFinalResultFromOutcome(row.outcome)}
</td>
      <td>
        <button class="srb-delete-btn">✕</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

document.addEventListener("change", e => {
  if (!e.target.classList.contains("srb-outcome")) return;

  const id = e.target.dataset.id;
  const value = e.target.value;

  let list = loadSRB();
  const row = list.find(r => r.id === id);
  if (!row) return;

  row.outcome = value;
  saveSRB(list);
  renderSRBTable(list);
});

/* ===============================
   DELETE ROW
================================ */
document.addEventListener("click", e => {
  if (!e.target.classList.contains("srb-delete-btn")) return;

  const tr = e.target.closest("tr");
  if (!tr) return;

  if (!confirm("Delete this SRB snapshot?")) return;

  const id = tr.dataset.id;
  if (!id) return;

  let list = loadSRB();
  list = list.filter(r => r.id !== id);

  saveSRB(list);
  renderSRBTable(list);
});




// ===============================
// STEP 3: CLEAN PRINT (TABLE ONLY)
// ===============================
document.getElementById("srbExportPDF")?.addEventListener("click", () => {

  const table = document.querySelector(".srb-table");
  if (!table) {
    alert("No SRB data to print");
    return;
  }

  // 1️⃣ clone table (so screen UI is untouched)
  const clone = table.cloneNode(true);
  
  
  
  // find OUTCOME column index
let outcomeIndex = -1;
const headerCells = clone.querySelectorAll("thead th");

headerCells.forEach((th, i) => {
  if (th.innerText.trim().toUpperCase() === "OUTCOME") {
    outcomeIndex = i;
  }
});



// remove OUTCOME column (header + rows)
if (outcomeIndex !== -1) {

  // remove OUTCOME header
  clone.querySelectorAll("thead tr").forEach(tr => {
    tr.children[outcomeIndex]?.remove();
  });

  // remove OUTCOME cells
  clone.querySelectorAll("tbody tr").forEach(tr => {
    tr.children[outcomeIndex]?.remove();
  });

}
  

  // 2️⃣ remove ACTION column (last column)
  clone.querySelectorAll("tr").forEach(row => {
    row.lastElementChild?.remove();
  });

  // 3️⃣ create hidden iframe
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;

  // 4️⃣ write clean print HTML
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>SRB Export</title>
      <style>
        @page { size: A4 portrait; margin: 16mm; }

        body {
          font-family: Arial, Helvetica, sans-serif;
          color: #000;
        }

        h3 {
          margin: 0 0 4px 0;
          font-size: 14px;
        }

        .print-date {
          font-size: 11px;
          margin-bottom: 10px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          border: 1px solid #000;
          padding: 6px;
          font-size: 12px;
          text-align: center;
        }

        th {
          background: #e9edf2;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <h3>SRB – Session Reflection Breakout</h3>
      <div class="print-date">
        Printed on: ${new Date().toLocaleString()}
      </div>

      ${clone.outerHTML}
    </body>
    </html>
  `);
  doc.close();

  // 5️⃣ print & cleanup
  iframe.contentWindow.focus();
  iframe.contentWindow.print();

  setTimeout(() => iframe.remove(), 400);
});


