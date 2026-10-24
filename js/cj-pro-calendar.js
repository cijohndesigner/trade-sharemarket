/* CJ Pro Calendar — isolated enhancement for native date fields. */
(() => {
  'use strict';
  const NS = 'cj-pro-calendar';
  let active = null;
  let viewDate = new Date();
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseISO = s => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null;
    const [y,m,d] = s.split('-').map(Number);
    const date = new Date(y,m-1,d);
    return date.getFullYear()===y && date.getMonth()===m-1 && date.getDate()===d ? date : null;
  };
  const todayISO = () => iso(new Date());
  const picker = document.createElement('div');
  picker.className = `${NS}-panel`;
  picker.setAttribute('role','dialog');
  picker.setAttribute('aria-label','Choose date');
  picker.hidden = true;
  picker.innerHTML = `
    <div class="${NS}-header">
      <button type="button" class="${NS}-month" aria-label="Choose month and year"></button>
      <div class="${NS}-nav"><button type="button" data-step="-1" aria-label="Previous month">‹</button><button type="button" data-step="1" aria-label="Next month">›</button></div>
    </div>
    <div class="${NS}-week" aria-hidden="true"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
    <div class="${NS}-days"></div>
    <div class="${NS}-footer"><button type="button" data-action="clear">Clear</button><button type="button" data-action="today">Today</button></div>`;
  document.body.appendChild(picker);
  const monthBtn = picker.querySelector(`.${NS}-month`);
  const daysEl = picker.querySelector(`.${NS}-days`);

  function dispatchDate(input) {
    input.dispatchEvent(new Event('input', {bubbles:true}));
    input.dispatchEvent(new Event('change', {bubbles:true}));
  }
  function isAllowed(date, input) {
    const key = iso(date);
    return (!input.min || key >= input.min) && (!input.max || key <= input.max);
  }
  function render() {
    if (!active) return;
    monthBtn.textContent = viewDate.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    daysEl.innerHTML = '';
    const y=viewDate.getFullYear(), m=viewDate.getMonth();
    const first = new Date(y,m,1);
    const offset = (first.getDay()+6)%7;
    const start = new Date(y,m,1-offset);
    const selected = active.value;
    for (let i=0;i<42;i++) {
      const d = new Date(start.getFullYear(),start.getMonth(),start.getDate()+i);
      const b = document.createElement('button');
      b.type='button'; b.className=`${NS}-day`;
      b.textContent=String(d.getDate());
      b.dataset.date=iso(d);
      if (d.getMonth()!==m) b.classList.add('is-outside');
      if (iso(d)===selected) { b.classList.add('is-selected'); b.setAttribute('aria-pressed','true'); }
      if (iso(d)===todayISO()) b.classList.add('is-today');
      if (!isAllowed(d,active)) { b.disabled=true; b.classList.add('is-disabled'); }
      daysEl.appendChild(b);
    }
    position();
  }
  function position() {
    if (!active || picker.hidden) return;
    const r = active.getBoundingClientRect();
    const vv = window.visualViewport;
    const viewportLeft = vv ? vv.offsetLeft : 0;
    const viewportTop = vv ? vv.offsetTop : 0;
    const viewportWidth = vv ? vv.width : window.innerWidth;
    const viewportHeight = vv ? vv.height : window.innerHeight;
    const margin = 12;
    const width = Math.min(304, Math.max(240, viewportWidth - margin * 2));
    picker.style.width = `${width}px`;
    picker.style.maxHeight = `${Math.max(220, viewportHeight - margin * 2)}px`;
    picker.style.overflowY = 'auto';
    const h = Math.min(picker.scrollHeight || 360, viewportHeight - margin * 2);
    const anchorLeft = r.left - viewportLeft;
    const anchorTop = r.top - viewportTop;
    const anchorBottom = r.bottom - viewportTop;
    const left = viewportLeft + Math.max(margin, Math.min(anchorLeft, viewportWidth - width - margin));
    const roomBelow = viewportHeight - anchorBottom - 8 - margin;
    const roomAbove = anchorTop - 8 - margin;
    let top;
    if (roomBelow >= Math.min(h, 300) || roomBelow >= roomAbove) {
      top = viewportTop + anchorBottom + 8;
      if (roomBelow < h) picker.style.maxHeight = `${Math.max(180, roomBelow)}px`;
    } else {
      top = viewportTop + anchorTop - h - 8;
      if (roomAbove < h) {
        top = viewportTop + margin;
        picker.style.maxHeight = `${Math.max(180, viewportHeight - margin * 2)}px`;
      }
    }
    top = Math.max(viewportTop + margin, Math.min(top, viewportTop + viewportHeight - Math.min(h, viewportHeight - margin * 2) - margin));
    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
  }
  function open(input) {
    if (active===input && !picker.hidden) { close(); return; }
    active=input;
    const selected=parseISO(input.value);
    const base=selected || parseISO(input.min) || new Date();
    viewDate=new Date(base.getFullYear(),base.getMonth(),1);
    picker.hidden=false;
    input.setAttribute('aria-haspopup','dialog'); input.setAttribute('aria-expanded','true');
    render();
  }
  function close() {
    if (active) active.setAttribute('aria-expanded','false');
    picker.hidden=true; active=null;
  }
  picker.addEventListener('click', e => {
    const step=e.target.closest('[data-step]');
    if (step) { viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()+Number(step.dataset.step),1); render(); return; }
    const day=e.target.closest('[data-date]');
    if (day && active && !day.disabled) { active.value=day.dataset.date; dispatchDate(active); close(); active.focus({preventScroll:true}); return; }
    const action=e.target.closest('[data-action]');
    if (action && active) {
      if (action.dataset.action==='today') { const t=todayISO(); if ((!active.min||t>=active.min)&&(!active.max||t<=active.max)) { active.value=t; dispatchDate(active); } }
      if (action.dataset.action==='clear') { active.value=''; dispatchDate(active); }
      close();
    }
  });
  monthBtn.addEventListener('click',()=>{ if (!active) return; viewDate=new Date(); render(); });
  document.addEventListener('click',e=>{
    if (!active) return;
    if (e.target===active || picker.contains(e.target)) return;
    close();
  });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!picker.hidden) { const old=active; close(); old?.focus({preventScroll:true}); } });
  window.addEventListener('resize',position); window.addEventListener('scroll',position,true);
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', position); window.visualViewport.addEventListener('scroll', position); }
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('input[type="date"]').forEach(input=>{
      input.classList.add(`${NS}-input`);
      input.setAttribute('autocomplete','off');
      input.addEventListener('click',e=>{ e.preventDefault(); open(input); });
      input.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();open(input);} });
      input.addEventListener('focus',()=>input.setAttribute('aria-haspopup','dialog'));
      // Keep the native ISO date value/API intact while the custom picker handles selection.
      input.addEventListener('beforeinput',e=>e.preventDefault());
    });
  });
})();
