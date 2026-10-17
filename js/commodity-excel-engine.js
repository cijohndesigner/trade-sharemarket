
(function () {
  function MROUND(v, m) { return Math.round(v / m) * m; }
  function el(id){ return document.getElementById(id); }
  function n(id){ return Number(el(id)?.value) || 0; }

  function setImpact(id, val) {
  const left = el(id);
  if (left) left.textContent = val;

  const row = left?.closest(".impact-row");
  const right = row?.querySelector(".impact-value");
  if (right) right.textContent = val;
}

function out(e,t,s1,s2){
    el("outEntry") && (el("outEntry").textContent = e);
    el("outCommodityTarget") && (el("outCommodityTarget").textContent = t);
    el("outSL1") && (el("outSL1").textContent = s1);
    el("outSL2") && (el("outSL2").textContent = s2);
  }

  function calc(){
    const h1=n("day1High"), l1=n("day1Low");
    const h2=n("day2High"), l2=n("day2Low");
    const h3=n("day3High"), l3=n("day3Low");
    const h4=n("day4High"), l4=n("day4Low");

    // ===== FIX: Excel-style rolling 2-Day HH / LL (ONLY CHANGE) =====
    const days = [
      { h: h1, l: l1 },
      { h: h2, l: l2 },
      { h: h3, l: l3 },
      { h: h4, l: l4 }
    ].filter(d => d.h > 0 && d.l > 0);

    let HH2 = 0, LL2 = 0;
    if (days.length >= 2) {
      const last2 = days.slice(-2);
      HH2 = Math.max(last2[0].h, last2[1].h);
      LL2 = Math.min(last2[0].l, last2[1].l);
    }
    const HH4 = Math.max(h1,h2,h3,h4);
    const LL4 = Math.min(l1,l2,l3,l4);
    const RECENT_LL = Math.min(l3,l4);
    const RECENT_HH = Math.max(h3,h4);

    el("out2DHH") && (el("out2DHH").textContent = HH2);
    el("out2DLL") && (el("out2DLL").textContent = LL2);
    el("out4DHH") && (el("out4DHH").textContent = HH4);
    el("out4DLL") && (el("out4DLL").textContent = LL4);

    // Buy/Sell based on active chip
    const isBuy = el("commodityBuyBtn")?.classList.contains("active");

    if(isBuy){
      const entry = MROUND(HH4 * 1.0012, 1);
      const target = MROUND(entry * 1.015, 1);
      const sl1 = MROUND(Math.max(entry * 0.985, RECENT_LL * 0.9988), 1);
      const sl2 = MROUND(entry * 0.985, 1);
      out(entry,target,sl1,sl2);
    } else {
      const entry = MROUND(LL4 * 0.9988, 1);
      const target = MROUND(entry * 0.985, 1);
      const sl1 = MROUND(Math.min(entry * 1.015, RECENT_HH * 1.0012), 1);
      const sl2 = MROUND(entry * 1.015, 1);
      out(entry,target,sl1,sl2);
    }
  }

  function checkDate(){
    const d = el("commodityCalcDate");
    const w = el("commodityDateWarning");
    if(!d || !w) return;
    const today = new Date().toISOString().slice(0,10);
    w.textContent = (d.value && d.value !== today) ? `⚠ Levels are for ${d.value}` : "";
  }

  document.addEventListener("input", function(){ calc(); checkDate(); });
  document.addEventListener("change", function(){ calc(); checkDate(); });
  document.addEventListener("DOMContentLoaded", function(){ calc(); checkDate(); });

// === FIX: ensure Buy/Sell triggers recalculation ===
document.addEventListener("DOMContentLoaded", function () {
  const buyBtn = document.getElementById("commodityBuyBtn");
  const sellBtn = document.getElementById("commoditySellBtn");

  function activateBuy() {
    buyBtn?.classList.add("active");
    sellBtn?.classList.remove("active");
    if (typeof calc === "function") calc();
  }

  function activateSell() {
    sellBtn?.classList.add("active");
    buyBtn?.classList.remove("active");
    if (typeof calc === "function") calc();
  }

  buyBtn && buyBtn.addEventListener("click", activateBuy);
  sellBtn && sellBtn.addEventListener("click", activateSell);
});

})();

