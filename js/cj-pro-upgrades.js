/* CJ Pro dashboard enhancements. Read-only with respect to existing trade data. */
(function(){'use strict';
 const KEY='cj_trader_trades'; let page=0, mode='recent', filtered=[];
 const $=id=>document.getElementById(id);
 function readTrades(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch(e){return []}}
 function dateValue(t){return t.date||t.tradeDate||t.createdAt||t.timestamp||''}
 function dateMs(t){const v=dateValue(t);const d=new Date(v);return Number.isNaN(d.getTime())?0:d.getTime()}
 function isRunning(t){const s=String(t.status||t.tradeStatus||t.state||'').toLowerCase();return ['running','open','active','executed','in progress'].includes(s)&&!['completed','closed'].includes(s)}
 function isCompleted(t){const s=String(t.status||t.tradeStatus||t.state||'').toLowerCase();if(['running','open','active','in progress','pending','not executed'].includes(s))return false;return true}
 function todayMatch(t){const d=new Date(dateMs(t));const n=new Date();return dateMs(t)>0&&d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate()}
 function pl(t){for(const k of ['pl','pnl','profitLoss','netPL']){if(t[k]!==undefined&&t[k]!==null&&t[k]!==''&&Number.isFinite(Number(t[k])))return Number(t[k])}return null}
 function side(t){return String(t.side||t.tradeSide||t.type||'').toLowerCase()}
 function symbol(t){return t.symbol||t.instrument||t.customSymbol||'Trade'}
 function money(v){return v===null?'—':(v<0?'−':'')+'₹'+Math.abs(v).toLocaleString('en-IN',{maximumFractionDigits:2})}
 function openModal(title,subtitle,records,which){mode=which;page=0;filtered=records;$('cjProModalTitle').textContent=title;$('cjProModalSubtitle').textContent=subtitle;$('cjProTradesModal').classList.add('cj-pro-open');$('cjProTradesModal').setAttribute('aria-hidden','false');renderPage();}
 function renderPage(){const body=$('cjProTradesModalBody');if(!body)return;body.innerHTML='';const start=page*10;const items=filtered.slice(start,start+10);if(!items.length){body.innerHTML='<div class="cj-pro-empty">No '+(mode==='running'?'running trades':'trade records')+' to display.</div>'}else{const list=document.createElement('div');list.className='cj-pro-trade-list';items.forEach((t,i)=>{const row=document.createElement('div');row.className='cj-pro-trade-row';const info=document.createElement('div');const name=document.createElement('div');name.className='cj-pro-trade-name';name.textContent=symbol(t);const meta=document.createElement('div');meta.className='cj-pro-trade-meta';meta.textContent=(dateValue(t)?new Date(dateMs(t)).toLocaleString():'Date unavailable')+' · '+(t.quantity??t.qty??1)+' qty';info.append(name,meta);const badge=document.createElement('span');const sd=side(t);badge.className='cj-pro-chip '+(sd.includes('sell')?'cj-pro-sell':sd.includes('buy')?'cj-pro-buy':'');badge.textContent=sd.includes('sell')?'SELL':sd.includes('buy')?'BUY':(t.status||t.tradeStatus||'TRADE');const pts=document.createElement('div');const p=pl(t);pts.className='cj-pro-points '+(p>0?'cj-pro-positive':p<0?'cj-pro-negative':'');pts.textContent=p===null?(isRunning(t)?'RUNNING':'—'):money(p);row.append(info,badge,pts);list.appendChild(row)});body.appendChild(list)}$('cjProPageInfo').textContent=filtered.length?`Page ${page+1} · Trades ${start+1}–${Math.min(start+10,filtered.length)} of ${filtered.length}`:'Page 1 · 0 trades';$('cjProPrevPage').disabled=page===0;$('cjProNextPage').disabled=(page+1)*10>=filtered.length;}
 function close(){const m=$('cjProTradesModal');m.classList.remove('cj-pro-open');m.setAttribute('aria-hidden','true')}
 function init(){const trades=readTrades();const sorted=trades.slice().sort((a,b)=>dateMs(b)-dateMs(a));$('cjProTodayCompletedCount').textContent=trades.filter(t=>todayMatch(t)&&isCompleted(t)).length;$('cjProRecentTradesCount').textContent=trades.length;$('cjProRunningTradesCount').textContent=trades.filter(isRunning).length;
 $('cjProTodayCompletedBtn').addEventListener('click',()=>openModal("Today's Completed Trades",'Completed records dated today',sorted.filter(t=>todayMatch(t)&&isCompleted(t)),'today'));
 $('cjProRecentTradesBtn').addEventListener('click',()=>openModal('Recent Trades','Newest saved trades · 10 per page',sorted,'recent'));
 $('cjProRunningTradesBtn').addEventListener('click',()=>openModal('Running Trades','Trades marked open/running in saved records',sorted.filter(isRunning),'running'));
 $('cjProModalClose').addEventListener('click',close);$('cjProPrevPage').addEventListener('click',()=>{if(page>0){page--;renderPage()}});$('cjProNextPage').addEventListener('click',()=>{if((page+1)*10<filtered.length){page++;renderPage()}});$('cjProTradesModal').addEventListener('click',e=>{if(e.target===$('cjProTradesModal'))close()});document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
