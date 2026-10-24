
document.addEventListener("DOMContentLoaded", () => {

  const table = document.querySelector(".gap-history-table");
  const trendDateInput = document.getElementById("trendBiasDate");

  function parseRow(row) {
    const c = row.querySelectorAll("td");
    return {
      date: c[0]?.innerText.trim(),
      pair: c[1]?.innerText.trim(),
      fxMove: parseFloat(c[4]?.innerText),
      fxPercent: parseFloat(c[5]?.innerText),
      estGap: parseFloat(c[7]?.innerText),
      estOpen: parseFloat(c[8]?.innerText),
      marketView: c[c.length-2]?.innerText.trim() // MARKET VIEW column
    };
  }

  function getLatest() {
    if (!table) return null;
    const rows = table.querySelectorAll("tbody tr");
    if (rows.length === 0) return null;
    return parseRow(rows[rows.length - 1]);
  }

  function getByDate(d) {
    if (!table || !d) return null;
    const rows = table.querySelectorAll("tbody tr");
    for (const r of rows) {
      const rowDate = r.querySelector("td")?.innerText.trim();
      if (rowDate && rowDate.startsWith(d)) {
        return parseRow(r);
      }
    }
    return null;
  }

  function updateUI(d) {
    const hero = document.querySelector(".bias-hero");
    const bar = document.querySelector(".bias-bar-fill");
    const values = document.querySelectorAll(".tb-metric .tb-value");

    if (!hero || !bar) return;

    if (!d) {
      hero.innerText = "No Data Found";
      hero.style.color = "#999";
      bar.style.width = "0%";
      bar.style.background = "#ccc";
      values.forEach(v => v.style.opacity = "0.3");
      return;
    }

    values.forEach(v => v.style.opacity = "1");

    // Bias from MARKET VIEW
    if (d.marketView === "Bullish") {
      hero.innerText = "Bullish";
      hero.style.color = "green";
    } else if (d.marketView === "Bearish") {
      hero.innerText = "Bearish";
      hero.style.color = "red";
    } else {
      hero.innerText = "Neutral";
      hero.style.color = "#777";
    }

    // Directional bar
    const p = Math.min(100, Math.abs(d.fxPercent));
    bar.style.width = p + "%";
    if (d.marketView === "Bearish") {
      bar.style.background = p >= 60 ? "#c0392b" : "#e67e22";
    } else {
      bar.style.background = p >= 60 ? "#2ecc71" : "#f1c40f";
    }

    // Wire numbers by order
    if (values.length >= 4) {
      values[0].innerText = (d.fxMove > 0 ? "▲ " : "▼ ") + d.fxMove.toLocaleString() + " pts";
      values[0].className = "tb-value " + (d.fxMove >= 0 ? "positive" : "negative");

      values[1].innerText = d.fxPercent.toFixed(2) + "%";
      values[1].className = "tb-value " + (d.fxPercent >= 0 ? "positive" : "negative");

      values[2].innerText = "₹ " + d.estGap.toLocaleString();
      values[3].innerText = "₹ " + d.estOpen.toLocaleString();
    }

    // Source
    const sourceEl = document.querySelector(".source-value");
    if (sourceEl) {
      sourceEl.innerText = d.pair + " - " + d.date;
    }
  }

  // Initial load
  updateUI(getLatest());

  if (trendDateInput) {
    trendDateInput.addEventListener("change", e => {
      updateUI(getByDate(e.target.value));
    });
  }
});
