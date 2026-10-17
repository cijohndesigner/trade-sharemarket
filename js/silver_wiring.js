/* ===============================
   SILVER MICRO CALCULATION (ISOLATED)
   Prefix: silvm_
   Does NOT touch Gold logic
   =============================== */

let silvmSide = 'BUY';

function silvmNum(id){
  return Number(document.getElementById(id)?.value) || 0;
}

function silvmSet(id,val){
  const el = document.getElementById(id);
  if(el) el.textContent = val ?? '';
}





const silvmBuyBtn  = document.getElementById('silvmBuyBtn');
const silvmSellBtn = document.getElementById('silvmSellBtn');

silvmBuyBtn?.addEventListener('click', () => {
  silvmSide = 'BUY';

  silvmBuyBtn.classList.add('active');
  silvmSellBtn.classList.remove('active');

  calculateSilvm();
});

silvmSellBtn?.addEventListener('click', () => {
  silvmSide = 'SELL';

  silvmSellBtn.classList.add('active');
  silvmBuyBtn.classList.remove('active');

  calculateSilvm();
});





function calculateSilvm(){

  const h1=silvmNum('silvm_h1'), h2=silvmNum('silvm_h2'),
        h3=silvmNum('silvm_h3'), h4=silvmNum('silvm_h4');
  const l1=silvmNum('silvm_l1'), l2=silvmNum('silvm_l2'),
        l3=silvmNum('silvm_l3'), l4=silvmNum('silvm_l4');

  const highs = [h1, h2, h3, h4].filter(v => v > 0);
const lows  = [l1, l2, l3, l4].filter(v => v > 0);

// 2-Day (last 2 available)
const last2Highs = highs.slice(-2);
const last2Lows  = lows.slice(-2);

const HH2 = last2Highs.length ? Math.max(...last2Highs) : 0;
const LL2 = last2Lows.length  ? Math.min(...last2Lows)  : 0;

// 4-Day (all available)
const HH4 = highs.length ? Math.max(...highs) : 0;
const LL4 = lows.length  ? Math.min(...lows)  : 0;





if (!highs.length || !lows.length) return;


 

  silvmSet('silvm_hh2', HH2 || 0);
silvmSet('silvm_ll2', LL2 || 0);
silvmSet('silvm_hh4', HH4 || 0);
silvmSet('silvm_ll4', LL4 || 0);

  let entry, target, sl1, sl2;

 if (silvmSide === 'BUY') {

  entry  = Math.round(HH4 * 1.0012);
  target = Math.round(entry * 1.02);

  const slEntry  = Math.round(entry * 0.98);   // SL2
  const slRecent = Math.round(LL2 * 0.9988);   // recent based

  sl1 = Math.max(slEntry, slRecent);
  sl2 = slEntry;

} else {

  entry  = Math.round(LL4 * 0.9988);
  target = Math.round(entry * 0.98);

  const slEntry  = Math.round(entry * 1.02);   // SL2
  const slRecent = Math.round(HH2 * 1.0012);

  sl1 = Math.min(slEntry, slRecent);
  sl2 = slEntry;
}

  silvmSet('silvm_entry', entry);
  silvmSet('silvm_target', target);
  silvmSet('silvm_sl1', sl1 || 0);
silvmSet('silvm_sl2', sl2 || 0);
}

// Inputs


//[
 //'silvm_h1','silvm_h2','silvm_h3','silvm_h4',
//'silvm_l1','silvm_l2','silvm_l3','silvm_l4'
//].forEach(id=>{
 // document.getElementById(id)?.addEventListener('input', calculateSilvm);
//});


// Buttons
document.getElementById('silvmBuyBtn')?.addEventListener('click',()=>{
  silvmSide='BUY';
  calculateSilvm();
});

document.getElementById('silvmSellBtn')?.addEventListener('click',()=>{
  silvmSide='SELL';
  calculateSilvm();
});


function checkSilvmDate(){
  const d = document.getElementById("silvmCalcDate");
  const w = document.getElementById("silvmDateWarning");
  if(!d || !w) return;

  const today = new Date().toISOString().slice(0,10);
  w.textContent =
    (d.value && d.value !== today)
      ? `⚠ Levels are for ${d.value}`
      : "";
}

document.addEventListener("input", function(){
  calculateSilvm();
  checkSilvmDate();
});

document.addEventListener("change", function(){
  calculateSilvm();
  checkSilvmDate();
});

document.addEventListener("DOMContentLoaded", function(){
  calculateSilvm();
  checkSilvmDate();
});

document.addEventListener('DOMContentLoaded', () => {
  silvmSet('silvm_entry', 0);
  silvmSet('silvm_target', 0);
  silvmSet('silvm_sl1', 0);
  silvmSet('silvm_sl2', 0);
  silvmSet('silvm_hh2', 0);
  silvmSet('silvm_ll2', 0);
  silvmSet('silvm_hh4', 0);
  silvmSet('silvm_ll4', 0);
});