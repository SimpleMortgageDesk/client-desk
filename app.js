(function(){
'use strict';
var T,STAGES,STAGE_LABEL,TYPES,AP_TYPES,landingDone=false;
function applyTrade(){
  T=window.CD_T();STAGES=T.stages;STAGE_LABEL={lost:'Closed lost'};STAGES.forEach(function(s){STAGE_LABEL[s.id]=s.label});TYPES=T.types;AP_TYPES=T.apptTypes;
  var nb=document.getElementById('newBtn');if(nb)nb.textContent=(T.noun[0]==='Client'||T.tenancyMode)?'Add '+T.noun[0].toLowerCase():'New '+T.noun[0].toLowerCase();
  var q=document.getElementById('q');if(q)q.placeholder='Search '+T.noun[1].toLowerCase();
  var bn=document.getElementById('brandName'),an=(window.MD_CONFIG||{}).appName||'MySimpleDesk';if(bn){var sp=an.lastIndexOf(' '),dk=/^(.+)(Desk)$/.exec(an);bn.innerHTML=sp>0?esc(an.slice(0,sp))+' <span style="font-weight:300">'+esc(an.slice(sp+1))+'</span>':dk?esc(dk[1])+'<span style="font-weight:300">'+dk[2]+'</span>':esc(an)}
  document.title=an;
  if(!landingDone&&window.CD_tradeChosen&&window.CD_tradeChosen()){landingDone=true;if(T.landing&&(view==='tasks'||view===undefined))view=T.landing}
}
function N1(){return T.noun[0].toLowerCase()}
function NS(){return T.noun[1].toLowerCase()}
applyTrade();

var db=null, col=null, cases=[], loaded=false, view=view||'tasks', query='', stageFilter='', lenderFilter='', revFilter='', sortBy=(function(){try{return localStorage.getItem('cd.ui.sortBy')||'task'}catch(e){return 'task'}})(), openId=undefined;
var queues={};

/* ---------- helpers ---------- */
function $(s,r){return (r||document).querySelector(s)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function num(v){if(v===''||v==null)return null;var n=parseFloat(String(v).replace(/[£,\s]/g,''));return isNaN(n)?null:n}
function money(n){if(n==null||n==='')return '—';n=+n;return '£'+n.toLocaleString('en-GB',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2})}
function pd(iso){if(!iso)return null;var p=iso.split('-').map(Number);return new Date(p[0],p[1]-1,p[2])}
var TODAY=(function(){var d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate())})();
function diff(iso){return Math.round((pd(iso)-TODAY)/864e5)}
function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function addMonths(s,n){var d=pd(s),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);var last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return iso(d)}
var REVM=4;
function addDays(s,n){var d=pd(s);d.setDate(d.getDate()+n);return iso(d)}
function fd(s){return s?pd(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—'}
function rel(s){var n=diff(s);if(n===0)return 'today';if(n===1)return 'tomorrow';if(n===-1)return 'yesterday';return n>0?'in '+n+' days':Math.abs(n)+' days ago'}
function uid(){return Math.random().toString(36).slice(2,9)}
function lastDay(s){var d=pd(s);return d.getDate()===new Date(d.getFullYear(),d.getMonth()+1,0).getDate()}
function autoDate(s,a){var r=s;if(a.m){if(a.eom&&lastDay(s)){var d=pd(s);r=iso(new Date(d.getFullYear(),d.getMonth()+a.m+1,0))}else r=addMonths(s,a.m)}if(a.d)r=addDays(r,a.d);return r}
function autoOf(c,f){var s=fv(c,f.auto.from);return s&&/^\d{4}-\d{2}-\d{2}$/.test(s)?autoDate(s,f.auto):''}
function fv(c,k){var v=c?c[k]:null;if(v!==''&&v!=null)return v;var f=T.byKey[k];if(f&&f.auto&&c)return autoOf(c,f);return ''}
function stageOf(c){return c.stage==='lost'?'lost':(STAGE_LABEL[c.stage]&&c.stage!=='lost'?c.stage:STAGES[0].id)}
function fmtField(c,k){var f=T.byKey[k],v=fv(c,k);if(v===''||v==null)return '';if(!f)return String(v);if(f.t==='money')return money(v);if(f.t==='date')return fd(v);if(f.t==='sel'){var o=(f.o||[]).filter(function(x){return Array.isArray(x)&&x[0]===v})[0];return o?o[1]:String(v)}return String(v)}
function csvCell(v){if(v==null)return '';if(typeof v==='number')return String(v);v=String(v);if(/^[=+\-@\t\r]/.test(v))v="'"+v;return v}
var protHidden=false,protAll=false,prDraft='';

function protFs(c){
  var ps=(c.protection||[]).slice().sort(function(a,b){return b.ts-a.ts});
  var xl=T.extraLog||{title:'Extra notes',ph:''};
  return '<fieldset style="margin-top:14px"><legend>'+esc(xl.title)+' ('+ps.length+')</legend><div class="add" style="margin:0 0 8px"><button type="button" class="btn ghost sm" id="prHide">'+(protHidden?'Show':'Hide')+'</button></div>'+
  (protHidden?'<span class="muted">Hidden.</span>':'<label class="f">New note<textarea id="prText" rows="3" placeholder="'+esc(xl.ph)+'">'+esc(prDraft)+'</textarea></label><div id="prTblBox">'+pendHtml('pr')+'</div><div class="add"><button type="button" class="btn ghost" id="prStamp">Insert date and time</button><button type="button" class="btn ghost" id="prAdd">Add note</button></div>'+
  (protAll?ps:ps.slice(0,1)).map(function(n){return noteItem(n,'protection',(protAll||ps.length<2?'':' (latest)'),esc)}).join('')+
  (ps.length>1?'<button type="button" class="btn ghost sm" id="prAll">'+(protAll?'Show latest only':'Show all '+ps.length)+'</button>':''))+'</fieldset>';
}
function latestNoteCell(c,key){var n=(c[key||'notes']||[]).slice().sort(function(a,b){return b.ts-a.ts})[0];if(!n)return '<span class="muted">—</span>';var t=String(n.text||'');if(!t&&n.table)t='[Table]';if(t.length>140)t=t.slice(0,140)+'…';t=t.replace(/\s+/g,' ');return '<div class="nl1" title="'+esc(stampOf(n.ts)+' '+t)+'"><span class="muted" style="font-family:var(--mono);font-size:11px">'+stampOf(n.ts)+'</span> '+esc(t)+'</div>'}
function cno(c){return c.clientNo?' <span class="cno">'+esc(c.clientNo)+'</span>':''}
function nextClientNo(){var m=0;cases.forEach(function(c){var r=/^C(\d+)$/i.exec(c.clientNo||'');if(r)m=Math.max(m,+r[1])});return 'C'+String(m+1).padStart(3,'0')}
/* full property address: line one plus the postcode (not repeated if the postcode is already typed in line one) */
function pcFmt(raw){var v=String(raw||'').toUpperCase().replace(/[^A-Z0-9]/g,''),m=/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/.exec(v);return m?m[1]+' '+m[2]:String(raw||'').toUpperCase().replace(/\s+/g,' ').trim()}
function paddr(c){var a=String((c&&c.propertyAddress)||'').trim(),p=String((c&&c.postcode)||'').trim();if(!p)return a;var n=function(x){return x.toUpperCase().replace(/[^A-Z0-9]/g,'')};return n(a).indexOf(n(p))>-1?a:(a?a+', '+p:p)}
function names(c){if(T&&T.tenancyMode){var pa=short(paddr(c));return pa||'Unnamed property'}return pnames(c)}
function pnames(c){var a=(c.applicants||[]).map(function(x){return x.name}).filter(Boolean);return a.length?a.join(' & '):'Unnamed client'}
function remDone(c,r,d){return !!(c.remDone&&c.remDone[r.k]===d)}
/* repeating expiry reminders: first one lead months before the date; each press of "In 30 days" moves it on 30 days; a new date starts again */
function remDue(snoozed,exp,lead){var r0=addMonths(exp,-lead);return (/^\d{4}-\d{2}-\d{2}$/.test(snoozed||'')&&snoozed>=r0)?addDays(snoozed,30):r0}
function reviewItems(c,useStage){
  var st=stageOf(c),out=[];
  T.reminders.forEach(function(r){
    if(useStage&&r.only&&r.only.indexOf(st)<0)return;
    if(r.unless&&r.unless.some(function(k){return fv(c,k)!==''}))return;
    var d=fv(c,r.k);if(!d||!/^\d{4}-\d{2}-\d{2}$/.test(d))return;
    var ref=r.ref?fv(c,r.ref):'',rl=ref?(r.refL?'. '+r.refL+' '+(T.byKey[r.ref]&&T.byKey[r.ref].t==='date'?fd(ref):ref):': '+ref):'';
    if(r.lead){out.push({date:remDue(c.remDone&&c.remDone[r.k],d,r.lead),label:r.l+' '+fd(d)+rl,key:r.k,sec:false,rep:1,exp:d});return}
    if(remDone(c,r,d))return;
    out.push({date:d,label:r.l+rl,key:r.k,sec:false});
  });
  return out.concat(tnReminders(c)).concat(T.tenancyMode?rlReminders(c).concat(rpReminders(c)):[]).concat(docReminders(c));
}
function reviewOf(c){var r=reviewItems(c).map(function(x){return x.exp||x.date}).sort();return r[0]||''}
function firstName(c){var a=(c.applicants||[]).map(function(x){return (x.name||'').trim()}).filter(Boolean)[0]||'';return a.replace(/^(mr|mrs|miss|ms|dr)\.?\s+/i,'').toLowerCase()}
function cnum(c){var m=/(\d+)/.exec(c.clientNo||'');return m?+m[1]:1e9}
function odLink(u){u=String(u||'').trim();return /^https?:\/\//i.test(u)?'<a href="'+esc(u)+'" target="_blank" rel="noopener">Open OneDrive folder</a>':''}
/* ---------- pasted tables: Excel colours kept, cells editable ---------- */
var ntTable=null,prTable=null,tblTimer=null;
function safeColor(v){v=String(v||'').trim();return /^#[0-9a-fA-F]{6}$/.test(v)?v:''}
function rgbHex(s){var m=/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s\/]+([\d.]+))?/.exec(s||'');if(!m)return '';if(m[4]!=null&&+m[4]===0)return '';return '#'+[m[1],m[2],m[3]].map(function(x){return ('0'+Math.min(255,+x).toString(16)).slice(-2)}).join('')}
function lum(h){return (0.299*parseInt(h.substr(1,2),16)+0.587*parseInt(h.substr(3,2),16)+0.114*parseInt(h.substr(5,2),16))/255}
function cellStyle(c){
  var s=[],bg=safeColor(c.bg),col=safeColor(c.c),bd=safeColor(c.bd);
  if(bg){s.push('background:'+bg);s.push('color:'+(col||'#101C26'))}else if(col&&lum(col)>0.25&&lum(col)<0.9){s.push('color:'+col)}
  if(c.b)s.push('font-weight:700');if(c.i)s.push('font-style:italic');
  if(c.a==='center'||c.a==='right')s.push('text-align:'+c.a);
  if(bd)s.push('border:1px solid '+bd);
  return s.join(';');
}
function cellHtml(c,edit){c=c||{};var st=cellStyle(c);return '<td'+(edit?' contenteditable="true"':'')+(st?' style="'+st+'"':'')+'>'+esc(c.v)+'</td>'}
function tblInner(rows,edit){var w=0;rows.forEach(function(r){if(r.length>w)w=r.length});return rows.map(function(r){var h='';for(var i=0;i<w;i++)h+=cellHtml(r[i],edit);return '<tr>'+h+'</tr>'}).join('')}
function tblBlock(n,list){
  var tb=n&&n.table;if(!tb||!tb.rows||!tb.rows.length)return '';
  return '<div class="tblwrap" data-list="'+list+'" data-ts="'+esc(n.ts)+'"><table class="nt xl"><tbody>'+tblInner(tb.rows,true)+'</tbody></table><div class="tblbar"><button type="button" class="btn ghost sm" data-tb="addrow">Add row</button><button type="button" class="btn ghost sm" data-tb="addcol">Add column</button><button type="button" class="btn ghost sm" data-tb="delrow">Remove last row</button><button type="button" class="btn ghost sm" data-tb="delcol">Remove last column</button>'+(list==='nbtables'?'<button type="button" class="btn danger sm" data-tb="nbdel">Remove table</button>':'')+'</div></div>';
}
function pendHtml(k){
  var tb=k==='nt'?ntTable:prTable;if(!tb)return '';
  return '<div class="tblpend"><div class="muted" style="margin:6px 0">Table ready: '+tb.rows.length+' rows × '+(tb.rows[0]?tb.rows[0].length:0)+' columns. Click Add note to save it. <button type="button" class="btn ghost sm" data-tb="drop'+k+'">Remove table</button></div><div class="tblwrap"><table class="nt xl"><tbody>'+tblInner(tb.rows,false)+'</tbody></table></div></div>';
}
function showPend(k){var b=$('#'+k+'TblBox');if(b)b.innerHTML=pendHtml(k)}
function parseTable(html,cb){
  var doc=new DOMParser().parseFromString(html,'text/html'),tb=doc.querySelector('table');
  if(!tb){cb(null);return}
  doc.querySelectorAll('script,link,img,iframe,object,embed,meta,base,form,svg,video,audio').forEach(function(x){x.remove()});
  var styles='';doc.querySelectorAll('style').forEach(function(s){styles+=s.outerHTML});
  var fr=document.createElement('iframe'),done=false;
  fr.setAttribute('sandbox','allow-same-origin');
  fr.style.cssText='position:fixed;left:-9999px;top:0;width:1200px;height:800px;visibility:hidden;border:0';
  function finish(r){if(done)return;done=true;try{fr.remove()}catch(e){}cb(r)}
  fr.onload=function(){
    try{
      var d=fr.contentDocument,w=fr.contentWindow,rows=[],width=0,cells=0,cut=false;
      d.querySelectorAll('table tr').forEach(function(tr){
        if(rows.length>=200||cells>1500){cut=true;return}
        var r=[];
        Array.prototype.slice.call(tr.children).forEach(function(td){
          if(!/^t[dh]$/i.test(td.tagName)||r.length>=30)return;
          var cs=w.getComputedStyle(td),c={v:(td.textContent||'').replace(/\s+/g,' ').trim()};
          var bg=rgbHex(cs.backgroundColor);if(bg)c.bg=bg;
          var fc=rgbHex(cs.color);if(fc&&lum(fc)>0.12)c.c=fc;
          var fw=cs.fontWeight;if(fw==='bold'||+fw>=600)c.b=1;
          if(cs.fontStyle==='italic')c.i=1;
          if(cs.textAlign==='center'||cs.textAlign==='right')c.a=cs.textAlign;
          var bc='';['Top','Right','Bottom','Left'].forEach(function(sd){if(!bc&&cs['border'+sd+'Style']!=='none'&&parseFloat(cs['border'+sd+'Width'])>0)bc=rgbHex(cs['border'+sd+'Color'])||'#888888'});
          if(bc)c.bd=bc;
          r.push(c);cells++;
          var span=Math.min(+td.getAttribute('colspan')||1,10);
          for(var k=1;k<span&&r.length<30;k++){var e={v:''};if(c.bg)e.bg=c.bg;if(c.bd)e.bd=c.bd;r.push(e)}
        });
        if(r.length){rows.push(r);if(r.length>width)width=r.length}
      });
      rows.forEach(function(r){while(r.length<width)r.push({v:''})});
      finish(rows.length?{rows:rows,cut:cut}:null);
    }catch(e){finish(null)}
  };
  setTimeout(function(){finish(null)},4000);
  fr.srcdoc='<!doctype html><html><head><meta charset="utf-8">'+styles+'</head><body>'+tb.outerHTML+'</body></html>';
  document.body.appendChild(fr);
}
function readRows(w){
  var ts=+w.getAttribute('data-ts'),list=w.getAttribute('data-list'),c=list==='nbtables'?notes.filter(function(x){return x.id===nbShown})[0]:currentCase();if(!c)return null;
  var arr=(list==='nbtables'?c.tables:c[list])||[],idx=-1;arr.forEach(function(n,i){if(n.ts===ts)idx=i});
  if(idx<0||!arr[idx].table)return null;
  var old=arr[idx].table.rows,rows=[];
  w.querySelectorAll('tr').forEach(function(tr,ri){var r=[];tr.querySelectorAll('td').forEach(function(td,ci){var o=Object.assign({},(old[ri]||[])[ci]||{});o.v=td.textContent.replace(/ /g,' ');r.push(o)});rows.push(r)});
  return {list:list,idx:idx,arr:arr,rows:rows};
}
function commitTbl(info,rows){
  var arr=info.arr.map(function(n,i){if(i!==info.idx)return n;var m=Object.assign({},n);m.table={rows:rows};return m});
  if(info.list==='nbtables'){nbSetTables(arr);return}
  var o={};o[info.list]=arr;patch(openId,o);
}
function saveTbl(w){var info=readRows(w);if(!info)return;if(JSON.stringify(info.rows)===JSON.stringify(info.arr[info.idx].table.rows))return;commitTbl(info,info.rows)}
function cellTxt(c){c=String(c);if(c.length>1&&c.charAt(0)==='"'&&c.charAt(c.length-1)==='"')c=c.slice(1,-1).replace(/""/g,'"');return c.trim()}
function tableHtml(rows){
  var w=0;rows.forEach(function(r){if(r.length>w)w=r.length});
  function tr(r,tag){var h='';for(var i=0;i<w;i++)h+='<'+tag+'>'+esc(r[i]==null?'':r[i])+'</'+tag+'>';return '<tr>'+h+'</tr>'}
  return '<div class="tblwrap"><table class="nt"><thead>'+tr(rows[0],'th')+'</thead><tbody>'+rows.slice(1).map(function(r){return tr(r,'td')}).join('')+'</tbody></table></div>';
}
function paras(t){
  var lines=String(t||'').replace(/\r\n?/g,'\n').split('\n'),out=[],tbl=[],k=0;
  function flush(){if(!tbl.length)return;out.push('<div class="np np'+(k++%6)+'">'+(tbl.length>1?tableHtml(tbl):esc(tbl[0].join('  ')))+'</div>');tbl=[]}
  lines.forEach(function(l){
    if(l.indexOf('\t')>=0){var cells=l.split('\t').map(cellTxt);while(cells.length&&cells[cells.length-1]==='')cells.pop();if(cells.length>1||cells.length===1&&cells[0]){tbl.push(cells);return}}
    flush();
    if(l.trim())out.push('<div class="np np'+(k++%6)+'">'+esc(l)+'</div>');
  });
  flush();
  return out.join('');
}
function nextTask(c){var d=(c.tasks||[]).filter(function(t){return !t.done&&t.due}).map(function(t){return t.due}).sort();return d[0]||''}
function taskCell(c){var d=nextTask(c);return '<td>'+(d?'<span class="chip '+tone(d)+'">'+fd(d)+'</span>':'<span class="muted">—</span>')+'</td>'}
function sortList(l){
  return l.slice().sort(function(a,b){
    if(sortBy==='first'){var x=firstName(a),y=firstName(b);if(!x&&y)return 1;if(x&&!y)return -1;return x.localeCompare(y)||cnum(a)-cnum(b)}
    if(sortBy==='review'){var ra=reviewOf(a),rb=reviewOf(b);if(!ra&&rb)return 1;if(ra&&!rb)return -1;return ra<rb?-1:ra>rb?1:(firstName(a).localeCompare(firstName(b)))}
    if(sortBy==='task'){var ka=nextTask(a),kb=nextTask(b);if(!ka&&kb)return 1;if(ka&&!kb)return -1;return ka<kb?-1:ka>kb?1:cnum(a)-cnum(b)}
    if(sortBy==='clientno')return cnum(a)-cnum(b);
    return (b.updatedAt||0)-(a.updatedAt||0)});
}
function short(addr){return (addr||'').split('\n')[0]||''}
function ltv(c){return c.loanAmount&&(c.propertyValue||c.purchasePrice)?c.loanAmount/(c.purchasePrice||c.propertyValue)*100:null}
function toast(m,sticky){var t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.h);if(!sticky)toast.h=setTimeout(function(){t.hidden=true},3200)}
function stageIdx(id){return STAGES.findIndex(function(s){return s.id===id})}

/* ---------- writes (one at a time per document) ---------- */
function write(id,fn){
  var p=(queues[id]||Promise.resolve()).then(fn).catch(function(e){toast('Not saved: '+((e&&e.message)||'try again'))});
  queues[id]=p;return p;
}
function patch(id,data){
  if(!col)return Promise.resolve();
  data.updatedAt=Date.now();
  return write(id,function(){return col.doc(id).update(data)});
}

/* ---------- events / reminders ---------- */
function caseEvents(c){
  var ev=[],st=c.stage,n=names(c);
  function add(date,label,kind){if(date)ev.push({date:date,label:label,kind:kind,id:c.id,who:n})}
  reviewItems(c,true).forEach(function(r){ev.push({date:r.date,label:r.label,kind:'review',id:c.id,who:n,key:r.key,rep:r.rep,exp:r.exp})});
  (c.tasks||[]).forEach(function(t){if(!t.done&&t.due)ev.push({date:t.due,label:t.text,kind:'task',id:c.id,who:n})});
  return ev;
}
function allEvents(){
  var out=[];cases.forEach(function(c){if(c.stage!=='lost')out=out.concat(caseEvents(c))});if(T.tenancyMode)out=out.concat(homeEvents());
  return out.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0});
}
function reviewEvents(){return allEvents().filter(function(e){return e.kind==='review'})}
/* key dates for the Outlook calendar: sync.js turns these into 9am events with a phone alert */
window.CD_keyDates=function(){
  if(!loaded||!db)return null;var out=[];
  cases.forEach(function(c){if(c.stage==='lost')return;var n=names(c);
    reviewItems(c,true).forEach(function(r){out.push({key:c.id+'|'+r.key,date:kdNext(r),title:r.label,who:n})});
    (c.tasks||[]).forEach(function(t,i){if(!t.done&&t.due)out.push({key:c.id+'|task:'+(t.id||i),date:t.due,title:t.text,who:n})});
  });
  if(T.tenancyMode)homeEvents().forEach(function(e){out.push({key:'home|'+e.key,date:kdNext(e),title:e.label,who:'My home'})});
  return out;
};
function kdNext(r){if(!r.rep)return r.date;var n=diff(r.date);return n>=0?r.date:addDays(r.date,Math.ceil(-n/30)*30)}
function nextEvent(c){
  var e=caseEvents(c).sort(function(a,b){return a.date<b.date?-1:1});
  var over=e.filter(function(x){return diff(x.date)<0})[0];
  return over||e.filter(function(x){return diff(x.date)>=0})[0]||null;
}
function tone(date){var n=diff(date);return n<0?'bad':n<=7?'warn':''}
function dueCount(){return reviewEvents().filter(function(e){return diff(e.date)<0}).length}

/* ---------- filtering ---------- */
function visible(){
  var q=query.trim().toLowerCase();
  return cases.filter(function(c){
    if(stageFilter==='lost'&&c.stage!=='lost')return false;
    if(lenderFilter&&T.filter&&(c[T.filter.k]||'')!==lenderFilter)return false;
    if(stageFilter&&stageFilter!=='lost'&&stageOf(c)!==stageFilter)return false;
    if(revFilter){var rv=reviewOf(c);if(revFilter==='none'?!!rv:rv.slice(0,7)!==revFilter)return false}
    if(!q)return true;
    var hay=[names(c),c.clientNo,c.type].concat(T.fields.filter(function(f){return f.t!=='date'&&f.t!=='money'&&f.t!=='num'}).map(function(f){return c[f.k]||''})).concat((c.applicants||[]).map(function(a){return [a.phone,a.email,a.address].join(' ')})).join(' ').toLowerCase();
    return hay.indexOf(q)>-1;
  });
}

/* ---------- render shell ---------- */
/* landlords: Notebook and Book appointment sit under More, in the top menu (phone) and the side menu (computer) */
var navMore=false;
function renderNav(){updTrayBtn();if(view==='notebook')navMore=true;
  var items=toolItems([['clients',CL()],['cases',T.tenancyMode?T.noun[1]:'All '+NS()],['pipeline','Pipeline'],['tasks','Tasks'],['reminders','Reminders'],['invoices','Quotes & invoices'],['calculator','Mortgage Calculator'],['notebook','Notebook'],['birthdays','Birthdays'],['marketing','Marketing']]);
  var dc=dueCount(),tdc=allTasks().filter(function(x){return trBucket(x)==='over'}).length;
  var tools={invoices:1,calculator:1,notebook:1,birthdays:1,marketing:1,bookappt:1,gendocs:1,acctset:1,myhome:1,more:1};
  if(T.tenancyMode)items=items.filter(function(i){return i[0]!=='invoices'&&i[0]!=='marketing'&&i[0]!=='notebook'}).concat([['myhome','My home'],['gendocs','Reports and agreements'],['more',navMore?'Less':'More']].concat(navMore?[['notebook','Notebook'],['bookappt','Book appointment']]:[]).concat([['acctset','Settings']]));
  var mk=function(list){return list.map(function(i){
    return '<button data-v="'+i[0]+'"'+(view===i[0]?' aria-current="page"':'')+'>'+i[1]+(i[0]==='myhome'?homeSmall(true):'')+(i[0]==='reminders'&&dc?'<span class="badge">'+dc+' overdue</span>':'')+(i[0]==='tasks'&&tdc?'<span class="badge">'+tdc+' overdue</span>':'')+(i[0]==='birthdays'&&bdCounts(bdPeople().list).today?'<span class="badge" style="background:#fde4ee;color:#c2185b">'+bdCounts(bdPeople().list).today+' today</span>':'')+(i[0]==='appointments'&&apTodayN()?'<span class="badge" style="background:var(--accent-soft,#dbe9f8);color:var(--accent)">'+apTodayN()+' today</span>':'')+'</button>';
  }).join('')};
  var hideRem=sideVisible(),n1=$('#nav'),n2=$('#nav2'),one=T.tenancyMode&&NAV_MQ&&NAV_MQ.matches;
  /* landlords on a phone: every menu item in one row that swipes sideways, Settings last */
  n1.classList.toggle('onerow',!!one);
  if(one){var keep=n1.scrollLeft;n1.innerHTML=mk(items.filter(function(i){return !(hideRem&&i[0]==='reminders')}));if(n2)n2.innerHTML='';n1.scrollLeft=keep;var cur=n1.querySelector('[aria-current="page"]');if(cur&&(cur.offsetLeft<n1.scrollLeft||cur.offsetLeft+cur.offsetWidth>n1.scrollLeft+n1.clientWidth))n1.scrollLeft=Math.max(0,cur.offsetLeft-12);return}
  n1.innerHTML=mk(items.filter(function(i){return !tools[i[0]]&&!(hideRem&&i[0]==='reminders')}));if(n2)n2.innerHTML=mk(items.filter(function(i){return tools[i[0]]}));
}
var NAV_MQ=window.matchMedia?window.matchMedia('(max-width:759px)'):null;
if(NAV_MQ){var navMqFn=function(){if(T)renderNav()};if(NAV_MQ.addEventListener)NAV_MQ.addEventListener('change',navMqFn);else if(NAV_MQ.addListener)NAV_MQ.addListener(navMqFn)}

function toolItems(l){return l.filter(function(i){return !(i[0]==='calculator'&&!T.calculator)&&!(i[0]==='birthdays'&&!T.dob)&&!(T.hideTabs&&T.hideTabs.indexOf(i[0])>-1)})}
function gbp2(n){return '£'+n.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}
function calcPay(P,rate,n){var r=rate/1200;return r===0?P/n:P*r/(1-Math.pow(1+r,-n))}
function calcShell(){
  var list=cases.slice().sort(function(a,b){return names(a).toLowerCase()<names(b).toLowerCase()?-1:1});
  return '<div class="pagehead"><h1>Mortgage calculator</h1><span class="muted">Monthly payment, repayment and interest only</span></div><div id="calcMain" class="calc">'+
   '<div class="calcin"><label class="f">Fill from a case (optional)<select id="calcCase"><option value="">Choose a case, or type the figures below</option>'+list.map(function(x){return '<option value="'+esc(x.id)+'">'+esc(names(x)+(x.clientNo?' ('+x.clientNo+')':''))+'</option>'}).join('')+'</select></label>'+
   '<div class="grid" style="margin-top:10px"><label class="f">Mortgage amount<span class="ig"><i>£</i><input id="calcAmt" type="number" step="any" inputmode="decimal" placeholder="e.g. 250000"></span></label>'+
   '<label class="f">Term (years)<input id="calcYrs" type="number" step="1" inputmode="numeric" placeholder="e.g. 25"></label>'+
   '<label class="f">Extra months (optional)<input id="calcMon" type="number" step="1" min="0" max="11" inputmode="numeric" placeholder="0"></label>'+
   '<label class="f">Interest rate (% a year)<input id="calcRate" type="number" step="any" inputmode="decimal" placeholder="e.g. 4.5"></label></div></div>'+
   '<div id="calcOut"></div></div>';
}
function calcUpdate(){
  var out=$('#calcOut');if(!out)return;
  var P=parseFloat($('#calcAmt').value),y=parseFloat($('#calcYrs').value)||0,m=parseFloat($('#calcMon').value)||0,R=parseFloat($('#calcRate').value),n=Math.round(y*12+m);
  if(!(P>0)||!(n>0)||isNaN(R)||R<0){out.innerHTML='<p class="muted" style="margin:14px 0">Enter the mortgage amount, term and interest rate to see the monthly payments.</p>';return}
  var rp=calcPay(P,R,n),io=P*R/1200,tr=rp*n,ti=io*n,t=Math.floor(n/12)+' years'+(n%12?' '+(n%12)+' months':'');
  var rises=[1,2,3].map(function(d){var p2=calcPay(P,R+d,n);return '<tr><td>Rate '+(R+d).toFixed(2).replace(/\.?0+$/,'')+'% (+'+d+'%)</td><td>'+gbp2(p2)+'</td><td>'+gbp2(p2-rp)+' more</td><td>'+gbp2((R+d)*P/1200)+'</td></tr>'}).join('');
  out.innerHTML='<div class="calcres"><div class="calcbox"><div class="ct">Repayment</div><div class="cbig">'+gbp2(rp)+'<span> a month</span></div>'+
    '<div class="crow"><span>Total interest over '+t+'</span><b>'+gbp2(tr-P)+'</b></div><div class="crow"><span>Total repaid</span><b>'+gbp2(tr)+'</b></div><div class="crow"><span>Mortgage left at the end</span><b>£0.00</b></div></div>'+
    '<div class="calcbox io"><div class="ct">Interest only</div><div class="cbig">'+gbp2(io)+'<span> a month</span></div>'+
    '<div class="crow"><span>Total interest over '+t+'</span><b>'+gbp2(ti)+'</b></div><div class="crow"><span>Total paid by you</span><b>'+gbp2(ti)+'</b></div><div class="crow"><span>Mortgage left at the end</span><b>'+gbp2(P)+'</b></div></div></div>'+
    '<div class="calcdiff">Interest only is <b>'+gbp2(rp-io)+'</b> a month cheaper, but the full <b>'+gbp2(P)+'</b> is still owed at the end of the term.</div>'+
    '<div class="calcrise"><b>If the rate rises</b><table><thead><tr><th></th><th>Repayment</th><th>Change</th><th>Interest only</th></tr></thead><tbody>'+rises+'</tbody></table></div>'+
    '<p class="muted" style="font-size:12px">Monthly payments are worked out with the rate compounded monthly. Figures are an illustration, not a quote. A lender may calculate slightly differently.</p>';
}
function render(){
  renderNav();applySide();
  var v=$('#view');
  if(!db){v.innerHTML='<div class="banner">Saving is not available. Sign in to store your '+NS()+'.</div>';return}
  if(!loaded){v.innerHTML='<div class="empty">Loading your '+NS()+'…</div>';return}
  if((view==='calculator'&&!T.calculator)||(view==='birthdays'&&!T.dob))view='tasks';
  if(T.hideTabs&&T.hideTabs.indexOf(view)>-1)view=T.landing||'tasks';
  if(T.tenancyMode&&(view==='invoices'||view==='marketing'))view='cases';
  if(!T.tenancyMode&&view==='myhome')view=T.landing||'tasks';
  if(view==='tasks'){if(!$('#trList')||!v.contains($('#trList'))){v.innerHTML='<div class="homesplit"><section class="hp" id="homeCal" aria-label="Appointments calendar"></section><section class="hp htk" aria-label="Tasks"><div class="pagehead"><h1>Tasks</h1><span class="muted">Due today first, then overdue, then soonest</span></div><div class="tpage">'+taskShell()+'</div></section><aside class="hp hrem" id="homeRem" aria-label="Reminders"></aside></div>'}var hc=$('#homeCal');if(hc&&!$('#apOv'))hc.innerHTML=apHome();renderTray();renderRem()}
  else if(view==='notebook'){if(!$('#nbMain')||!v.contains($('#nbMain'))){v.innerHTML=nbShell();nbShown=null}renderNotebook()}
  else if(view==='calculator'){if(!$('#calcMain')||!v.contains($('#calcMain'))){v.innerHTML=calcShell();calcUpdate()}}
  else if(view==='marketing'){var mr=$('#mkRoot');if(!mr||!v.contains(mr)||mr.getAttribute('data-tab')!==mkTab)v.innerHTML=mkShell();mkList()}
  else if(view==='birthdays'){if(!$('#bdList')||!v.contains($('#bdList'))){v.innerHTML=bdShell();bdTplRender()}bdRender()}
  else if(view==='appointments')v.innerHTML=apHTML();
  else if(view==='clients'){if(!$('#clList')||!v.contains($('#clList')))v.innerHTML=clShell();clRender()}
  else if(view==='invoices')v.innerHTML=invoicesHTML();
  else if(view==='pipeline')v.innerHTML=pipelineHTML();
  else if(view==='cases')v.innerHTML=casesHTML();
  else if(view==='myhome')v.innerHTML='<div class="pagehead"><h1>My home</h1></div>'+homeCard(true);
  else v.innerHTML=remindersHTML();
}
function emptyHTML(){
  return '<div class="empty"><h2>No '+NS()+' yet</h2>Add your first '+N1()+' to track it from enquiry to the end, with tasks, notes, appointments and reminders for key dates.<br><button class="btn" data-act="new">Add your first '+N1()+'</button></div>';
}

/* ---------- pipeline ---------- */
function pipelineHTML(){
  if(!cases.length)return emptyHTML();
  var list=sortList(visible().filter(function(c){return c.stage!=='lost'}));
  var vk=T.value.k,vv=function(c){return +fv(c,vk)||0};
  var active=list.filter(function(c){return stageOf(c)!==T.doneStage});
  var vol=active.reduce(function(a,c){return a+vv(c)},0);
  var h='<div class="pagehead"><h1>Pipeline</h1><div class="stats">'+
    '<div class="stat"><b>'+active.length+'</b><span>Live '+NS()+'</span></div>'+
    '<div class="stat"><b>'+money(vol)+'</b><span>'+esc(T.value.l)+'</span></div></div></div><div class="board">';
  STAGES.forEach(function(s,i){
    var cs=list.filter(function(c){return stageOf(c)===s.id});
    var sum=cs.reduce(function(a,c){return a+vv(c)},0);
    h+='<section class="col" data-stage="'+s.id+'"><h3>'+s.label+'<span>'+cs.length+'</span></h3><div class="sum">'+(sum?money(sum):'&nbsp;')+'</div><div class="cards">';
    cs.forEach(function(c){
      var ne=nextEvent(c),next=STAGES[i+1];
      h+='<div class="card" draggable="true" tabindex="0" role="button" data-open="'+c.id+'">'+
        '<div class="nm">'+esc(names(c))+cno(c)+'</div>'+
        '<div class="ad">'+esc(short(fv(c,T.addr))||c.type||'')+'</div>'+
        '<div class="row"><span class="num">'+(fv(c,vk)!==''?money(fv(c,vk)):'')+'</span><span class="muted">'+esc(fmtField(c,T.sub))+'</span></div>'+
        (ne?'<div><span class="chip '+tone(ne.date)+'">'+esc(ne.label.split('.')[0])+' · '+rel(ne.date)+'</span></div>':'')+
        (next?'<button class="btn ghost sm go" data-adv="'+c.id+'" data-to="'+next.id+'">Move to '+next.label+' →</button>':'')+
      '</div>';
    });
    h+='</div></section>';
  });
  return h+'</div>';
}

/* ---------- cases table ---------- */
var colsHide=(function(){try{return JSON.parse(localStorage.getItem('cd.ui.colsHide')||'[]')}catch(e){return []}})();
function colOn(k){return colsHide.indexOf(k)<0}
function lenderSelHTML(){if(!T.filter)return '';var fk=T.filter.k,ls={};cases.forEach(function(c){if(c[fk])ls[c[fk]]=1});return '<select id="lenderSel" aria-label="Filter by '+esc(T.filter.l)+'"><option value="">All '+esc(T.filter.l)+'</option>'+Object.keys(ls).sort().map(function(l){return '<option value="'+esc(l)+'"'+(lenderFilter===l?' selected':'')+'>'+esc(l)+'</option>'}).join('')+'</select>'}
function revSelHTML(){var ms={};cases.forEach(function(c){var r=reviewOf(c);if(r)ms[r.slice(0,7)]=1});return '<select id="revSel" aria-label="Filter by key date month"><option value="">Any '+esc(T.reviewWord.toLowerCase())+' month</option>'+Object.keys(ms).sort().map(function(m){return '<option value="'+m+'"'+(revFilter===m?' selected':'')+'>'+new Date(m+'-01T00:00:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'})+'</option>'}).join('')+'<option value="none"'+(revFilter==='none'?' selected':'')+'>No '+esc(T.reviewWord.toLowerCase())+' date</option></select>'}
function casesHTML(){
  var CASE_COLS=T.cols,list=sortList(visible());
  var opts='<option value="">All stages</option>'+STAGES.concat([{id:'lost',label:'Closed lost'}]).map(function(s){return '<option value="'+s.id+'"'+(stageFilter===s.id?' selected':'')+'>'+s.label+'</option>'}).join('');
  var llSum=T.tenancyMode?(function(){var let_=cases.filter(function(c){return c.stage!=='lost'&&tnCurrent(c).length}).length,roll=cases.reduce(function(a,c){return a+rentSum(c)},0);return '<div class="stats"><div class="stat"><b>'+cases.length+'</b><span>Properties</span></div><div class="stat"><b>'+let_+'</b><span>Let</span></div><div class="stat"><b>'+(cases.length-let_)+'</b><span>Vacant</span></div><div class="stat"><b>'+money(Math.round(roll*100)/100)+'</b><span>Rent a month</span></div></div>'})():'';
  var h='<div class="pagehead"><h1>'+(T.tenancyMode?'Properties':'All '+NS())+'</h1>'+llSum+'<button class="btn ghost" data-act="export">Export CSV</button></div>'+
    '<div class="filters"><button type="button" class="btn ghost xpm" data-act="export">Export CSV</button>'+(T.tenancyMode?'':'<select id="stageSel" aria-label="Filter by stage">'+opts+'</select> ')+'<select id="sortSel" aria-label="Sort clients">'+[['updated','Sort: recently updated'],['first','Sort: first name A–Z'],['review','Sort: next '+T.reviewWord.toLowerCase()+' date'],['task','Sort: next task due date'],['clientno','Sort: client number']].map(function(o){return '<option value="'+o[0]+'"'+(sortBy===o[0]?' selected':'')+'>'+o[1]+'</option>'}).join('')+'</select>'+lenderSelHTML()+revSelHTML()+'<details class="colpick"><summary class="btn ghost">Columns</summary><div class="colbox">'+CASE_COLS.map(function(c){return '<label><input type="checkbox" data-colk="'+c[0]+'"'+(colOn(c[0])?' checked':'')+'> '+c[1]+'</label>'}).join('')+'</div></details>'+((stageFilter||lenderFilter||revFilter)?' <button type="button" class="btn ghost" data-clrf="1">Clear filters</button>':'')+'</div>';
  h='<div class="caseswrap">'+h;
  if(!cases.length)return h+emptyHTML()+mtdCard()+'</div>';
  var shown=CASE_COLS.filter(function(x){return colOn(x[0])});
  h+='<div class="tw"><table><thead><tr><th>'+esc(T.tenancyMode?'Property':T.person[0]==='Applicant'||T.person[0]==='Contact'?'Client':T.person[0])+'</th>'+shown.map(function(x){return '<th>'+esc(x[1])+'</th>'}).join('')+'</tr></thead><tbody>';
  if(!list.length)h+='<tr><td colspan="'+(shown.length+1)+'" class="muted">No '+NS()+' match.</td></tr>';
  list.forEach(function(c){
    var ad=T.tenancyMode?[c.type,c.bedrooms?c.bedrooms+' bed':''].filter(Boolean).join(' · '):short(fv(c,T.addr))||short(((c.applicants||[])[0]||{}).address);
    h+='<tr class="click" data-open="'+c.id+'"><td><b>'+esc(names(c))+'</b>'+cno(c)+'<div class="muted" style="font-size:12px">'+esc(ad)+'</div></td>'+shown.map(function(x){
      var k=x[0];
      if(k==='type')return '<td>'+esc(c.type||'')+'</td>';
      if(k==='tenants')return '<td>'+(tnCurrent(c).map(function(tn){return esc(tnNames(tn)||'Unnamed tenant')}).join('<br>')||'<span class="muted">None</span>')+'</td>';
      if(k==='rentSum'){var rs=rentSum(c);return '<td class="num">'+(rs?money(Math.round(rs*100)/100):'—')+'</td>'}
      if(k==='occ')return '<td>'+occChip(c)+'</td>';
      if(k==='legal')return '<td>'+lgChip(c)+'</td>';
      if(k==='rentSt')return '<td>'+rentStatusCell(c)+'</td>';
      if(k==='stage')return '<td><span class="chip">'+esc(STAGE_LABEL[stageOf(c)]||'')+'</span></td>';
      if(k==='task')return taskCell(c);
      if(k==='review'){var rv=reviewOf(c);return '<td>'+(rv?'<span class="chip '+tone(rv)+'">'+fd(rv)+'</span>':'<span class="muted">—</span>')+'</td>'}
      if(k==='note')return '<td class="ntc">'+latestNoteCell(c)+'</td>';
      if(k==='prot')return '<td class="ntc">'+latestNoteCell(c,'protection')+'</td>';
      var sub=(T.sub===k&&T.subRef)?'<div class="muted num" style="font-size:12px">'+esc(fmtField(c,T.subRef))+'</div>':'';
      return '<td>'+esc(fmtField(c,k))+sub+'</td>';
    }).join('')+'</tr>';
  });
  return h+'</tbody></table></div>'+mtdCard()+'</div>';
}

/* ---------- reminders ---------- */
function remindersHTML(){
  var ev=reviewEvents(),q=query.trim().toLowerCase();
  if(q)ev=ev.filter(function(e){return (e.who+' '+e.label).toLowerCase().indexOf(q)>-1});
  var g=[['Overdue','bad',function(n){return n<0}],['Next 7 days','',function(n){return n>=0&&n<=7}],['Next 30 days','',function(n){return n>7&&n<=30}],['Later this year and beyond','',function(n){return n>30}]];
  var h='<div class="pagehead"><h1>Reminders</h1><span class="muted">Key dates from your '+NS()+'. Tasks are in the Tasks tab</span></div>';
  if(!ev.length)return h+'<div class="empty"><h2>Nothing due</h2>Key dates you enter on your '+NS()+' (for example '+esc(T.reminders.slice(0,2).map(function(r){return r.l.toLowerCase()}).join(' or '))+') appear here.</div>';
  g.forEach(function(x){
    var items=ev.filter(function(e){return x[2](diff(e.date))});
    if(!items.length)return;
    h+='<div class="group"><h3 class="'+x[1]+'">'+x[0]+' · '+items.length+'</h3>';
    items.forEach(function(e){
      h+='<div class="evrow"><button class="ev" data-open="'+e.id+'"><div class="d">'+fd(e.date)+'<small>'+rel(e.date)+'</small></div><div><b>'+esc(e.label)+'</b><div class="who">'+esc(e.who)+'</div></div><span class="chip '+tone(e.date)+'">'+esc(T.reviewWord)+'</span></button><button type="button" class="btn ghost sm" data-remdone="'+e.id+'|'+esc(e.key)+'|'+e.date+'"'+(e.rep?' data-rep="1" title="Remind me again in 30 days. Update the date when it is renewed.">In 30 days':' title="Hide this reminder">Done')+'</button></div>';
    });
    h+='</div>';
  });
  return h;
}

/* ---------- drawer ---------- */
function fld(name,label,val,type,extra){
  type=type||'text';
  var inp='<input id="f-'+name+'" data-f="'+name+'" type="'+type+'" value="'+esc(val==null?'':val)+'"'+(type==='number'?' step="any" inputmode="decimal"':'')+'>';
  if(extra&&extra.gbp)inp='<span class="ig"><i>£</i>'+inp+'</span>';
  return '<label class="f'+(extra&&extra.wide?' wide':'')+'">'+label+inp+'</label>';
}
function sel(name,label,val,opts){
  return '<label class="f">'+label+'<select id="f-'+name+'" data-f="'+name+'">'+opts.map(function(o){var v=o[0],l=o[1];return '<option value="'+esc(v)+'"'+(v===val?' selected':'')+'>'+esc(l)+'</option>'}).join('')+'</select></label>';
}
function contactLinks(t){t=String(t||'');var ph=/(?:\+44\s?|\b0)(?:\d[\s-]?){9,10}\b/.exec(t),em=/[^\s@,;()]+@[^\s@,;()]+\.[A-Za-z]{2,}/.exec(t);return (ph?plinks(ph[0]):'')+(em?elinks(em[0]):'')}
function elinks(m){
  m=String(m||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m))return '';
  return '<a href="mailto:'+esc(m)+'" target="_blank" rel="noopener">Send email</a><a href="https://outlook.live.com/mail/0/deeplink/compose?to='+encodeURIComponent(m)+'" target="_blank" rel="noopener">Outlook</a>';
}
function plinks(p){
  var d=String(p||'').replace(/[^\d+]/g,'');if(d.replace(/\D/g,'').length<7)return '';
  var intl=d.charAt(0)==='+'?d.slice(1):d.charAt(0)==='0'?'44'+d.slice(1):d;
  return '<a href="https://wa.me/'+intl+'" target="_blank" rel="noopener">WhatsApp</a>';
}
var secCollapsed={};
function secSumText(x){var rv=x.reviewDate||(x.fixedUntil?addMonths(x.fixedUntil,-REVM):'');var parts=[x.lender,x.rate?x.rate+'%':'',rv?'Review '+fd(rv):''].filter(Boolean);return parts.join(' · ')||'No lender details yet'}
function secRow(x,i){
  x=x||{};var sid=x.id||('s'+Math.random().toString(36).slice(2,9));
  return '<div class="sec2" data-sid="'+sid+'"><div class="top2"><span>Security address '+(i+1)+'</span><span><button type="button" class="btn ghost sm" data-rmsec="'+sid+'">Remove</button></span></div>'+
   '<div class="grid"><label class="f wide">Security address<input data-s="address" value="'+esc(x.address)+'" placeholder="Full address and postcode"></label></div></div>';
}
function updSRev(){updStrip()}
function stripVal(c,k){if(k==='rentSum'){var rs=rentSum(c);return rs?money(Math.round(rs*100)/100):'—'}if(k==='occ')return occOf(c);if(k==='ltv'){var l=ltv(c);return l?l.toFixed(1)+'%':'—'}if(k==='next'){var r=reviewOf(c);return r?fd(r):'—'}return fmtField(c,k)||'—'}
function stripHtml(c){return '<div class="strip">'+T.strip.map(function(s,i){return '<div><b data-strip="'+i+'">'+esc(stripVal(c,s[0]))+'</b><span>'+esc(s[1])+'</span></div>'}).join('')+'</div>'}
function updStrip(){if(!$('#caseForm'))return;var c=Object.assign({},currentCase()||{},collectForm());T.strip.forEach(function(s,i){var b=document.querySelector('[data-strip="'+i+'"]');if(b)b.textContent=stripVal(c,s[0])});if(T.tenancyMode)lgRefresh(c)}
function typeOpts(cur){var l=TYPES.slice();if(cur&&l.indexOf(cur)<0)l.push(cur);return l.map(function(t){return [t,t]})}
/* "Does the property have a mortgage?" (landlord): the mortgage fields show only when the answer is Yes.
   A property saved before this question existed counts as Yes when any mortgage detail is filled in. */
function mortKeys(){var out=[];(T.sections||[]).forEach(function(s){s.fields.forEach(function(f){if(f.mort)out.push(f.k)})});return out}
function mortVal(c){if(c&&c.hasMortgage)return c.hasMortgage;return mortKeys().some(function(k){return c&&c[k]})?'Yes':''}
function fieldHtml(f,c){
  if(f.k==='hasMortgage'){var c2=Object.assign({},c);c2.hasMortgage=mortVal(c);return fieldHtml0(f,c2)}
  var h=fieldHtml0(f,c);
  if(f.mort)h=h.replace('<label class="f','<label data-mort="1"'+(mortVal(c)==='Yes'?'':' style="display:none"')+' class="f');
  return h;
}
document.addEventListener('change',function(e){
  var t=e.target;if(!t||t.id!=='f-hasMortgage'||!t.closest('#caseForm'))return;
  var els=[].slice.call(document.querySelectorAll('#caseForm [data-mort]')),ins=els.map(function(l){return l.querySelector('[data-f]')}).filter(Boolean);
  if(t.value==='No'&&ins.some(function(i){return i.value})){
    if(!confirm('Choosing No clears the mortgage details saved for this property. Continue?')){t.value='Yes';t.dispatchEvent(new Event('input',{bubbles:true}));return}
    ins.forEach(function(i){i.value=''});
    t.dispatchEvent(new Event('input',{bubbles:true}));
  }
  els.forEach(function(l){l.style.display=t.value==='Yes'?'':'none'});
  if(t.value==='Yes'&&ins[0])ins[0].focus();
});
function fieldHtml0(f,c){
  var v=c[f.k],wc=f.w?' wide':'';
  if(f.t==='sel'){var opts=(f.o||[]).map(function(x){return Array.isArray(x)?x:[x,x===''?'Choose…':x]});if(v&&!opts.some(function(o){return o[0]===v}))opts.push([v,v]);return sel(f.k,esc(f.l),v==null?'':v,opts).replace('<label class="f">','<label class="f'+wc+'">')}
  if(f.t==='area')return '<label class="f wide">'+esc(f.l)+'<textarea id="f-'+f.k+'" data-f="'+f.k+'" rows="3">'+esc(v||'')+'</textarea></label>';
  if(f.t==='date'&&f.auto)return '<label class="f'+wc+'">'+esc(f.l)+'<input id="f-'+f.k+'" data-f="'+f.k+'" type="date" data-auto="'+(v?'0':'1')+'" data-from="'+f.auto.from+'" value="'+esc(fv(c,f.k))+'"></label>';
  var h=fld(f.k,esc(f.l),v,(f.t==='money'||f.t==='num'||f.t==='pct')?'number':f.t==='date'?'date':'text',{gbp:f.t==='money',wide:f.w});
  if(f.t==='text')h=h.replace(/<\/label>$/,'<span class="pl cl">'+contactLinks(v)+'</span></label>');
  if(f.doc&&T.tenancyMode)h=h.replace(/<\/label>$/,dzSpan(c,f)+'</label>');
  return h;
}
function sectionsHtml(c){
  return T.sections.map(function(s,i){
    var odd=c.stage&&!STAGE_LABEL[c.stage],so=STAGES.map(function(x){return [x.id,x.label]}).concat([['lost','Closed lost']]);if(odd)so.unshift([c.stage,c.stage+' (from your earlier trade)']);
    return secFs(s.id,esc(s.title))+(i===0?sel('stage','Stage',odd?c.stage:stageOf(c),so)+sel('type','Type',c.type,typeOpts(c.type)):'')+s.fields.map(function(f){return fieldHtml(f,c)}).join('')+'</div></fieldset>';
  }).join('');
}
function appRow(a,i){
  a=a||{};
  return '<div class="app" data-app="'+i+'"><div class="top2"><span>'+esc(T.person[0])+' '+(i+1)+'</span><button type="button" class="btn ghost sm" data-rmapp="'+i+'">Remove</button></div><div class="grid">'+
   '<label class="f">Full name<input data-a="name" value="'+esc(a.name)+'"></label>'+
   (T.dob||a.dob?'<label class="f">Date of birth'+(T.dob?'':' (optional)')+'<input data-a="dob" type="date" value="'+esc(a.dob)+'"></label>':'')+
   '<label class="f">Phone<input data-a="phone" type="tel" value="'+esc(a.phone)+'"><span class="pl">'+plinks(a.phone)+'</span></label>'+
   '<label class="f">Email<input data-a="email" type="email" value="'+esc(a.email)+'"><span class="pl el">'+elinks(a.email)+'</span></label>'+
   '<label class="f wide">Address<input data-a="address" value="'+esc(a.address)+'"></label></div></div>';
}
var pendingNotes=[];
/* ---------- clients: one line per person, with all their records ---------- */
function plural(n,w){return n+' '+w+(n===1?'':'s')}
function CL(){return T.person[1]==='Applicants'?'Clients':T.person[1]}
var clQuery='',clOpen={},clSort='name';
function clKey(a){var nm=String(a.name||'').trim().toLowerCase().replace(/\s+/g,' '),ph=String(a.phone||'').replace(/\D/g,'').slice(-10),em=String(a.email||'').trim().toLowerCase();return nm+'|'+(ph||em)}
function clPeople(){
  var map={};
  cases.forEach(function(c){(c.applicants||[]).forEach(function(a){
    if(!String(a.name||'').trim())return;var k=clKey(a),p=map[k];
    if(!p)p=map[k]={key:k,name:a.name.trim(),phone:'',email:'',address:'',recs:[]};
    if(!p.phone&&a.phone)p.phone=a.phone;if(!p.email&&a.email)p.email=a.email;if(!p.address&&a.address)p.address=a.address;
    if(p.recs.indexOf(c)<0)p.recs.push(c);
  })});
  return Object.keys(map).map(function(k){
    var p=map[k];p.recs.sort(function(a,b){return (b.updatedAt||0)-(a.updatedAt||0)});
    p.live=p.recs.filter(function(c){return c.stage!=='lost'&&stageOf(c)!==T.doneStage}).length;
    p.value=p.recs.reduce(function(s,c){return s+(+fv(c,T.value.k)||0)},0);
    p.next=p.recs.map(reviewOf).filter(Boolean).sort()[0]||'';
    p.last=p.recs[0]?p.recs[0].updatedAt||0:0;
    p.cno=p.recs.map(function(c){return c.clientNo}).filter(Boolean).join(', ');
    var t=iso(TODAY);p.appts=appts.filter(function(x){return (x.status||'booked')==='booked'&&x.date>=t&&p.recs.some(function(c){return c.id===x.caseId})}).length;
    return p;
  });
}
function clShell(){
  return '<div class="pagehead"><h1>'+esc(CL())+'</h1><span class="muted" id="clCount"></span></div>'+
   '<div class="filters"><input type="search" id="clQ" class="search" style="flex:1;min-width:200px" placeholder="Search by name, phone, email or address" aria-label="Search '+esc(CL().toLowerCase())+'" value="'+esc(clQuery)+'"> <select id="clSort" aria-label="Sort"><option value="name"'+(clSort==='name'?' selected':'')+'>Sort: name A–Z</option><option value="recent"'+(clSort==='recent'?' selected':'')+'>Sort: recently updated</option><option value="next"'+(clSort==='next'?' selected':'')+'>Sort: next key date</option><option value="value"'+(clSort==='value'?' selected':'')+'>Sort: highest value</option></select></div><div id="clList"></div>';
}
function clRender(){
  var box=$('#clList');if(!box)return;
  var all=clPeople(),q=clQuery.trim().toLowerCase();
  var l=all.filter(function(p){return !q||[p.name,p.phone,p.email,p.address,p.cno].join(' ').toLowerCase().indexOf(q)>-1});
  l.sort(function(a,b){
    if(clSort==='recent')return b.last-a.last;
    if(clSort==='value')return b.value-a.value||a.name.localeCompare(b.name);
    if(clSort==='next'){if(!a.next&&b.next)return 1;if(a.next&&!b.next)return -1;return a.next<b.next?-1:a.next>b.next?1:a.name.localeCompare(b.name)}
    return firstName({applicants:[{name:a.name}]}).localeCompare(firstName({applicants:[{name:b.name}]}))||a.name.localeCompare(b.name);
  });
  var ct=$('#clCount');if(ct)ct.textContent=(l.length===all.length?all.length:l.length+' of '+all.length)+' '+CL().toLowerCase();
  if(!all.length){box.innerHTML='<div class="empty"><h2>No '+esc(CL().toLowerCase())+' yet</h2>Everyone you add to a '+esc(N1())+' appears here, with all their '+esc(NS())+' together.<br><button class="btn" data-act="new">Add your first '+esc(T.person[0].toLowerCase())+'</button></div>';return}
  if(!l.length){box.innerHTML='<div class="muted" style="margin-top:12px">Nobody matches.</div>';return}
  box.innerHTML='<div class="tw"><table class="cltab"><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>'+esc(T.noun[1])+'</th><th>'+esc(T.value.l.replace(/ in progress$/i,''))+'</th><th>Next key date</th><th>Last updated</th></tr></thead><tbody>'+l.map(function(p){
    var open=!!clOpen[p.key],wa=plinks(p.phone);
    var h='<tr class="click'+(open?' clon':'')+'" data-clrow="'+esc(p.key)+'"><td><b>'+esc(p.name)+'</b>'+(p.cno?' <span class="cno">'+esc(p.cno)+'</span>':'')+(p.address?'<div class="muted" style="font-size:12px">'+esc(short(p.address))+'</div>':'')+'</td>'+
      '<td class="num">'+esc(p.phone||'')+(wa?'<div class="pl">'+wa+'</div>':'')+'</td><td>'+esc(p.email||'')+(p.email?'<div class="pl">'+elinks(p.email)+'</div>':'')+'</td>'+
      '<td>'+p.recs.length+(p.live?' <span class="muted" style="font-size:12px">('+p.live+' live)</span>':'')+'</td><td class="num">'+(p.value?money(p.value):'—')+'</td>'+
      '<td>'+(p.next?'<span class="chip '+tone(p.next)+'">'+fd(p.next)+'</span>':'<span class="muted">—</span>')+'</td><td class="muted" style="font-size:12px">'+(p.last?shortStamp(p.last):'')+'</td></tr>';
    if(open)h+='<tr class="cldet"><td colspan="7"><div class="clbox">'+
      '<div class="add" style="margin:0 0 8px"><button type="button" class="btn sm" data-clnew="'+esc(p.recs[0].id)+'">New '+esc(N1())+' for this '+esc(CL()==='Clients'?'client':T.person[0].toLowerCase())+'</button><button type="button" class="btn ghost sm" data-clbook="'+esc(p.recs[0].id)+'">Book appointment</button>'+(p.appts?'<span class="muted" style="align-self:center;font-size:12px">'+p.appts+' appointment'+(p.appts===1?'':'s')+' booked</span>':'')+'</div>'+
      p.recs.map(function(c){var v=fv(c,T.value.k),rv=reviewOf(c),ad=short(fv(c,T.addr));
        return '<button type="button" class="clrec" data-open="'+c.id+'"><b>'+esc(c.type||T.noun[0])+'</b>'+(c.clientNo?' <span class="cno">'+esc(c.clientNo)+'</span>':'')+' <span class="chip">'+esc(c.stage==='lost'?'Closed lost':STAGE_LABEL[stageOf(c)]||'')+'</span>'+(ad?'<span class="muted"> · '+esc(ad)+'</span>':'')+(v!==''?'<span class="num"> · '+money(v)+'</span>':'')+(rv?' <span class="chip '+tone(rv)+'">'+esc(T.reviewWord)+' '+fd(rv)+'</span>':'')+'<span class="muted" style="margin-left:auto;font-size:12px">'+plural((c.tasks||[]).filter(function(t){return !t.done}).length,'open task')+' · '+plural((c.notes||[]).length,'note')+'</span></button>'}).join('')+
      '</div></td></tr>';
    return h;
  }).join('')+'</tbody></table></div>';
}
document.addEventListener('click',function(e){
  var t=e.target;if(!t||!t.closest)return;
  if(t.closest('a'))return;
  var b=t.closest('[data-clnew]');if(b){var src=cases.filter(function(x){return x.id===b.getAttribute('data-clnew')})[0];if(src)startFrom(src);return}
  b=t.closest('[data-clbook]');if(b){apOpen(null,iso(TODAY),b.getAttribute('data-clbook'));return}
  b=t.closest('[data-clrow]');if(b){var k=b.getAttribute('data-clrow');clOpen[k]=!clOpen[k];clRender()}
});
document.addEventListener('change',function(e){if(e.target&&e.target.id==='clSort'){clSort=e.target.value;clRender()}});
function pickClient(){
  var list=cases.slice().sort(function(a,b){return names(a).toLowerCase()<names(b).toLowerCase()?-1:1});
  if(!list.length)return '';
  return '<label class="f" style="margin-bottom:12px">Start from an existing client (copies their details)<select id="fromClient"><option value="">Choose a client, or leave blank for a new one</option>'+list.map(function(x){return '<option value="'+esc(x.id)+'">'+esc(names(x)+(x.clientNo?' ('+x.clientNo+')':''))+'</option>'}).join('')+'</select></label>';
}
function startFrom(src){
  var ap=JSON.parse(JSON.stringify(src.applicants&&src.applicants.length?src.applicants:[{}]));
  var d={stage:T.defaultStage,type:T.types[0],applicants:ap,oneDriveLink:src.oneDriveLink||'',_from:src.id,notes:[{ts:Date.now(),text:'New '+N1()+' for an existing client: '+names(src)+(src.clientNo?' (see '+src.clientNo+')':'')+'.'}]};
  if(T.id==='mortgage')d.repayment='repayment';
  closeDrawer();openDrawer(null,d);
}
function openDrawer(id,draft){
  openId=id;ntDraft='';notesAll=false;prDraft='';protAll=false;editNote=null;editTk=null;ntTable=null;prTable=null;pendingNotes=(draft&&draft.notes)||[];
  var c=id?cases.filter(function(x){return x.id===id})[0]:null;
  if(id&&!c){openId=undefined;return}
  c=c||Object.assign({stage:T.defaultStage,type:T.types[0],applicants:[{}]},T.id==='mortgage'?{repayment:'repayment'}:{},draft||{});
  if(!id)colOpen[(T.sections[0].title||'').toLowerCase()]=true;
  var d=$('#drawer');d.hidden=false;
  d.innerHTML='<div class="bk" data-close></div><div class="panel" role="dialog" aria-modal="true" aria-label="'+esc(T.noun[0])+'">'+
  '<div class="dh"><div style="min-width:0"><div class="eyebrow">'+(id?esc(T.noun[0]):draft&&draft._from?'New '+N1()+' for an existing client. Add the details, then it saves automatically':'New '+N1())+'</div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2 id="dTitle" style="margin:0">'+esc(id?names(c):(T.tenancyMode?'Add a property':'Add a client'))+'</h2></div>'+(id?'<div id="nextAppt" class="muted" style="font-size:12px;margin-top:4px">'+apNextHtml(id)+'</div>':'')+(id&&c.oneDriveLink?'<div class="pl" style="margin-top:4px">'+odLink(c.oneDriveLink)+'</div>':'')+
  stripHtml(c)+(T.tenancyMode&&id?'<div id="rentHead"></div>':'')+'</div>'+
  '<div class="dhb" style="display:flex;gap:8px;flex-wrap:nowrap;justify-content:flex-end;align-items:center;flex:none">'+(id?(T.tenancyMode?'<button type="button" class="btn ghost" id="repBtn">Repairs</button><button type="button" class="btn" id="expBtn">Expenses</button>':'<button type="button" class="btn" id="bookBtn">Book appointment</button>'):'')+(id&&!T.tenancyMode?'<button type="button" class="btn" id="dupBtn" title="Same client, another '+esc(N1())+'">New '+esc(N1())+' for this client</button>':'')+'<button type="button" class="btn" id="saveCloseBtn">Done</button></div></div>'+
  '<form id="caseForm" class="db" autocomplete="off">'+
   (T.tenancyMode?llBody(c):(!id&&!draft?pickClient():'')+'<fieldset id="peopleFs"><legend>'+esc(T.peopleTitle)+'</legend><div class="appsplit"><div class="appleft"><div id="apps">'+(c.applicants&&c.applicants.length?c.applicants:[{}]).map(appRow).join('')+'</div><button type="button" class="btn ghost sm" id="addApp">Add '+esc(T.person[0].toLowerCase())+'</button><div class="grid" style="margin-top:10px">'+fld('clientNo','Client number',c.clientNo)+'</div></div><aside class="lkpane"><div class="lkt" style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span id="lkTitle">Connected clients (0)</span><button type="button" class="btn ghost sm secbtn" id="lkToggle">Show</button></div><div id="linksBox" style="display:none"></div></aside></div></fieldset>'+
   (T.securities?'<fieldset class="secfs"><legend>Security addresses (buy to let and other properties)</legend><p class="muted" style="font-size:12px;margin:0 0 8px">Add the address of each property the mortgage is secured on.</p><div id="secs">'+(c.securities||[]).map(secRow).join('')+'</div><button type="button" class="btn ghost sm" id="addSec">Add security address</button></fieldset>':'')+
   sectionsHtml(c))+
   '<div id="liveNotes"></div>'+
   '<div id="live"></div>'+
   (T.tenancyMode?'':'<fieldset class="odfs"><legend>OneDrive folder</legend><label class="f">OneDrive folder link<input id="f-oneDriveLink" data-f="oneDriveLink" type="url" placeholder="Paste the OneDrive folder link for this client" value="'+esc(c.oneDriveLink)+'"><span class="pl" id="odl">'+odLink(c.oneDriveLink)+'</span></label></fieldset>')+
  '</form>'+
  '<div class="df"><div>'+(id?'<button type="button" class="btn danger" id="delBtn">Delete '+esc(N1())+'</button>':'')+'</div><span class="muted" id="autoMsg" role="status" style="font-size:12.5px">'+(id?'&#10003; Saved. Changes save by themselves.':'Saves by itself once the '+(T.tenancyMode?'address':'name')+' is in.')+'</span></div></div>';
  colOpen={};if(T.tenancyMode){if(!id)colOpen[(T.sections[0].title||'').toLowerCase()]=1}else if(!id)colOpen[(T.sections[0].title||'').toLowerCase()]=true;lkOpen=false;curLinks=((c&&c.links)||[]).map(function(l){return {id:l.id,cid:l.cid,rel:l.rel}});renderLive();renderLinks();
  var first=$('#drawer [data-a="name"]');if(first&&!id)first.focus();
  ntDraft=(id&&c.noteDraft)||'';prDraft=(id&&c.protDraft)||'';lastND=ntDraft;lastPD=prDraft;renderLive();
  if(T.tenancyMode&&id)rhRender();
  if(T.tenancyMode){mcRender();tnLockAll();rpBtnSet()}
  lastAuto=id?JSON.stringify(collectForm()):null;
  newBase=id?null:JSON.stringify(collectForm());
}
function closeDrawer(){editNote=null;editTk=null;var d=$('#drawer');d.hidden=true;d.innerHTML='';openId=undefined;lastAuto=null;newBase=null;ntTable=null;prTable=null}
function currentCase(){return openId?cases.filter(function(x){return x.id===openId})[0]:null}

/* ---------- appointments ---------- */
var apCol=null,appts=[],apMonth={y:TODAY.getFullYear(),m:TODAY.getMonth()},apSel=iso(TODAY),apEditId=null,apClash=false;
var AP_MODES=['Phone','Video call','In person','Office'];
var AP_DURS=[15,30,45,60,90,120];
var AP_STATUS={booked:'Booked',done:'Done',cancelled:'Cancelled',noshow:'No show'};
function apMin(t){var m=/^(\d\d):(\d\d)$/.exec(t||'');return m?+m[1]*60+ +m[2]:0}
function apHM(n){n=((n%1440)+1440)%1440;return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function apSorted(l){return l.slice().sort(function(a,b){return (a.date+' '+(a.time||''))<(b.date+' '+(b.time||''))?-1:(a.date+' '+(a.time||''))>(b.date+' '+(b.time||''))?1:0})}
function apCase(a){return a.caseId?cases.filter(function(x){return x.id===a.caseId})[0]:null}
function apWho(a){var c=apCase(a);return c?names(c):(a.who||'Unnamed')}
function apWhoHtml(a){var c=apCase(a);return c?'<button type="button" class="lnk" data-open="'+c.id+'">'+esc(names(c))+cno(c)+'</button>':esc(a.who||'Unnamed')+' <span class="apst">not yet a case</span>'}
function apLabel(c){return c.clientNo?c.clientNo+' · '+names(c):names(c)}
function apFindCase(v){v=String(v||'').trim();if(!v)return null;var no=v.split(' · ')[0].trim().toUpperCase(),c=no?cases.filter(function(x){return (x.clientNo||'').toUpperCase()===no})[0]:null;if(c)return c;var nm=v.replace(/^.* · /,'').trim().toLowerCase();return cases.filter(function(x){return names(x).toLowerCase()===nm})[0]||null}
function apTodayN(){var t=iso(TODAY);return appts.filter(function(a){return a.date===t&&a.status!=='cancelled'&&a.status!=='done'&&a.status!=='noshow'}).length}
function apCard(a,showDate){
  var st=a.status||'booked',end=apHM(apMin(a.time)+(+a.dur||30));
  var dl=showDate?'<span class="muted" style="font-size:12px">'+new Date(a.date+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+' · </span>':'';
  var meta=[a.type,a.mode,a.where].filter(Boolean).map(esc).join(' · ');
  return '<div class="apc st-'+st+'"><div class="aptm"><b>'+esc(a.time||'')+'</b>to '+end+'</div><div class="apbody"><div class="apwho">'+dl+apWhoHtml(a)+(st!=='booked'?'<span class="apst">'+AP_STATUS[st]+'</span>':'')+'</div>'+(meta?'<div class="muted" style="font-size:12px">'+meta+'</div>':'')+(a.notes?'<div style="font-size:13px;margin-top:3px;white-space:pre-wrap">'+esc(String(a.notes).slice(0,220))+'</div>':'')+'</div><div class="apact"><button type="button" class="btn ghost sm" data-apedit="'+a.id+'">Edit</button><button type="button" class="btn ghost sm" data-apdone="'+a.id+'">'+(st==='done'?'Reopen':'Mark done')+'</button></div></div>';
}
function apHTML(home){
  var y=apMonth.y,mo=apMonth.m,first=new Date(y,mo,1),off=(first.getDay()+6)%7,tIso=iso(TODAY);
  var by={};appts.forEach(function(a){if(a.status==='cancelled')return;(by[a.date]=by[a.date]||[]).push(a)});
  var h=(home?'':'<div class="pagehead"><h1>Appointments</h1><span class="muted">Book and track client appointments</span></div>')+'<div class="apwrap"><div>';
  h+='<div class="aphead"><h2>'+first.toLocaleDateString('en-GB',{month:'long',year:'numeric'})+'</h2><button type="button" class="btn ghost sm" data-apmonth="-1" aria-label="Previous month">‹ Prev</button><button type="button" class="btn ghost sm" data-apmonth="0">Today</button><button type="button" class="btn ghost sm" data-apmonth="1" aria-label="Next month">Next ›</button><button type="button" class="btn" data-apnew="1" style="margin-left:auto">Book appointment</button></div>';
  h+='<div class="apgrid">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(function(d){return '<div class="apdow">'+d+'</div>'}).join('');
  for(var i=0;i<42;i++){
    var d=new Date(y,mo,1-off+i),di=iso(d),l=apSorted(by[di]||[]);
    h+='<button type="button" class="apcell'+(d.getMonth()!==mo?' out':'')+(di===tIso?' today':'')+(di===apSel?' sel':'')+'" data-apday="'+di+'" aria-label="'+di+(l.length?', '+l.length+' appointments':'')+'"><span class="apn">'+d.getDate()+'</span>'+
      l.slice(0,3).map(function(a){return '<span class="apchip'+(a.status==='done'?' done':'')+'">'+esc(a.time)+' '+esc(apWho(a))+'</span>'}).join('')+(l.length>3?'<span class="apmore">+'+(l.length-3)+' more</span>':'')+
      (l.length?'<span class="apdots">'+l.slice(0,6).map(function(){return '<span class="apdot"></span>'}).join('')+'</span>':'')+'</button>';
  }
  h+='</div></div><div>';
  var day=apSorted(appts.filter(function(a){return a.date===apSel}));
  h+='<div class="aphead"><h2>'+new Date(apSel+'T00:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})+'</h2><button type="button" class="btn ghost sm" data-apnew="1">Book on this day</button></div>';
  h+=day.length?day.map(function(a){return apCard(a,false)}).join(''):'<div class="muted" style="margin-bottom:10px">Nothing booked on this day.</div>';
  var nowMin=new Date().getHours()*60+new Date().getMinutes();
  var up=apSorted(appts.filter(function(a){return (a.status||'booked')==='booked'&&(a.date>tIso||(a.date===tIso&&apMin(a.time)+(+a.dur||30)>=nowMin))})).slice(0,8);
  h+='<div class="aphead" style="margin-top:16px"><h2 style="font-size:15px">Coming up</h2></div>'+(up.length?up.map(function(a){return apCard(a,true)}).join(''):'<div class="muted">No upcoming appointments.</div>');
  return h+'</div></div>';
}
var homeMonth=false;
function apHome(){
  if(homeMonth)return '<div class="aphead" style="margin-bottom:6px"><h2 style="font-size:15px">Month view</h2><button type="button" class="btn ghost sm" data-hmtog="0">Back to agenda</button></div>'+apHTML(true);
  var nowMin=new Date().getHours()*60+new Date().getMinutes(),tI=iso(TODAY),h='<div class="aphead"><h2>Today and next 7 days</h2><button type="button" class="btn ghost sm" data-hmtog="1">Month view</button><button type="button" class="btn" data-apnew="1" style="margin-left:auto">Book appointment</button></div>',any=0;
  for(var i=0;i<8;i++){
    var di=addDays(tI,i),l=apSorted(appts.filter(function(a){return a.date===di&&(a.status||'booked')!=='cancelled'}));
    if(!l.length&&i>0)continue;
    any+=l.length;
    h+='<div class="agd"><b>'+(i===0?'Today':i===1?'Tomorrow':'')+(i<2?' · ':'')+new Date(di+'T00:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})+'</b><span class="muted"> · '+l.length+' appointment'+(l.length===1?'':'s')+'</span></div>'+(l.length?l.map(function(a){return apCard(a,false)}).join(''):'<div class="muted" style="margin:0 0 8px">Nothing booked today.</div>');
  }
  if(!any)h+='<div class="muted" style="margin-top:6px">No appointments in the next 7 days.</div>';
  return h;
}
function apNextHtml(cid){
  var nowMin=new Date().getHours()*60+new Date().getMinutes(),t=iso(TODAY);
  var up=apSorted(appts.filter(function(a){return a.caseId===cid&&(a.status||'booked')==='booked'&&(a.date>t||(a.date===t&&apMin(a.time)+(+a.dur||30)>=nowMin))}));
  if(!up.length)return '';
  var a=up[0];return 'Next appointment: <b>'+new Date(a.date+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+', '+esc(a.time)+'</b>'+(a.mode?' · '+esc(a.mode):'')+(up.length>1?' · +'+(up.length-1)+' more':'');
}
function apClose(){var o=$('#apOv');if(o)o.remove();apEditId=null;apClash=false;apDpM=null}
document.addEventListener('change',function(e){if(e.target&&e.target.id==='apDur'){apClash=false;apDpRender()}});
var apDpM=null;
function apT(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function apDpRender(){
  var box=$('#apDp');if(!box)return;
  var oldSl=$('#apSl'),keep=oldSl?oldSl.scrollTop:null;
  var dv=$('#apDate').value||iso(TODAY),tv=$('#apTime').value||'10:00',dur=+(($('#apDur')||{}).value)||30,pp=dv.split('-');
  if(!apDpM)apDpM={y:+pp[0],m:+pp[1]-1};
  var first=new Date(apDpM.y,apDpM.m,1),off=(first.getDay()+6)%7,dim=new Date(apDpM.y,apDpM.m+1,0).getDate(),tIso=iso(TODAY);
  var live=appts.filter(function(x){return (x.status||'booked')==='booked'&&x.id!==apEditId}),cnt={};
  live.forEach(function(x){cnt[x.date]=(cnt[x.date]||0)+1});
  var cal='<div class="apdh"><button type="button" class="btn ghost sm" data-apdm="-1" aria-label="Previous month">&#8249;</button><b>'+first.toLocaleDateString('en-GB',{month:'long',year:'numeric'})+'</b><button type="button" class="btn ghost sm" data-apdm="1" aria-label="Next month">&#8250;</button></div><div class="apdg">'+
    ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(function(h){return '<span class="apdw">'+h+'</span>'}).join('');
  for(var i=0;i<off;i++)cal+='<span></span>';
  for(var d=1;d<=dim;d++){
    var ds=apDpM.y+'-'+String(apDpM.m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    cal+='<button type="button" class="apdd'+(ds===dv?' sel':'')+(ds===tIso?' today':'')+'" data-apdd="'+ds+'" aria-label="'+ds+(cnt[ds]?', '+cnt[ds]+' booked':'')+'">'+d+(cnt[ds]?'<i class="apdot"></i>':'')+'</button>';
  }
  cal+='</div><button type="button" class="btn ghost sm" data-apdd="'+tIso+'" style="margin-top:6px">Today</button>';
  var s0=apMin(tv),lo=Math.min(7*60,s0),hi=Math.max(21*60+45,s0),day=live.filter(function(x){return x.date===dv});
  var sl='';
  for(var m=lo;m<=hi;m+=15){
    var busy=day.filter(function(x){return apMin(x.time)<m+15&&apMin(x.time)+(+x.dur||30)>m})[0];
    sl+='<button type="button" class="apts'+(m===s0?' sel':(m>s0&&m<s0+dur?' span':''))+(busy?' busy':'')+'" data-apts="'+apT(m)+'"'+(busy?' title="Already booked: '+esc(apWho(busy))+'"':'')+'>'+apT(m)+'</button>';
  }
  var dd=new Date(+pp[0],+pp[1]-1,+pp[2]),sum=dd.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})+', '+apT(s0)+' to '+apT(s0+dur);
  var bk=day.slice().sort(function(a,b){return apMin(a.time)-apMin(b.time)}).map(function(x){return x.time+' '+esc(apWho(x))}).join(' &middot; ');
  box.innerHTML='<div class="apdwrap"><div class="apdcal">'+cal+'</div><div class="apdslots"><div class="apdlbl">Time (15-minute slots)</div><div class="apdsl" id="apSl">'+sl+'</div></div></div>'+
    '<div class="apdsum"><b>'+esc(sum)+'</b>'+(bk?'<div class="muted">Already booked that day: '+bk+'</div>':'<div class="muted">Nothing else booked that day.</div>')+'</div>';
  var se=box.querySelector('.apts.sel'),sc=$('#apSl');if(sc){if(keep!=null)sc.scrollTop=keep;else if(se)sc.scrollTop=Math.max(0,se.offsetTop-sc.offsetTop-60)}
}
function apOpen(id,date,preCase){
  apDpM=null;
  var a=id?appts.filter(function(x){return x.id===id})[0]:null;if(id&&!a)return;
  apEditId=a?a.id:null;apClash=false;
  var c=a&&apCase(a),who=a?(c?apLabel(c):(a.who||'')):'';
  if(!a&&preCase){var pc=cases.filter(function(x){return x.id===preCase})[0];if(pc)who=apLabel(pc)}
  var opt=function(list,sel){return list.map(function(v){return '<option'+(v===sel?' selected':'')+'>'+esc(v)+'</option>'}).join('')};
  var o=$('#apOv');if(!o){o=document.createElement('div');o.id='apOv';document.body.appendChild(o)}
  o.innerHTML='<div class="apm" role="dialog" aria-label="Appointment"><h2>'+(a?'Edit appointment':'Book appointment')+'</h2><div class="apf">'+
    '<label class="full">Client<input type="text" id="apWho" list="apCases" value="'+esc(who)+'" placeholder="Pick a client or case number, or type a new name" autocomplete="off"></label><datalist id="apCases">'+cases.slice().sort(function(x,y){return cnum(x)-cnum(y)}).map(function(x){return '<option value="'+esc(apLabel(x))+'"></option>'}).join('')+'</datalist>'+
    '<input type="hidden" id="apDate" value="'+esc(a?a.date:(date||iso(TODAY)))+'"><input type="hidden" id="apTime" value="'+esc(a?a.time:'10:00')+'"><div class="full apdp" id="apDp"></div>'+
    '<label>Type<select id="apType">'+opt(AP_TYPES,a&&a.type)+'</select></label><label>Length<select id="apDur">'+AP_DURS.map(function(v){return '<option value="'+v+'"'+(v===(a?+a.dur:30)?' selected':'')+'>'+v+' minutes</option>'}).join('')+'</select></label>'+
    '<label>How<select id="apMode">'+opt(AP_MODES,a&&a.mode)+'</select></label><label>Where or link<input type="text" id="apWhere" value="'+esc(a&&a.where||'')+'" placeholder="Address, phone number or meeting link"></label>'+
    (a?'<label class="full">Status<select id="apStatus">'+Object.keys(AP_STATUS).map(function(k){return '<option value="'+k+'"'+(k===(a.status||'booked')?' selected':'')+'>'+AP_STATUS[k]+'</option>'}).join('')+'</select></label>':'')+
    '<label class="full">Notes<textarea id="apNotes" rows="3" placeholder="What to cover, documents to bring">'+esc(a&&a.notes||'')+'</textarea></label></div>'+
    '<p id="apMsg" class="muted" style="min-height:18px;margin:8px 0 0"></p><div class="add" style="margin-top:8px"><button type="button" class="btn" id="apSave">'+(a?'Save changes':'Book it')+'</button><button type="button" class="btn ghost" data-apclose="1">Cancel</button>'+(a?'<button type="button" class="btn danger" id="apDel">Delete</button>':'')+'</div></div>';
  apDpRender();
  setTimeout(function(){var w=$('#apWho');if(w)w.focus()},50);
}
function apSave(){
  var msg=$('#apMsg'),wv=$('#apWho').value.trim(),date=$('#apDate').value,time=$('#apTime').value;
  if(!wv){msg.textContent='Choose or type who the appointment is with.';return}
  if(!date||!time){msg.textContent='Choose a date and a time.';return}
  var c=apFindCase(wv),ex=apEditId?appts.filter(function(x){return x.id===apEditId})[0]:null,ref=apEditId?apCol.doc(apEditId):apCol.doc(),id=ref.id;
  var d={caseId:c?c.id:'',who:c?names(c):wv,type:$('#apType').value,date:date,time:time,dur:+$('#apDur').value||30,mode:$('#apMode').value,where:$('#apWhere').value.trim(),notes:$('#apNotes').value.trim(),status:apEditId?$('#apStatus').value:'booked',created:(ex&&ex.created)||Date.now(),updatedAt:Date.now()};
  var s0=apMin(time),e0=s0+d.dur,clash=(d.status==='booked')?appts.filter(function(x){return x.id!==id&&x.date===date&&(x.status||'booked')==='booked'&&apMin(x.time)<e0&&apMin(x.time)+(+x.dur||30)>s0}):[];
  if(clash.length&&!apClash){apClash=true;msg.textContent='That overlaps with '+apWho(clash[0])+' at '+clash[0].time+'. Press the button again to book it anyway.';return}
  write('ap-'+id,function(){return apEditId?ref.update(d):ref.set(d)});
  apSel=date;var pd=date.split('-');apMonth={y:+pd[0],m:+pd[1]-1};
  var was=apEditId;apClose();toast(was?'Appointment updated':'Appointment booked');setTimeout(function(){if(view==='appointments'||view==='tasks')render();renderNav()},30);
}
/* ---------- marketing contacts ---------- */
var mkCol=null,mkItems=[],mkQuery='',mkConsent='',mkGroup='',mkGroupKey='',mkEditId=null,mkTab='contacts';
var MK_LABEL={yes:'Opted in',unknown:'Unknown',no:'Opted out'};
function mkSave(){var items=mkItems.slice();return write('mk',function(){return mkCol.doc('contacts').set({items:items,updatedAt:Date.now()})})}
function mkShell(){
  var tabs='<div class="mktabs"><button type="button" class="mktab'+(mkTab==='contacts'?' on':'')+'" data-mktab="contacts">Contacts</button><button type="button" class="mktab'+(mkTab==='messages'?' on':'')+'" data-mktab="messages">Messages</button></div>';
  var head='<div class="pagehead"><h1>Marketing</h1><span class="muted">'+(mkTab==='messages'?'Messages to send to your contacts':'Contacts for your marketing')+'</span></div>';
  if(mkTab==='messages')return '<div id="mkRoot" data-tab="messages">'+head+tabs+'<div id="mkMsgs"></div></div>';
  return '<div id="mkRoot" data-tab="contacts">'+head+tabs+
  '<div class="mknote"><b>Before you message anyone:</b> only market to people who have agreed to hear from you (UK GDPR and PECR). Imported contacts start as <b>Unknown</b>. Mark them <b>Opted in</b> once they agree, and <b>Opted out</b> if they ask you to stop.</div>'+
  '<div class="mkbar"><input id="mkQ" type="search" placeholder="Search contacts" aria-label="Search contacts" value="'+esc(mkQuery)+'"><select id="mkConsent" aria-label="Filter by consent"><option value="">All consent</option><option value="yes">Opted in</option><option value="unknown">Unknown</option><option value="no">Opted out</option></select><select id="mkGroup" aria-label="Filter by group"></select>'+
  '<button type="button" class="btn" data-mkadd="1">Add contact</button><label class="btn ghost mkimp">Import<input type="file" id="mkImp" accept=".csv,.vcf,text/csv,text/vcard,text/x-vcard,text/plain" hidden></label><button type="button" class="btn ghost" data-mkexp="1">Export CSV</button><span id="mkCount" class="muted"></span></div>'+
  '<div class="mkbar"><label class="mktpl">Message for the WhatsApp and Email buttons <select id="mkTpl" aria-label="Message"></select></label></div>'+
  '<div id="mkList"></div></div>';
}
function mkGroups(){var g={};mkItems.forEach(function(c){if(c.group)g[c.group]=1});return Object.keys(g).sort()}
function mkFiltered(){
  var q=mkQuery.trim().toLowerCase();
  return mkItems.filter(function(c){
    if(mkConsent&&(c.consent||'unknown')!==mkConsent)return false;
    if(mkGroup&&(c.group||'')!==mkGroup)return false;
    if(!q)return true;
    return ((c.name||'')+' '+(c.phone||'')+' '+(c.email||'')+' '+(c.group||'')+' '+(c.notes||'')).toLowerCase().indexOf(q)>=0;
  }).sort(function(a,b){
    var na=mkNamed(a),nb=mkNamed(b);if(na!==nb)return na?-1:1;
    return (na?a.name:(a.phone||a.email||'')).localeCompare(nb?b.name:(b.phone||b.email||''),undefined,{sensitivity:'base',numeric:true});
  });
}
function mkNamed(c){return !!(c.name&&/\p{L}/u.test(c.name))}
function mkWa(c){var d=String(c.phone||'').replace(/\D/g,'');return d.length>=8?'https://wa.me/'+d:''}
function mkLinks(c){
  var w=mkWa(c),h='';
  var tp=mkTplCur();
  if(w&&tp)w+='?text='+encodeURIComponent(mkFill(tp.text,c));
  if(w)h+='<a class="mklink wa" href="'+esc(w)+'" target="_blank" rel="noopener noreferrer" title="Open WhatsApp chat">WhatsApp</a>';
  if(c.email)h+='<a class="mklink em" href="mailto:'+esc(c.email)+(tp?'?subject='+encodeURIComponent(tp.subject||tp.title)+'&body='+encodeURIComponent(mkFill(tp.text,c).replace(/\n/g,'\r\n')):'')+'" title="Send an email">Email</a>';
  return h||'<span class="muted">\u2014</span>';
}
function mkTplOpts(){var sel=$('#mkTpl');if(!sel)return;sel.innerHTML='<option value="">No message (blank)</option>'+mkTpls().map(function(m){return '<option value="'+esc(m.id)+'"'+(m.id===mkTplId?' selected':'')+'>'+esc(m.title)+'</option>'}).join('')}
function mkList(){
  if(mkTab==='messages'){mkMsgs();return}
  var box=$('#mkList');if(!box)return;
  mkTplOpts();
  var gs=mkGroups(),key=gs.join('|')+'#'+mkGroup,sel=$('#mkGroup');
  if(sel&&mkGroupKey!==key){mkGroupKey=key;sel.innerHTML='<option value="">All groups</option>'+gs.map(function(g){return '<option value="'+esc(g)+'"'+(g===mkGroup?' selected':'')+'>'+esc(g)+'</option>'}).join('')}
  var cs=$('#mkConsent');if(cs&&cs.value!==mkConsent)cs.value=mkConsent;
  var l=mkFiltered(),n=mkItems.length,shown=l.slice(0,500);
  var ct=$('#mkCount');if(ct)ct.textContent=l.length===n?n+' contact'+(n===1?'':'s'):l.length+' of '+n+' shown';
  if(!n){box.innerHTML='<div class="empty"><h2>No contacts yet</h2>Use Import to load a CSV or vCard (.vcf) file, or Add contact to type one in.</div>';return}
  if(!l.length){box.innerHTML='<div class="muted" style="margin-top:12px">No contacts match.</div>';return}
  box.innerHTML='<div class="tw"><table><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Group</th><th>Message</th><th>Consent</th><th>Notes</th></tr></thead><tbody>'+shown.map(function(c){
    var k=c.consent||'unknown';
    return '<tr class="click" data-mkedit="'+esc(c.id)+'"><td><b>'+esc(c.name||'(no name)')+'</b></td><td class="num">'+esc(c.phone||'')+'</td><td>'+esc(c.email||'')+'</td><td>'+esc(c.group||'')+'</td><td class="mklinks">'+mkLinks(c)+'</td><td><span class="chip mk-'+k+'">'+MK_LABEL[k]+'</span></td><td class="ntc"><div class="nl1">'+esc(c.notes||'')+'</div></td></tr>';
  }).join('')+'</tbody></table></div>'+(l.length>shown.length?'<div class="muted" style="margin-top:8px">Showing the first 500. Use search or filters to narrow the list.</div>':'');
}
function mkNorm(p){
  var raw=String(p||'').trim();if(!raw)return '';
  var plus=raw.charAt(0)==='+',d=raw.replace(/\D/g,'');if(!d)return '';
  if(!plus&&d.slice(0,2)==='00'){plus=true;d=d.slice(2)}
  if(plus)return '+'+d;
  if(d.charAt(0)==='0')return '+44'+d.slice(1);
  if(d.slice(0,2)==='44'&&d.length>=12)return '+'+d;
  if(d.length===10&&d.charAt(0)==='7')return '+44'+d;
  return d;
}
function mkKey(c){return c.phone?'p'+c.phone:c.email?'e'+c.email.toLowerCase():'n'+(c.name||'').toLowerCase()}
function mkId(){return 'm'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function mkCsvRows(t){
  var rows=[],row=[],f='',q=false,i=0,c;
  var first=t.split(/\r?\n/)[0]||'',dl=',';
  [',',';','\t'].forEach(function(d){if(first.split(d).length>first.split(dl).length)dl=d});
  for(i=0;i<t.length;i++){
    c=t.charAt(i);
    if(q){if(c==='"'){if(t.charAt(i+1)==='"'){f+='"';i++}else q=false}else f+=c}
    else if(c==='"')q=true;
    else if(c===dl){row.push(f);f=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&t.charAt(i+1)==='\n')i++;row.push(f);f='';if(row.some(function(x){return x.trim()}))rows.push(row);row=[]}
    else f+=c;
  }
  row.push(f);if(row.some(function(x){return x.trim()}))rows.push(row);
  return rows;
}
function mkParseCsv(t){
  var rows=mkCsvRows(t.replace(/^﻿/,''));if(!rows.length)return [];
  var hasData=function(r){return r.some(function(x){return /@/.test(x)||x.replace(/\D/g,'').length>=7})};
  var head=!hasData(rows[0]),out=[];
  if(head){
    var h=rows[0].map(function(x){return x.trim().toLowerCase()}),body=rows.slice(1);
    var idx=function(re){var r=[];h.forEach(function(x,i){if(re.test(x))r.push(i)});return r};
    var nm=idx(/^(name|full name|display name|contact name|contact)$/),fn=idx(/^(first name|given name|first)$/),ln=idx(/^(last name|family name|surname|last)$/),
        ph=idx(/phone|mobile|tel|number|whatsapp/),em=idx(/e-?mail/),gr=idx(/^(group|groups|label|labels|source|list|group membership)$/),no=idx(/note/),co=idx(/consent|opt/);
    body.forEach(function(r){
      var g=function(a){for(var i=0;i<a.length;i++){var v=(r[a[i]]||'').trim();if(v)return v}return ''};
      var name=g(nm)||((g(fn)+' '+g(ln)).trim()),cv=g(co).toLowerCase();
      out.push({name:name,phone:g(ph),email:g(em),group:g(gr).replace(/\s*:::\s*\*?$/,''),notes:g(no),consent:/^(yes|y|opted in|opt in|true|1)$/.test(cv)?'yes':/^(no|n|opted out|opt out|false|0)$/.test(cv)&&cv?'no':'unknown'});
    });
  }else{
    rows.forEach(function(r){
      var o={name:'',phone:'',email:'',group:'',notes:'',consent:'unknown'};
      r.forEach(function(x){x=x.trim();if(!x)return;if(/@/.test(x)&&!o.email)o.email=x;else if(x.replace(/\D/g,'').length>=7&&/^[+()\d\s.-]+$/.test(x)&&!o.phone)o.phone=x;else if(!o.name)o.name=x});
      out.push(o);
    });
  }
  return out;
}
function mkParseVcf(t){
  var lines=t.replace(/\r/g,'').replace(/\n[ \t]/g,'').split('\n'),out=[],cur=null;
  lines.forEach(function(l){
    if(/^BEGIN:VCARD/i.test(l)){cur={name:'',phone:'',email:'',group:'',notes:'',consent:'unknown'};return}
    if(/^END:VCARD/i.test(l)){if(cur)out.push(cur);cur=null;return}
    if(!cur)return;
    var i=l.indexOf(':');if(i<0)return;
    var k=l.slice(0,i).split(';')[0].toUpperCase().replace(/^ITEM\d+\./,''),v=l.slice(i+1).trim();
    if(k==='FN'&&v)cur.name=v;
    else if(k==='N'&&!cur.name){var p=v.split(';');cur.name=((p[1]||'')+' '+(p[0]||'')).trim()}
    else if(k==='TEL'&&!cur.phone)cur.phone=v;
    else if(k==='EMAIL'&&!cur.email)cur.email=v;
    else if(k==='ORG'&&!cur.group)cur.group=v.replace(/;/g,' ').trim();
    else if(k==='NOTE'&&!cur.notes)cur.notes=v;
  });
  return out;
}
function mkImport(file){
  var rd=new FileReader();
  rd.onload=function(){
    try{
      var t=String(rd.result||''),raw=/BEGIN:VCARD/i.test(t)?mkParseVcf(t):mkParseCsv(t),grp=file.name.replace(/\.[^.]+$/,'').replace(/^WhatsApp (Chat|Group) with /i,'').trim();
      var have={};mkItems.forEach(function(c){have[mkKey(c)]=1});
      var added=0,skipped=0,empty=0;
      raw.forEach(function(r){
        var c={id:mkId(),name:(r.name||'').trim(),phone:mkNorm(r.phone),email:(r.email||'').trim(),group:(r.group||'').trim()||grp,notes:(r.notes||'').trim(),consent:r.consent||'unknown',added:Date.now()};
        if(!c.name&&!c.phone&&!c.email){empty++;return}
        var k=mkKey(c);if(have[k]){skipped++;return}
        have[k]=1;mkItems.push(c);added++;
      });
      if(added)mkSave();
      mkList();
      toast('Imported '+added+' contact'+(added===1?'':'s')+(skipped?', skipped '+skipped+' duplicate'+(skipped===1?'':'s'):'')+(empty?', ignored '+empty+' empty row'+(empty===1?'':'s'):'')+(added?'. Consent is set to Unknown.':''),true);
    }catch(x){toast('That file could not be read as contacts.')}
  };
  rd.readAsText(file);
}
function mkExport(){
  var l=mkFiltered(),q=function(v){v=csvCell(v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
  var rows=[['Name','Phone','Email','Group','Consent','Notes','Added'].join(',')];
  l.forEach(function(c){rows.push([c.name,c.phone,c.email,c.group,MK_LABEL[c.consent||'unknown'],c.notes,c.added?new Date(c.added).toISOString().slice(0,10):''].map(q).join(','))});
  var blob=new Blob(['﻿'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='marketing-contacts-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);
  toast('Exported '+l.length+' contact'+(l.length===1?'':'s'));
}
function mkSendBox(c){
  var w=mkWa(c),h='<div class="mksend"><b>Send a message</b><div class="muted" style="font-size:12px;margin:2px 0 8px">'+(w||c.email?'Pick a message. It opens in WhatsApp or your email app, filled in and ready to send. Check consent first.':'Add a phone number or email to send a message.')+'</div>';
  mkTpls().forEach(function(m){
    var t=mkFill(m.text,c),pv=t.replace(/\s+/g,' ').slice(0,150)+(t.length>150?'\u2026':'');
    h+='<div class="mksm"><div class="mkch"><b>'+esc(m.title)+'</b></div><div class="muted" style="font-size:12px;margin-bottom:6px">'+esc(pv)+'</div><div>'+
      (w?'<a class="mklink wa" href="'+esc(w+'?text='+encodeURIComponent(t))+'" target="_blank" rel="noopener noreferrer">WhatsApp</a>':'')+
      (c.email?'<a class="mklink em" href="mailto:'+esc(c.email)+'?subject='+encodeURIComponent(m.subject||m.title)+'&body='+encodeURIComponent(t.replace(/\n/g,'\r\n'))+'">Email</a>':'')+'</div></div>';
  });
  return h+'</div>';
}
function mkOpen(id){
  var c=mkItems.filter(function(x){return x.id===id})[0]||{},ov=document.createElement('div');
  mkEditId=id||null;ov.id='mkOv';ov.className='mkov';
  ov.innerHTML='<div class="mkpanel" role="dialog" aria-label="Contact"><h2>'+(id?'Edit contact':'Add contact')+'</h2>'+
   '<label class="f">Name<input id="mkf-name" value="'+esc(c.name||'')+'"></label><label class="f">Phone<input id="mkf-phone" inputmode="tel" value="'+esc(c.phone||'')+'"></label>'+(id&&mkWa(c)?'<div class="mkrow"><a class="mklink wa" href="'+esc(mkWa(c))+'" target="_blank" rel="noopener noreferrer">WhatsApp</a></div>':'')+'<label class="f">Email<input id="mkf-email" type="email" value="'+esc(c.email||'')+'"></label>'+(id&&c.email?'<div class="mkrow"><a class="mklink em" href="mailto:'+esc(c.email)+'">Email</a></div>':'')+'<label class="f">Group or source<input id="mkf-group" value="'+esc(c.group||'')+'"></label>'+
   '<label class="f">Consent<select id="mkf-consent"><option value="unknown"'+((c.consent||'unknown')==='unknown'?' selected':'')+'>Unknown</option><option value="yes"'+(c.consent==='yes'?' selected':'')+'>Opted in</option><option value="no"'+(c.consent==='no'?' selected':'')+'>Opted out</option></select></label><label class="f">Notes<textarea id="mkf-notes" rows="3">'+esc(c.notes||'')+'</textarea></label>'+
   (id?mkSendBox(c):'')+'<div class="mkact"><button type="button" class="btn" data-mksave="1">Save</button><button type="button" class="btn ghost" data-mkcancel="1">Cancel</button>'+(id?'<button type="button" class="btn ghost" id="mkDel" data-mkdel="1" style="margin-left:auto">Delete</button>':'')+'</div></div>';
  document.body.appendChild(ov);setTimeout(function(){var f=$('#mkf-name');if(f)f.focus()},30);
}
function mkClose(){var o=$('#mkOv');if(o)o.remove();mkEditId=null}
function mkSaveForm(){
  var g=function(i){return ($('#mkf-'+i).value||'').trim()},c={name:g('name'),phone:mkNorm(g('phone')),email:g('email'),group:g('group'),notes:g('notes'),consent:$('#mkf-consent').value};
  if(!c.name&&!c.phone&&!c.email){toast('Add a name, phone or email');return}
  if(mkEditId){mkItems=mkItems.map(function(x){return x.id===mkEditId?Object.assign({},x,c):x})}
  else mkItems.push(Object.assign({id:mkId(),added:Date.now()},c));
  mkSave();mkClose();mkList();toast('Saved');
}

/* ---------- marketing messages ---------- */
function profA(){try{return JSON.parse(localStorage.getItem('cd.profile')||'{}')||{}}catch(e){return {}}}
function ukPhone(p){p=String(p||'');return /^44\d{9,10}$/.test(p)?'0'+p.slice(2):(p?'+'+p:'')}
function mkSig(){var p=profA();return [p.name,p.role||(p.name?T.label:''),p.biz,p.reg,p.phone?'Mobile: '+ukPhone(p.phone):''].filter(Boolean).join('\n')}
function mkDefaults(){var sg=mkSig(),ft=T.msgFoot;return T.msgs.map(function(m){return {id:m.id,title:m.title,subject:m.subject,text:m.text.replace('{sig}',sg).replace('{foot}',ft).replace(/\n{3,}/g,'\n\n')}})}
var mkMsgsDoc=null,mkTplId='',mkMsgEdit=null,mkDraft=null;
function mkTpls(){return mkMsgsDoc||mkDefaults()}
function mkTplSave(list){mkMsgsDoc=list;return write('mkm',function(){return mkCol.doc('messages').set({items:list,updatedAt:Date.now()})})}
function mkFirst(c){var n=(c&&c.name||'').trim();return mkNamed(c)?n.split(/\s+/)[0]:''}
function mkFill(t,c){var f=mkFirst(c);return String(t||'').replace(/ ?\{name\}/g,f?' '+f:'')}
function mkTplCur(){return mkTpls().filter(function(x){return x.id===mkTplId})[0]||null}
function mkMsgs(){
  var box=$('#mkMsgs');if(!box)return;
  var l=mkDraft?[mkDraft].concat(mkTpls()):mkTpls();
  box.innerHTML='<div class="mknote">Where a message has {name}, the contact\u2019s first name is put in (or left out if there is no name). On the Contacts tab, choose a message and the WhatsApp and Email buttons open with it filled in. Your signature comes from My profile. Each message ends with a way to opt out'+(T.id==='mortgage'?', and the usual mortgage warning':'')+'.</div>'+
  '<div class="mkbar"><button type="button" class="btn" data-mkmnew="1">New message</button>'+(mkMsgsDoc?'<button type="button" class="btn ghost" data-mkmreset="1">Restore the standard messages</button>':'')+'</div>'+
  (l.length?l.map(function(m){
    if(mkMsgEdit===m.id)return '<div class="mkcard"><label class="f">Title<input id="mkm-title" value="'+esc(m.title)+'"></label><label class="f">Email subject<input id="mkm-subject" value="'+esc(m.subject||'')+'"></label><label class="f">Message<textarea id="mkm-text" rows="12">'+esc(m.text)+'</textarea></label><div class="mkact"><button type="button" class="btn" data-mkmsave="'+esc(m.id)+'">Save</button><button type="button" class="btn ghost" data-mkmcancel="1">Cancel</button><button type="button" class="btn ghost" data-mkmdel="'+esc(m.id)+'" style="margin-left:auto">Delete</button></div></div>';
    return '<div class="mkcard"><div class="mkch"><b>'+esc(m.title)+'</b><span class="muted">'+esc(m.subject||'')+'</span></div><pre class="mkpre">'+esc(m.text)+'</pre><div class="mkact"><button type="button" class="btn ghost sm" data-mkmcopy="'+esc(m.id)+'">Copy message</button><button type="button" class="btn ghost sm" data-mkmedit="'+esc(m.id)+'">Edit</button></div></div>';
  }).join(''):'<div class="muted">No messages. Use New message or Restore the standard messages.</div>');
}
function mkMsgAct(t){
  var g=function(a){var e=t.closest('['+a+']');return e?e.getAttribute(a):null},v;
  if(g('data-mkmnew')!==null){var id='c'+Date.now().toString(36);mkDraft={id:id,title:'New message',subject:'',text:'Hello{name},\n\n\n\n'+mkSig()+'\n\n'+T.msgFoot};mkMsgEdit=id;mkMsgs();return true}
  if(g('data-mkmreset')!==null){if(!window.confirm('Replace your messages with the standard ones?'))return true;mkMsgsDoc=null;write('mkm',function(){return mkCol.doc('messages').delete()});mkMsgEdit=null;mkMsgs();return true}
  if((v=g('data-mkmedit'))){mkMsgEdit=v;mkMsgs();return true}
  if(g('data-mkmcancel')!==null){mkMsgEdit=null;mkDraft=null;mkMsgs();return true}
  if((v=g('data-mkmsave'))){var ti=($('#mkm-title').value||'').trim()||'Message';var nm={id:v,title:ti,subject:($('#mkm-subject').value||'').trim(),text:$('#mkm-text').value},cur=mkTpls(),has=cur.some(function(m){return m.id===v});mkTplSave(has?cur.map(function(m){return m.id===v?nm:m}):[nm].concat(cur));mkDraft=null;mkMsgEdit=null;mkMsgs();toast('Message saved');return true}
  if((v=g('data-mkmdel'))){if(!t.classList.contains('armed')){t.classList.add('armed');t.textContent='Confirm delete';return true}if(mkDraft&&mkDraft.id===v){mkDraft=null;mkMsgEdit=null;mkMsgs();return true}mkTplSave(mkTpls().filter(function(m){return m.id!==v}));if(mkTplId===v)mkTplId='';mkMsgEdit=null;mkMsgs();toast('Message deleted');return true}
  if((v=g('data-mkmcopy'))){var m=mkTpls().filter(function(x){return x.id===v})[0];if(m){var txt=mkFill(m.text,null);if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(function(){toast('Message copied')},function(){toast('Could not copy')});else toast('Could not copy')}return true}
  return false;
}

/* ---------- birthdays ---------- */
var bdFilter='week',bdQuery='',bdOpen={},bdDraft={},bdTplOpen=false;
var BD_MSGS=['Happy Birthday {name}! 🎂🎉 Wishing you a wonderful day filled with joy, laughter and all your favourite things. May the year ahead bring you good health, happiness and lots of lovely surprises.','Dear {name}, wishing you a very happy birthday! 🎈 I hope today is full of smiles, good company and a little bit of cake. Here\'s to a fantastic year ahead!','Happy Birthday {name}! 🥳 Thinking of you today and hoping you have a lovely, relaxing day with the people who matter most to you.','Many happy returns, {name}! 🎁 May your day be as special as you are, and may the coming year bring you everything you wish for.','Hi {name}, just a quick note to wish you a very happy birthday! 🌟 I hope you\'re spoiled rotten today. Enjoy every moment!','Happy Birthday {name}! 🎂 Wishing you health, happiness and success in the year ahead. Have a truly wonderful day!','Warmest birthday wishes to you, {name}! 🌸 May this new year of life bring you peace, prosperity and plenty of reasons to celebrate.','Happy Birthday {name}! 🎉 Hope your day is packed with good food, good company and lots of laughter. You deserve it!','Hello {name}, sending you my very best wishes on your birthday! 💐 May it be the start of a brilliant year for you and your family.','Happy Birthday {name}! 🥂 Here\'s to another great year. Wishing you a day full of love, laughter and wonderful surprises.','Wishing you a fantastic birthday, {name}! 🎈 Take time to enjoy today. You deserve a day that\'s all about you!','Happy Birthday {name}! ☀️ I hope today brings you plenty of joy and that the year ahead is your best yet.','Dear {name}, happy birthday! 🎂 Thank you for being a valued client. Wishing you a wonderful day and a happy, healthy year ahead.','Happy Birthday {name}! 🌹 May your day be filled with love and your year with happy moments. Enjoy every minute!','Wishing you the happiest of birthdays, {name}! 🎊 May all your wishes come true today and throughout the year ahead.'];
function bdDefSig(){var p=profA();return 'Warmest wishes,'+(p.name?'\n'+p.name:'')+(p.role?'\n'+p.role:'')}
var bdCfg={messages:null,signature:null,islamic:null},bdShuf={};
var BD_ISL=['Assalamu alaikum {name}! 🌙 Wishing you a very happy and blessed birthday. May Allah grant you good health, happiness and barakah in everything you do this year. Ameen.','Assalamu alaikum {name}, many happy returns! 🤲 May Allah bless you with a long, healthy life filled with joy, peace and success, and keep you and your family safe. Ameen.','Happy Birthday {name}! ✨ Barakallahu feek. May Allah make this coming year your best yet, fill your home with happiness and grant you ease in all your affairs.','Assalamu alaikum {name}. Sending you warm birthday wishes today. May Allah shower you with His mercy, protect you and your loved ones, and bless every day of the year ahead. 🌟','Dear {name}, Assalamu alaikum and happy birthday! 🎂 May Allah grant you good health, a blessed income and happiness for you and your family. Ameen.','Happy Birthday {name}! Alhamdulillah for another year. May Allah fill it with barakah, good health and good news. Wishing you and your family all the best. 🤍','Assalamu alaikum {name}! 🌸 Wishing you a lovely birthday. May Allah bless you with peace of heart, success and many more healthy years ahead. Ameen.','Warm birthday wishes {name}! 🌙 May Allah accept your good deeds, guide you, and grant you and your family happiness and ease in the year ahead.','Assalamu alaikum {name}, wishing you a happy birthday! May Allah protect you, bless your family and your home, and make the year ahead full of khayr. Jazakallah khair for being a valued client. 🤲','Happy Birthday {name}! 🎈 Barakallahu fee umrik. May Allah bless your life and give you good health, happiness and success always.'];
var BD_MUS_SET={};('mohammed muhammad mohammad mohamed mohamad mohd md mahmoud mahmood mehmood mahmud mahmuda hamza hamzah ibrahim ismail ismael yusuf yousuf yusuff usman uthman umar omar abdullah abdul abdur abdel abu bilal imran tariq kamran salman saeed saleem salim nadeem naeem shahid zahid zahidur jamal kamal kabir karim rashid rasheed rafiq rafique shafiq shafique anwar aslam arif asif adnan faisal farooq faruk habib harun haroon idris ilyas jahangir junaid khalid khalil masud masood mustafa nasir noor nur rizwan sadiq shoaib suleman sulaiman waseem wasim zubair zakaria zakir ahmed ahmad ahamed ali hussain hussein hossain hosen hassan hasan rahman rehman islam alam haque hoque huq siddiqui siddique sheikh shaikh syed sayed sayyid iqbal hafiz mirza qureshi malik butt ansari khan begum bibi khatun khanom akhter akhtar akter aktar miah mia mian uddin ullah sultana nasreen parveen perveen yasmin yasmeen fatima fatema fatimah aisha ayesha aysha khadija khadijah maryam mariam zainab zaynab amina aminah rabia ruqayya sumaiya sumayya samira salma jannat rahima rokeya rubina tahmina nazma nazneen shamsun shamim shamima ashraful mizanur rafiqul nazrul'.split(' ')).forEach(function(w){BD_MUS_SET[w]=1});
function bdMuslim(nm){
  return String(nm||'').toLowerCase().split(/[^a-z]+/).filter(Boolean).some(function(w){
    return BD_MUS_SET[w]||/^(abdul|abdur|abdel|mohamm|muham|mohd)/.test(w)||/(uddin|uddeen|ullah)$/.test(w);
  });
}
var bdGen={};
var BD_FEM={};('jerin thania shumaya husneara fatema-tuz nipa mitu ria rima shapla popy poly lucky happy nilufa nilufar rumana rumi shilpi lipi fatima fatema fatimah fatma aisha ayesha aysha ayisha khadija khadijah khodeja maryam mariam mary zainab zaynab zeinab sana sara sarah amina aminah asma halima hajra hina nadia nadiya nasreen nasrin nazia nazma nazneen parveen perveen rubina sabina shabana shahida shazia sultana yasmin yasmeen zahra zara rehana rukhsana razia rashida salma samira sania sobia sadia sonia tahira tasneem uzma farzana farida fouzia fozia jannat rahima rokeya ruksana rabia ruqayya ruqayyah sumaiya sumayya sumaya tahmina shamima shamsun shahnaz shahina shirin shiren sharmin sharmeen sultana jesmin jasmin laila laylah lubna madiha maheen mahnoor mehreen mehwish misbah naila nargis noreen nusrat rizwana robina roksana saima sajida shaheen sidra sumi tamanna tania tanzila umme uzma yasmina zakia zarina zubaida zeenat bushra anisa anika hafsa hafsah iqra insha kulsum kalsoom kauser kishwar maliha momina munira nafisa naseem nazira parvin rahena rehena ruma selina shakila shamim sharifa suraiya sultana tahera '.trim().split(/\s+/)).forEach(function(w){BD_FEM[w]=1});
var BD_MALE={};('ijaz korban kurban foyjul foysal foyez ehsan ihsan ikram inam ilyaas imtiaz jamil jashim jakir kader kalam kaium khokon mamunur mannan matin mofiz motin nurul nazmul rashed rubel salauddin selim shahed shahidul tofazzul tuhin mohammed muhammad mohammad mohamed mohamad mohd md mahmoud mahmood mehmood mahmud hamza hamzah ibrahim ismail ismael yusuf yousuf yusuff usman uthman umar omar abdullah abdul abdur abdel abu bilal imran tariq kamran salman saeed saleem salim nadeem naeem shahid zahid jamal kamal kabir kobir karim rashid rasheed rafiq rafique shafiq shafique anwar aslam arif asif adnan faisal farooq faruk forhad habib harun haroon idris ilyas jahangir junaid khalid khalil masud masood mustafa nasir rizwan sadiq shoaib suleman sulaiman waseem wasim zubair zakaria zakir ahmed ahmad ahamed ali hussain hussein hossain hosen hassan hasan iqbal hafiz mirza sardar shorif sharif rahim rubel sohel monir sumon tanvir masum jahid mizan mizanur ashraful rafiqul nazrul osama usama talha yahya yaqub yacub zain zayn ayaan arman aziz amir ameen amin ashiq ashik babul belal billal dilwar enam farhan fahim fazal gulzar harris haris hanif jabir jalal javed jawad kaiser kashif liaquat luqman majid manzoor mamun masud mehdi mohsin mubarak muzammil nawaz obaid raihan rayhan ramzan rony saif shabir shafi shakil shamim shamsul shuvo siraj sultan tahir taslim tauhid wahid yasin younis zahir zia'.trim().split(/\s+/)).forEach(function(w){BD_MALE[w]=1});
function bdGuess(nm){
  var toks=String(nm||'').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if(!toks.length)return '';
  if(toks[0]==='mr')return 'm';
  if(/^(mrs|miss|ms)$/.test(toks[0]))return 'f';
  var f=toks.filter(function(w){return !/^(mr|mrs|miss|ms|dr)$/.test(w)})[0]||'';
  if(BD_FEM[f])return 'f';
  if(BD_MALE[f]||/^(abdul|abdur|abdel|mohamm|muham|mohd)/.test(f)||/(uddin|uddeen|ullah)$/.test(f))return 'm';
  if(toks.some(function(w){return /^(begum|khatun|bibi|banu|khanom|nessa)$/.test(w)}))return 'f';
  return '';
}
function bdGender(p){return bdGen[p.key]||bdGuess(p.name)}
function bdGenBtns(p){
  var g=bdGender(p);
  return '<span class="bdgenw" role="group" aria-label="Address as"><button type="button" class="btn ghost bdgen" data-bdgen="'+esc(p.key)+'|m" aria-pressed="'+(g==='m')+'">Brother</button><button type="button" class="btn ghost bdgen" data-bdgen="'+esc(p.key)+'|f" aria-pressed="'+(g==='f')+'">Sister</button></span>';
}
var bdKind={};
function bdMode(p){return bdKind[p.key]||(p.muslim?'isl':'gen')}
function bdIsl(){return (bdCfg.islamic&&bdCfg.islamic.length)?bdCfg.islamic:BD_ISL}
function bdList(p){return bdMode(p)==='isl'?bdIsl():bdMsgs()}

function bdMsgs(){return (bdCfg.messages&&bdCfg.messages.length)?bdCfg.messages:BD_MSGS}
function bdSig(){return bdCfg.signature!=null?bdCfg.signature:bdDefSig()}
function bdHash(t){var h=0;for(var i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))>>>0;return h}
function bdPick(p){var l=bdList(p);return bdHash(p.slug+'|'+p.year+'|'+(bdShuf[p.key]||0))%l.length}
function bdFirst(nm){var t=String(nm||'').trim().split(/\s+/).filter(Boolean);while(t.length>1&&/^(mr|mrs|miss|ms|dr|md|mohd)\.?$/i.test(t[0]))t.shift();var f=t[0]||'';return f.charAt(0).toUpperCase()+f.slice(1).toLowerCase()}
function bdSlug(nm){return String(nm||'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function bdIntl(ph){var d=String(ph||'').replace(/[^\d+]/g,'');if(d.replace(/\D/g,'').length<7)return '';return d.charAt(0)==='+'?d.slice(1):d.charAt(0)==='0'?'44'+d.slice(1):d}
function bdLeap(y){return (y%4===0&&y%100!==0)||y%400===0}
function bdPeople(){
  var map={},withDob={},noDob={};
  cases.forEach(function(c){(c.applicants||[]).forEach(function(a){
    var nm=String(a.name||'').trim();if(!nm)return;
    var nk=nm.toLowerCase().replace(/\s+/g,' ');
    if(!a.dob||!/^\d{4}-\d{2}-\d{2}$/.test(a.dob)){noDob[nk]=1;return}
    withDob[nk]=1;
    var key=nk+'|'+a.dob,p=map[key]||(map[key]={key:key,name:nm,dob:a.dob,phone:'',cases:[]});
    if(!p.phone&&a.phone)p.phone=a.phone;
    p.cases.push(c);
  })});
  var list=Object.keys(map).map(function(k){
    var p=map[k],m=+p.dob.slice(5,7),d=+p.dob.slice(8,10),y=TODAY.getFullYear();
    var occ=function(yr){return (m===2&&d===29&&!bdLeap(yr))?new Date(yr,1,28):new Date(yr,m-1,d)};
    var n=occ(y);if(n<TODAY)n=occ(y+1);
    p.next=n;p.days=Math.round((n-TODAY)/864e5);p.age=n.getFullYear()-(+p.dob.slice(0,4));
    p.slug=bdSlug(p.name);p.year=n.getFullYear();p.muslim=bdMuslim(p.name);
    p.sent=p.cases.some(function(c){return c.bdaySent&&c.bdaySent[p.slug]===p.year});
    return p;
  }).sort(function(a,b){return a.days-b.days||a.name.localeCompare(b.name)});
  var missing=Object.keys(noDob).filter(function(k){return !withDob[k]}).length;
  return {list:list,missing:missing};
}
function bdCounts(list){var c={today:0,week:0,month:0,all:list.length};list.forEach(function(p){if(p.sent)return;if(p.days===0)c.today++;if(p.days<=7)c.week++;if(p.days<=30)c.month++});return c}
function bdMessage(p){if(bdDraft[p.key]!=null)return bdDraft[p.key];var isl=bdMode(p)==='isl',g=isl?bdGender(p):'',who=g==='m'?'brother':g==='f'?'sister':bdFirst(p.name),t=bdList(p)[bdPick(p)].replace(/\{name\}/g,who),sg=bdSig().trim();if(isl&&g==='f')t=t.replace(/\bfeek\b/g,'feeki');return sg?t+'\n\n'+sg:t}
function bdShell(){
  return '<div class="pagehead"><h1>Birthdays</h1><span class="muted">Send a birthday message with one click</span></div><div id="bdTplBox"></div><div class="filters" style="margin:10px 0"><input type="search" id="bdQ" class="search" style="width:100%" placeholder="Search by name" aria-label="Search birthdays" value="'+esc(bdQuery)+'"></div><div id="bdChips" class="chips" style="margin:10px 0"></div><div id="bdList"></div>';
}
function bdTplRender(){
  var b=$('#bdTplBox');if(!b)return;
  b.innerHTML=bdTplOpen?'<div class="bdc" style="border-left-color:var(--accent)"><b>Birthday messages</b><div class="muted" style="font-size:12px;margin:2px 0 6px">'+bdMsgs().length+' messages. Each client is given one of them automatically (standard greetings). Write {name} where the first name goes, and put a line with --- between messages.</div><textarea id="bdMsgsText" rows="14">'+esc(bdMsgs().join('\n---\n'))+'</textarea><div class="muted" style="font-size:12px;margin:8px 0 2px">Signature, added at the end of every message</div><textarea id="bdSigText" rows="3">'+esc(bdSig())+'</textarea><div class="muted" style="font-size:12px;margin:10px 0 2px">Islamic greetings ('+bdIsl().length+'). Used first for clients whose names suggest they may be Muslim. Write {name} where "brother" or "sister" should go (chosen from the name, and you can change it on each client). Same format, with --- between messages.</div><textarea id="bdIslText" rows="10">'+esc(bdIsl().join('\n---\n'))+'</textarea><div class="add" style="margin-top:8px"><button type="button" class="btn" id="bdTplSave">Save</button><button type="button" class="btn ghost" id="bdTplReset">Reset to the standard messages</button><button type="button" class="btn ghost" id="bdTplBtn">Close</button></div></div>':'<button type="button" class="btn ghost sm" id="bdTplBtn">Edit messages and signature</button>';
}
function bdDobText(p){var y=+p.dob.slice(0,4),d=new Date(y,+p.dob.slice(5,7)-1,+p.dob.slice(8,10));return d.toLocaleDateString('en-GB',y>=1900&&y<=TODAY.getFullYear()?{day:'numeric',month:'short',year:'numeric'}:{day:'numeric',month:'short'})}
function bdSentAt(p){var t=0;p.cases.forEach(function(c){if(c.bdaySent&&c.bdaySent[p.slug]===p.year&&c.bdaySentAt&&c.bdaySentAt[p.slug]>t)t=c.bdaySentAt[p.slug]});return t}
function bdItem(p){
  var intl=bdIntl(p.phone),open=bdOpen[p.key]!==undefined?bdOpen[p.key]:p.days<=7;
  var when=p.days===0?'Today':p.days===1?'Tomorrow':p.next.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
  var meta=[when+(p.days>1?' · in '+p.days+' days':''),(p.age>=16&&p.age<=110?'turns '+p.age:''),p.phone?esc(p.phone):'no phone number'].filter(Boolean).join(' · ');
  var c0=p.cases.slice().sort(function(a,b){return (b.updatedAt||0)-(a.updatedAt||0)})[0],sa=p.sent?bdSentAt(p):0;
  var h='<div class="bdc'+(p.sent?' sent':'')+'" data-bdkey="'+esc(p.key)+'"><div class="bdh"><div><b>'+esc(p.name)+'</b> <span class="muted" style="font-size:13px">🎂 '+esc(bdDobText(p))+'</span>'+(p.sent?'<span class="bdok">✓ Sent'+(sa?' '+shortStamp(sa):'')+'</span>':'')+'</div><div class="muted" style="font-size:12px">'+meta+' · <button type="button" class="lnk" data-open="'+c0.id+'">'+(c0.clientNo?esc(c0.clientNo):'open case')+'</button></div></div>';
  if(!open)return h+'<div class="add" style="margin-top:6px"><button type="button" class="btn ghost sm" data-bdopen="'+esc(p.key)+'">Write message</button><label class="bdchk"><input type="checkbox" data-bdchk="'+esc(p.key)+'"'+(p.sent?' checked':'')+'> Sent</label></div></div>';
  var isl=bdMode(p)==='isl',tip=isl&&p.muslim&&!bdKind[p.key]?'<div class="muted" style="font-size:12px;margin:4px 0">Suggested: Islamic greeting, chosen from the name. Check it suits this client, or switch to the standard greeting.</div>':'';if(isl&&!bdGender(p))tip+='<div style="font-size:12px;margin:4px 0;color:#8A5A00">Choose Brother or Sister below. The name does not show which, so the first name is used until you pick.</div>';
  return h+tip+'<textarea data-bdmsg="'+esc(p.key)+'" rows="7" aria-label="Birthday message for '+esc(p.name)+'">'+esc(bdMessage(p))+'</textarea><div class="add" style="margin-top:6px">'+
    (intl?'<button type="button" class="btn bdwa" data-bdsend="'+esc(p.key)+'">Send on WhatsApp</button>':'<span class="muted" style="align-self:center;font-size:12px">Add a phone number to the case to send on WhatsApp.</span>')+
    (isl?bdGenBtns(p):'')+'<button type="button" class="btn ghost" data-bdkind="'+esc(p.key)+'">'+(isl?'Use standard greeting':'Use Islamic greeting')+'</button><button type="button" class="btn ghost" data-bdshuf="'+esc(p.key)+'" title="Pick a different message">Another message</button><button type="button" class="btn ghost" data-bdcopy="'+esc(p.key)+'">Copy message</button><label class="bdchk"><input type="checkbox" data-bdchk="'+esc(p.key)+'"'+(p.sent?' checked':'')+'> Sent</label>'+(bdOpen[p.key]!==undefined&&p.days>7?'<button type="button" class="btn ghost sm" data-bdopen="'+esc(p.key)+'">Hide</button>':'')+'</div></div>';
}
function bdRender(){
  var box=$('#bdList');if(!box)return;
  var ae=document.activeElement;if(ae&&ae.matches&&ae.matches('[data-bdmsg]'))return;
  var r=bdPeople(),cnt=bdCounts(r.list),q=bdQuery.trim().toLowerCase();
  var chips=[['today','Today'],['week','Next 7 days'],['month','Next 30 days'],['all','All']];
  $('#bdChips').innerHTML=chips.map(function(c){return '<button type="button" data-bdf="'+c[0]+'" aria-pressed="'+(bdFilter===c[0])+'">'+c[1]+' '+cnt[c[0]]+'</button>'}).join('');
  var max={today:0,week:7,month:30,all:400}[bdFilter];
  var items=r.list.filter(function(p){return p.days<=max&&(!q||p.name.toLowerCase().indexOf(q)>-1)});
  var h='';
  if(!r.list.length)h='<div class="empty"><h2>No birthdays yet</h2>Birthdays come from the date of birth saved on each client. Add dates of birth to the cases and they will appear here.</div>';
  else if(!items.length)h='<div class="empty">Nobody has a birthday in this period.</div>';
  else{
    var groups=[['Today',function(p){return p.days===0}],['Next 7 days',function(p){return p.days>0&&p.days<=7}],['Next 30 days',function(p){return p.days>7&&p.days<=30}],['Later',function(p){return p.days>30}]];
    groups.forEach(function(g){var gi=items.filter(g[1]);if(!gi.length)return;h+='<div class="tgh">'+g[0]+' · '+gi.length+'</div>'+gi.map(bdItem).join('')});
  }
  if(r.missing)h+='<p class="muted" style="margin-top:14px">'+r.missing+' client'+(r.missing===1?' has':'s have')+' no date of birth saved, so they cannot appear here.</p>';
  box.innerHTML=h;
}
function bdFind(key){return bdPeople().list.filter(function(p){return p.key===key})[0]}
function bdText(p){var ta=document.querySelector('[data-bdmsg="'+(window.CSS&&CSS.escape?CSS.escape(p.key):p.key)+'"]');return ta?ta.value:bdMessage(p)}
function bdSetSent(p,on){
  var jobs=[];
  p.cases.forEach(function(c){
    var o=Object.assign({},c.bdaySent||{}),at=Object.assign({},c.bdaySentAt||{});
    if(on){if(c!==p.cases[0])return;o[p.slug]=p.year;at[p.slug]=Date.now()}
    else{if(o[p.slug]!==p.year)return;delete o[p.slug];delete at[p.slug]}
    jobs.push([c,{bdaySent:o,bdaySentAt:at}]);
  });
  jobs.forEach(function(j){patch(j[0].id,j[1])});
}
function bdBanner(){
  var b=$('#bdBanner');if(!b)return;
  var c=bdCounts(bdPeople().list);
  b.innerHTML=(c.today||c.week)?'<div class="bdban"><b>🎂 Birthdays</b><span>'+(c.today?c.today+' today':'none today')+' · '+c.week+' in the next 7 days</span><button type="button" class="btn sm" data-bdgo="1" style="margin-left:auto">Send birthday messages</button></div>':'';
}
function shortStamp(ts){return new Date(ts).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
var editNote=null,editTk=null;
function tkKey(t){return (t.due||'9999-99-99')+' '+(t.time||'99:99')}
function tkEditor(k,t){return '<div class="tkedit" data-tkbox="'+k+'"><input type="text" data-tkf="text" value="'+esc(t.text)+'" aria-label="Task"><input type="date" data-tkf="due" value="'+esc(t.due||'')+'" aria-label="Due date"><input type="time" data-tkf="time" value="'+esc(t.time||'')+'" aria-label="Time"><label class="prichk"><input type="checkbox" data-tkf="pri"'+(t.pri?' checked':'')+'> High priority</label><button type="button" class="btn" data-tkesave="'+k+'">Save</button><button type="button" class="btn ghost" data-tkecancel="1">Cancel</button></div>'}
function rerenderTasks(){if(openId)renderLive();if($('#trList'))renderTray();renderSide()}
function noteItem(n,list,suffix,fmt){
  var head=stampOf(n.ts)+suffix+(n.edited?' · edited '+shortStamp(n.edited):'');
  if(editNote&&editNote.list===list&&editNote.ts===n.ts)
    return '<div class="note"><small>'+head+'</small><textarea id="ntEdit" class="nbb" style="min-height:140px" aria-label="Edit note">'+esc(n.text||'')+'</textarea><div class="add"><button type="button" class="btn" id="ntEditSave">Save changes</button><button type="button" class="btn ghost" id="ntEditCancel">Cancel</button></div>'+tblBlock(n,list)+'</div>';
  return '<div class="note"><small>'+head+' <button type="button" class="btn ghost sm" data-nedit="'+list+'|'+n.ts+'" style="margin-left:8px">Edit</button></small>'+fmt(n.text)+tblBlock(n,list)+'</div>';
}
var colOpen={};
/* ---------- connected clients ---------- */
var curLinks=[],lkOpen=false;
var REL_OPTS=['Spouse / partner','Parent','Child','Grandparent','Grandchild','Sibling','Other relative','Friend','Colleague','Business partner','Employer','Employee','Referred by','Referred client','Other'];
var REL_INV={'Spouse / partner':'Spouse / partner','Parent':'Child','Child':'Parent','Grandparent':'Grandchild','Grandchild':'Grandparent','Sibling':'Sibling','Other relative':'Other relative','Friend':'Friend','Colleague':'Colleague','Business partner':'Business partner','Employer':'Employee','Employee':'Employer','Referred by':'Referred client','Referred client':'Referred by','Other':'Other'};
function lkById(id){return cases.filter(function(x){return x.id===id})[0]}
function nkey(c){return names(c).toLowerCase()}
function lkGroup(c){if(!c)return[];var k=nkey(c);return cases.filter(function(x){return nkey(x)===k})}
function lkIds(g){var o={};g.forEach(function(x){o[x.id]=1});return o}
function lkEdges(){
  var me=currentCase(),g=me?lkGroup(me):[],gids=lkIds(g),seen={},list=[];
  function add(o,rel){if(!o||gids[o.id]||o.id===openId)return;var k=nkey(o);if(seen[k])return;seen[k]=1;list.push({o:o,rel:rel})}
  curLinks.forEach(function(l){add(lkById(l.cid),l.rel)});
  g.forEach(function(x){if(x.id===openId)return;(x.links||[]).forEach(function(l){add(lkById(l.cid),l.rel)})});
  cases.forEach(function(x){if(gids[x.id])return;(x.links||[]).forEach(function(l){if(gids[l.cid])add(x,REL_INV[l.rel]||l.rel)})});
  return list;
}
function lkSave(){if(openId)patch(openId,{links:curLinks.map(function(l){return {id:l.id,cid:l.cid,rel:l.rel}})})}
function lkDrop(target){
  if(!target)return;
  var me=currentCase(),mg=me?lkGroup(me):[],mids=lkIds(mg),tg=lkGroup(target),tids=lkIds(tg);
  curLinks=curLinks.filter(function(l){return !tids[l.cid]});
  mg.forEach(function(x){if(x.id===openId)return;var n=(x.links||[]).filter(function(l){return !tids[l.cid]});if(n.length!==(x.links||[]).length)patch(x.id,{links:n})});
  tg.forEach(function(x){var n=(x.links||[]).filter(function(l){return !mids[l.cid]});if(n.length!==(x.links||[]).length)patch(x.id,{links:n})});
  lkSave();
}
function lkSet(target,rel){
  if(!target)return;lkDrop(target);
  var tg=lkGroup(target).sort(function(a,b){return (b.createdAt||0)-(a.createdAt||0)})[0]||target;
  curLinks.push({id:Math.random().toString(36).slice(2,9),cid:tg.id,rel:rel});lkSave();
}
function lkCaseLine(x){
  var bits=[STAGE_LABEL[stageOf(x)]||'',x.type||'',fmtField(x,T.sub),fv(x,T.value.k)!==''?money(fv(x,T.value.k)):'',reviewOf(x)?T.reviewWord+' '+fd(reviewOf(x)):''].filter(Boolean);
  return '<div class="lkc">'+bits.map(esc).join(' · ')+'</div>';
}
function lkActivity(g){
  var tk=0,nn=0,last=null;
  g.forEach(function(x){(x.tasks||[]).forEach(function(t){if(!t.done)tk++});(x.notes||[]).forEach(function(n){nn++;if(!last||(n.ts||0)>(last.ts||0))last=n})});
  var s=tk+' open task'+(tk===1?'':'s')+' · '+nn+' note'+(nn===1?'':'s');
  if(last)s+=' · latest '+new Date(last.ts||0).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})+': '+String(last.text||'').replace(/\s+/g,' ').slice(0,90);
  return s;
}
function renderLinks(){
  var box=document.getElementById('linksBox');if(!box)return;
  var ed=lkEdges(),me=currentCase(),mids=lkIds(me?lkGroup(me):[]),taken={};
  ed.forEach(function(e){taken[nkey(e.o)]=1});
  var opts={};cases.forEach(function(x){var k=nkey(x);if(mids[x.id]||x.id===openId||taken[k]||k==='unnamed client')return;opts[names(x)]=1});
  var h=ed.map(function(e){
    var g=lkGroup(e.o).sort(function(a,b){return (b.createdAt||0)-(a.createdAt||0)});
    return '<div class="lkrow"><div class="lkh"><button type="button" class="lnk" data-lkopen="'+e.o.id+'"><b>'+esc(names(e.o))+'</b></button>'+
      '<select data-lkrel="'+e.o.id+'" aria-label="Relationship">'+REL_OPTS.map(function(r){return '<option'+(r===e.rel?' selected':'')+'>'+esc(r)+'</option>'}).join('')+'</select>'+
      '<button type="button" class="btn ghost sm" data-lkdel="'+e.o.id+'">Remove</button></div>'+
      g.map(lkCaseLine).join('')+'<div class="muted lkact">'+esc(lkActivity(g))+'</div></div>';
  }).join('');
  if(!ed.length)h='<p class="muted" style="margin:0 0 8px">No connected clients yet.</p>';
  h+='<div class="lkadd"><input id="lkQ" list="lkDL" placeholder="Search client name" autocomplete="off"><select id="lkRel" aria-label="They are this client\'s">'+REL_OPTS.map(function(r){return '<option>'+esc(r)+'</option>'}).join('')+'</select><button type="button" class="btn sm" id="lkAdd">Add</button></div>'+
    '<datalist id="lkDL">'+Object.keys(opts).sort().map(function(n){return '<option value="'+esc(n)+'">'}).join('')+'</datalist>'+
    '<p class="muted" style="font-size:12px;margin:6px 0 0">Pick the client, then choose who they are to this client (for example Parent). The link shows on both records.</p>';
  box.innerHTML=h;
  var lt=document.getElementById('lkTitle');if(lt)lt.textContent='Connected clients ('+ed.length+')';
  box.style.display=lkOpen?'':'none';var tg=document.getElementById('lkToggle');if(tg){tg.textContent=lkOpen?'Hide':'Show';tg.setAttribute('aria-expanded',lkOpen?'true':'false')}
}
document.addEventListener('click',function(e){
  var t=e.target;if(!t||!t.closest)return;
  if(t.closest('#lkToggle')){lkOpen=!lkOpen;renderLinks();return}
  var b=t.closest('[data-lkopen]');
  if(b){e.preventDefault();var id=b.getAttribute('data-lkopen');if(openId&&document.getElementById('caseForm'))patch(openId,collectForm());openDrawer(id);return}
  b=t.closest('[data-lkdel]');
  if(b){if(!b.classList.contains('armed')){b.classList.add('armed');b.textContent='Confirm remove';return}lkDrop(lkById(b.getAttribute('data-lkdel')));renderLinks();setTimeout(renderLinks,200);toast('Connection removed');return}
  if(t.closest('#lkAdd')){
    var q=document.getElementById('lkQ'),r=document.getElementById('lkRel'),nm=((q&&q.value)||'').trim().toLowerCase();
    var me=currentCase(),mids=lkIds(me?lkGroup(me):[]);
    var cand=cases.filter(function(x){return nkey(x)===nm&&!mids[x.id]&&x.id!==openId});
    if(!nm||!cand.length){toast('Choose a client from the list');return}
    lkSet(cand[0],r.value);renderLinks();setTimeout(renderLinks,200);toast('Clients connected');
  }
});
document.addEventListener('change',function(e){var s=e.target;if(s&&s.hasAttribute&&s.hasAttribute('data-lkrel')){lkSet(lkById(s.getAttribute('data-lkrel')),s.value);renderLinks();setTimeout(renderLinks,200)}});

function decorateSecs(){
  var f=document.getElementById('caseForm');if(!f)return;
  var fs=f.querySelectorAll('fieldset');
  for(var i=0;i<fs.length;i++){
    var x=fs[i],lg=x.querySelector(':scope>legend');if(!lg||lg.querySelector('.colbtn'))continue;
    var t=(lg.firstChild&&lg.firstChild.nodeType===3?lg.firstChild.nodeValue:lg.textContent).replace(/\(\d+\)/,'').trim().toLowerCase();
    if(x.id==='peopleFs'||t.indexOf('applicants')===0){x.setAttribute('data-col','applicants');continue}
    if(x.id==='pickClient'||x.querySelector('#pickSel,#pcSel'))continue;
    x.setAttribute('data-col',t);
    var open=!!colOpen[t];x.classList.toggle('col-closed',!open);
    var b=document.createElement('button');b.type='button';b.className='btn ghost sm secbtn colbtn';b.setAttribute('data-coltoggle',t);b.textContent=open?'Hide':'Show';
    lg.appendChild(document.createTextNode(' '));lg.appendChild(b);
  }
}
function renderLive(){
  var box=$('#live');if(!box)return;
  if(!openId){var nb0=$('#liveNotes');if(nb0)nb0.innerHTML='';box.innerHTML='<fieldset><legend>Tasks and notes</legend><span class="muted">Add a name first. The '+N1()+' saves itself, then you can add tasks and notes here.</span></fieldset>';decorateSecs();return}
  var c=currentCase();if(!c)return;
  var ts=(c.tasks||[]).slice().sort(function(a,b){return (a.done?1:0)-(b.done?1:0)||((b.pri&&!b.done?1:0)-(a.pri&&!a.done?1:0))||(tkKey(a)<tkKey(b)?-1:tkKey(a)>tkKey(b)?1:0)});
  var ns=(c.notes||[]).slice().sort(function(a,b){return b.ts-a.ts});
  var tasksHtml='<fieldset><legend>Tasks</legend>'+
    (ts.length?ts.map(function(t){var tk0=c.id+'|'+t.id;if(editTk===tk0)return '<div class="task">'+tkEditor(tk0,t)+'</div>';return '<div class="task'+(t.done?' done':'')+(t.pri&&!t.done?' pri':'')+'"><input type="checkbox" data-tk="'+t.id+'"'+(t.done?' checked':'')+' aria-label="Done"><span class="t">'+esc(t.text)+'</span>'+(t.created?'<span class="muted" style="font-size:11px;white-space:nowrap">Added '+shortStamp(t.created)+'</span>':'')+(t.due?'<span class="chip '+(t.done?'':tone(t.due))+'">'+fd(t.due)+(t.time?' · '+esc(t.time):'')+'</span>':'')+'<button type="button" class="star'+(t.pri?' on':'')+'" data-tkpri="'+tk0+'" title="High priority" aria-label="Toggle high priority">'+(t.pri?'★':'☆')+'</button><button type="button" class="btn ghost sm" data-tkedit="'+tk0+'">Edit</button><button type="button" class="x" data-rmtk="'+t.id+'" aria-label="Delete task">×</button></div>'}).join(''):'<span class="muted">No tasks yet.</span>')+
    '<div class="add"><input type="text" id="tkText" placeholder="Add a task, e.g. '+esc(T.taskHint)+'" aria-label="New task"><input type="date" id="tkDue" aria-label="Due date"><input type="time" id="tkTime" aria-label="Time"><label class="prichk"><input type="checkbox" id="tkPri"> High priority</label><button type="button" class="btn ghost" id="tkAdd">Add task</button><button type="button" class="btn" id="tkBook">Book appointment</button></div></fieldset>';
  box.innerHTML=((T.extraLog||(c.protection||[]).length)?protFs(c):'')+(T.tenancyMode?'':docsFs(c));
  var nb=$('#liveNotes');if(nb)nb.innerHTML='<div style="margin-bottom:14px">'+tasksHtml+'</div><fieldset><legend>Notes ('+ns.length+')</legend><div class="add" style="margin:0 0 8px"><button type="button" class="btn ghost sm" id="ntHide">'+(notesHidden?'Show notes':'Hide notes')+'</button></div>'+
    (notesHidden?'<span class="muted">Notes hidden.</span>':'<label class="f">New note<textarea id="ntText" rows="3" placeholder="File note, call summary, next step. You can also paste a table from Excel">'+esc(ntDraft)+'</textarea></label><div class="muted" style="font-size:12px;margin:-4px 0 8px">'+esc(T.dontRecord)+'</div><div id="ntTblBox">'+pendHtml('nt')+'</div><div class="add"><button type="button" class="btn ghost" id="ntStamp">Insert date and time</button><button type="button" class="btn ghost" id="ntAdd">Add note</button></div>'+
    (notesAll?ns:ns.slice(0,1)).map(function(n){return noteItem(n,'notes',(notesAll||ns.length<2?'':' (latest)'),paras)}).join('')+(ns.length>1?'<button type="button" class="btn ghost sm" id="ntAll">'+(notesAll?'Show latest only':'Show all '+ns.length+' notes')+'</button>':''))+'</fieldset>';
  decorateSecs();
}
var secHidden={};

function secFs(k,title){return '<fieldset data-sec="'+k+'"'+(secHidden[k]?' class="sec-hidden"':'')+'><legend>'+title+' <button type="button" class="btn ghost sm secbtn" data-sectoggle="'+k+'">'+(secHidden[k]?'Show':'Hide')+'</button></legend><div class="grid">'}
var notesHidden=false,notesAll=false,ntDraft='';

function stampOf(ts){return new Date(ts).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}

function collectForm(){
  var o={};
  document.querySelectorAll('#caseForm [data-f]').forEach(function(el){
    var k=el.getAttribute('data-f'),v=el.value;
    if(el.type==='number')o[k]=num(v);else o[k]=v.trim();
  });
  if(o.postcode!=null)o.postcode=pcFmt(o.postcode);
  o.applicants=[];
  document.querySelectorAll('#apps .app').forEach(function(row){
    var a={};row.querySelectorAll('[data-a]').forEach(function(i){a[i.getAttribute('data-a')]=i.value.trim()});
    if(Object.keys(a).some(function(k){return a[k]}))o.applicants.push(a);
  });
  T.fields.forEach(function(f){if(f.auto&&o[f.k]&&o[f.k]===autoOf(o,f))o[f.k]=''});
  if($('#secs'))o.securities=[];
  document.querySelectorAll('#secs .sec2').forEach(function(card){
    var sid0=card.getAttribute('data-sid'),old0=((currentCase()||{}).securities||[]).filter(function(q){return q.id===sid0})[0]||{};var x=Object.assign({},old0,{id:sid0});
    card.querySelectorAll('[data-s]').forEach(function(i){var k=i.getAttribute('data-s');x[k]=i.type==='number'?num(i.value):i.value.trim()});
    var a2=x.fixedUntil?addMonths(x.fixedUntil,-REVM):'';if(x.reviewDate===a2)x.reviewDate='';
    var has=['address','lender','lenderRef','product','fixedUntil','reviewDate','erc','mortgageExpiry','rate','followOnRate','monthlyPayment','loanAmount'].some(function(k){return x[k]});
    if(has&&o.securities)o.securities.push(x);
  });
  var tns=tnCollect();if(tns){o.tenancies=tns;o.applicants=[];tns.forEach(function(tn){if((tn.status||'current')==='current')(tn.people||[]).forEach(function(p){if(p.name)o.applicants.push(p)})});var oc=occOf(o);o.stage=oc==='Let'?'let':oc==='Vacant'?'vacant':'notice'}
  o.links=curLinks.map(function(l){return {id:l.id,cid:l.cid,rel:l.rel}});
  return o;
}
function hasIdent(o){return T.tenancyMode?!!String(o.propertyAddress||'').trim():o.applicants.length>0}
/* ---------- quick add (landlord): four boxes make the property; everything else can be added later ---------- */
function qaOpen(){
  overlay('qaOv','<div class="dhd"><h2>Add a property</h2><button type="button" class="btn ghost" data-qaclose="1">Close</button></div>'+
   '<p class="muted" style="margin:6px 0 12px">Just the basics to start. Certificates, mortgage, deposit and documents can be added later, when you open the property.</p>'+
   '<form id="qaForm" autocomplete="off" novalidate><div class="grid">'+
   '<label class="f wide">Address line one (required)<input id="qa-addr" maxlength="120" placeholder="e.g. 1 Example Road"></label>'+
   '<label class="f">Postcode<input id="qa-pc" maxlength="10"></label>'+
   '<label class="f">Rent a month<span class="ig"><i>£</i><input id="qa-rent" type="number" step="any" min="0" inputmode="decimal"></span></label>'+
   '<label class="f wide">Tenant name (leave empty if the property is not let yet)<input id="qa-tn" maxlength="80"></label></div>'+
   '<p id="qaMsg" role="alert" style="margin:0 0 8px;color:#b3261e;font-size:13px;font-weight:600"></p>'+
   '<div class="add" style="justify-content:flex-end;margin:0"><button type="button" class="btn ghost" data-qamore="1">Add full details now</button><button type="submit" class="btn" id="qaGo">Add property</button></div></form>');
  var a=$('#qa-addr');if(a)a.focus();
}
function qaRead(){var v=function(k){return String(($('#qa-'+k)||{}).value||'').trim()};return {addr:v('addr'),pc:pcFmt(v('pc')),rent:num(v('rent')),tn:v('tn')}}
function qaData(q){
  var d={propertyAddress:q.addr,postcode:q.pc,type:T.types[0],stage:q.tn?'let':T.defaultStage,clientNo:nextClientNo(),tenancies:[]};
  if(q.tn||q.rent)d.tenancies.push({id:'t'+uid(),status:'current',tenantType:'private',people:q.tn?[{name:q.tn}]:[],rent:q.rent||'',rentFreq:'Monthly'});
  return d;
}
function qaSave(){
  var q=qaRead(),m=$('#qaMsg'),go=$('#qaGo');
  if(!q.addr){if(m)m.textContent='Add address line one of the property.';var a=$('#qa-addr');if(a)a.focus();return}
  if(!col){if(m)m.textContent='Saving is not available. Sign in to store your properties.';return}
  if(go)go.disabled=true;
  var d=qaData(q),ref=col.doc();d.createdAt=Date.now();d.updatedAt=d.createdAt;d.tasks=[];d.notes=[];
  write(ref.id,function(){return ref.set(d)}).then(function(){closeOv('qaOv');toast('Property added. Open it any time to add certificates, mortgage and documents.')},function(){if(go)go.disabled=false;if(m)m.textContent='Could not save the property. Check you are online, then try again.'});
}
document.addEventListener('submit',function(e){if(e.target&&e.target.id==='qaForm'){e.preventDefault();qaSave()}});
document.addEventListener('click',function(e){
  var t=e.target;if(!t||!t.closest)return;
  if(t.closest('[data-qaclose]')||t.id==='qaOv'){closeOv('qaOv');return}
  if(t.closest('[data-qamore]')){var q=qaRead();closeOv('qaOv');openDrawer(null,{propertyAddress:q.addr,postcode:q.pc});return}
});
function saveCase(){
  var data=collectForm();
  if(!hasIdent(data)){if(!openId&&JSON.stringify(data)===newBase){closeDrawer();return}toast(T.tenancyMode?'Add address line one of the property':'Add at least one name');if(T.tenancyMode)paNeed();return}
  var btn=$('#saveCloseBtn');if(btn)btn.disabled=true;
  var p;
  if(openId){p=patch(openId,data)}
  else{
    if(!data.clientNo)data.clientNo=nextClientNo();
    var ref=col.doc();data.createdAt=Date.now();data.updatedAt=data.createdAt;data.tasks=[];data.notes=pendingNotes;
    p=write(ref.id,function(){return ref.set(data)}).then(function(){openId=ref.id});
  }
  p.then(function(){toast(T.noun[0]+' saved');closeDrawer()});
}

/* ---------- export ---------- */
function exportCsv(){
  claude.use('downloads').then(function(dl){
    if(!dl){toast('Downloads are not available in this view');return}
    var flds=T.fields;
    function q(v){return '"'+csvCell(v).replace(/"/g,'""')+'"'}
    if(T.tenancyMode)flds=flds.concat([{k:'_tenants',l:'Current tenants'},{k:'_rent',l:'Rent a month'}]);
    var lines=[['Client','Client number','Stage','Type','Phones','Emails'].concat(flds.map(function(f){return f.l.replace(/\s*\((?=[^)]*\s)[^)]*\)$/,'')})).map(q).join(',')];
    cases.forEach(function(c){var ap=c.applicants||[];lines.push([names(c),c.clientNo,STAGE_LABEL[stageOf(c)],c.type,ap.map(function(a){return a.phone||''}).filter(Boolean).join(' | '),ap.map(function(a){return a.email||''}).filter(Boolean).join(' | ')].concat(flds.map(function(f){return f.k==='_tenants'?tnCurrent(c).map(tnNames).join(' | '):f.k==='_rent'?Math.round(rentSum(c)*100)/100:fv(c,f.k)})).map(q).join(','))});
    return dl.save({filename:NS()+'-'+iso(TODAY)+'.csv',data:'\ufeff'+lines.join('\r\n')}).then(function(){toast('CSV saved')},function(e){if(e&&e.code!=='declined')toast('Could not save the file')});
  });
}

/* ---------- task tray ---------- */
var trayOpen=false,trFilter='open',trQuery='',trOpen={};
function allTasks(){var out=[];cases.forEach(function(c){if(c.stage==='lost')return;(c.tasks||[]).forEach(function(t){out.push({c:c,t:t})})});return out}
function trBucket(x){var d=x.t.due;if(x.t.done)return 'done';if(!d)return 'none';var n=diff(d);return n<0?'over':n===0?'today':n<=7?'week':'later'}
function updTrayBtn(){var b=$('#trayBtn');if(!b)return;var od=allTasks().filter(function(x){return trBucket(x)==='over'}).length;b.innerHTML='Tasks'+(od?'<span class="tbadge">'+od+' overdue</span>':'')}
var TR_LABEL={pri:'High priority',over:'Overdue',today:'Due today',week:'Next 7 days',later:'Later',none:'No due date',done:'Done'};
function trItem(x){
  var c=x.c,t=x.t,b=trBucket(x),k=c.id+'|'+t.id;
  if(editTk===k)return '<div class="tt"><div class="tm">'+tkEditor(k,t)+'<div><button type="button" class="lnk" data-open="'+c.id+'">'+esc(names(c))+cno(c)+'</button></div></div></div>';
  var open=!!trOpen[k],dchip=t.due?'<span class="chip '+(b==='over'?'bad':b==='today'?'warn':'')+'">'+(b==='today'?'Today':fd(t.due))+(t.time?' '+esc(t.time):'')+'</span>':'<span class="muted" style="font-size:12px">No date</span>';
  return '<div class="tt '+(b==='over'?'bad':b==='today'?'warn':'')+(t.done?' done':'')+(t.pri&&!t.done?' pri':'')+(open?' open':'')+'"><input type="checkbox" data-trk="'+k+'"'+(t.done?' checked':'')+' aria-label="Mark done"><div class="tm"><div class="trow" data-trtog="'+k+'" role="button" tabindex="0" aria-expanded="'+open+'"><div class="tx">'+(t.pri&&!t.done?'<span class="prtag">HIGH</span> ':'')+esc(t.text)+'</div>'+dchip+'</div><div><button type="button" class="lnk" data-open="'+c.id+'">'+esc(names(c))+cno(c)+'</button></div>'+(open?(t.created?'<div class="muted" style="font-size:12px">Added '+shortStamp(t.created)+'</div>':'')+'<div class="tact"><input type="date" data-trd="'+k+'" value="'+esc(t.due||'')+'" aria-label="Due date"><input type="time" data-trt="'+k+'" value="'+esc(t.time||'')+'" aria-label="Time"><button type="button" class="star'+(t.pri?' on':'')+'" data-tkpri="'+k+'" title="High priority" aria-label="Toggle high priority">'+(t.pri?'★':'☆')+'</button><button type="button" class="btn ghost sm" data-tkedit="'+k+'">Edit</button><button type="button" class="btn ghost sm" data-snz="'+k+'|1">+1 day</button><button type="button" class="btn ghost sm" data-snz="'+k+'|7">+1 week</button></div>':'')+'</div></div>';
}
var sideOn=true;
var mqSide=window.matchMedia('(min-width:760px)');
function placeAcct(){}
function sideVisible(){var sd=document.getElementById('side');return !!sd&&document.body.classList.contains('side-on')&&getComputedStyle(sd).display!=='none'}
function applySide(){document.body.classList.toggle('side-on',sideOn);if(sideVisible()&&view==='reminders'){view='tasks';render()}renderNav();placeAcct();var h=document.querySelector('header.top');if(h)document.documentElement.style.setProperty('--hh',h.offsetHeight+'px');renderSide();renderRem()}
if(mqSide.addEventListener)mqSide.addEventListener('change',function(){applySide()});
window.addEventListener('resize',function(){if(sideVisible()&&view==='reminders'){view='tasks';render()}renderNav();var h=document.querySelector('header.top');if(h)document.documentElement.style.setProperty('--hh',h.offsetHeight+'px')});
function sideItem(e,g){
  return '<div class="si'+(g==='over'?' over':'')+'"><div style="min-width:0;flex:1"><button type="button" class="lnk st" data-open="'+e.id+'">'+esc(e.who)+'</button><div class="sc">'+esc(e.label)+'</div><div class="sd">'+fd(e.date)+' · '+esc(rel(e.date))+'</div></div><button type="button" class="btn ghost sm" data-remdone="'+e.id+'|'+esc(e.key)+'|'+e.date+'"'+(e.rep?' data-rep="1" title="Remind me again in 30 days. Update the date when it is renewed.">In 30 days':' title="Hide this reminder">Done')+'</button></div>';
}
var sideLater=false;
function renderSide(){
  var s=$('#sideTasks');if(!s||!document.body.classList.contains('side-on')){if(s)s.innerHTML='';return}
  var bt=bdCounts(bdPeople().list).today;
  if(T.tenancyMode){var an=bizName()||(profA().name)||'';s.innerHTML='<div id="sideTools"><div class="sh acctname"><b>Account</b>'+(an?'<span>'+esc(an)+'</span>':'')+'</div><button type="button" class="sbtn" data-v="myhome"'+(view==='myhome'?' aria-current="page"':'')+'><span style="display:flex;flex-direction:column;min-width:0"><span>My home</span>'+homeSmall()+'</span></button><button type="button" class="sbtn" data-gnopen="1">Reports and agreements</button><button type="button" class="sbtn" data-v="more" aria-expanded="'+(navMore||view==='notebook')+'">More<span aria-hidden="true" style="font-size:10px;margin-left:8px">'+(navMore||view==='notebook'?'&#9650;':'&#9660;')+'</span></button>'+(navMore||view==='notebook'?'<button type="button" class="sbtn" data-v="notebook"'+(view==='notebook'?' aria-current="page"':'')+'>Notebook</button><button type="button" class="sbtn" data-bookappt="1">Book appointment</button>':'')+'<button type="button" class="sbtn acct" data-sideacct="1" style="margin:auto 0 6px">Settings</button><button type="button" class="sbtn logout" id="logoutBtn">Log out</button></div>';return}
  var items=toolItems([['invoices','Quotes & invoices'],['calculator','Mortgage Calculator'],['notebook','Notebook'],['birthdays','Birthdays'],['marketing','Marketing']]);
  s.innerHTML='<div id="sideTools"><div class="sh"><b>Tools</b></div>'+items.map(function(i){return '<button type="button" class="sbtn" data-v="'+i[0]+'"'+(view===i[0]?' aria-current="page"':'')+'>'+i[1]+(i[0]==='birthdays'&&bt?'<span class="badge" style="background:#fde4ee;color:#c2185b">'+bt+' today</span>':'')+'</button>'}).join('')+'<button type="button" class="sbtn acct" data-sideacct="1">Settings</button><button type="button" class="sbtn logout" id="logoutBtn">Log out</button></div>';
}
function renderRem(){
  var s=$('#homeRem');if(!s)return;
  var ev=reviewEvents();
  var h='<div class="sh"><b>Reminders</b><span class="muted" style="font-size:12px">'+ev.length+' key date'+(ev.length===1?'':'s')+'</span></div>';
  [['over','Overdue',function(n){return n<0}],['week','Next 7 days',function(n){return n>=0&&n<=7}],['month','Next 30 days',function(n){return n>7&&n<=30}],['q','31 to 90 days',function(n){return n>30&&n<=90}],['later','Later',function(n){return n>90}]].forEach(function(g){
    var gi=ev.filter(function(e){return g[2](diff(e.date))});
    if(g[0]==='later'){if(gi.length)h+='<button type="button" class="sg sglater" data-sidelater="1" aria-expanded="'+sideLater+'">Later · '+gi.length+' <span>'+(sideLater?'▾':'▸')+'</span></button>'+(sideLater?gi.map(function(e){return sideItem(e,g[0])}).join(''):'');return}
    if(gi.length)h+='<div class="sg'+(g[0]==='over'?' bad':'')+'">'+g[1]+' · '+gi.length+'</div>'+gi.map(function(e){return sideItem(e,g[0])}).join('');
  });
  if(!ev.length)h+='<div class="muted" style="font-size:13px">Nothing due.</div>';
  s.innerHTML=h;
}
function renderTray(){
  var box=$('#trList');if(!box)return;
  bdBanner();
  var aeT=document.activeElement;if(editTk&&aeT&&aeT.closest&&aeT.closest('[data-tkbox]'))return;
  var q=trQuery.trim().toLowerCase(),all=allTasks();
  var cnt={open:0,over:0,today:0,week:0,none:0,done:0};
  all.forEach(function(x){var b=trBucket(x);if(b==='done')cnt.done++;else{cnt.open++;if(b==='over')cnt.over++;if(b==='today'){cnt.today++;cnt.week++}if(b==='week')cnt.week++;if(b==='none')cnt.none++}});
  var chips=[['open','All open'],['over','Overdue'],['today','Today'],['week','Next 7 days'],['none','No date'],['done','Done']];
  var tbk=$('#trBulk');if(tbk)tbk.innerHTML=cnt.over?'<span><b>'+cnt.over+' overdue.</b> Move them all to:</span> <button type="button" class="btn ghost sm" data-trbulk="today">Today</button><button type="button" class="btn ghost sm" data-trbulk="tomorrow">Tomorrow</button><button type="button" class="btn ghost sm" data-trbulk="monday">Next Monday</button>':'';
  $('#trChips').innerHTML=chips.map(function(c){return '<button type="button" data-trf="'+c[0]+'" aria-pressed="'+(trFilter===c[0])+'">'+c[1]+' '+cnt[c[0]]+'</button>'}).join('');
  var dl=$('#trCases');if(dl)dl.innerHTML=cases.slice().sort(function(a,b){return cnum(a)-cnum(b)}).map(function(c){return '<option value="'+esc((c.clientNo||'')+' · '+names(c))+'"></option>'}).join('');
  var items=all.filter(function(x){
    var b=trBucket(x);
    if(trFilter==='done'){if(b!=='done')return false}
    else{if(b==='done')return false;
      if(trFilter==='over'&&b!=='over')return false;
      if(trFilter==='today'&&b!=='today')return false;
      if(trFilter==='week'&&b!=='today'&&b!=='week')return false;
      if(trFilter==='none'&&b!=='none')return false}
    if(q&&(x.t.text+' '+names(x.c)+' '+(x.c.clientNo||'')).toLowerCase().indexOf(q)<0)return false;
    return true});
  items.sort(function(a,b){var da=tkKey(a.t),db2=tkKey(b.t);return da<db2?-1:da>db2?1:((a.t.created||0)-(b.t.created||0))||(cnum(a.c)-cnum(b.c))});
  if(!items.length){box.innerHTML='<div class="empty">Nothing here.</div>';return}
  var order=['pri','today','over','week','later','none','done'],h='';
  var isP=function(x){return !x.t.done&&!!x.t.pri};
  order.forEach(function(g){
    var gi=items.filter(function(x){return g==='pri'?isP(x):(!isP(x)&&trBucket(x)===g)});
    if(!gi.length)return;
    h+='<div class="tgh '+(g==='over'?'bad':g==='pri'?'prh':'')+'">'+TR_LABEL[g]+' · '+gi.length+'</div>'+gi.map(trItem).join('');
  });
  box.innerHTML=h;
}
function trBulk(w){
  var d=w==='today'?iso(TODAY):w==='tomorrow'?addDays(iso(TODAY),1):addDays(iso(TODAY),((8-TODAY.getDay())%7)||7),n=0;
  cases.forEach(function(c){
    if(c.stage==='lost'||!(c.tasks||[]).some(function(t){return !t.done&&t.due&&diff(t.due)<0}))return;
    var nt=(c.tasks||[]).map(function(t){if(!t.done&&t.due&&diff(t.due)<0){n++;return Object.assign({},t,{due:d})}return t});
    patch(c.id,{tasks:nt});
  });
  toast(n+' task'+(n===1?'':'s')+' moved to '+fd(d));
}
function taskShell(){
  return '<input type="search" id="trQ" class="search" style="width:100%;margin-top:10px" placeholder="Search tasks or clients" aria-label="Search tasks" value="'+esc(trQuery)+'"><div id="trBulk" class="trbulk"></div><div id="trChips" class="chips" style="margin:10px 0"></div><div id="trList"></div>';
}
function openTray(){
  trayOpen=true;var t=$('#tray');t.hidden=false;
  t.innerHTML='<div class="th"><div><div class="eyebrow">Task tray</div><h2>Tasks</h2></div><button type="button" class="btn ghost" data-trclose>Close</button></div><div class="tb"><div class="tadd"><input type="text" id="trNewText" class="wide2" placeholder="New task, e.g. '+esc(T.taskHint)+'" aria-label="New task"><input type="text" id="trNewCase" list="trCases" placeholder="Client (name or C number)" aria-label="Client"><datalist id="trCases"></datalist><input type="date" id="trNewDue" aria-label="Due date"><input type="time" id="trNewTime" aria-label="Time"><label class="prichk"><input type="checkbox" id="trNewPri"> High priority</label><button type="button" class="btn wide2" id="trAdd">Add task</button></div><input type="search" id="trQ" class="search" style="width:100%" placeholder="Search tasks or clients" aria-label="Search tasks" value="'+esc(trQuery)+'"><div id="trChips" class="chips"></div><div id="trList"></div></div>';
  renderTray();
}
function closeTray(){trayOpen=false;var t=$('#tray');t.hidden=true;t.innerHTML=''}
function trFind(key){var p=String(key).split('|');var c=cases.filter(function(x){return x.id===p[0]})[0];if(!c)return null;var t=(c.tasks||[]).filter(function(x){return x.id===p[1]})[0];return t?{c:c,t:t,n:+p[2]}:null}
function trSet(f,change){patch(f.c.id,{tasks:(f.c.tasks||[]).map(function(x){return x.id===f.t.id?Object.assign({},x,change):x})})}
function trAddTask(){
  var tx=$('#trNewText').value.trim(),cv=$('#trNewCase').value,due=$('#trNewDue').value,tmv=$('#trNewTime').value;if(tmv&&!due)due=iso(TODAY);
  if(!tx){toast('Type the task first');return}
  var no=cv.split(' · ')[0].trim().toUpperCase();
  var c=cases.filter(function(x){return (x.clientNo||'').toUpperCase()===no})[0];
  if(!c){toast('Pick a client from the list');return}
  patch(c.id,{tasks:(c.tasks||[]).concat([{id:uid(),text:tx,due:due||'',time:tmv||'',done:false,created:Date.now(),pri:!!$('#trNewPri').checked}])});
  $('#trNewText').value='';$('#trNewDue').value='';$('#trNewTime').value='';$('#trNewPri').checked=false;toast('Task added to '+names(c));
}

/* ---------- notebook (general notes, not linked to any client) ---------- */
var nbCol=null,notes=[],nbSel=null,nbShown=null,nbQuery='',nbTimer=null;
function nbSorted(){return notes.slice().sort(function(a,b){return (b.updatedAt||0)-(a.updatedAt||0)})}
function nbTitleOf(n){var t=(n.title||'').trim();if(t)return t;var l=String(n.body||'').split('\n').filter(function(x){return x.trim()})[0];return l?l.slice(0,60):'Untitled note'}
function nbShell(){
  return '<div class="pagehead"><h1>Notebook</h1><span class="muted">General notes, not linked to any client</span></div><div class="nb"><aside class="nbside"><button type="button" class="btn" id="nbNew" style="width:100%">New note</button><input type="search" id="nbQ" class="search" style="width:100%;margin-top:8px" placeholder="Search notes" aria-label="Search notes" value="'+esc(nbQuery)+'"><div id="nbList"></div></aside><section class="nbmain" id="nbMain"></section></div>';
}
function nbList(){
  var box=$('#nbList');if(!box)return;
  var q=nbQuery.trim().toLowerCase();
  var l=nbSorted().filter(function(n){return !q||((n.title||'')+' '+(n.body||'')).toLowerCase().indexOf(q)>-1});
  box.innerHTML=l.length?l.map(function(n){var sn=String(n.body||'').replace(/\s+/g,' ').slice(0,80);return '<button type="button" class="nbi'+(n.id===nbSel?' on':'')+'" data-nbsel="'+n.id+'"><b>'+esc(nbTitleOf(n))+'</b><span class="muted">'+stampOf(n.updatedAt||n.createdAt||Date.now())+'</span><span class="muted">'+esc(sn)+'</span></button>'}).join(''):'<div class="muted" style="padding:10px">'+(notes.length?'No notes match.':'No notes yet. Click New note.')+'</div>';
}
var NB_FONTS={'Arial':'Arial, Helvetica, sans-serif','Georgia':'Georgia, serif','Times New Roman':'"Times New Roman", Times, serif','Verdana':'Verdana, Geneva, sans-serif','Trebuchet MS':'"Trebuchet MS", sans-serif','Courier New':'"Courier New", monospace'};
var NB_SIZES={1:10,2:13,3:16,4:19,5:24,6:32,7:44};
var NB_NAMED={'x-small':10,'small':13,'medium':16,'large':19,'x-large':24,'xx-large':32,'xxx-large':44};
function nbColor(v){v=String(v||'').trim();if(/^#[0-9a-f]{3}$/i.test(v))v='#'+v.charAt(1)+v.charAt(1)+v.charAt(2)+v.charAt(2)+v.charAt(3)+v.charAt(3);var h=safeColor(v)||rgbHex(v);return h?h.toLowerCase():''}
function nbFontOf(v){var f=String(v||'').split(',')[0].replace(/["']/g,'').trim().toLowerCase();for(var k in NB_FONTS)if(k.toLowerCase()===f)return NB_FONTS[k];return ''}
function nbSizeOf(v){v=String(v||'').trim().toLowerCase();if(NB_NAMED[v])return NB_NAMED[v];var m=/^([\d.]+)px$/.exec(v);if(m){var n=Math.round(+m[1]);return n>=8&&n<=72?n:0}return 0}
function nbClean(html){
  var doc=new DOMParser().parseFromString('<body>'+String(html||'')+'</body>','text/html'),out=document.createElement('div');
  var TAG={b:'b',strong:'b',i:'i',em:'i',u:'u',s:'s',strike:'s',del:'s',ul:'ul',ol:'ol',li:'li',div:'div',p:'div',h1:'div',h2:'div',h3:'div',span:'span',font:'span'};
  function walk(src,dst,depth){
    if(depth>30)return;
    Array.prototype.forEach.call(src.childNodes,function(n){
      if(n.nodeType===3){dst.appendChild(document.createTextNode(n.nodeValue));return}
      if(n.nodeType!==1)return;
      var tg=n.tagName.toLowerCase();
      if(tg==='br'){dst.appendChild(document.createElement('br'));return}
      if(/^(script|style|iframe|object|embed|svg|math|template|noscript|textarea|select|button|input|img|video|audio|link|meta)$/.test(tg))return;
      if(!TAG[tg]){walk(n,dst,depth+1);return}
      var el=document.createElement(TAG[tg]),st=[],sd=n.style||{};
      var col=nbColor(sd.color||(tg==='font'?n.getAttribute('color'):'')),bg=nbColor(sd.backgroundColor),fam=nbFontOf(sd.fontFamily||(tg==='font'?n.getAttribute('face'):'')),sz=nbSizeOf(sd.fontSize)||(tg==='font'?NB_SIZES[+n.getAttribute('size')]||0:0);
      if(col&&(lum(col)<0.1||lum(col)>0.95))col='';
      if(bg){st.push('background-color:'+bg);if(!col)col='#101c26'}
      if(col)st.push('color:'+col);
      if(fam)st.push('font-family:'+fam);
      if(sz)st.push('font-size:'+sz+'px');
      var fw=sd.fontWeight;if(fw==='bold'||+fw>=600)st.push('font-weight:700');
      if(sd.fontStyle==='italic')st.push('font-style:italic');
      var td=String(sd.textDecorationLine||sd.textDecoration||'');
      if(/underline|line-through/.test(td))st.push('text-decoration:'+((/underline/.test(td)?'underline ':'')+(/line-through/.test(td)?'line-through':'')).trim());
      if(st.length)el.setAttribute('style',st.join(';'));
      walk(n,el,depth+1);dst.appendChild(el);
    });
  }
  walk(doc.body,out,0);
  return out.innerHTML;
}
function nbBodyHtml(n){return n.html?nbClean(n.html):esc(n.body||'').replace(/\r?\n/g,'<br>')}
function nbToolbar(){
  var sw=function(kind,c){return '<button type="button" class="sw" data-rt="'+kind+':'+c+'" style="background:'+c+'" title="'+(kind==='fore'?'Text colour':'Highlight')+'" aria-label="'+(kind==='fore'?'Text colour':'Highlight')+' '+c+'"></button>'};
  var tc=['#d32f2f','#ef6c00','#2e7d32','#1565c0','#6a1b9a','#6d4c41'],hc=['#fff176','#a5d6a7','#90caf9','#f8bbd0','#ffcc80'];
  return '<div class="rtbar" id="nbBar">'+
  '<button type="button" data-rt="bold" title="Bold"><b>B</b></button><button type="button" data-rt="italic" title="Italic"><i>I</i></button><button type="button" data-rt="underline" title="Underline"><u>U</u></button><button type="button" data-rt="strikeThrough" title="Strikethrough"><s>S</s></button><span class="sep"></span>'+
  '<select data-rtsel="font" aria-label="Font"><option value="">Font</option>'+Object.keys(NB_FONTS).map(function(k){return '<option value="'+esc(NB_FONTS[k])+'">'+k+'</option>'}).join('')+'</select>'+
  '<select data-rtsel="size" aria-label="Text size"><option value="">Size</option><option value="2">Small</option><option value="3">Normal</option><option value="4">Large</option><option value="5">Larger</option><option value="6">Huge</option></select><span class="sep"></span>'+
  '<label>Text</label>'+tc.map(function(c){return sw('fore',c)}).join('')+'<input type="color" data-rtinput="fore" value="#1565c0" aria-label="Custom text colour"><span class="sep"></span>'+
  '<label>Highlight</label>'+hc.map(function(c){return sw('hilite',c)}).join('')+'<input type="color" data-rtinput="hilite" value="#fff176" aria-label="Custom highlight colour"><button type="button" data-rt="hilite:none" title="Remove highlight">No highlight</button><span class="sep"></span>'+
  '<button type="button" data-rt="insertUnorderedList" title="Bullet list">• List</button><button type="button" data-rt="insertOrderedList" title="Numbered list">1. List</button><button type="button" data-rt="removeFormat" title="Clear formatting">Clear format</button></div>';
}
var nbRange=null;
document.addEventListener('selectionchange',function(){var sl=window.getSelection(),b=$('#nbBody');if(b&&sl&&sl.rangeCount&&b.contains(sl.anchorNode))nbRange=sl.getRangeAt(0).cloneRange()});
function nbExec(cmd,val){
  var b=$('#nbBody');if(!b)return;
  b.focus();if(nbRange){var sl=window.getSelection();sl.removeAllRanges();sl.addRange(nbRange)}
  try{document.execCommand('styleWithCSS',false,true)}catch(e){}
  if(cmd==='hilite'){if(val==='none'){document.execCommand('hiliteColor',false,'transparent')}else if(!document.execCommand('hiliteColor',false,val))document.execCommand('backColor',false,val)}
  else if(cmd==='fore'){document.execCommand('foreColor',false,val)}
  else document.execCommand(cmd,false,val==null?null:val);
  nbSched();
}
function nbTablesHtml(n){return (n.tables||[]).map(function(t){return '<div style="margin:12px 0">'+tblBlock({ts:t.ts,table:t.table},'nbtables')+'</div>'}).join('')}
function nbSetTables(arr){
  var id=nbShown;if(!id||!nbCol)return;
  var n=notes.filter(function(x){return x.id===id})[0];if(n)n.tables=arr;
  var bx=$('#nbTables');if(bx&&n){bx.innerHTML=nbTablesHtml(n);bx.setAttribute('data-sig',JSON.stringify(arr))}
  write('nb-'+id,function(){return nbCol.doc(id).update({tables:arr,updatedAt:Date.now()})});
}
function nbEditor(){
  var m=$('#nbMain');if(!m)return;
  var n=notes.filter(function(x){return x.id===nbSel})[0];
  if(!n){m.innerHTML='<div class="empty"><h2>Notebook</h2>Click New note to start typing.</div>';nbShown=null;return}
  nbShown=n.id;
  m.innerHTML='<input id="nbTitle" class="nbt" type="text" placeholder="Title (optional)" value="'+esc(n.title||'')+'" aria-label="Note title">'+nbToolbar()+'<div id="nbBody" class="nbb nbrt" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Note" data-ph="Type anything here. Use the toolbar for colour and font. You can also paste a table from Excel.">'+nbBodyHtml(n)+'</div><div id="nbTables" data-sig=\''+esc(JSON.stringify(n.tables||[]))+'\'>'+nbTablesHtml(n)+'</div><div class="add"><button type="button" class="btn ghost" id="nbStamp">Insert date and time</button><button type="button" class="btn danger" id="nbDel">Delete note</button><span class="muted" id="nbMsg" style="align-self:center;font-size:12px">Saves automatically</span></div>';
}
function renderNotebook(){
  if(!nbSel&&notes.length)nbSel=nbSorted()[0].id;
  nbList();
  var n=notes.filter(function(x){return x.id===nbSel})[0];
  if(nbSel!==nbShown||(!n&&nbShown)||(!$('#nbTitle')&&n))nbEditor();
  var bx=$('#nbTables');
  if(n&&bx){var sg=JSON.stringify(n.tables||[]);if(bx.getAttribute('data-sig')!==sg&&!(document.activeElement&&bx.contains(document.activeElement))){bx.innerHTML=nbTablesHtml(n);bx.setAttribute('data-sig',sg)}}
}
function nbSave(){
  nbTimer=null;var id=nbShown;if(!id||!nbCol)return;
  var t=$('#nbTitle'),b=$('#nbBody');if(!t||!b)return;
  var d={title:t.value,body:(b.innerText||'').replace(/\u00a0/g,' ').replace(/\n{3,}/g,'\n\n').trim(),html:nbClean(b.innerHTML),updatedAt:Date.now()};
  write('nb-'+id,function(){return nbCol.doc(id).update(d)}).then(function(){var m=$('#nbMsg');if(m)m.textContent='Saved '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})});
}
function nbFlush(){if(nbTimer){clearTimeout(nbTimer);nbSave()}}
function nbSched(){var m=$('#nbMsg');if(m)m.textContent='Saving...';clearTimeout(nbTimer);nbTimer=setTimeout(nbSave,800)}
function nbNew(){
  if(!nbCol)return;nbFlush();
  var ref=nbCol.doc(),now=Date.now();nbSel=ref.id;nbQuery='';
  write('nb-'+ref.id,function(){return ref.set({title:'',body:'',createdAt:now,updatedAt:now})}).then(function(){setTimeout(function(){var b=$('#nbBody');if(b)b.focus()},400)});
}

/* ---------- full backup ---------- */
function backupAll(){
  if(!loaded||!cases.length){toast('Nothing to back up yet');return}
  claude.use('downloads').then(function(dl){
    if(!dl){toast('Downloads are not available in this view');return}
    var an=(window.MD_CONFIG||{}).appName||'MySimpleDesk';
    var payload={app:an,trade:T.id,exportedAt:new Date().toISOString(),count:cases.length,cases:cases,notebook:notes,appointments:appts,marketing:[{id:'contacts',items:mkItems}].concat(mkMsgsDoc?[{id:'messages',items:mkMsgsDoc}]:[]),settings:[{id:'trade',trade:T.id}].concat(BIZ.savedAt?[Object.assign({id:'business'},BIZ)]:[])};
    return dl.save({filename:an.replace(/[^A-Za-z0-9]+/g,'-').toLowerCase()+'-backup-'+iso(TODAY)+'.json',data:JSON.stringify(payload,null,2)}).then(function(){toast('Backup saved: '+cases.length+' '+NS())},function(e){if(e&&e.code!=='declined')toast('Could not save the backup')});
  });
}

/* ---------- events ---------- */
document.addEventListener('click',function(e){
  var cb=e.target.closest&&e.target.closest('[data-coltoggle]');
  if(cb){var ck=cb.getAttribute('data-coltoggle'),cf=cb.closest('fieldset');colOpen[ck]=!colOpen[ck];cf.classList.toggle('col-closed',!colOpen[ck]);cb.textContent=colOpen[ck]?'Hide':'Show';cb.blur();return}
  var sb=e.target.closest&&e.target.closest('[data-sectoggle]');
  if(sb){var k=sb.getAttribute('data-sectoggle'),fs=sb.closest('fieldset');secHidden[k]=!secHidden[k];
    fs.classList.toggle('sec-hidden',!!secHidden[k]);sb.textContent=secHidden[k]?'Show':'Hide';
    try{localStorage.setItem('cd.ui.secHidden',JSON.stringify(secHidden))}catch(x){}return}
  var t=e.target;
  var rdn=t.closest('[data-remdone]');
  if(rdn&&rdn.getAttribute('data-remdone').indexOf('__home|')===0){e.stopPropagation();var hp=rdn.getAttribute('data-remdone').split('|'),nh=Object.assign({},HOME||{});nh.remDone=Object.assign({},nh.remDone||{});nh.remDone[hp[1]]=hp[2];homeWrite(nh);toast((rdn.hasAttribute('data-rep')?'OK, we will remind you again in 30 days. Update the date when it is renewed and the reminders start again from the new date.':'Reminder hidden. It comes back if you change that date.'));return}
  if(rdn){e.stopPropagation();var rp=rdn.getAttribute('data-remdone').split('|'),rc=cases.filter(function(x){return x.id===rp[0]})[0];if(rc){var rm={};Object.assign(rm,rc.remDone||{});rm[rp[1]]=rp[2];patch(rc.id,{remDone:rm});toast((rdn.hasAttribute('data-rep')?'OK, we will remind you again in 30 days. Update the date when it is renewed and the reminders start again from the new date.':'Reminder hidden. It comes back if you change that date.'))}return}
  var tpb=t.closest('[data-trade]');if(tpb&&(tpb.disabled||(window.CD_tradeOpen&&!window.CD_tradeOpen(tpb.getAttribute('data-trade')))))return;if(tpb){saveTrade(tpb.getAttribute('data-trade'));var ov=$('#tpOv');if(ov)ov.remove();toast('Set up for: '+T.label);return}
  if(t.closest('[data-tpclose]')){var ov2=$('#tpOv');if(ov2)ov2.remove();return}
  var adv=t.closest('[data-adv]');
  if(adv){e.stopPropagation();patch(adv.dataset.adv,{stage:adv.dataset.to});return}
  var o=t.closest('[data-open]');
  if(o&&o.dataset.open==='__home'){e.preventDefault();homeOpen();return}
  if(o){e.preventDefault();openDrawer(o.dataset.open);return}
  if(t.closest('.brand')){nbFlush();view=T.landing||'tasks';render();window.scrollTo(0,0);return}
  if(t.closest&&t.closest('[data-sideacct]')){var sb=document.getElementById('settingsBtn');if(sb)sb.click();return}
  var nv=t.closest('#nav button,#nav2 button,#sideTools button[data-v]');
  if(nv&&nv.dataset.v==='bookappt'){apOpen(null,iso(TODAY));return}
  if(nv&&nv.dataset.v==='gendocs'){gnOpen();return}
  if(nv&&nv.dataset.v==='more'){navMore=!navMore;renderNav();renderSide();return}
  if(nv&&nv.dataset.v==='acctset'){var sb=$('#settingsBtn');if(sb)sb.click();return}
  if(nv){nbFlush();view=nv.dataset.v;render();return}
  if(t.closest('#newBtn')||t.closest('[data-act="new"]')){if(T.tenancyMode)qaOpen();else openDrawer(null);return}
  if(t.closest('[data-act="export"]')){exportCsv();return}
  if(t.closest('#backupBtn')){backupAll();return}
  if(t.closest('#trayBtn')){if(trayOpen)closeTray();else openTray();return}
  if(t.closest('[data-trclose]')){closeTray();return}
  if(t.closest('[data-clrf]')){stageFilter='';lenderFilter='';revFilter='';render();return}
  var sl=t.closest('[data-sidelater]');if(sl){sideLater=!sideLater;renderRem();return}
  var tg=t.closest('[data-trtog]');if(tg){var kk=tg.getAttribute('data-trtog');trOpen[kk]=!trOpen[kk];renderTray();return}
  var tb=t.closest('[data-trbulk]');if(tb){trBulk(tb.getAttribute('data-trbulk'));return}
  var tf=t.closest('[data-trf]');if(tf){trFilter=tf.dataset.trf;renderTray();return}
  var sz=t.closest('[data-snz]');if(sz){var f1=trFind(sz.dataset.snz);if(f1){var base=f1.t.due&&diff(f1.t.due)>=0?f1.t.due:iso(TODAY);trSet(f1,{due:addDays(base,f1.n)})}return}
  if(t.id==='trAdd'){trAddTask();return}
  if(t.id==='nbNew'){nbNew();return}
  var ns1=t.closest('[data-nbsel]');if(ns1){nbFlush();nbSel=ns1.dataset.nbsel;renderNotebook();return}
  if(t.id==='nbStamp'){var nb1=$('#nbBody');nb1.focus();var rg=document.createRange();rg.selectNodeContents(nb1);rg.collapse(false);var sg=window.getSelection();sg.removeAllRanges();sg.addRange(rg);document.execCommand('insertHTML',false,(nb1.textContent.trim()?'<br><br>':'')+esc(stampOf(Date.now()))+' - ');nbSched();return}
  if(t.id==='nbDel'){if(!t.classList.contains('armed')){t.classList.add('armed');t.textContent='Confirm delete';return}var nid=nbShown;nbSel=null;nbShown=null;write('nb-'+nid,function(){return nbCol.doc(nid).delete()}).then(function(){toast('Note deleted')});return}
  if(t.closest('[data-close]')){closeDrawer();return}
  if(t.id==='saveBtn'){saveCase();return}
  if(t.id==='addApp'){var n=document.querySelectorAll('#apps .app').length;$('#apps').insertAdjacentHTML('beforeend',appRow({},n));return}
  if(t.id==='addSec'){var sn=document.querySelectorAll('#secs .sec2').length;$('#secs').insertAdjacentHTML('beforeend',secRow({},sn));var na=$('#secs .sec2:last-child [data-s="address"]');if(na)na.focus();return}
  var rms=t.closest('[data-rmsec]');
  if(rms){var cd=rms.closest('.sec2');cd.remove();document.querySelectorAll('#secs .sec2').forEach(function(c2,j){var h=c2.querySelector('.top2>span');if(h)h.textContent='Security address '+(j+1)});updSRev();return}
  var sg=t.closest('[data-sectog]');
  if(sg){var cd2=sg.closest('.sec2'),isC=cd2.classList.toggle('sec2-collapsed');secCollapsed[cd2.getAttribute('data-sid')]=isC;sg.textContent=isC?'Show lender details':'Hide lender details';return}
  var rm=t.closest('[data-rmapp]');
  if(rm){var row=rm.closest('.app');if(document.querySelectorAll('#apps .app').length>1)row.remove();return}
  if(t.id==='apOv'){apClose();return}
  if(t.id==='bookBtn'){apOpen(null,iso(TODAY),openId);return}
  if(t.id==='tkBook'){var tdue=document.getElementById('tkDue');apOpen(null,(tdue&&tdue.value)||iso(TODAY),openId);return}
  var bdf=t.closest&&t.closest('[data-bdf]');if(bdf){bdFilter=bdf.getAttribute('data-bdf');bdRender();return}
  var mkt=t.closest&&t.closest('[data-mktab]');if(mkt){mkTab=mkt.getAttribute('data-mktab');mkMsgEdit=null;render();return}
  if(mkMsgAct(t))return;
  if(t.closest&&t.closest('[data-mkadd]')){mkOpen(null);return}
  if(t.closest&&t.closest('[data-mkexp]')){mkExport();return}
  var mke=t.closest&&t.closest('[data-mkedit]');if(mke&&!(t.closest&&t.closest('a'))){mkOpen(mke.getAttribute('data-mkedit'));return}
  if(t.closest&&t.closest('[data-mksave]')){mkSaveForm();return}
  if(t.closest&&t.closest('[data-mkcancel]')){mkClose();return}
  if(t.id==='mkOv'){mkClose();return}
  if(t.closest&&t.closest('[data-mkdel]')){if(!t.classList.contains('armed')){t.classList.add('armed');t.textContent='Confirm delete';return}var did=mkEditId;mkItems=mkItems.filter(function(x){return x.id!==did});mkSave();mkClose();mkList();toast('Contact deleted');return}
  if(t.closest&&t.closest('[data-bdgo]')){view='birthdays';bdFilter='week';render();return}
  var bdo=t.closest&&t.closest('[data-bdopen]');
  if(bdo){var ok=bdo.getAttribute('data-bdopen'),cur=bdOpen[ok]!==undefined?bdOpen[ok]:(bdFind(ok)||{days:99}).days<=7;bdOpen[ok]=!cur;bdRender();return}
  var bds=t.closest&&t.closest('[data-bdsend]');
  if(bds){var sp=bdFind(bds.getAttribute('data-bdsend'));if(!sp)return;var si=bdIntl(sp.phone);if(!si){toast('No phone number saved for '+sp.name);return}
    var stx=bdText(sp);bdDraft[sp.key]=stx;window.open('https://wa.me/'+si+'?text='+encodeURIComponent(stx),'_blank','noopener');bdSetSent(sp,true);toast('WhatsApp opened for '+bdFirst(sp.name));return}
  var bdc=t.closest&&t.closest('[data-bdcopy]');
  if(bdc){var cp=bdFind(bdc.getAttribute('data-bdcopy'));if(!cp)return;var ctx=bdText(cp);bdDraft[cp.key]=ctx;
    var done=function(){toast('Message copied')};
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(ctx).then(done,function(){toast('Could not copy. Select the text and copy it.')});else{var ta0=document.querySelector('[data-bdmsg]');if(ta0){ta0.select();try{document.execCommand('copy');done()}catch(x){}}}
    return}
  var bdg=t.closest&&t.closest('[data-bdgen]');
  if(bdg){var gv=bdg.getAttribute('data-bdgen'),gi=gv.lastIndexOf('|'),gk=gv.slice(0,gi);bdGen[gk]=gv.slice(gi+1);delete bdDraft[gk];write('nb-bday-gender',function(){return nbCol.doc('bday-gender').set({map:bdGen,updatedAt:Date.now()})});bdRender();return}
  var bdk=t.closest&&t.closest('[data-bdkind]');
  if(bdk){var kp=bdFind(bdk.getAttribute('data-bdkind'));if(kp){bdKind[kp.key]=bdMode(kp)==='isl'?'gen':'isl';delete bdDraft[kp.key];bdRender()}return}
  var bdh=t.closest&&t.closest('[data-bdshuf]');
  if(bdh){var hp=bdFind(bdh.getAttribute('data-bdshuf'));if(hp){var n0=bdList(hp).length,cur0=bdPick(hp),tries=0;do{bdShuf[hp.key]=(bdShuf[hp.key]||0)+1;tries++}while(n0>1&&bdPick(hp)===cur0&&tries<30);delete bdDraft[hp.key];bdRender()}return}
  if(t.id==='bdTplBtn'){bdTplOpen=!bdTplOpen;bdTplRender();return}
  if(t.id==='bdTplSave'){
    var ms=$('#bdMsgsText').value.split(/\n-{3,}\s*\n/).map(function(x){return x.trim()}).filter(Boolean),sg=$('#bdSigText').value.trim();
    if(!ms.length){toast('Write at least one message');return}
    if(!ms.some(function(x){return x.indexOf('{name}')>-1})&&!confirm('None of your messages has {name}, so the first name will not be added. Save anyway?'))return;
    var im=$('#bdIslText').value.split(/\n-{3,}\s*\n/).map(function(x){return x.trim()}).filter(Boolean);if(!im.length)im=BD_ISL.slice();
    var islSame=JSON.stringify(im)===JSON.stringify(BD_ISL),same=JSON.stringify(ms)===JSON.stringify(BD_MSGS)&&sg===bdDefSig().trim()&&islSame;
    bdCfg=same?{messages:null,signature:null,islamic:null}:{messages:ms,signature:sg,islamic:islSame?null:im};bdDraft={};bdShuf={};
    write('nb-bday-template',function(){return same?nbCol.doc('bday-template').delete():nbCol.doc('bday-template').set({messages:ms,signature:sg,islamic:islSame?[]:im,updatedAt:Date.now()})});
    bdTplOpen=false;bdTplRender();bdRender();toast('Saved');return}
  if(t.id==='bdTplReset'){bdCfg={messages:null,signature:null,islamic:null};bdShuf={};bdDraft={};write('nb-bday-template',function(){return nbCol.doc('bday-template').delete()});bdTplRender();bdRender();toast('Template reset');return}
  var hmt=t.closest&&t.closest('[data-hmtog]');if(hmt){homeMonth=hmt.getAttribute('data-hmtog')==='1';var hc3=$('#homeCal');if(hc3)hc3.innerHTML=apHome();return}
  var apd=t.closest&&t.closest('[data-apday]');
  if(apd){apSel=apd.getAttribute('data-apday');var pq=apSel.split('-');apMonth={y:+pq[0],m:+pq[1]-1};render();return}
  var apm=t.closest&&t.closest('[data-apmonth]');
  if(apm){var dm=+apm.getAttribute('data-apmonth');if(dm===0){apMonth={y:TODAY.getFullYear(),m:TODAY.getMonth()};apSel=iso(TODAY)}else{var nd0=new Date(apMonth.y,apMonth.m+dm,1);apMonth={y:nd0.getFullYear(),m:nd0.getMonth()}}render();return}
  if(t.closest&&t.closest('[data-apnew]')){apOpen(null,apSel);return}
  var ape=t.closest&&t.closest('[data-apedit]');if(ape){apOpen(ape.getAttribute('data-apedit'));return}
  var apk=t.closest&&t.closest('[data-apdone]');
  if(apk){var ak=apk.getAttribute('data-apdone'),aa=appts.filter(function(x){return x.id===ak})[0];if(aa){write('ap-'+ak,function(){return apCol.doc(ak).update({status:aa.status==='done'?'booked':'done',updatedAt:Date.now()})});setTimeout(function(){if(view==='appointments'||view==='tasks')render();renderNav()},30)}return}
  if(t.closest&&t.closest('[data-apdm]')){var dmb=t.closest('[data-apdm]'),dn=+dmb.getAttribute('data-apdm');apDpM=new Date(apDpM.y,apDpM.m+dn,1);apDpM={y:apDpM.getFullYear(),m:apDpM.getMonth()};apDpRender();return}
  if(t.closest&&t.closest('[data-apdd]')){var ddb=t.closest('[data-apdd]'),dv2=ddb.getAttribute('data-apdd'),q2=dv2.split('-');$('#apDate').value=dv2;apDpM={y:+q2[0],m:+q2[1]-1};apClash=false;apDpRender();return}
  if(t.closest&&t.closest('[data-apts]')){$('#apTime').value=t.closest('[data-apts]').getAttribute('data-apts');apClash=false;apDpRender();return}
  if(t.closest&&t.closest('[data-apclose]')){apClose();return}
  if(t.id==='apSave'){apSave();return}
  if(t.id==='apDel'){if(!t.classList.contains('armed')){t.classList.add('armed');t.textContent='Confirm delete';return}var did=apEditId;apClose();if(did){write('ap-'+did,function(){return apCol.doc(did).delete()});toast('Appointment deleted');setTimeout(function(){if(view==='appointments'||view==='tasks')render();renderNav()},30)}return}
  var rtb=t.closest&&t.closest('[data-rt]');
  if(rtb){var rv=rtb.getAttribute('data-rt'),ix=rv.indexOf(':');if(ix>0)nbExec(rv.slice(0,ix),rv.slice(ix+1));else nbExec(rv);return}
  var spr=t.closest&&t.closest('[data-tkpri]');
  if(spr){var sf=trFind(spr.getAttribute('data-tkpri'));try{spr.blur()}catch(e){}if(sf)trSet(sf,{pri:!sf.t.pri});return}
  var sdt=t.closest&&t.closest('[data-sidetoggle]');
  if(sdt){sideOn=!sideOn;try{localStorage.setItem('cd.ui.sideOn',sideOn?'1':'0')}catch(x){}applySide();try{sdt.blur()}catch(e){}return}
  var tke=t.closest&&t.closest('[data-tkedit]');
  if(tke){editTk=tke.getAttribute('data-tkedit');rerenderTasks();setTimeout(function(){var x=document.querySelector('[data-tkf=text]');if(x)x.focus()},50);return}
  if(t.closest&&t.closest('[data-tkecancel]')){editTk=null;try{document.activeElement.blur()}catch(e){}rerenderTasks();return}
  var tks=t.closest&&t.closest('[data-tkesave]');
  if(tks){
    var key=tks.getAttribute('data-tkesave'),bx=tks.closest('[data-tkbox]'),f=trFind(key);if(!f||!bx)return;
    var tx5=bx.querySelector('[data-tkf=text]').value.trim(),du5=bx.querySelector('[data-tkf=due]').value,tm5=bx.querySelector('[data-tkf=time]').value,pr5=bx.querySelector('[data-tkf=pri]').checked;
    if(!tx5){toast('Type the task first');return}
    if(tm5&&!du5)du5=iso(TODAY);
    editTk=null;try{document.activeElement.blur()}catch(e){}
    if(tx5===f.t.text&&du5===(f.t.due||'')&&tm5===(f.t.time||'')&&pr5===!!f.t.pri){rerenderTasks();return}
    trSet(f,{text:tx5,due:du5,time:tm5,pri:pr5,edited:Date.now()});toast('Task updated');return;
  }
  var ne=t.closest&&t.closest('[data-nedit]');
  if(ne){var pp=ne.getAttribute('data-nedit').split('|');editNote={list:pp[0],ts:+pp[1]};renderLive();setTimeout(function(){var x=$('#ntEdit');if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length)}},50);return}
  if(t.id==='ntEditCancel'){editNote=null;renderLive();return}
  if(t.id==='ntEditSave'){
    var ex=$('#ntEdit'),cc=currentCase();if(!ex||!editNote||!cc)return;
    var en=editNote,val=ex.value.trim(),arr0=cc[en.list]||[],cur=arr0.filter(function(x){return x.ts===en.ts})[0];if(!cur)return;
    if(!val&&!cur.table){toast('A note cannot be empty');return}
    editNote=null;
    if(val===String(cur.text||'').trim()){renderLive();return}
    var narr=arr0.map(function(x){return x.ts===en.ts?Object.assign({},x,{text:val,edited:Date.now()}):x}),oo={};oo[en.list]=narr;patch(openId,oo);toast('Note updated');return;
  }
  var tbb=t.closest&&t.closest('[data-tb]');
  if(tbb){
    var act=tbb.getAttribute('data-tb');
    if(act==='dropnt'){ntTable=null;showPend('nt');return}
    if(act==='droppr'){prTable=null;showPend('pr');return}
    if(act==='nbdel'){var tw0=tbb.closest('.tblwrap'),i0=tw0&&readRows(tw0);if(!i0)return;nbSetTables(i0.arr.filter(function(x,i){return i!==i0.idx}));return}
    var tw=tbb.closest('.tblwrap'),info=tw&&readRows(tw);if(!info)return;
    var rws=info.rows,wd=rws[0]?rws[0].length:1;
    if(act==='addrow'){var nr=[];for(var q=0;q<wd;q++)nr.push({v:''});rws.push(nr)}
    else if(act==='addcol'){rws.forEach(function(r){r.push({v:''})})}
    else if(act==='delrow'){if(rws.length>1)rws.pop()}
    else if(act==='delcol'){if(wd>1)rws.forEach(function(r){r.pop()})}
    commitTbl(info,rws);return;
  }
  if(t.id==='dupBtn'){var sc=cases.filter(function(x){return x.id===openId})[0];if(sc){autoSave();startFrom(sc)}return}
  if(t.id==='delBtn'){
    if(!t.classList.contains('armed')){t.classList.add('armed');t.textContent='Confirm delete';return}
    var id=openId;closeDrawer();write(id,function(){return col.doc(id).delete()}).then(function(){toast(T.noun[0]+' deleted')});return;
  }
  if(t.id==='tkAdd'){
    var tx=$('#tkText').value.trim();if(!tx)return;
    var c2=currentCase();var arr=(c2.tasks||[]).concat([{id:uid(),text:tx,due:$('#tkDue').value||($('#tkTime').value?iso(TODAY):''),time:$('#tkTime').value||'',done:false,created:Date.now(),pri:!!$('#tkPri').checked}]);
    patch(openId,{tasks:arr});return;
  }
  var rt=t.closest('[data-rmtk]');
  if(rt){var c3=currentCase();patch(openId,{tasks:(c3.tasks||[]).filter(function(x){return x.id!==rt.dataset.rmtk})});return}
  if(t.id==='prAll'){var pa=$('#prText');if(pa)prDraft=pa.value;protAll=!protAll;renderLive();return}
  if(t.id==='prHide'){var ph=$('#prText');if(ph)prDraft=ph.value;protHidden=!protHidden;try{localStorage.setItem('cd.ui.protHidden',protHidden?'1':'0')}catch(x){}renderLive();return}
  if(t.id==='prStamp'){var px=$('#prText'),ps2=stampOf(Date.now())+' - ';px.value=px.value.trim()?px.value.replace(/\s*$/,'')+'\n'+ps2:ps2;px.focus();px.setSelectionRange(px.value.length,px.value.length);return}
  if(t.id==='prAdd'){var pt=$('#prText').value.trim();if(!pt&&!prTable)return;prDraft='';var c6=currentCase();lastPD='';var pn={ts:Date.now(),text:pt};if(prTable){pn.table={rows:prTable.rows};prTable=null}patch(openId,{protection:(c6.protection||[]).concat([pn]),protDraft:''});return}
  if(t.id==='ntAll'){var ta2=$('#ntText');if(ta2)ntDraft=ta2.value;notesAll=!notesAll;renderLive();return}
  if(t.id==='ntHide'){
    var ta=$('#ntText');if(ta)ntDraft=ta.value;
    notesHidden=!notesHidden;try{localStorage.setItem('cd.ui.notesHidden',notesHidden?'1':'0')}catch(e){}
    renderLive();return;
  }
  if(t.id==='ntStamp'){
    var tx=$('#ntText'),st=stampOf(Date.now())+' - ';
    tx.value=tx.value.trim()?tx.value.replace(/\s*$/,'')+'\n'+st:st;tx.focus();tx.setSelectionRange(tx.value.length,tx.value.length);return;
  }
  if(t.id==='ntAdd'){
    var nt=$('#ntText').value.trim();if(!nt&&!ntTable)return;ntDraft='';
    var c4=currentCase();lastND='';var nn={ts:Date.now(),text:nt};if(ntTable){nn.table={rows:ntTable.rows};ntTable=null}patch(openId,{notes:(c4.notes||[]).concat([nn]),noteDraft:''});return;
  }
});
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.id==='mkTpl'){mkTplId=t.value;mkList();return}
  if(t.id==='mkConsent'){mkConsent=t.value;mkList();return}
  if(t.id==='mkGroup'){mkGroup=t.value;mkList();return}
  if(t.id==='mkImp'){if(t.files&&t.files[0])mkImport(t.files[0]);t.value='';return}
  if(t.matches('[data-trk]')){var f2=trFind(t.dataset.trk);if(f2)trSet(f2,{done:t.checked});return}
  if(t.matches('[data-bdchk]')){var cp2=bdFind(t.getAttribute('data-bdchk'));if(cp2)bdSetSent(cp2,t.checked);return}
  if(t.matches('[data-rtsel]')){if(t.value){nbExec(t.getAttribute('data-rtsel')==='font'?'fontName':'fontSize',t.value)}t.selectedIndex=0;return}
  if(t.matches('[data-rtinput]')){nbExec(t.getAttribute('data-rtinput'),t.value);return}
  if(t.matches('[data-trt]')){var f4=trFind(t.dataset.trt);if(f4)trSet(f4,t.value&&!f4.t.due?{time:t.value,due:iso(TODAY)}:{time:t.value});return}
  if(t.matches('[data-trd]')){var f3=trFind(t.dataset.trd);if(f3)trSet(f3,{due:t.value});return}
  if(t.matches('[data-tk]')){
    var c=currentCase();patch(openId,{tasks:(c.tasks||[]).map(function(x){return x.id===t.dataset.tk?Object.assign({},x,{done:t.checked}):x})});return;
  }
  if(t.id==='stageSel'){stageFilter=t.value;render()}
  if(t.id==='lenderSel'){lenderFilter=t.value;render()}
  if(t.id==='revSel'){revFilter=t.value;render()}
  if(t.getAttribute&&t.getAttribute('data-colk')){var ck=t.getAttribute('data-colk');colsHide=colsHide.filter(function(x){return x!==ck});if(!t.checked)colsHide.push(ck);try{localStorage.setItem('cd.ui.colsHide',JSON.stringify(colsHide))}catch(e){}render();var dp=document.querySelector('.colpick');if(dp)dp.open=true}
  if(t.id==='sortSel'){sortBy=t.value;try{localStorage.setItem('cd.ui.sortBy',sortBy)}catch(e){}render()}
  if(t.id==='fromClient'&&t.value){var s2=cases.filter(function(x){return x.id===t.value})[0];if(s2)startFrom(s2)}
});
document.addEventListener('input',function(e){
  var t=e.target;
  if(t.getAttribute&&t.getAttribute('data-f')&&t.closest&&t.closest('#caseForm')){
    if(t.hasAttribute('data-from')){var af=T.byKey[t.getAttribute('data-f')];if(t.value)t.setAttribute('data-auto','0');else{t.setAttribute('data-auto','1');var src=$('#f-'+af.auto.from);t.value=src&&src.value?autoDate(src.value,af.auto):''}}
    autoChain(t.getAttribute('data-f'),0);updStrip();
  }
  if(t.getAttribute&&t.getAttribute('data-f')&&t.closest){var lb=t.closest('label'),cl=lb&&lb.querySelector('.cl');if(cl)cl.innerHTML=contactLinks(t.value)}
  if(t.getAttribute&&t.getAttribute('data-a')==='email'){var el=t.parentNode.querySelector('.el');if(el)el.innerHTML=elinks(t.value)}
  if(t.getAttribute&&t.getAttribute('data-a')==='phone'){var pl=t.parentNode.querySelector('.pl');if(pl)pl.innerHTML=plinks(t.value)}
  if(t.getAttribute&&t.getAttribute('data-s')){
    var scd=t.closest('.sec2'),sk=t.getAttribute('data-s');
    if(scd){
      if(sk==='fixedUntil'){var sr=scd.querySelector('[data-s="reviewDate"]');if(sr&&sr.getAttribute('data-auto')==='1')sr.value=t.value?addMonths(t.value,-REVM):''}
      if(sk==='reviewDate')t.setAttribute('data-auto','0');
      var gv=function(k){var q=scd.querySelector('[data-s="'+k+'"]');return q?q.value.trim():''};
      var sm=scd.querySelector('.secsum');if(sm)sm.textContent=secSumText({lender:gv('lender'),rate:gv('rate'),fixedUntil:gv('fixedUntil'),reviewDate:gv('reviewDate')});
      updSRev();
    }
  }
  if(t.id==='f-oneDriveLink'){var od=$('#odl');if(od)od.innerHTML=odLink(t.value)}
  if(t.id==='calcCase'){var cc=cases.filter(function(x){return x.id===t.value})[0];if(cc){$('#calcAmt').value=cc.loanAmount||'';var yy=cc.termLeft||cc.termYears||'';$('#calcYrs').value=yy;$('#calcMon').value='';$('#calcRate').value=cc.rate||''}calcUpdate()}
  if(t.id==='calcAmt'||t.id==='calcYrs'||t.id==='calcMon'||t.id==='calcRate')calcUpdate();
  if(t.id==='mkQ'){mkQuery=t.value;mkList();return}
  if(t.id==='trQ'){trQuery=t.value;renderTray()}
  if(t.id==='nbTitle'||t.id==='nbBody'){nbSched()}
  if(t.id==='nbQ'){nbQuery=t.value;nbList()}
  if(t.id==='q'){query=t.value;render()}
  if(t.id==='clQ'){clQuery=t.value;clRender()}
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&!$('#drawer').hidden)closeDrawer();
  else if(e.key==='Escape'&&trayOpen)closeTray();
  if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('card')){e.preventDefault();openDrawer(e.target.dataset.open)}
  if(e.key==='Enter'&&(e.target.id==='tkText')){e.preventDefault();$('#tkAdd').click()}
});
/* drag between pipeline stages */
var dragId=null;
document.addEventListener('dragstart',function(e){var c=e.target.closest&&e.target.closest('.card');if(c){dragId=c.dataset.open;e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',dragId)}catch(_){}}});
document.addEventListener('dragover',function(e){var c=e.target.closest&&e.target.closest('.col');if(c&&dragId){e.preventDefault();document.querySelectorAll('.col.over').forEach(function(x){x.classList.remove('over')});c.classList.add('over')}});
document.addEventListener('drop',function(e){
  var c=e.target.closest&&e.target.closest('.col');
  document.querySelectorAll('.col.over').forEach(function(x){x.classList.remove('over')});
  if(c&&dragId){e.preventDefault();var cs=cases.filter(function(x){return x.id===dragId})[0];if(cs&&cs.stage!==c.dataset.stage)patch(dragId,{stage:c.dataset.stage})}
  dragId=null;
});
document.addEventListener('dragend',function(){dragId=null;document.querySelectorAll('.col.over').forEach(function(x){x.classList.remove('over')})});



function autoChain(k,depth){
  if(depth>5)return;var srcEl=$('#f-'+k);if(!srcEl)return;var v=srcEl.value;
  document.querySelectorAll('#caseForm [data-from="'+k+'"]').forEach(function(dep){
    if(dep.getAttribute('data-auto')!=='1')return;var f=T.byKey[dep.getAttribute('data-f')];if(!f)return;
    dep.value=v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?autoDate(v,f.auto):'';autoChain(f.k,depth+1);
  });
}
/* ---------- trade (chosen once, kept in OneDrive so every device matches) ---------- */
var setCol=null;
function saveTrade(id){
  window.CD_tradeSet(id);var was=openId;if(was!==undefined)closeDrawer();applyTrade();view=T.landing||'tasks';
  if(setCol)write('set-trade',function(){return setCol.doc('trade').set({trade:id,updatedAt:Date.now()})});
  render();renderSide();
}
function openTradePicker(first){
  if($('#tpOv')||window.CD_TRADES.only)return;var A=window.CD_TRADES,o=document.createElement('div');o.id='tpOv';o.className='mkov';
  o.innerHTML='<div class="mkpanel tpick" role="dialog" aria-label="Choose your trade"><h2>'+(first?'Welcome. What kind of work do you do?':'Change your trade')+'</h2><p class="muted" style="margin:4px 0 12px">This sets the fields, stages and reminders on your records. You can change it later in Settings.'+(first?'':' Your saved records keep all their details. Fields that do not belong to the new trade are hidden, not deleted.')+'</p><div class="tpgrid">'+
    A.order.map(function(id){var x=A.all[id],op=!window.CD_tradeOpen||window.CD_tradeOpen(id);return '<button type="button" class="tpb'+(!first&&id===T.id?' on':'')+(op?'':' soon')+'" data-trade="'+id+'"'+(op?'':' disabled aria-disabled="true"')+'><b>'+esc(x.label)+(op?'':' <em class="tpsoon">Coming soon</em>')+'</b><span>'+esc(x.noun[1])+' · '+esc(x.stages.map(function(s){return s.label.replace(/^\d /,'')}).slice(0,4).join(', '))+'…</span></button>'}).join('')+
    '</div>'+(first?'':'<div class="mkact"><button type="button" class="btn ghost" data-tpclose="1">Cancel</button></div>')+'</div>';
  document.body.appendChild(o);
}
window.CD_openTrade=function(){openTradePicker(false)};

/* ---------- auto save (every 5 seconds) ---------- */
var lastAuto=null,newBase=null,lastND='',lastPD='';
function draftSave(){
  var a=$('#ntText'),b=$('#prText'),o={};
  if(a&&a.value!==lastND){lastND=a.value;ntDraft=a.value;o.noteDraft=a.value}
  if(b&&b.value!==lastPD){lastPD=b.value;prDraft=b.value;o.protDraft=b.value}
  if(Object.keys(o).length)patch(openId,o).then(function(){var m=$('#autoMsg');if(m)m.textContent='\u2713 Saved '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})});
}
var creatingNew=false;
function autoSave(){
  if(!openId&&col&&!creatingNew){
    var dn=$('#drawer');
    if(dn&&!dn.hidden&&$('#caseForm')){
      var nd=collectForm();
      if(hasIdent(nd)&&JSON.stringify(nd)!==newBase){
        creatingNew=true;
        if(!nd.clientNo)nd.clientNo=nextClientNo();
        var nref=col.doc();nd.createdAt=Date.now();nd.updatedAt=nd.createdAt;nd.tasks=[];nd.notes=pendingNotes;
        write(nref.id,function(){return nref.set(nd)}).then(function(){
          creatingNew=false;
          if(!openId&&dn&&!dn.hidden&&$('#caseForm')){openId=nref.id;var cf=$('#f-clientNo');if(cf&&!cf.value)cf.value=nd.clientNo;lastAuto=JSON.stringify(collectForm());var m=$('#autoMsg');if(m)m.textContent='\u2713 Saved '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
        },function(){creatingNew=false});
      }
    }
    return;
  }
  if(!openId||!col||lastAuto===null)return;
  var dr=$('#drawer');if(!dr||dr.hidden||!$('#caseForm'))return;
  draftSave();
  var data=collectForm();
  if(!hasIdent(data))return;
  var key=JSON.stringify(data);
  if(key===lastAuto)return;
  lastAuto=key;
  patch(openId,data).then(function(){var m=$('#autoMsg');if(m)m.textContent='\u2713 Saved '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})});
}
setInterval(autoSave,5000);
document.addEventListener('mousedown',function(e){var t=e.target;if(t&&t.closest&&t.closest('#nbBar')&&!t.closest('select')&&!t.closest('input'))e.preventDefault()},true);
document.addEventListener('drop',function(e){var t=e.target;if(t&&t.closest&&t.closest('#nbBody')){e.preventDefault();var tx=(e.dataTransfer&&e.dataTransfer.getData('text/plain'))||'';if(tx)document.execCommand('insertText',false,tx)}},true);
document.addEventListener('paste',function(e){
  var t=e.target;
  if(t&&t.closest&&t.closest('table.nt.xl')){e.preventDefault();var tx=(e.clipboardData&&e.clipboardData.getData('text/plain')||'').replace(/\s+/g,' ');document.execCommand('insertText',false,tx);return}
  if(t&&t.closest&&t.closest('#nbBody')){
    var h2=e.clipboardData&&e.clipboardData.getData('text/html');
    var pl2=(e.clipboardData&&e.clipboardData.getData('text/plain'))||'';
    e.preventDefault();
    if(!h2||!/<table/i.test(h2)){document.execCommand('insertText',false,pl2);return}
    parseTable(h2,function(tb){
      if(!tb){document.execCommand('insertText',false,pl2);return}
      var nn2=notes.filter(function(x){return x.id===nbShown})[0];if(!nn2)return;
      nbSetTables((nn2.tables||[]).concat([{ts:Date.now(),table:{rows:tb.rows}}]));
      toast(tb.cut?'Table added. Only the first 200 rows and 30 columns were kept':'Table added to this note');
    });
    return;
  }
  if(!t||(t.id!=='ntText'&&t.id!=='prText'))return;
  var html=e.clipboardData&&e.clipboardData.getData('text/html');
  if(!html||!/<table/i.test(html))return;
  var plain=e.clipboardData.getData('text/plain'),s0=t.selectionStart,s1=t.selectionEnd,k=t.id==='ntText'?'nt':'pr';
  e.preventDefault();
  parseTable(html,function(tb){
    if(!tb){t.setRangeText(plain,s0,s1,'end');return}
    if(k==='nt')ntTable=tb;else prTable=tb;
    showPend(k);if(tb.cut)toast('That table is large. Only the first 200 rows and 30 columns were kept');
  });
},true);
document.addEventListener('input',function(e){
  var t=e.target;
  if(t&&t.id==='bdQ'){bdQuery=t.value;bdRender();return}
  if(t&&t.getAttribute&&t.getAttribute('data-bdmsg')!==null){bdDraft[t.getAttribute('data-bdmsg')]=t.value;return}
});
document.addEventListener('input',function(e){
  var w=e.target&&e.target.closest&&e.target.closest('.tblwrap');
  if(!w||!e.target.closest('table.nt.xl')||!w.getAttribute('data-ts'))return;
  clearTimeout(tblTimer);tblTimer=setTimeout(function(){saveTbl(w)},700);
});
document.addEventListener('focusout',function(e){
  var w=e.target&&e.target.closest&&e.target.closest('.tblwrap');
  if(!w||!e.target.closest('table.nt.xl')||!w.getAttribute('data-ts'))return;
  clearTimeout(tblTimer);setTimeout(function(){if(document.body.contains(w))saveTbl(w)},50);
});
document.addEventListener('keydown',function(e){
  var td=e.target&&e.target.closest&&e.target.closest('table.nt.xl td');
  if(!td||e.key!=='Enter')return;
  e.preventDefault();
  var tr=td.parentNode,nx=tr.nextElementSibling;
  if(nx){var cell=nx.children[Array.prototype.indexOf.call(tr.children,td)];if(cell)cell.focus()}
});

/* ---------- business details, quotes, invoices and tenancy agreements ---------- */
var BIZ={},HOME=null;
function bizSnap(s){var d=s.docs.filter(function(x){return x.id==='business'})[0];BIZ=d?d.data():{};var hd=s.docs.filter(function(x){return x.id==='home'})[0],nh=hd?hd.data():null;if(JSON.stringify(nh)!==JSON.stringify(HOME)){HOME=nh;if(view==='cases'||view==='myhome')render();renderRem();renderNav()}if(view==='invoices')render();if(T.tenancyMode)renderSide()}
function bizName(){var p=profA();return BIZ.name||p.biz||p.name||''}
function okLogo(u){return /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(String(u||''))}
function vatOn(){return BIZ.vatReg==='yes'}
function r2(n){return Math.round((+n||0)*100)/100}
function gbp(n){n=r2(n);return (n<0?'-£':'£')+Math.abs(n).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}
function nl2br(s){return esc(s).replace(/\n/g,'<br>')}
function overlay(id,html,wide){var o=$('#'+id);if(!o){o=document.createElement('div');o.id=id;o.className='mkov';document.body.appendChild(o)}o.innerHTML='<div class="mkpanel dpanel'+(wide?' dwide':'')+'" role="dialog">'+html+'</div>';return o}
function closeOv(id){var o=$('#'+id);if(o)o.remove()}
/* LATEST29 module */
/* ---------- LATEST29: legal to let, repairs, Making Tax Digital check, rent statement, talk to an adviser ---------- */
/* Legal to let (landlord): built from the dates already on the property and its current tenancies.
   'bad' only when a date or rating shows a real problem; 'warn' when something is not recorded or due soon. */
function lgItems(c){
  var out=[],fk='',fd0='',add=function(l,st,note){out.push({l:l,st:st,note:note||'',k:fk,doc:fd0})},doc=function(k,d){fk=k;fd0=d};
  var dated=function(label,doneK,dueK,soon,missing){var d=fv(c,doneK),n=fv(c,dueK);if(!d){add(label,'warn',missing);return}if(n&&diff(n)<0){add(label,'bad','Overdue since '+fd(n));return}if(n&&diff(n)<=soon){add(label,'warn','Due '+fd(n));return}add(label,'ok',n?'Next due '+fd(n):'Done '+fd(d))};
  doc('gsrDate','gas safety certificate');
  dated('Gas safety record','gsrDate','gsrDue',30,'Not recorded. Needed every 12 months if there are gas appliances.');
  doc('eicrDate','EICR report');
  dated('Electrical safety report (EICR)','eicrDate','eicrDue',60,'Not recorded. Needed at least every 5 years.');
  doc('epcDate','EPC certificate');
  var r=String(c.epcRating||''),ex=fv(c,'epcExpiry');
  if(!r)add('Energy certificate (EPC)','warn','No rating recorded. An EPC rated E or above is needed to let.');
  else if('FG'.indexOf(r)>-1)add('Energy certificate (EPC)','bad','Rated '+r+'. The minimum to let is E, unless an exemption is registered.');
  else add('Energy certificate (EPC)',ex&&diff(ex)<0?'warn':'ok','Rated '+r+(ex?(diff(ex)<0?'. Expired '+fd(ex)+': renew before the next tenancy':'. Valid until '+fd(ex)):''));
  doc('alarmsChecked','alarm test record');
  add('Smoke and carbon monoxide alarms',c.alarmsChecked?'ok':'warn',c.alarmsChecked?'Tested '+fd(c.alarmsChecked):'Not recorded. Test them on the first day of every tenancy.');
  doc('licenceExpiry','licence');
  var lic=c.licence,le=c.licenceExpiry;
  if(!lic)add('Council licence','warn','Not recorded. Check with the council whether a licence is needed.');
  else if(lic==='Applied')add('Council licence','warn','Applied for, not granted yet.');
  else if(lic!=='Not needed')add('Council licence ('+lic+')',le&&diff(le)<0?'bad':le&&diff(le)<=60?'warn':'ok',le?(diff(le)<0?'Expired '+fd(le):'Expires '+fd(le)):'Expiry date not recorded.');
  tnCurrent(c).forEach(function(tn){
    var pre=' · '+(tnNames(tn)||'current tenant'),who=pfClean(tnNames(tn),40),tid=String(tn.id||'').replace(/[^A-Za-z0-9_-]/g,''),dep=+tfv(tn,'deposit')||0,sch=tfv(tn,'depositScheme');who=who?' '+who:'';
    doc('dep-'+tid,'deposit protection certificate'+who);
    if(dep>0&&sch!=='Not taken'){var pr=tfv(tn,'depositProtected'),dd=tfv(tn,'depositDue');add('Deposit protected'+pre,pr?'ok':dd&&diff(dd)<0?'bad':'warn',pr?'Protected '+fd(pr)+(sch?' with '+sch:''):dd?'Protect by '+fd(dd)+' (30 days from receipt).':'Protect it within 30 days of receiving it.')}
    doc('rtr-'+tid,'right to rent check'+who);
    var rr=tfv(tn,'rightToRent');add('Right to rent check'+pre,rr?'ok':'warn',rr?'Done '+fd(rr):'Not recorded. Check every adult occupier before the tenancy starts (England).');
    doc('inf-'+tid,'tenancy information'+who);
    var inf=tfv(tn,'infoSheet');add('Written tenancy information given'+pre,inf?'ok':'warn',inf?'Given '+fd(inf):'Not recorded. Tenants must be given the required written information.');
  });
  doc('insuranceRenewal','insurance certificate');
  if(c.insuranceRenewal)add('Landlord insurance (recommended)',diff(c.insuranceRenewal)<0?'warn':'ok',diff(c.insuranceRenewal)<0?'Renewal date passed '+fd(c.insuranceRenewal):'Renews '+fd(c.insuranceRenewal));
  return out;
}
function lgSum(c){var it=lgItems(c);return {bad:it.filter(function(x){return x.st==='bad'}).length,warn:it.filter(function(x){return x.st==='warn'}).length,n:it.length}}
function lgChip(c){var s=lgSum(c);return s.bad?'<span class="chip bad">'+s.bad+' problem'+(s.bad>1?'s':'')+'</span>':s.warn?'<span class="chip warn">'+s.warn+' to check</span>':'<span class="chip ok">In order</span>'}
/* each item can hold one uploaded document, saved in the property's folder in the user's own OneDrive or Google Drive.
   The same file shows next to the matching date field, because both use the same key. */
var LG_DOC='display:flex;flex-direction:row;flex-wrap:wrap;gap:4px 14px;margin-top:5px;font-size:12px';
function lgDocInner(c,k){
  var fl=dzFiles(c,k).slice().reverse(),up='<button type="button" style="'+DZ_BTN+'" data-dzup="'+esc(k)+'">Upload</button>';
  if(!fl.length)return up;
  var lk=function(f,t){return '<a href="'+esc(f.url)+'" target="_blank" rel="noopener" title="'+esc(f.name)+'">'+esc(t)+'</a>'};
  if(fl.length===1)return up+lk(fl[0],'Show');
  return up+'<details style="flex:1 1 100%;order:2"><summary style="cursor:pointer;font-weight:600;color:var(--accent)">Show ('+fl.length+' documents)</summary><div style="display:flex;flex-direction:column;gap:4px;margin:6px 0 2px">'+fl.map(function(f){return lk(f,f.name)}).join('')+'</div></details>';
}
/* a second upload for the same item asks first: keep the old documents as well, or replace them */
var lgPend=null;
function lgAsk(k,file){
  var c=currentCase(),n=dzFiles(c,k).length,w=window.CD_files.where(),bin=w==='Google Drive'?'Google Drive bin':w+' recycle bin';
  lgPend={k:k,file:file};
  overlay('lgAskOv','<h2>A document is already saved here</h2><p style="margin:0 0 14px">You are uploading <b>'+esc(file.name)+'</b>. What should happen to the '+(n>1?n+' documents':'document')+' already saved?</p>'+
   '<div style="display:flex;flex-direction:column;gap:10px">'+
   '<button type="button" class="btn" data-lgask="keep" style="text-align:left;white-space:normal">Keep old and add this one<br><span style="font-weight:400;font-size:12.5px">Both stay in the property folder. The new one is saved with its date in the name.</span></button>'+
   '<button type="button" class="btn ghost" data-lgask="replace" style="text-align:left;white-space:normal">Replace the old '+(n>1?'documents':'document')+'<br><span style="font-weight:400;font-size:12.5px">The old '+(n>1?'ones move':'one moves')+' to your '+esc(bin)+'.</span></button>'+
   '<button type="button" class="btn ghost" data-lgask="cancel">Cancel</button></div>');
}
document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest?e.target.closest('[data-lgask]'):null;if(!t)return;
  e.preventDefault();var m=t.getAttribute('data-lgask'),p=lgPend;lgPend=null;closeOv('lgAskOv');
  if(p&&m!=='cancel')dzSend(p.k,p.file,m);
});
function lgInner(c){return '<ul class="lglist">'+lgItems(c).map(function(x){return '<li class="lg-'+x.st+'"><i aria-hidden="true"></i><div><b>'+esc(x.l)+'</b><span>'+esc(x.note)+'</span>'+(x.k?'<div class="pl" style="'+LG_DOC+'" data-dz="'+esc(x.k)+'" data-dzl="'+esc(x.doc)+'" data-dzlg="1">'+lgDocInner(c,x.k)+'</div>':'')+'</div></li>'}).join('')+'</ul><p class="muted" style="margin:8px 0 0;font-size:11.5px">A guide built from the dates you have entered, for England. It is not legal advice.</p>'}
function lgBox(c){return '<fieldset data-sec="legal" id="lgFs"><legend>Legal to let <span class="lgsum" id="lgChip">'+lgChip(c)+'</span></legend><div id="lgBody">'+lgInner(c)+'</div></fieldset>'}
function lgRefresh(c){var b=$('#lgBody'),h=$('#lgChip');if(!b)return;b.innerHTML=lgInner(c);if(h)h.innerHTML=lgChip(c)}

/* Repairs log (landlord). A fixed repair with a cost becomes a "Repairs and maintenance" expense, kept in step. */
var RP_ST=[['reported','Reported, to arrange'],['booked','Booked in'],['fixed','Fixed']];
function rpList(c){return ((c&&c.repairs)||[]).slice().sort(function(a,b){var o=(a.status==='fixed')-(b.status==='fixed');return o||(a.reported<b.reported?1:a.reported>b.reported?-1:0)})}
function rpOpenN(c){return ((c&&c.repairs)||[]).filter(function(r){return r.status!=='fixed'}).length}
function rpReminders(c){var out=[];((c&&c.repairs)||[]).forEach(function(r){if(r.status==='fixed')return;var key='rp:'+r.id,d=r.status==='booked'&&r.booked?r.booked:r.reported?addDays(r.reported,7):'';if(!d||(c.remDone&&c.remDone[key]===d))return;out.push({date:d,label:(r.status==='booked'?'Repair booked: ':'Repair to arrange: ')+r.issue,key:key,sec:false})});return out}
var rpCase=null,rpEdit=null;
function rpOpen(caseId,editId){
  var c=cases.filter(function(x){return x.id===caseId})[0];if(!c)return;rpCase=caseId;rpEdit=editId||null;
  var ed=rpEdit?((c.repairs||[]).filter(function(x){return x.id===rpEdit})[0]||null):null;if(!ed)rpEdit=null;ed=ed||{};
  var who=tnCurrent(c).map(tnNames).filter(Boolean).join(' & ');
  var l=rpList(c),n=rpOpenN(c);
  overlay('rpOv','<div class="dhd"><h2>Repairs · '+esc(names(c))+'</h2><button type="button" class="btn" data-rpclose="1">Close</button></div>'+
   '<p class="muted" style="margin:4px 0 10px">'+(n?n+' repair'+(n>1?'s':'')+' still open. ':'No open repairs. ')+'When a repair is marked fixed with a cost, it is added to this property\'s expenses for your accountant.</p>'+
   (rpEdit?'<p style="margin:0 0 6px;font-weight:600">Editing the repair reported '+fd(ed.reported)+'</p>':'<p style="margin:0 0 6px;font-weight:600">Log a repair</p>')+
   '<div class="grid rpform'+(rpEdit?' editing':'')+'">'+
   '<label class="f">Reported on<input id="rp-reported" type="date" value="'+esc(ed.reported||iso(TODAY))+'"></label>'+
   '<label class="f">Reported by<input id="rp-by" value="'+esc(ed.by!=null?ed.by:who)+'" placeholder="Tenant, inspection, neighbour"></label>'+
   '<label class="f wide">What needs fixing<input id="rp-issue" value="'+esc(ed.issue||'')+'" placeholder="For example: kitchen tap leaking, boiler not firing"></label>'+
   '<label class="f">Status<select id="rp-status">'+RP_ST.map(function(s){return '<option value="'+s[0]+'"'+((ed.status||'reported')===s[0]?' selected':'')+'>'+s[1]+'</option>'}).join('')+'</select></label>'+
   '<label class="f">Tradesperson<input id="rp-who" value="'+esc(ed.who||'')+'" placeholder="Name or firm"></label>'+
   '<label class="f">Their phone<input id="rp-phone" type="tel" value="'+esc(ed.phone||'')+'"><span class="pl">'+plinks(ed.phone)+'</span></label>'+
   '<label class="f">Booked for<input id="rp-booked" type="date" value="'+esc(ed.booked||'')+'"></label>'+
   '<label class="f">Fixed on<input id="rp-fixed" type="date" value="'+esc(ed.fixed||'')+'"></label>'+
   '<label class="f">Cost<span class="ig"><i>£</i><input id="rp-cost" type="number" step="any" inputmode="decimal" value="'+esc(ed.cost==null?'':ed.cost)+'"></span></label>'+
   '<label class="f wide">Notes<input id="rp-notes" value="'+esc(ed.notes||'')+'" placeholder="Access arrangements, parts ordered, guarantee"></label></div>'+
   '<p id="rpMsg" role="alert" style="color:#b42318;min-height:1em;margin:4px 0"></p>'+
   '<div class="add" style="margin:0 0 12px"><button type="button" class="btn" data-rpsave="1">'+(rpEdit?'Save changes':'Add repair')+'</button>'+(rpEdit?'<button type="button" class="btn ghost" data-rpcancel="1">Cancel edit</button>':'')+'</div>'+
   (l.length?'<div class="tw"><table class="extab"><thead><tr><th>Reported</th><th>Repair</th><th>Tradesperson</th><th>Status</th><th>Cost</th><th></th></tr></thead><tbody>'+l.map(function(r){var st=r.status==='fixed'?'<span class="chip ok">Fixed '+fd(r.fixed)+'</span>':r.status==='booked'?'<span class="chip warn">Booked'+(r.booked?' '+fd(r.booked):'')+'</span>':'<span class="chip '+(r.reported&&diff(r.reported)<-7?'bad':'warn')+'">To arrange</span>';
     return '<tr><td>'+fd(r.reported)+'</td><td>'+esc(r.issue||'')+(r.notes?'<div class="muted" style="font-size:12px">'+esc(r.notes)+'</div>':'')+'</td><td>'+esc(r.who||'')+(r.phone?'<div class="pl">'+plinks(r.phone)+'</div>':'')+'</td><td>'+st+'</td><td class="num">'+(r.cost?gbp(r.cost):'')+'</td><td class="exact"><button type="button" class="exed" data-rpedit="'+esc(r.id)+'">Edit</button><button type="button" class="x" data-rpdel="'+esc(r.id)+'" aria-label="Delete repair">×</button></td></tr>'}).join('')+'</tbody></table></div>':'<p class="muted">No repairs logged for this property yet.</p>'),true);
}
function rpSave(){
  var c=cases.filter(function(x){return x.id===rpCase})[0];if(!c)return;var m=$('#rpMsg'),g=function(k){var e=$('#rp-'+k);return e?e.value.trim():''};
  var issue=g('issue');if(!issue){m.textContent='Describe what needs fixing.';$('#rp-issue').focus();return}
  var st=g('status'),cost=num(g('cost')),fixed=g('fixed');if(st==='fixed'&&!fixed)fixed=iso(TODAY);if(fixed&&st!=='fixed')st='fixed';
  var old=rpEdit?((c.repairs||[]).filter(function(x){return x.id===rpEdit})[0]||{}):{};
  var r=Object.assign({},old,{id:old.id||'r'+uid(),reported:g('reported')||iso(TODAY),by:g('by'),issue:issue,status:st,who:g('who'),phone:g('phone'),booked:g('booked'),fixed:st==='fixed'?fixed:'',cost:cost,notes:g('notes'),updated:Date.now()});
  var exps=(c.expenses||[]).slice();
  if(st==='fixed'&&cost>0){var e={date:r.fixed,cat:'Repairs and maintenance',amount:r2(cost),to:r.who,desc:'Repair: '+issue,repairId:r.id};
    if(r.expId&&exps.some(function(x){return x.id===r.expId}))exps=exps.map(function(x){return x.id===r.expId?Object.assign({},x,e,{edited:Date.now()}):x});
    else{r.expId='e'+uid();exps.push(Object.assign({id:r.expId,added:Date.now()},e))}}
  else if(r.expId){exps=exps.filter(function(x){return x.id!==r.expId});delete r.expId}
  var reps=rpEdit?(c.repairs||[]).map(function(x){return x.id===rpEdit?r:x}):(c.repairs||[]).concat([r]);
  patch(c.id,{repairs:reps,expenses:exps});toast(rpEdit?'Repair updated':'Repair logged'+(r.expId?'. The cost was added to expenses':''));
  setTimeout(function(){rpOpen(c.id,null);rpBtnSet()},60);
}
function rpBtnSet(){var b=$('#repBtn'),c=currentCase();if(!b||!c)return;var n=rpOpenN(c);b.textContent='Repairs'+(n?' ('+n+' open)':'')}
document.addEventListener('click',function(e){
  var t=e.target;if(!t||!t.closest)return;var b;
  if(t.id==='repBtn'){if(!openId){toast('Add the property address first. It saves itself, then try again.');return}var d=collectForm();patch(openId,d);lastAuto=JSON.stringify(d);rpOpen(openId,null);return}
  if(t.closest('[data-rpclose]')){closeOv('rpOv');rpBtnSet();if(openId&&T.tenancyMode)setTimeout(function(){renderLive();var c=currentCase();if(c)lgRefresh(c)},60);return}
  if(t.closest('[data-rpsave]')){rpSave();return}
  if(t.closest('[data-rpcancel]')){rpOpen(rpCase,null);return}
  if((b=t.closest('[data-rpedit]'))){rpOpen(rpCase,b.getAttribute('data-rpedit'));var f=$('#rp-issue');if(f)f.focus();return}
  if((b=t.closest('[data-rpdel]'))){if(!b.classList.contains('armed')){b.classList.add('armed');b.textContent='Delete?';b.title='Press again to delete the repair and its expense';return}
    var c=cases.filter(function(x){return x.id===rpCase})[0];if(!c)return;var id=b.getAttribute('data-rpdel'),rr=(c.repairs||[]).filter(function(x){return x.id===id})[0]||{};
    patch(c.id,{repairs:(c.repairs||[]).filter(function(x){return x.id!==id}),expenses:(c.expenses||[]).filter(function(x){return !rr.expId||x.id!==rr.expId})});toast('Repair deleted');setTimeout(function(){rpOpen(c.id,null);rpBtnSet()},60);return}
});
document.addEventListener('input',function(e){var t=e.target;if(t&&t.id==='rp-phone'){var pl=t.parentNode.querySelector('.pl');if(pl)pl.innerHTML=plinks(t.value)}});

/* Making Tax Digital check (every trade). Gross income recorded in the app, against the planned thresholds:
   income in the tax year starting April Y decides whether MTD for Income Tax applies from April Y+2. */
function mtdRule(y){return {th:y<=2024?50000:y===2025?30000:20000,from:'April '+(y+2)}}
function docNet(d){var n=(d.lines||[]).reduce(function(a,l){return a+(+l.q||0)*(+l.p||0)},0);return n||(+d.total||0)}
function mtdIncome(from,to){
  var s=0;
  cases.forEach(function(c){
    if(T.tenancyMode){tnList(c).forEach(function(tn){(tn.rentLog||[]).forEach(function(r){if(r.status!=='paid')return;var d=r.paidDate||r.due;if(d&&d>=from&&d<=to)s+=+r.amount||0})});return}
    var inv=docsOf(c).filter(function(d){return d.kind==='invoice'});
    if(inv.length)inv.forEach(function(d){if(d.status!=='paid')return;var dt=d.paidDate||d.date;if(dt&&dt>=from&&dt<=to)s+=docNet(d)});
    else{var pd2=fv(c,'paidDate'),amt=+c.invoiceAmount||0;if(amt&&pd2&&pd2>=from&&pd2<=to)s+=amt}
  });
  return r2(s);
}
function mtdCard(){
  var t=iso(TODAY),ty=taxYear(t),ly=taxYear(addDays(ty.from,-1)),y=+ty.from.slice(0,4),now=mtdIncome(ty.from,t),last=mtdIncome(ly.from,ly.to);
  var rN=mtdRule(y),rL=mtdRule(y-1),days=Math.max(1,Math.round((pd(t)-pd(ty.from))/864e5)+1),proj=days>=30?r2(now/days*365):null;
  var what=T.tenancyMode?'rent received':'paid invoices';
  var lastSt=last>rL.th?'bad':'ok',nowSt=now>rN.th?'bad':proj!=null&&proj>rN.th?'warn':'ok';
  var head=lastSt==='bad'||nowSt==='bad'?'<span class="chip bad">Likely to apply</span>':nowSt==='warn'?'<span class="chip warn">On track to apply</span>':'<span class="chip ok">Under the limits so far</span>';
  var row=function(lbl,val,rule,st,extra){return '<div class="mtdrow"><div><b>'+lbl+'</b><span>'+gbp(val)+' of '+what+extra+'</span></div><div class="mtdres '+st+'">'+(st==='bad'?'Over '+gbp0(rule.th)+': MTD from '+rule.from:st==='warn'?'Heading over '+gbp0(rule.th)+' (MTD from '+rule.from+')':'Under '+gbp0(rule.th)+' (the limit for MTD from '+rule.from+')')+'</div></div>'};
  return '<details class="mtdcard"><summary><b>Making Tax Digital check</b> '+head+'</summary>'+
   '<p class="muted" style="margin:8px 0 10px">From April 2026, sole traders and landlords must keep digital records and send HMRC updates every quarter once their income is over a limit: £50,000 now, £30,000 from April 2027 and £20,000 from April 2028. Each year\'s income decides the year after next.</p>'+
   row('Last tax year '+ly.label,last,rL,lastSt,'')+row('This tax year '+ty.label+' so far',now,rN,nowSt,proj!=null?' (on track for about '+gbp0(proj)+')':'')+
   '<p class="muted" style="margin:10px 0 0;font-size:12px">Only counts '+what+' recorded in this app. The limit is your gross income before expenses from self-employment and property added together, so include any other work or rentals. This app does not send updates to HMRC: if MTD applies, you or your accountant will need HMRC-recognised software. Check with your accountant or GOV.UK.</p></details>';
}
function gbp0(n){return '£'+Math.round(+n||0).toLocaleString('en-GB')}

/* Rent statement for a tenancy (landlord): PDF, share and print. */
function stData(c,tn){
  var rows=(tn.rentLog||[]).filter(function(r){return r.due}).slice().sort(function(a,b){return a.due<b.due?-1:1}),t=iso(TODAY),bal=0,dueT=0,paidT=0;
  var out=rows.map(function(r){var due=r.due<=t,amt=+r.amount||0,paid=r.status==='paid';if(due)dueT+=amt;if(paid)paidT+=amt;if(due)bal+=amt;if(paid)bal-=amt;return {due:r.due,period:rlPeriod(r.due,tfv(tn,'rentFreq')),amt:amt,paid:paid,paidOn:paid?(r.paidDate||''):'',future:!due&&!paid,bal:r2(bal)}});
  return {rows:out,dueT:r2(dueT),paidT:r2(paidT),bal:r2(dueT-paidT)};
}
function stHtml(c,tn){
  var d=stData(c,tn),who=tnNames(tn)||'Tenant';
  return '<div class="sthtml"><h3 style="margin:0 0 2px">Rent statement</h3><div class="muted">'+esc(bizName()||profA().name||'')+' · '+fd(iso(TODAY))+'</div>'+
   '<p style="margin:10px 0"><b>'+esc(who)+'</b><br>'+esc(paddr(c))+'</p>'+
   '<div class="stsum"><div><span>Rent due to date</span><b>'+gbp(d.dueT)+'</b></div><div><span>Paid</span><b>'+gbp(d.paidT)+'</b></div><div><span>'+(d.bal>0?'Owing':'Balance')+'</span><b'+(d.bal>0?' style="color:#b3261e"':'')+'>'+gbp(d.bal)+'</b></div></div>'+
   (d.rows.length?'<div class="tw"><table class="extab"><thead><tr><th>Due</th><th>For</th><th>Rent</th><th>Paid on</th><th>Balance</th></tr></thead><tbody>'+d.rows.map(function(r){return '<tr><td>'+fd(r.due)+'</td><td>'+esc(r.period)+'</td><td class="num">'+gbp(r.amt)+'</td><td>'+(r.paid?fd(r.paidOn||r.due):r.future?'<span class="muted">Not due yet</span>':'<span class="chip bad">Unpaid</span>')+'</td><td class="num">'+(r.future?'':gbp(r.bal))+'</td></tr>'}).join('')+'</tbody></table></div>':'<p class="muted">No rent payments recorded for this tenancy yet. Add them under Rent payments on the tenant.</p>')+'</div>';
}
function stPdf(c,tn){
  var d=stData(c,tn),P=new Pdf(),G=[0.35,0.41,0.47],A=[0.18,0.29,0.25],who=tnNames(tn)||'Tenant';
  if(okLogo(BIZ.logo)&&BIZ.logoW){var s=Math.min(140/BIZ.logoW,45/BIZ.logoH);P.image(BIZ.logo,BIZ.logoW,BIZ.logoH,40,36,BIZ.logoW*s,BIZ.logoH*s);P.y=36+BIZ.logoH*s+12}
  P.t(40,P.y,'Rent statement',18,true,'l',A);P.y+=22;
  var from=[bizName()||profA().name||''].concat(String(BIZ.address||'').split('\n')).filter(Boolean);from.forEach(function(l){P.t(40,P.y,l,9.5,false,'l',G);P.y+=12});
  P.y+=6;P.t(40,P.y,'To: '+who,10.5,true);P.y+=14;wrapT(paddr(c),515,10).forEach(function(l){P.t(40,P.y,l,10);P.y+=13});P.t(40,P.y,'Date: '+fd(iso(TODAY)),10);P.y+=20;
  [['Rent due to date',d.dueT],['Paid',d.paidT],[d.bal>0?'Owing':'Balance',d.bal]].forEach(function(r,i){P.t(40,P.y,r[0],10.5,i===2);P.t(300,P.y,gbp(r[1]),10.5,i===2,'r');P.y+=15});P.y+=8;
  var cols=[[46,'l'],[120,'l'],[360,'r'],[380,'l'],[549,'r']],hd=function(p){p.rect(40,p.y,515,16,[0.93,0.95,0.94]);['Due','For','Rent','Paid on','Balance'].forEach(function(h,i){p.t(cols[i][0],p.y+4,h,8.5,true,cols[i][1])});p.y+=20};
  P.need(40);hd(P);
  if(!d.rows.length){P.t(46,P.y,'No rent payments recorded.',9,false,'l',G);P.y+=14}
  d.rows.forEach(function(r){P.need(14,hd);P.t(cols[0][0],P.y,fd(r.due),9);P.t(cols[1][0],P.y,r.period,9);P.t(cols[2][0],P.y,gbp(r.amt),9,false,'r');P.t(cols[3][0],P.y,r.paid?fd(r.paidOn||r.due):r.future?'Not due yet':'Unpaid',9,!r.paid&&!r.future);if(!r.future)P.t(cols[4][0],P.y,gbp(r.bal),9,false,'r');P.y+=13;P.line(40,P.y-2,555)});
  if(BIZ.payDetails&&d.bal>0){P.y+=10;P.need(30);P.t(40,P.y,'How to pay',10,true);P.y+=13;wrapT(BIZ.payDetails,515,9).forEach(function(l){P.t(40,P.y,l,9);P.y+=11})}
  P.y+=10;P.need(20);wrapT('Please contact your landlord if anything on this statement looks wrong.',515,8.5).forEach(function(l){P.t(40,P.y,l,8.5,false,'l',G);P.y+=11});
  return P.bytes('Rent statement · '+who);
}
var stCase=null,stTn=null;
function stOpen(caseId,tnId){
  var c=cases.filter(function(x){return x.id===caseId})[0];if(!c)return;var tn=tnList(c).filter(function(x){return x.id===tnId})[0];if(!tn)return;stCase=caseId;stTn=tnId;
  var d=stData(c,tn),ppl=(tn.people||[]).filter(function(p){return p.phone||p.email});
  var msg='Hello'+(ppl[0]&&ppl[0].name?' '+String(ppl[0].name).split(' ')[0]:'')+', here is your rent statement for '+(paddr(c).split(',')[0])+'. Rent due to date '+gbp(d.dueT)+', paid '+gbp(d.paidT)+(d.bal>0?', owing '+gbp(d.bal)+'.':'. Thank you, nothing is owing.');
  overlay('stOv','<div class="dhd"><h2>Rent statement</h2><button type="button" class="btn ghost" data-stclose="1">Close</button></div>'+
   '<div class="add" style="margin:4px 0 12px"><button type="button" class="btn" data-stout="dl">Download PDF</button><button type="button" class="btn ghost" data-stout="share">Share PDF</button><button type="button" class="btn ghost" data-stout="print">Print</button></div>'+
   (ppl.length?'<div class="stsend">'+ppl.map(function(p){var w=String(p.phone||'').replace(/[^\d+]/g,''),intl=w.charAt(0)==='+'?w.slice(1):w.charAt(0)==='0'?'44'+w.slice(1):w;return '<div><b>'+esc(p.name||'Tenant')+'</b> '+(w.replace(/\D/g,'').length>=7?'<a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/'+intl+'?text='+encodeURIComponent(msg)+'">WhatsApp message</a>':'')+(p.email?'<a class="btn ghost sm" target="_blank" rel="noopener" href="mailto:'+esc(p.email)+'?subject='+encodeURIComponent('Rent statement')+'&body='+encodeURIComponent(msg)+'">Email</a>':'')+'</div>'}).join('')+'<p class="muted" style="font-size:12px;margin:6px 0 0">The message gives the totals. To send the PDF itself, use Share PDF on a phone, or attach the downloaded file.</p></div>':'')+
   stHtml(c,tn),true);
}
document.addEventListener('click',function(e){
  var t=e.target;if(!t||!t.closest)return;var b;
  if((b=t.closest('[data-tnstmt]'))){e.preventDefault();if(!openId)return;var tid=b.getAttribute('data-tnstmt'),data=collectForm();patch(openId,data);lastAuto=JSON.stringify(data);setTimeout(function(){stOpen(openId,tid)},80);return}
  if(t.closest('[data-stclose]')){closeOv('stOv');return}
  if((b=t.closest('[data-stout]'))){var c=cases.filter(function(x){return x.id===stCase})[0],tn=c&&tnList(c).filter(function(x){return x.id===stTn})[0];if(!tn)return;var how=b.getAttribute('data-stout'),fn='Rent-statement-'+pfClean(paddr(c).split(',')[0],40).replace(/\s+/g,'-')+'-'+iso(TODAY)+'.pdf';
    if(how==='print'){printHtml(stHtml(c,tn));return}fileOut(stPdf(c,tn),fn,how==='dl'?'dl':'share');return}
});

/* Talk to a mortgage adviser: shown near mortgage deal end dates when the app owner has filled in adviser details in config.js */
function advCfg(){var C=window.MD_CONFIG||{},v=function(k){var x=String(C[k]||'').trim();return /PASTE/i.test(x)?'':x};return {name:v('adviserName'),firm:v('adviserFirm'),phone:v('adviserPhone'),email:v('adviserEmail')}}
function advOn(){var a=advCfg();return !!(a.phone||a.email)}
function advBox(date,what){
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!advOn())return '';var n=diff(date);if(n>270||n<-90)return '';
  var a=advCfg(),msg='Hello'+(a.name?' '+a.name.split(' ')[0]:'')+', my '+what.toLowerCase()+' ends on '+fd(date)+'. Could we talk about my options?';
  var w=String(a.phone||'').replace(/[^\d+]/g,''),intl=w.charAt(0)==='+'?w.slice(1):w.charAt(0)==='0'?'44'+w.slice(1):w;
  return '<div class="advbox"><b>'+esc(what)+' '+(n<0?'ended':'ends')+' '+fd(date)+' ('+esc(rel(date))+')</b><span>Talk to '+esc(a.name||'a mortgage adviser')+(a.firm?' at '+esc(a.firm):'')+' about your options before you move onto a higher rate.</span><div class="advlinks">'+
   (w.replace(/\D/g,'').length>=7?'<a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/'+intl+'?text='+encodeURIComponent(msg)+'">WhatsApp</a>':'')+(a.email?'<a class="btn ghost sm" target="_blank" rel="noopener" href="mailto:'+esc(a.email)+'?subject='+encodeURIComponent('My mortgage deal')+'&body='+encodeURIComponent(msg)+'">Email</a>':'')+'</div><small>Nothing is shared until you send the message yourself.</small></div>';
}

/* ---------- My home: the landlord's own residential property (settings/home). Kept apart from rental properties, rent totals and the accountant report. ---------- */
var HOME_F=[
  ['Your home',[['addr1','Address line one','text'],['postcode','Postcode','text'],['ownership','Ownership','sel',['','Owned with a mortgage','Owned outright','Shared ownership','Renting']],['ptype','Type','sel',['','House','Flat','Bungalow','Maisonette','Other']],['bedrooms','Bedrooms','num'],['purchaseDate','Bought on','date'],['purchasePrice','Price paid','money'],['value','Estimated value now','money'],['valueDate','Value checked on','date']]],
  ['Mortgage',[['lender','Lender','text'],['balance','Mortgage balance','money'],['rate','Interest rate (% a year)','num'],['payment','Monthly payment','money'],['method','Payment method','sel',['','Repayment','Interest only','Part and part']],['dealType','Type of deal','sel',['','Fixed rate','Tracker','Discount','Variable (SVR)']],['dealEnd','Deal ends','date'],['ercEnd','Early repayment charge until','date'],['termEnd','Mortgage term ends','date']]],
  ['Insurance and bills',[['insurer','Home insurer','text'],['insRenewal','Insurance renewal','date'],['energy','Energy supplier','text'],['energyEnd','Energy deal ends','date'],['councilBand','Council tax band','sel',['','A','B','C','D','E','F','G','H','I']]]],
  ['Safety and upkeep',[['boiler','Boiler last serviced','date'],['boilerDue','Next boiler service (12 months)','date',null,{from:'boiler',m:12}],['eicr','Electrical check done','date'],['eicrDue','Next electrical check (every 10 years)','date',null,{from:'eicr',m:120}],['epc','EPC rating','sel',['','A','B','C','D','E','F','G']]]]
];
function homeF(k){var f=null;HOME_F.forEach(function(g){g[1].forEach(function(x){if(x[0]===k)f=x})});return f}
function homeV(h,k){h=h||{};if(h[k])return h[k];var f=homeF(k);if(f&&f[4]&&h[f[4].from])return addMonths(h[f[4].from],f[4].m);return ''}
function homeEvents(){
  var h=HOME;if(!h||!h.addr1)return [];var out=[],who='My home · '+h.addr1;
  function add(k,exp,label,lead){if(!exp||!/^\d{4}-\d{2}-\d{2}$/.test(exp))return;out.push({date:remDue(h.remDone&&h.remDone[k],exp,lead),label:label+' '+fd(exp),kind:'review',id:'__home',who:who,key:k,rep:1,exp:exp})}
  add('dealEnd',homeV(h,'dealEnd'),'Mortgage deal ends',4);
  add('insRenewal',homeV(h,'insRenewal'),'Home insurance renewal',2);add('energyEnd',homeV(h,'energyEnd'),'Energy deal ends',2);
  add('boilerDue',homeV(h,'boilerDue'),'Boiler service due',2);add('eicrDue',homeV(h,'eicrDue'),'Electrical check due',2);
  return out;
}
/* the home address, in small type, under the My home tab */
function homeLine(){var h=HOME;return h&&h.addr1?[String(h.addr1).trim(),String(h.postcode||'').trim()].filter(Boolean).join(', '):''}
function homeSmall(top){var a=homeLine();return a?'<small title="'+esc(a)+'" style="display:block;font-size:11px;font-weight:400;line-height:1.3;opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:'+(top?'170px':'100%')+'">'+esc(a)+'</small>':''}
function homeWrite(d){d.savedAt=Date.now();HOME=d;if(setCol)write('set-home',function(){return setCol.doc('home').set(d)});if(view==='cases'||view==='myhome')render();renderRem();renderNav();renderSide()}
function homeCard(pg){
  var h=HOME,hd=pg?'':'<h2>My home</h2>';
  if(!h||!h.addr1)return '<section class="homecard empty"><div class="hch"><div>'+hd+'<p class="muted">Keep a record of your own home: mortgage and deal end date, insurance, bills and safety checks. It is kept separate from your rental properties, rent totals and accountant reports.</p></div><button type="button" class="btn" id="homeAdd">Add my home</button></div></section>';
  var bal=+h.balance||0,val=+h.value||0,ltv=bal&&val?Math.round(bal/val*1000)/10:null,eq=val?val-bal:null;
  var chip=function(d,l){return d?'<span class="chip '+tone(d)+'">'+esc(l)+' '+fd(d)+'</span>':''};
  var fact=function(l,v){return v?'<div class="hf"><span>'+esc(l)+'</span><b>'+v+'</b></div>':''};
  return '<section class="homecard"><div class="hch"><div>'+hd+'<div class="hadr">'+esc(h.addr1)+(h.postcode?', '+esc(h.postcode):'')+'</div><div class="muted" style="font-size:13px">'+esc([h.ownership,h.ptype,h.bedrooms?h.bedrooms+' bed':''].filter(Boolean).join(' · '))+'</div></div><button type="button" class="btn ghost" id="homeEdit">View and edit</button></div>'+
    '<div class="hfacts">'+fact('Estimated value',val?money(val):'')+fact('Mortgage balance',bal?money(bal):'')+fact('Equity',eq!=null&&bal?money(eq):'')+fact('Loan to value',ltv!=null?ltv+'%':'')+fact('Lender',esc(h.lender||''))+fact('Rate',h.rate?esc(h.rate)+'%'+(h.dealType?' '+esc(String(h.dealType).toLowerCase()):''):'')+fact('Monthly payment',h.payment?money(h.payment):'')+'</div>'+
    '<div class="hchips">'+chip(homeV(h,'dealEnd'),'Deal ends')+chip(homeV(h,'insRenewal'),'Insurance renewal')+chip(homeV(h,'boilerDue'),'Boiler service')+chip(homeV(h,'energyEnd'),'Energy deal ends')+'</div>'+advBox(homeV(h,'dealEnd'),'Mortgage deal on your home')+'</section>';
}
function homeOpen(){
  var h=HOME||{};
  var fld=function(x){var k=x[0],l=x[1],t=x[2],v=h[k]==null?'':h[k];
    if(t==='sel')return '<label class="f">'+esc(l)+'<select id="hm-'+k+'">'+x[3].map(function(o){return '<option value="'+esc(o)+'"'+(o===v?' selected':'')+'>'+(o===''?'Choose…':esc(o))+'</option>'}).join('')+'</select></label>';
    if(x[4])return '<label class="f">'+esc(l)+'<input id="hm-'+k+'" type="date" data-hfrom="'+x[4].from+'" data-hm="'+x[4].m+'" data-auto="'+(v?'0':'1')+'" value="'+esc(homeV(h,k))+'"></label>';
    var inp='<input id="hm-'+k+'" type="'+(t==='date'?'date':t==='text'?'text':'number" step="any" inputmode="decimal')+'" value="'+esc(v)+'">';
    return '<label class="f">'+esc(l)+(t==='money'?'<span class="ig"><i>£</i>'+inp+'</span>':inp)+'</label>'};
  overlay('hmOv','<div class="dhd"><h2>My home</h2><button type="button" class="btn ghost" data-hmclose="1">Close</button></div>'+
   '<p class="muted" style="margin:4px 0 12px">Your own home, kept apart from your rental properties. It is saved in your own '+esc(window.CD_files?window.CD_files.where():'storage')+'. Do not add account numbers or bank details.</p>'+
   HOME_F.map(function(g){return '<fieldset><legend>'+esc(g[0])+'</legend><div class="grid">'+g[1].map(fld).join('')+'</div></fieldset>'}).join('')+
   '<fieldset><legend>Notes</legend><label class="f wide">Notes<textarea id="hm-notes" rows="3">'+esc(h.notes||'')+'</textarea></label></fieldset>'+
   '<p id="hmMsg" class="muted" role="alert"></p><div class="add" style="justify-content:flex-end">'+(HOME&&HOME.addr1?'<button type="button" class="btn ghost danger" data-hmdel="1" style="margin-right:auto">Remove my home</button>':'')+'<button type="button" class="btn ghost" data-hmclose="1">Cancel</button><button type="button" class="btn" data-hmsave="1">Save</button></div>',true);
}
function homeSave(){
  var d=Object.assign({},HOME||{}),m=$('#hmMsg');delete d.removedAt;
  HOME_F.forEach(function(g){g[1].forEach(function(x){
    var e=$('#hm-'+x[0]);if(!e)return;var v=e.value.trim();
    if(x[4]){var src=(($('#hm-'+x[4].from)||{}).value||'');if(e.getAttribute('data-auto')==='1'||(src&&v===addMonths(src,x[4].m))){d[x[0]]='';return}}
    d[x[0]]=(x[2]==='money'||x[2]==='num')?(v===''?'':num(v)):v;
  })});
  d.notes=($('#hm-notes')||{}).value||'';
  if(d.postcode)d.postcode=pcFmt(d.postcode);
  if(!String(d.addr1||'').trim()){if(m){m.textContent='Add address line one.';m.style.color='#b3261e'}var a=$('#hm-addr1');if(a){a.focus();a.scrollIntoView({block:'center'})}return}
  homeWrite(d);closeOv('hmOv');toast('My home saved');
}
document.addEventListener('click',function(e){
  var t=e.target;if(!t||!t.closest)return;
  if(t.closest('#homeAdd')||t.closest('#homeEdit')){homeOpen();return}
  if(t.closest('[data-hmclose]')){closeOv('hmOv');return}
  if(t.closest('[data-hmsave]')){homeSave();return}
  var dl=t.closest('[data-hmdel]');if(dl){if(!dl.classList.contains('armed')){dl.classList.add('armed');dl.textContent='Press again to remove';return}homeWrite({removedAt:Date.now()});closeOv('hmOv');toast('My home removed');return}
});
document.addEventListener('input',function(e){var t=e.target;if(!t||!t.id||t.id.indexOf('hm-')!==0)return;
  if(t.hasAttribute('data-hfrom'))t.setAttribute('data-auto',t.value?'0':'1');
  document.querySelectorAll('#hmOv [data-hfrom="'+t.id.slice(3)+'"]').forEach(function(dep){if(dep.getAttribute('data-auto')!=='1')return;dep.value=t.value&&/^\d{4}-\d{2}-\d{2}$/.test(t.value)?addMonths(t.value,+dep.getAttribute('data-hm')):''});
});


/* --- business details panel (saved to OneDrive, same on every device) --- */
var bizDraftLogo=null;
function openBiz(){
  var locked=BIZ.savedAt&&window.CD_reFresh&&!window.CD_reFresh(),dis=locked?' disabled':'',p=profA(),b=BIZ;bizDraftLogo=null;
  var f=function(k,l,v,ph,type){return '<label class="f">'+l+'<input id="bz-'+k+'" type="'+(type||'text')+'"'+dis+' value="'+esc(v==null?'':v)+'" placeholder="'+esc(ph||'')+'"></label>'};
  var a=function(k,l,v,ph){return '<label class="f wide">'+l+'<textarea id="bz-'+k+'" rows="3"'+dis+' placeholder="'+esc(ph||'')+'">'+esc(v||'')+'</textarea></label>'};
  overlay('bzOv','<div class="dhd"><h2>Business details</h2><button type="button" class="btn ghost" data-bzclose="1">Close</button></div>'+
   '<p class="muted" style="margin:4px 0 10px">These appear on your quotes, invoices'+(T.id==='landlord'?' and tenancy agreements':'')+'. They are saved in your OneDrive, so every device uses the same details.</p>'+
   (locked?'<p class="dnote">Locked. To change your business or payment details, confirm with your Microsoft account password. This stops anyone else changing where customers pay you.</p><button type="button" class="btn" data-bzunlock="1" style="margin-bottom:10px">Unlock to edit</button>':'')+
   '<div class="bzlogo"><div id="bzLogoBox">'+(okLogo(b.logo)?'<img src="'+b.logo+'" alt="Your logo">':'<span class="muted">No logo yet</span>')+'</div><div><label class="btn ghost sm'+(locked?' disabled':'')+'">Upload logo<input type="file" id="bzLogo" accept="image/*" hidden'+dis+'></label> '+(okLogo(b.logo)?'<button type="button" class="btn ghost sm" data-bzlogodel="1"'+dis+'>Remove logo</button>':'')+'<div class="muted" style="font-size:12px;margin-top:4px">PNG or JPG. It is resized to keep your files small.</div></div></div>'+
   '<div class="grid">'+f('name','Business or trading name',b.name!=null?b.name:p.biz,'')+f('owner','Your name (shown as the contact)',b.owner!=null?b.owner:p.name,'')+
   a('address','Business address',b.address,'Street, town, postcode')+f('phone','Phone',b.phone!=null?b.phone:(p.phone?ukPhone(p.phone):''),'','tel')+f('email','Email',b.email!=null?b.email:p.email,'','email')+f('web','Website',b.web,'www.example.co.uk')+f('reg','Registration (e.g. Gas Safe, NICEIC, ARB, SRA, FCA number)',b.reg!=null?b.reg:p.reg,'')+
   f('companyNo','Company number (limited companies)',b.companyNo,'')+a('regOffice','Registered office (if different from the business address)',b.regOffice,'')+
   '<label class="f">VAT registered<select id="bz-vatReg"'+dis+'><option value="no">No</option><option value="yes"'+(b.vatReg==='yes'?' selected':'')+'>Yes</option></select></label>'+f('vatNo','VAT number',b.vatNo,'GB123456789')+f('vatRate','Usual VAT rate (%)',b.vatRate!=null?b.vatRate:20,'','number')+
   a('payDetails','How customers pay you (your own business account, shown on invoices)',b.payDetails,'For example: Bank transfer to Example Ltd, sort code 00-00-00, account 00000000')+
   f('payTerms','Payment due after (days)',b.payTerms!=null?b.payTerms:14,'','number')+f('quoteValid','Quotes valid for (days)',b.quoteValid!=null?b.quoteValid:30,'','number')+
   f('invPrefix','Invoice number starts with',b.invPrefix!=null?b.invPrefix:'INV-','')+f('nextInv','Next invoice number',b.nextInv||1001,'','number')+
   f('quotePrefix','Quote number starts with',b.quotePrefix!=null?b.quotePrefix:'Q-','')+f('nextQuote','Next quote number',b.nextQuote||1001,'','number')+
   a('terms','Notes printed at the bottom of every quote and invoice',b.terms!=null?b.terms:'Thank you for your business.','')+
   '</div><div class="mkact"><button type="button" class="btn" data-bzsave="1"'+dis+'>Save business details</button><button type="button" class="btn ghost" data-bzclose="1">Cancel</button></div><p id="bzMsg" class="muted" style="min-height:18px"></p>');
}
window.CD_openBiz=openBiz;
function logoLoad(file,cb){
  var fr=new FileReader();
  fr.onload=function(){var im=new Image();im.onload=function(){var s=Math.min(1,600/im.width,300/im.height),w=Math.max(1,Math.round(im.width*s)),h=Math.max(1,Math.round(im.height*s)),cv=document.createElement('canvas');cv.width=w;cv.height=h;var x=cv.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);cb({src:cv.toDataURL('image/jpeg',0.88),w:w,h:h})};im.onerror=function(){cb(null)};im.src=fr.result};
  fr.onerror=function(){cb(null)};fr.readAsDataURL(file);
}
function bizSave(){
  if(BIZ.savedAt&&window.CD_reGate&&!window.CD_reGate('biz'))return;
  var g=function(k){var e=$('#bz-'+k);return e?e.value.trim():''},n=function(k,d){var v=parseFloat(g(k));return isNaN(v)?d:v};
  var d=Object.assign({},BIZ,{name:g('name'),owner:g('owner'),address:g('address'),phone:g('phone'),email:g('email'),web:g('web'),reg:g('reg'),companyNo:g('companyNo'),regOffice:g('regOffice'),vatReg:g('vatReg'),vatNo:g('vatNo'),vatRate:n('vatRate',20),payDetails:g('payDetails'),payTerms:Math.max(0,Math.round(n('payTerms',14))),quoteValid:Math.max(0,Math.round(n('quoteValid',30))),invPrefix:g('invPrefix'),nextInv:Math.max(1,Math.round(n('nextInv',1001))),quotePrefix:g('quotePrefix'),nextQuote:Math.max(1,Math.round(n('nextQuote',1001))),terms:g('terms'),savedAt:Date.now()});
  if(bizDraftLogo==='del'){delete d.logo;delete d.logoW;delete d.logoH}else if(bizDraftLogo){d.logo=bizDraftLogo.src;d.logoW=bizDraftLogo.w;d.logoH=bizDraftLogo.h}
  if(d.vatReg==='yes'&&!d.vatNo){var m=$('#bzMsg');if(m)m.textContent='Add your VAT number, or set VAT registered to No.';return}
  BIZ=d;write('set-biz',function(){return setCol.doc('business').set(d)});closeOv('bzOv');toast('Business details saved');
  if($('#dcOv'))dcRender();if(view==='invoices')render();
}
document.addEventListener('change',function(e){
  var t=e.target;if(!t||t.id!=='bzLogo'||!t.files||!t.files[0])return;
  logoLoad(t.files[0],function(r){if(!r){toast('That file could not be read as a picture');return}bizDraftLogo=r;var b=$('#bzLogoBox');if(b)b.innerHTML='<img src="'+r.src+'" alt="Your logo">'});
});

/* --- tiny PDF writer: A4, Helvetica, JPEG logo --- */
var mCtx=null;
function tw(s,size,bold){if(!mCtx)mCtx=document.createElement('canvas').getContext('2d');mCtx.font=(bold?'bold ':'')+'100px Helvetica, Arial, "Liberation Sans", sans-serif';return mCtx.measureText(String(s)).width/100*size}
function pStr(s){var o='';s=String(s==null?'':s);for(var i=0;i<s.length;i++){var c=s.charCodeAt(i),t;
  if(c===0x2013||c===0x2014)t='-';else if(c===0x2018||c===0x2019)t="'";else if(c===0x201c||c===0x201d)t='"';else if(c===0x2026)t='...';else if(c===0x20ac)t='\\200';else if(c===0x2022)t='\\225';
  else if(c===0x28||c===0x29||c===0x5c)t='\\'+s.charAt(i);else if(c<32)t=' ';else if(c>126&&c<256)t='\\'+('00'+c.toString(8)).slice(-3);else if(c>255)t='?';else t=s.charAt(i);o+=t}return o}
function wrapT(s,max,size,bold){var out=[];String(s==null?'':s).split('\n').forEach(function(par){var words=par.split(/\s+/),line='';if(!par.trim()){out.push('');return}words.forEach(function(w){if(!w)return;var t=line?line+' '+w:w;if(tw(t,size,bold)<=max||!line)line=t;else{out.push(line);line=w}while(tw(line,size,bold)>max&&line.length>1){var k=line.length;while(k>1&&tw(line.slice(0,k),size,bold)>max)k--;out.push(line.slice(0,k));line=line.slice(k)}});if(line)out.push(line)});return out}
function Pdf(){this.pages=[];this.img=null;this.page()}
Pdf.prototype.page=function(){this.c=[];this.pages.push(this.c);this.y=40};
Pdf.prototype.col=function(rgb){return (rgb||[0.06,0.11,0.15]).map(function(v){return v.toFixed(3)}).join(' ')};
Pdf.prototype.t=function(x,top,s,size,bold,align,rgb){size=size||10;var w=tw(s,size,bold),xx=align==='r'?x-w:align==='c'?x-w/2:x;this.c.push('BT /'+(bold?'F2':'F1')+' '+size+' Tf '+this.col(rgb)+' rg 1 0 0 1 '+xx.toFixed(2)+' '+(842-top-size*0.8).toFixed(2)+' Tm ('+pStr(s)+') Tj ET')};
Pdf.prototype.rect=function(x,top,w,h,rgb){this.c.push(this.col(rgb)+' rg '+x+' '+(842-top-h).toFixed(2)+' '+w+' '+h.toFixed(2)+' re f')};
Pdf.prototype.line=function(x1,top,x2,rgb,lw){this.c.push(this.col(rgb||[0.8,0.83,0.85])+' RG '+(lw||0.6)+' w '+x1+' '+(842-top).toFixed(2)+' m '+x2+' '+(842-top).toFixed(2)+' l S')};
Pdf.prototype.image=function(src,iw,ih,x,top,w,h){this.img={bin:atob(src.split(',')[1]),w:iw,h:ih};this.c.push('q '+w.toFixed(2)+' 0 0 '+h.toFixed(2)+' '+x+' '+(842-top-h).toFixed(2)+' cm /Im1 Do Q')};
Pdf.prototype.need=function(h,foot){if(this.y+h>842-50){this.page();if(foot)foot(this)}};
Pdf.prototype.bytes=function(footer){
  var self=this,objs=[],add=function(s){objs.push(s);return objs.length};
  var n=this.pages.length;
  this.pages.forEach(function(c,i){if(footer){wrapT(footer,430,7.5).slice(0,2).forEach(function(fl,k,arr){c.push('BT /F1 7.5 Tf 0.4 0.45 0.5 rg 1 0 0 1 40 '+(24+(arr.length-1-k)*9)+' Tm ('+pStr(fl)+') Tj ET')});var pg='Page '+(i+1)+' of '+n;c.push('BT /F1 7.5 Tf 0.4 0.45 0.5 rg 1 0 0 1 '+(555-tw(pg,7.5)).toFixed(2)+' 24 Tm ('+pStr(pg)+') Tj ET')}});
  add('<< /Type /Catalog /Pages 2 0 R >>');add('PAGES');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  var imgRef='';if(this.img){var io=add('<< /Type /XObject /Subtype /Image /Width '+this.img.w+' /Height '+this.img.h+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+this.img.bin.length+' >>\nstream\n'+this.img.bin+'\nendstream');imgRef=' /XObject << /Im1 '+io+' 0 R >>'}
  var kids=[];this.pages.forEach(function(c){var body=c.join('\n');var cs=add('<< /Length '+body.length+' >>\nstream\n'+body+'\nendstream');kids.push(add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>'+imgRef+' >> /Contents '+cs+' 0 R >>'))});
  objs[1]='<< /Type /Pages /Kids ['+kids.map(function(k){return k+' 0 R'}).join(' ')+'] /Count '+kids.length+' >>';
  var out='%PDF-1.4\n%\xe2\xe3\xcf\xd3\n',offs=[];objs.forEach(function(o,i){offs.push(out.length);out+=(i+1)+' 0 obj\n'+o+'\nendobj\n'});
  var xr=out.length;out+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n'+offs.map(function(o){return ('000000000'+o).slice(-10)+' 00000 n \n'}).join('')+'trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+xr+'\n%%EOF';
  var u=new Uint8Array(out.length);for(var i=0;i<out.length;i++)u[i]=out.charCodeAt(i)&255;return u;
};
function fileOut(bytes,name,how){
  var blob=new Blob([bytes],{type:'application/pdf'});
  if(how==='share'){try{var f=new File([blob],name,{type:'application/pdf'});if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:name}).catch(function(){});return}}catch(e){}toast('Sharing files is not available on this device. Use Download PDF.');return}
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},4000);
  toast('PDF saved as '+name+'. (In the Claude demo, downloads are blocked. Use Preview.)');
}
function printHtml(html){var p=$('#printArea');if(!p){p=document.createElement('div');p.id='printArea';document.body.appendChild(p)}p.innerHTML=html;document.body.classList.add('printing');setTimeout(function(){try{window.print()}catch(e){}setTimeout(function(){document.body.classList.remove('printing')},500)},50)}
function bizLines(){return [BIZ.address].concat([BIZ.phone?'Phone: '+BIZ.phone:'',BIZ.email,BIZ.web,BIZ.reg,vatOn()&&BIZ.vatNo?'VAT number: '+BIZ.vatNo:'',BIZ.companyNo?'Company number: '+BIZ.companyNo:'']).filter(Boolean).join('\n')}
function bizFooter(){return [bizName(),BIZ.companyNo?'Registered in England and Wales, company number '+BIZ.companyNo:'',BIZ.companyNo&&(BIZ.regOffice||BIZ.address)?'Registered office: '+String(BIZ.regOffice||BIZ.address).replace(/\s*\n\s*/g,', '):''].filter(Boolean).join(' · ')}

/* --- quotes and invoices --- */
var dcCase=null,dcDoc=null;
function docsOf(c){return (c&&c.docs)||[]}
function dcTotals(d){var sub=0,vat=0;(d.lines||[]).forEach(function(l){var a=r2((+l.q||0)*(+l.p||0));sub+=a;if(vatOn())vat+=a*(+l.v||0)/100});sub=r2(sub);vat=r2(vat);return {sub:sub,vat:vat,total:r2(sub+vat)}}
function dcOver(d){return d.kind==='invoice'&&d.status!=='paid'&&d.status!=='cancelled'&&d.due&&diff(d.due)<0}
var DC_ST={quote:[['draft','Draft'],['sent','Sent'],['accepted','Accepted'],['declined','Declined']],invoice:[['draft','Draft'],['sent','Sent'],['paid','Paid'],['cancelled','Cancelled']]};
function dcStLabel(d){var o=(DC_ST[d.kind]||[]).filter(function(x){return x[0]===d.status})[0];return dcOver(d)?'Overdue':(o?o[1]:'Draft')}
function dcChip(d){var s=dcOver(d)?'bad':d.status==='paid'||d.status==='accepted'?'ok':d.status==='sent'?'warn':'';return '<span class="chip '+s+'">'+dcStLabel(d)+'</span>'}
function dcNewNumber(kind){return kind==='quote'?(BIZ.quotePrefix!=null?BIZ.quotePrefix:'Q-')+(BIZ.nextQuote||1001):(BIZ.invPrefix!=null?BIZ.invPrefix:'INV-')+(BIZ.nextInv||1001)}
function docsFs(c){
  var ds=docsOf(c).slice().sort(function(a,b){return (b.createdAt||0)-(a.createdAt||0)});
  return '<fieldset style="margin-top:14px"><legend>Quotes and invoices ('+ds.length+')</legend><div class="add" style="margin:0 0 8px"><button type="button" class="btn ghost sm" data-dcnew="quote">New quote</button><button type="button" class="btn ghost sm" data-dcnew="invoice">New invoice</button>'+(bizName()?'':'<button type="button" class="btn ghost sm" data-bizopen="1">Add your business details and logo first</button>')+'</div>'+
   (ds.length?ds.map(function(d){var t=dcTotals(d);return '<button type="button" class="clrec" data-dcopen="'+esc(c.id)+'|'+esc(d.id)+'"><b>'+(d.kind==='quote'?'Quote':'Invoice')+' '+esc(d.number||'')+'</b> '+dcChip(d)+'<span class="muted"> · '+fd(d.date)+'</span><span class="num" style="margin-left:auto">'+gbp(t.total)+'</span></button>'}).join(''):'<span class="muted">None yet.</span>')+'</fieldset>';
}
function dcOpen(caseId,docId,kind,from){
  var c=cases.filter(function(x){return x.id===caseId})[0];if(!c)return;dcCase=caseId;
  var d=docId?docsOf(c).filter(function(x){return x.id===docId})[0]:null;
  if(d)dcDoc=JSON.parse(JSON.stringify(d));
  else{
    var ap=(c.applicants||[]).filter(function(a){return a.name}),addr=(ap[0]&&ap[0].address)||'',job=fv(c,T.addr)||'',today=iso(TODAY);
    dcDoc={id:'d'+uid(),kind:kind,number:dcNewNumber(kind),date:today,due:kind==='quote'?addDays(today,BIZ.quoteValid!=null?BIZ.quoteValid:30):addDays(today,BIZ.payTerms!=null?BIZ.payTerms:14),status:'draft',toName:T.tenancyMode?tnCurrent(c).map(tnNames).filter(Boolean).join(' & '):(pnames(c)==='Unnamed client'?'':pnames(c)),toAddr:T.tenancyMode?paddr(c):addr,job:job&&job!==addr&&T.byKey[T.addr]&&T.byKey[T.addr].t==='text'?job:'',lines:[{d:c.type||'',q:1,p:'',v:vatOn()?(BIZ.vatRate!=null?BIZ.vatRate:20):0}],notes:'',isNew:true};
    if(from){dcDoc.lines=JSON.parse(JSON.stringify(from.lines||[]));dcDoc.fromQuote=from.number;dcDoc.notes=from.notes||'';dcDoc.toName=from.toName;dcDoc.toAddr=from.toAddr;dcDoc.job=from.job}
  }
  dcRender();
}
function dcLineRow(l,i){return '<tr data-dcl="'+i+'"><td><textarea data-dlf="d" rows="1" placeholder="Description of work or item">'+esc(l.d||'')+'</textarea></td><td><input data-dlf="q" type="number" step="any" value="'+esc(l.q)+'"></td><td><input data-dlf="p" type="number" step="any" placeholder="0.00" value="'+esc(l.p)+'"></td>'+(vatOn()?'<td><select data-dlf="v">'+[20,5,0].map(function(v){return '<option value="'+v+'"'+(+l.v===v?' selected':'')+'>'+v+'%</option>'}).join('')+'</select></td>':'')+'<td class="num" data-dla="'+i+'">'+gbp((+l.q||0)*(+l.p||0))+'</td><td><button type="button" class="x" data-dldel="'+i+'" aria-label="Remove line">×</button></td></tr>'}
function dcRender(){
  var d=dcDoc,isQ=d.kind==='quote',st=DC_ST[d.kind];
  overlay('dcOv','<div class="dhd"><h2>'+(isQ?'Quote':'Invoice')+' '+esc(d.number)+(d.isNew?' (new)':'')+'</h2><button type="button" class="btn ghost" data-dcclose="1">Close</button></div>'+
   (bizName()?'':'<p class="dnote">Your business name, address and logo are not set up yet. <button type="button" class="lnk" data-bizopen="1"><b>Add business details</b></button></p>')+
   '<div class="dcgrid"><div class="dcform"><div class="grid">'+
   '<label class="f">'+(isQ?'Quote':'Invoice')+' number<input id="dc-number" value="'+esc(d.number)+'"></label><label class="f">Status<select id="dc-status">'+st.map(function(o){return '<option value="'+o[0]+'"'+(d.status===o[0]?' selected':'')+'>'+o[1]+'</option>'}).join('')+'</select></label>'+
   '<label class="f">Date<input id="dc-date" type="date" value="'+esc(d.date)+'"></label><label class="f">'+(isQ?'Valid until':'Payment due')+'<input id="dc-due" type="date" value="'+esc(d.due)+'"></label>'+
   (!isQ?'<label class="f">Paid on<input id="dc-paid" type="date" value="'+esc(d.paidDate||'')+'"></label>':'')+
   '<label class="f wide">'+(isQ?'Quote for':'Bill to')+'<input id="dc-toName" value="'+esc(d.toName||'')+'"></label><label class="f wide">Their address<textarea id="dc-toAddr" rows="2">'+esc(d.toAddr||'')+'</textarea></label>'+
   '<label class="f wide">Job or property address (if different)<input id="dc-job" value="'+esc(d.job||'')+'"></label></div>'+
   '<table class="dclines"><thead><tr><th>Description</th><th>Qty</th><th>Price (£)</th>'+(vatOn()?'<th>VAT</th>':'')+'<th>Amount</th><th></th></tr></thead><tbody id="dcLines">'+(d.lines||[]).map(dcLineRow).join('')+'</tbody></table>'+
   '<button type="button" class="btn ghost sm" data-dladd="1">Add line</button><div id="dcTot" class="dctot"></div>'+
   '<label class="f">Notes for this '+(isQ?'quote':'invoice')+'<textarea id="dc-notes" rows="3" placeholder="'+(isQ?'What is included, what is not, start dates':'Anything the customer should know')+'">'+esc(d.notes||'')+'</textarea></label>'+
   (vatOn()?'':'<p class="muted" style="font-size:12px">Not VAT registered, so no VAT is shown. Change this in Business details.</p>')+
   '</div><div class="dcprev"><div class="muted" style="font-size:12px;margin-bottom:6px">Preview</div><div id="dcPrev"></div></div></div>'+
   '<div class="mkact dcact"><button type="button" class="btn" data-dcsave="1">Save</button><button type="button" class="btn ghost" data-dcpdf="dl">Download PDF</button><button type="button" class="btn ghost" data-dcpdf="share">Share</button><button type="button" class="btn ghost" data-dcprint="1">Print</button><button type="button" class="btn" data-dcsend="1">Send by WhatsApp or email</button>'+
   (isQ&&!d.isNew?'<button type="button" class="btn ghost" data-dcconv="1">Turn into invoice</button>':'')+(!d.isNew?'<button type="button" class="btn danger" data-dcdel="1" style="margin-left:auto">Delete</button>':'')+'</div>',true);
  dcPreview();
}
function dcRead(){
  var d=dcDoc,g=function(k){var e=$('#dc-'+k);return e?e.value:null};if(!$('#dcOv'))return d;
  ['number','status','date','due','toName','toAddr','job','notes'].forEach(function(k){var v=g(k);if(v!=null)d[k]=k==='notes'||k==='toAddr'?v:v.trim()});
  var pv=g('paid');if(pv!=null)d.paidDate=pv;
  d.lines=[];document.querySelectorAll('#dcLines tr').forEach(function(tr){var l={};tr.querySelectorAll('[data-dlf]').forEach(function(i){var k=i.getAttribute('data-dlf');l[k]=k==='d'?i.value:(i.value===''?'':+i.value)});if(l.v==null)l.v=0;d.lines.push(l)});
  return d;
}
function dcHtml(d){
  var isQ=d.kind==='quote',t=dcTotals(d),v=vatOn();
  return '<div class="dpage"><div class="dtop"><div>'+(okLogo(BIZ.logo)?'<img class="dlogo" src="'+BIZ.logo+'" alt="">':'')+'</div><div class="dtitle"><div class="dbig">'+(isQ?'QUOTE':(v?'VAT INVOICE':'INVOICE'))+'</div><table class="dmeta"><tr><td>Number</td><td>'+esc(d.number)+'</td></tr><tr><td>Date</td><td>'+fd(d.date)+'</td></tr><tr><td>'+(isQ?'Valid until':'Payment due')+'</td><td>'+fd(d.due)+'</td></tr>'+(d.fromQuote?'<tr><td>Quote</td><td>'+esc(d.fromQuote)+'</td></tr>':'')+'</table>'+(d.status==='paid'?'<div class="dpaid">PAID'+(d.paidDate?' '+fd(d.paidDate):'')+'</div>':'')+'</div></div>'+
   '<div class="dparties"><div><div class="dlab">From</div><b>'+esc(bizName()||'Your business name')+'</b><br>'+nl2br(bizLines())+'</div><div><div class="dlab">'+(isQ?'Quote for':'Bill to')+'</div><b>'+esc(d.toName||'')+'</b><br>'+nl2br(d.toAddr||'')+(d.job?'<div style="margin-top:6px"><span class="dlab">'+(T.id==='landlord'?'Property':'Job address')+'</span><br>'+esc(d.job)+'</div>':'')+'</div></div>'+
   '<table class="dtab"><thead><tr><th>Description</th><th>Qty</th><th>Price</th>'+(v?'<th>VAT</th>':'')+'<th>Amount</th></tr></thead><tbody>'+(d.lines||[]).filter(function(l){return l.d||l.p}).map(function(l){return '<tr><td>'+nl2br(l.d||'')+'</td><td>'+esc(l.q)+'</td><td>'+gbp(l.p)+'</td>'+(v?'<td>'+(+l.v||0)+'%</td>':'')+'<td>'+gbp((+l.q||0)*(+l.p||0))+'</td></tr>'}).join('')+'</tbody></table>'+
   '<table class="dsum">'+(v?'<tr><td>Subtotal</td><td>'+gbp(t.sub)+'</td></tr><tr><td>VAT</td><td>'+gbp(t.vat)+'</td></tr>':'')+'<tr class="dgt"><td>Total</td><td>'+gbp(t.total)+'</td></tr></table>'+
   (d.notes?'<div class="dsec"><div class="dlab">Notes</div>'+nl2br(d.notes)+'</div>':'')+
   (isQ?'<div class="dsec">This quote is valid until '+fd(d.due)+'.</div>':(BIZ.payDetails&&d.status!=='paid'?'<div class="dsec"><div class="dlab">How to pay</div>'+nl2br(BIZ.payDetails)+'<br>Please use reference <b>'+esc(d.number)+'</b>.</div>':''))+
   (BIZ.terms?'<div class="dsec muted">'+nl2br(BIZ.terms)+'</div>':'')+'<div class="dfoot">'+esc(bizFooter())+'</div></div>';
}
function dcPreview(){var d=dcRead(),t=dcTotals(d),v=vatOn(),b=$('#dcTot');if(b)b.innerHTML=(v?'<div>Subtotal <b>'+gbp(t.sub)+'</b></div><div>VAT <b>'+gbp(t.vat)+'</b></div>':'')+'<div class="big">Total <b>'+gbp(t.total)+'</b></div>';(d.lines||[]).forEach(function(l,i){var a=document.querySelector('[data-dla="'+i+'"]');if(a)a.textContent=gbp((+l.q||0)*(+l.p||0))});var p=$('#dcPrev');if(p)p.innerHTML=dcHtml(d)}
function dcPdf(d){
  var P=new Pdf(),isQ=d.kind==='quote',t=dcTotals(d),v=vatOn(),G=[0.35,0.41,0.47],A=[0.18,0.29,0.25];
  var lh=0;if(okLogo(BIZ.logo)&&BIZ.logoW){var s=Math.min(170/BIZ.logoW,70/BIZ.logoH);P.image(BIZ.logo,BIZ.logoW,BIZ.logoH,40,40,BIZ.logoW*s,BIZ.logoH*s);lh=BIZ.logoH*s}
  P.t(555,40,isQ?'QUOTE':(v?'VAT INVOICE':'INVOICE'),22,true,'r',A);
  var my=72;[['Number',d.number],['Date',fd(d.date)],[isQ?'Valid until':'Payment due',fd(d.due)]].concat(d.fromQuote?[['Quote',d.fromQuote]]:[]).forEach(function(r){P.t(470,my,r[0],9,false,'r',G);P.t(555,my,r[1],9,true,'r');my+=13});
  if(d.status==='paid'){P.t(555,my+4,'PAID'+(d.paidDate?' '+fd(d.paidDate):''),12,true,'r',[0.1,0.5,0.25]);my+=18}
  var top=Math.max(40+lh,my)+18,ly=top,ry=top;
  P.t(40,ly,'FROM',7.5,true,'l',G);ly+=11;P.t(40,ly,bizName()||'Your business name',11,true);ly+=15;wrapT(bizLines(),250,9).forEach(function(l){P.t(40,ly,l,9);ly+=12});
  P.t(320,ry,isQ?'QUOTE FOR':'BILL TO',7.5,true,'l',G);ry+=11;wrapT(d.toName||'',235,11,true).forEach(function(l){P.t(320,ry,l,11,true);ry+=14});ry+=1;wrapT(d.toAddr||'',235,9).forEach(function(l){P.t(320,ry,l,9);ry+=12});
  if(d.job){ry+=4;P.t(320,ry,T.id==='landlord'?'PROPERTY':'JOB ADDRESS',7.5,true,'l',G);ry+=11;wrapT(d.job,235,9).forEach(function(l){P.t(320,ry,l,9);ry+=12})}
  P.y=Math.max(ly,ry)+16;
  var cQ=v?360:400,cP=v?430:475,cV=485,dw=(v?300:340)-48;
  var head=function(p){p.rect(40,p.y,515,18,[0.93,0.95,0.94]);p.t(46,p.y+5,'Description',8.5,true);p.t(cQ,p.y+5,'Qty',8.5,true,'r');p.t(cP,p.y+5,'Price',8.5,true,'r');if(v)p.t(cV,p.y+5,'VAT',8.5,true,'r');p.t(549,p.y+5,'Amount',8.5,true,'r');p.y+=22};
  head(P);
  (d.lines||[]).filter(function(l){return l.d||l.p}).forEach(function(l){var ls=wrapT(l.d||'',dw,9.5),h=ls.length*12+6;P.need(h,head);ls.forEach(function(x,i){P.t(46,P.y+i*12,x,9.5)});P.t(cQ,P.y,String(l.q),9.5,false,'r');P.t(cP,P.y,gbp(l.p),9.5,false,'r');if(v)P.t(cV,P.y,(+l.v||0)+'%',9.5,false,'r');P.t(549,P.y,gbp((+l.q||0)*(+l.p||0)),9.5,false,'r');P.y+=h;P.line(40,P.y-3,555)});
  P.need(70);P.y+=6;
  if(v){P.t(470,P.y,'Subtotal',9.5,false,'r',G);P.t(549,P.y,gbp(t.sub),9.5,false,'r');P.y+=14;P.t(470,P.y,'VAT',9.5,false,'r',G);P.t(549,P.y,gbp(t.vat),9.5,false,'r');P.y+=16}
  P.rect(360,P.y-4,195,22,[0.93,0.95,0.94]);P.t(470,P.y+2,'Total',11,true,'r');P.t(549,P.y+2,gbp(t.total),11,true,'r');P.y+=34;
  var sec=function(title,text){if(!text)return;var ls=wrapT(text,515,9.5);P.need(14+ls.length*12);if(title){P.t(40,P.y,title.toUpperCase(),7.5,true,'l',G);P.y+=11}ls.forEach(function(x){P.need(12);P.t(40,P.y,x,9.5);P.y+=12});P.y+=8};
  sec('Notes',d.notes);
  if(isQ)sec('','This quote is valid until '+fd(d.due)+'.');else if(BIZ.payDetails&&d.status!=='paid')sec('How to pay',BIZ.payDetails+'\nPlease use reference '+d.number+'.');
  sec('',BIZ.terms);
  return P.bytes(bizFooter());
}
function dcSave(quiet){
  var d=dcRead(),c=cases.filter(function(x){return x.id===dcCase})[0];if(!c)return null;
  if(!(d.lines||[]).some(function(l){return l.d||l.p})){toast('Add at least one line');return null}
  var isNew=!!d.isNew;delete d.isNew;d.updatedAt=Date.now();if(isNew)d.createdAt=d.updatedAt;
  if(d.kind==='invoice'&&d.status==='paid'&&!d.paidDate)d.paidDate=iso(TODAY);
  var t=dcTotals(d);d.total=t.total;
  var list=docsOf(c).filter(function(x){return x.id!==d.id}).concat([d]),o={docs:list};
  if(d.kind==='invoice'&&T.byKey.invoiceNo){var inv=list.filter(function(x){return x.kind==='invoice'&&x.status!=='cancelled'}).sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:(b.createdAt||0)-(a.createdAt||0)})[0];if(inv&&inv.id===d.id){o.invoiceNo=d.number;o.invoiceAmount=t.total;o.invoiceDate=d.date;if(T.byKey.payDue)o.payDue=d.due;if(T.byKey.paidDate)o.paidDate=d.status==='paid'?(d.paidDate||iso(TODAY)):'';o.docSync=d.id}}
  if(d.kind==='quote'&&T.byKey.quote&&d.status!=='declined')o.quote=t.total;
  patch(c.id,o);
  if(openId===c.id&&$('#caseForm')){Object.keys(o).forEach(function(k){var e=$('#f-'+k);if(e){e.value=o[k];if(e.hasAttribute('data-from'))e.setAttribute('data-auto','0')}});lastAuto=JSON.stringify(collectForm());updStrip()}
  if(isNew){var nb=Object.assign({},BIZ);if(d.kind==='quote'&&d.number===dcNewNumber('quote'))nb.nextQuote=(BIZ.nextQuote||1001)+1;if(d.kind==='invoice'&&d.number===dcNewNumber('invoice'))nb.nextInv=(BIZ.nextInv||1001)+1;if(nb.nextQuote!==BIZ.nextQuote||nb.nextInv!==BIZ.nextInv){BIZ=nb;write('set-biz',function(){return setCol.doc('business').set(nb)})}}
  dcDoc=JSON.parse(JSON.stringify(d));
  if(!quiet){toast((d.kind==='quote'?'Quote ':'Invoice ')+d.number+' saved');dcRender()}
  setTimeout(function(){if(openId)renderLive();if(view==='invoices')render()},60);
  return d;
}
function docReminders(c){
  var out=[];docsOf(c).forEach(function(d){if(d.kind!=='invoice'||d.status==='paid'||d.status==='cancelled'||!d.due||d.status==='draft')return;if(T.byKey.payDue&&c.docSync===d.id)return;var k='doc:'+d.id;if(c.remDone&&c.remDone[k]===d.due)return;out.push({date:d.due,label:'Invoice '+d.number+' payment due ('+gbp(d.total||dcTotals(d).total)+')',key:k,sec:false})});return out;
}
/* list page */
var ivFilter='all';
function invoicesHTML(){
  var all=[];cases.forEach(function(c){docsOf(c).forEach(function(d){all.push({c:c,d:d})})});
  var unpaid=all.filter(function(x){return x.d.kind==='invoice'&&x.d.status!=='paid'&&x.d.status!=='cancelled'&&x.d.status!=='draft'}),over=unpaid.filter(function(x){return dcOver(x.d)}),sum=function(l){return l.reduce(function(a,x){return a+(x.d.total||dcTotals(x.d).total)},0)};
  var paidY=all.filter(function(x){return x.d.kind==='invoice'&&x.d.status==='paid'&&(x.d.paidDate||'').slice(0,4)===String(TODAY.getFullYear())});
  var f={all:function(){return true},quotes:function(x){return x.d.kind==='quote'},open:function(x){return x.d.kind==='quote'&&(x.d.status==='sent'||x.d.status==='draft')},unpaid:function(x){return unpaid.indexOf(x)>-1},over:function(x){return dcOver(x.d)},paid:function(x){return x.d.status==='paid'},draft:function(x){return x.d.status==='draft'}};
  var l=all.filter(f[ivFilter]||f.all).sort(function(a,b){return a.d.date<b.d.date?1:a.d.date>b.d.date?-1:(b.d.createdAt||0)-(a.d.createdAt||0)});
  var chips=[['all','All'],['quotes','Quotes'],['open','Open quotes'],['unpaid','Unpaid invoices'],['over','Overdue'],['paid','Paid'],['draft','Drafts']];
  return '<div class="pagehead"><h1>Quotes &amp; invoices</h1><button type="button" class="btn ghost" data-bizopen="1">Business details and logo</button></div>'+
   '<div class="stats" style="margin:6px 0 12px"><div class="stat"><b>'+gbp(sum(unpaid))+'</b><span>Unpaid ('+unpaid.length+')</span></div><div class="stat"><b style="color:var(--bad,#b3261e)">'+gbp(sum(over))+'</b><span>Overdue ('+over.length+')</span></div><div class="stat"><b>'+gbp(sum(paidY))+'</b><span>Paid in '+TODAY.getFullYear()+'</span></div></div>'+
   '<div class="chips" style="margin:0 0 10px">'+chips.map(function(c){return '<button type="button" data-ivf="'+c[0]+'" aria-pressed="'+(ivFilter===c[0])+'">'+c[1]+'</button>'}).join('')+'</div>'+
   (all.length?'':'<div class="empty"><h2>No quotes or invoices yet</h2>Open a '+esc(N1())+' and use New quote or New invoice. Add your business details and logo first so they appear on every document.<br><button class="btn" data-bizopen="1">Add business details</button></div>')+
   (l.length?'<div class="tw"><table><thead><tr><th>Number</th><th>Type</th><th>'+esc(CL().replace(/s$/,''))+'</th><th>Date</th><th>Due / valid until</th><th>Total</th><th>Status</th></tr></thead><tbody>'+l.map(function(x){return '<tr class="click" data-dcopen="'+esc(x.c.id)+'|'+esc(x.d.id)+'"><td><b>'+esc(x.d.number)+'</b></td><td>'+(x.d.kind==='quote'?'Quote':'Invoice')+'</td><td>'+esc(x.d.toName||names(x.c))+cno(x.c)+'</td><td>'+fd(x.d.date)+'</td><td>'+fd(x.d.due)+'</td><td class="num">'+gbp(x.d.total||dcTotals(x.d).total)+'</td><td>'+dcChip(x.d)+'</td></tr>'}).join('')+'</tbody></table></div>':(all.length?'<div class="muted">Nothing here.</div>':''));
}

/* --- tenancy agreement (landlords, England) --- */
var taCase=null,taTn=null;
var TA_BILLS=[['councilTax','Council tax'],['gas','Gas'],['electricity','Electricity'],['water','Water and sewerage'],['broadband','Broadband and phone'],['tv','TV licence']];
function tenancyFs(c){
  var td=c.tenancyDoc;
  return '<fieldset style="margin-top:14px"><legend>Tenancy agreement</legend><p class="muted" style="font-size:12px;margin:0 0 8px">Creates an assured periodic tenancy agreement that includes the written statement of terms landlords in England must give new tenants from 1 May 2026.</p><div class="add" style="margin:0"><button type="button" class="btn ghost sm" data-taopen="'+esc(c.id)+'">'+(td?'Open tenancy agreement':'Create tenancy agreement')+'</button>'+(td&&td.savedAt?'<span class="muted" style="align-self:center;font-size:12px">Last saved '+shortStamp(td.savedAt)+'</span>':'')+'</div></fieldset>';
}
/* ---------- company let agreement (corporate tenant): a common-law tenancy, outside the Housing Act 1988 ---------- */
var CL_TERMS=[
 ['Break clause (either side)','Either the landlord or the tenant may end this tenancy early by giving the other at least 2 months’ notice in writing. The notice must not end before the last day of the first 6 months of the term. A notice from the tenant only takes effect if the rent has been paid up to the day the notice ends. Ending the tenancy in this way does not affect any claim either side has for an earlier breach of this agreement.'],
 ['Break clause (tenant only)','The tenant may end this tenancy early by giving the landlord at least 2 months’ notice in writing. The notice must not end before the last day of the first 6 months of the term, and only takes effect if the rent has been paid up to the day the notice ends.'],
 ['Rent review (fixed yearly increase)','On each anniversary of the start date the rent will increase by 3%. The landlord will confirm the new rent to the tenant in writing at least 1 month before each anniversary.'],
 ['Rent review (linked to inflation)','On each anniversary of the start date the rent will increase by the same percentage as the rise in the Consumer Prices Index over the 12 months for which figures were last published before that anniversary. The rent will not go down. The landlord will tell the tenant the new rent in writing, with the calculation, at least 1 month before each anniversary.'],
 ['Interest on late payment','If any rent or other sum due under this agreement is more than 14 days late, the tenant will pay interest on it at 4% a year above the Bank of England base rate, from the date it was due until the date it is paid.'],
 ['Inventory and check-out','The landlord will give the tenant an inventory and schedule of condition at the start of the tenancy. The tenant has 7 days from receiving it to tell the landlord in writing about anything it disagrees with. After that it is treated as correct. A check-out inspection will be carried out when the tenancy ends, and the tenant may attend.'],
 ['Furnished property','The property is let furnished. The tenant will keep the items listed in the inventory at the property and in the same condition as at the start (fair wear and tear excepted), and will pay the reasonable cost of repairing or replacing any item that is damaged or missing at the end.'],
 ['Professional cleaning at the end','At the end of the tenancy the tenant will have the property, including the carpets, curtains, windows and oven, professionally cleaned to the standard recorded in the inventory at the start, or will pay the landlord’s reasonable cost of having this done.'],
 ['Changing the occupiers','The tenant may change the occupiers by giving the landlord at least 7 days’ notice in writing with the full name of each new adult occupier and the information needed for any right to rent check. The tenant may not change the occupiers more than once in any 3 months without the landlord’s written consent.'],
 ['No short lets or serviced accommodation','The tenant must not use or advertise the property for holiday lets, short stays or serviced accommodation (for example through Airbnb, Booking.com or similar websites), and must not allow anyone other than the occupiers to stay for payment.'],
 ['Pets','No animal may be kept at the property without the landlord’s written consent. If consent is given, the tenant will pay for any damage the animal causes and for any extra cleaning needed at the end of the tenancy.'],
 ['No smoking','No one may smoke or vape inside the property or in any shared indoor areas of the building.'],
 ['Garden','The tenant will keep the garden tidy and free of rubbish, cut the grass regularly in the growing season, and will not remove or cut down any trees or shrubs without the landlord’s written consent.'],
 ['Parking','The tenant and the occupiers may park one private car or motorcycle in the parking space that belongs to the property. No commercial vehicle, caravan, boat or trailer may be kept there, and no vehicle may be repaired there.'],
 ['Tenant’s insurance','The tenant will keep in place insurance for its own and the occupiers’ belongings at the property, and for its liability to other people for injury or damage at the property, and will show the landlord evidence of this if asked.'],
 ['Keys and security','The landlord will give the tenant 2 sets of keys. The tenant will not change or add locks without written consent, will return every key at the end, and will pay the reasonable cost of replacing lost keys and, where security is affected, the locks. The tenant will make sure the property is locked whenever it is empty, and will tell the landlord if it will be empty for more than 28 days.'],
 ['Building rules and head lease','The property is part of a larger building. The tenant and the occupiers will keep to the rules of the building and to the terms of the landlord’s own lease that affect how the property is used, copies of which the landlord has given to the tenant.'],
 ['Renewal','If the tenant asks in writing at least 2 months before the end of the term, and has paid the rent and kept to this agreement, the landlord will consider granting a new tenancy on terms to be agreed. Neither side is obliged to agree a new tenancy.'],
 ['My own term','']];
var CL_PER={'Monthly':'month','Weekly':'week','Every 4 weeks':'4 weeks','Quarterly':'quarter'};
function clEnd(start,months){if(!/^\d{4}-\d{2}-\d{2}$/.test(start||'')||!(+months>0))return '';var d=pd(start);d.setMonth(d.getMonth()+Math.round(+months));d.setDate(d.getDate()-1);return iso(d)}
function clDefaults(c,tn){
  var b=taDefaults(c,tn),dirs=((tn&&tn.directors)||[]).filter(Boolean),ll=BIZ.companyNo?((BIZ.name||b.landlords)+' (company number '+BIZ.companyNo+')'):b.landlords;
  return {kind:'company',landlords:ll,noticeAddr:BIZ.regOffice||b.noticeAddr,llPhone:b.llPhone,llEmail:b.llEmail,agent:b.agent,
    coName:(tn&&tn.company)||'',coNo:(tn&&tn.companyNo)||'',coAddr:'',coSign:dirs.length?dirs[0]+', Director':'',guarantor:'',
    property:b.property,included:'',occupiers:'',maxOcc:'',start:b.start,termType:'fixed',termMonths:'12',notice:'2',
    rent:b.rent,freq:b.freq,rentDay:b.rentDay,rentHow:'',bills:'tenant',billsNote:'',deposit:b.deposit,depHold:'landlord',scheme:b.scheme,
    gas:b.gas,epc:b.epc,gsr:b.gsr,eicr:b.eicr,terms:[]};
}
function clTermRow(t){return '<div class="clterm" style="border:1px solid #D4DBDF;border-radius:8px;padding:8px 10px;margin:0 0 8px"><div style="display:flex;gap:8px;align-items:center;margin:0 0 6px"><input data-clt="t" maxlength="80" aria-label="Title of this term" value="'+esc(t.t||'')+'" placeholder="Title" style="flex:1;font-weight:600"><button type="button" class="btn ghost sm" data-clrm="1">Remove</button></div><textarea data-clt="x" rows="4" aria-label="Wording of this term" placeholder="Type the wording of this term" style="width:100%;box-sizing:border-box">'+esc(t.x||'')+'</textarea></div>'}
function clLetRender(d){
  var i=function(k,l,ph,type){return '<label class="f">'+l+'<input id="ta-'+k+'" type="'+(type||'text')+'" value="'+esc(d[k]==null?'':d[k])+'" placeholder="'+esc(ph||'')+'"></label>'};
  var a=function(k,l,ph,rows){return '<label class="f wide">'+l+'<textarea id="ta-'+k+'" rows="'+(rows||2)+'" placeholder="'+esc(ph||'')+'">'+esc(d[k]||'')+'</textarea></label>'};
  var s=function(k,l,opts){return '<label class="f">'+l+'<select id="ta-'+k+'">'+opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(d[k])===o[0]?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select></label>'};
  overlay('taOv','<div class="dhd"><h2>Company let agreement</h2><button type="button" class="btn ghost" data-taclose="1">Close</button></div>'+
   '<p class="dnote">This is a template to help you, not legal advice. It is for letting a home in England to a company for up to 3 years. A letting to a company is not an assured tenancy, so the Renters’ Rights Act rules do not apply to it. Do not use it where the person who will live there is really the one renting: a court can treat that as an ordinary tenancy. Have a solicitor check it before you rely on it, above all the guarantee and any term you change.</p>'+
   '<input type="hidden" id="ta-kind" value="company">'+
   '<div class="dcgrid"><div class="dcform">'+
   '<h3 class="tah">1. Landlord</h3><div class="grid">'+a('landlords','Landlord name(s), one per line. For a company, add its company number')+a('noticeAddr','Address in England or Wales where the tenant can serve notices on you')+i('llPhone','Landlord phone (optional)')+i('llEmail','Landlord email (optional)','','email')+i('agent','Letting agent (if any)')+'</div>'+
   '<h3 class="tah">2. Tenant company</h3><div class="grid">'+i('coName','Company name')+i('coNo','Company registration number')+a('coAddr','Registered office address')+i('coSign','Who signs for the company (name and position)','For example: MR A SMITH, Director')+a('guarantor','Guarantor name(s) and address, one per line (optional, for example a director giving a personal guarantee)')+'</div>'+
   '<h3 class="tah">3. Property and who lives there</h3><div class="grid">'+a('property','Property address')+a('included','What is included (furniture, parking, garden, shared areas)','For example: furnished as per the inventory; parking space 3')+a('occupiers','Permitted occupiers, one per line','Full names of the employees or officers who will live there')+i('maxOcc','Most people allowed to live there','','number')+'</div>'+
   '<h3 class="tah">4. Term</h3><div class="grid">'+i('start','Start date','','date')+s('termType','Type of term',[['fixed','Fixed term'],['periodic','No fixed term (runs until notice is given)']])+i('termMonths','Fixed term (months, 1 to 36)','','number')+s('notice','Notice to end a tenancy that has no fixed term, or that carries on after it',[['1','1 month'],['2','2 months'],['3','3 months']])+'</div><div id="clWarn"></div>'+
   '<h3 class="tah">5. Rent and bills</h3><div class="grid">'+i('rent','Rent (£)','','number')+s('freq','Rent period',[['Monthly','Monthly'],['Weekly','Weekly'],['Every 4 weeks','Every 4 weeks'],['Quarterly','Quarterly']])+i('rentDay','Rent due on (day of the month, or the day of the week)','1')+a('rentHow','How the tenant pays rent','For example: bank transfer to the account the landlord gives in writing')+s('bills','Council tax and utility bills',[['tenant','The tenant pays them'],['included','Included in the rent']])+a('billsNote','Anything else about bills (optional)')+'</div>'+
   '<h3 class="tah">6. Deposit</h3><div class="grid">'+i('deposit','Deposit (£). Leave blank if none','','number')+s('depHold','How the deposit is held',[['landlord','Held by the landlord'],['scheme','Protected in a deposit scheme (your choice, not required)']])+s('scheme','Deposit scheme, if you use one',[['','None'],['DPS','Deposit Protection Service (DPS)'],['mydeposits','mydeposits'],['TDS','Tenancy Deposit Scheme (TDS)']])+'</div>'+
   '<h3 class="tah">7. Safety documents</h3><div class="grid">'+s('gas','Is there a gas supply or gas appliance?',[['yes','Yes'],['','No']])+i('epc','EPC rating and date given')+i('gsr','Gas safety record date given')+i('eicr','Electrical report (EICR) date given')+'</div>'+
   '<h3 class="tah">8. Extra terms</h3><p class="muted" style="font-size:12px;margin:0 0 6px">Choose a ready-made term and press Add. You can then change its title and wording. Each one is added to the agreement as its own numbered term.</p>'+
   '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px"><select id="clPick" aria-label="Ready-made terms" style="flex:1;min-width:200px">'+CL_TERMS.map(function(t,n){return '<option value="'+n+'">'+esc(t[0])+'</option>'}).join('')+'</select><button type="button" class="btn" data-cladd="1">Add term</button></div>'+
   '<div id="clTerms">'+(d.terms||[]).map(clTermRow).join('')+'</div>'+
   '</div><div class="dcprev"><div class="muted" style="font-size:12px;margin-bottom:6px">Preview</div><div id="taPrev"></div></div></div>'+
   '<div class="mkact dcact"><button type="button" class="btn" data-tasave="1">Save details</button><button type="button" class="btn ghost" data-tapdf="dl">Download PDF</button><button type="button" class="btn ghost" data-tapdf="share">Share</button><button type="button" class="btn ghost" data-taprint="1">Print</button></div>',true);
  taPreview();
}
function clBlocks(d){
  var L=lines(d.landlords),Gs=lines(d.guarantor),Oc=lines(d.occupiers),B=[],n=0,m=0,one=function(x){return String(x||'').replace(/\s*\n\s*/g,', ')};
  var h=function(t){n++;m=0;B.push({h:n+'. '+t})},c=function(t){m++;B.push({p:n+'.'+m+'  '+t})},kv=function(r){B.push({kv:r.filter(function(x){return x[1]})})};
  var co=String(d.coName||'').trim()||'The tenant company',per=CL_PER[d.freq]||'month',fixed=d.termType!=='periodic',mo=Math.round(+d.termMonths)||0,end=fixed?clEnd(d.start,mo):'',nt=(+d.notice||2),ntx=nt+' month'+(nt>1?'s':'')+'’';
  B.push({title:'Company Let Tenancy Agreement'});B.push({sub:'A tenancy of a home let to a company. Because the tenant is a company and not an individual, this is not an assured tenancy under the Housing Act 1988. For a property in England.'});
  h('The landlord, the tenant and the guarantor');
  kv([['Landlord'+(L.length>1?'s':''),L.join(', ')],['Address for serving notices on the landlord',one(d.noticeAddr)],['Landlord phone',d.llPhone],['Landlord email',d.llEmail],['Letting agent',d.agent],['Tenant',co],['Company registration number',d.coNo],['Registered office',one(d.coAddr)],['Signing for the tenant',d.coSign],['Guarantor'+(Gs.length>1?'s':''),Gs.join('; ')]]);
  c('In this agreement “the landlord” includes whoever owns the landlord’s interest in the property in future, and “the tenant” means the company named above.');
  if(L.length>1)c('Where there is more than one landlord, they act together, and a notice given to any one of them is given to all.');
  h('The property');kv([['Property address',one(d.property)],['Included',d.included]]);
  c('The landlord lets the property to the tenant for the term and at the rent set out in this agreement.');
  h('Who may live at the property');
  kv([['Permitted occupiers',Oc.join(', ')||'The employees or officers of the tenant whose names the tenant gives the landlord in writing'],['Most people allowed to live there',d.maxOcc]]);
  c('The property is let only as a private home for the permitted occupiers, who are employees, officers or guests of the tenant. The tenant will not use it, or let it be used, for any other purpose.');
  c('The permitted occupiers live at the property with the tenant’s permission only. They are not tenants, they do not pay rent to the landlord, and they have no right to stay once this tenancy has ended.');
  c('Before any adult moves in, the tenant will give the landlord that person’s full name in writing and whatever the landlord needs to carry out any right to rent check the law requires.');
  c('The tenant is responsible for everything the occupiers and their visitors do or fail to do at the property, as if the tenant had done it itself.');
  c('The tenant will not sublet the property or any part of it, transfer this tenancy, take in lodgers or paying guests, or charge an occupier rent in a way that would create a tenancy, without the landlord’s written consent.');
  h('The term');
  if(fixed){
    c('The tenancy starts on '+(d.start?fd(d.start):'____________')+' and runs for a fixed term of '+(mo||'____')+' month'+(mo===1?'':'s')+', ending on '+(end?fd(end):'____________')+'.');
    c('If the tenant stays at the property after the fixed term with the landlord’s agreement, and no new agreement has been signed, the tenancy carries on from '+per+' to '+per+' on the same terms. Either side may then end it by giving the other at least '+ntx+' notice in writing, ending on the last day of a rent period.');
  }else{
    c('The tenancy starts on '+(d.start?fd(d.start):'____________')+' and runs from '+per+' to '+per+' until it is ended by notice.');
    c('Either side may end the tenancy by giving the other at least '+ntx+' notice in writing, ending on the last day of a rent period.');
  }
  h('Rent');
  kv([['Rent',(+d.rent?gbp(+d.rent):'£________')+' a '+per],['Due',d.rentDay?(/^\d+$/.test(String(d.rentDay).trim())?'On day '+String(d.rentDay).trim()+' of each '+per:'Each '+String(d.rentDay).trim()):'In advance on the first day of each '+per],['How to pay',d.rentHow||'By bank transfer to the account the landlord gives the tenant in writing']]);
  c('The tenant will pay the rent in advance on the due date, in full and without any deduction or set-off, whether or not the landlord has asked for it. The first payment is due on the start date.');
  c(fixed?'The rent stays the same during the fixed term unless an extra term of this agreement says otherwise. If the tenancy carries on after the fixed term, the landlord may change the rent by giving the tenant at least 2 months’ notice in writing, not more than once in any 12 months.':'The landlord may change the rent by giving the tenant at least 2 months’ notice in writing, not more than once in any 12 months. If the tenant does not accept the new rent it may end the tenancy by notice.');
  h('Bills');
  if(d.bills==='included')c('The rent includes council tax and the charges for gas, electricity, water and sewerage used at the property in a normal way for a home. The tenant pays for telephone, broadband and the TV licence unless the landlord has agreed otherwise in writing.');
  else c('From the start date until the tenancy ends, the tenant will pay the council tax and all charges for gas, electricity, water and sewerage, telephone, broadband and the TV licence for the property, directly to the council or supplier, and will put the accounts in its own name or the name of an occupier.');
  if(String(d.billsNote||'').trim())c(String(d.billsNote).trim());
  h('Deposit');
  if(+d.deposit>0){
    kv([['Deposit',gbp(+d.deposit)],['Held by',d.depHold==='scheme'?'The landlord, protected with '+(d.scheme||'a government-approved deposit scheme'):'The landlord']]);
    c('The tenant will pay the deposit on or before the start date. The landlord holds it as security for the rent and for the tenant keeping to this agreement. No interest is paid on it.');
    c(d.depHold==='scheme'?'The law does not require this deposit to be protected in a government-approved scheme, because this is not an assured tenancy. The landlord has chosen to protect it in the scheme named above, and the rules of that scheme will apply to it.':'The law does not require this deposit to be protected in a government-approved scheme, because this is not an assured tenancy. The landlord will keep it safe and account for it to the tenant.');
    c('Within 28 days after the tenancy ends and the property and all keys have been given back, the landlord will return the deposit to the tenant, less any unpaid rent or bills, the reasonable cost of repairing damage beyond fair wear and tear, of cleaning the property to its standard at the start, of replacing missing items, and any other sum the tenant owes under this agreement. The landlord will give the tenant a written list of anything deducted.');
    c('The tenant may not treat the deposit as payment of rent. If the landlord properly takes money from the deposit during the tenancy, the tenant will top it up within 14 days of being asked.');
  }else c('No deposit is taken for this tenancy.');
  h('What the tenant agrees to do');
  ['Pay the rent, and the bills it is responsible for, on time.',
   'Keep the inside of the property, and the landlord’s fixtures, fittings and contents, clean and in the condition they were in at the start, apart from fair wear and tear and damage the landlord must repair.',
   'Tell the landlord promptly in writing about any damage, disrepair, leak, damp, pest or safety problem at the property.',
   'Not make any alteration or addition to the property, redecorate it, or change the locks, without the landlord’s written consent.',
   'Not use the property, or allow it to be used, for any business (other than ordinary home working by an occupier), for anything illegal, or in a way that causes a nuisance or annoyance to neighbours.',
   'Not do anything that makes the landlord’s insurance invalid or more expensive, once the landlord has told the tenant what the policy requires.',
   'Test the smoke and carbon monoxide alarms regularly, replace their batteries when needed, and tell the landlord at once if an alarm does not work.',
   'Let the landlord, and anyone acting for the landlord, into the property at reasonable times of day to inspect it, carry out repairs or safety checks, or (in the last 2 months of the tenancy) show it to new tenants or buyers. The landlord will give at least 24 hours’ notice in writing, except in an emergency.',
   'When the tenancy ends, make sure every occupier has left, and give the property back empty of people and belongings, clean, and with all keys.',
   'Pay the reasonable costs the landlord properly incurs because the tenant has broken this agreement, including the cost of recovering rent and of any notice or court proceedings.'].forEach(c);
  h('What the landlord agrees to do');
  ['Let the tenant and the permitted occupiers have the property without interruption from the landlord, as long as the tenant pays the rent and keeps to this agreement.',
   'Keep in repair the structure and outside of the property, and keep in repair and working order the installations for water, gas, electricity, sanitation, room heating and hot water, as section 11 of the Landlord and Tenant Act 1985 requires. The landlord need not repair damage caused by the tenant or the occupiers, other than through fair wear and tear.',
   'Keep the property fit for people to live in during the tenancy, so far as section 9A of the Landlord and Tenant Act 1985 applies.',
   'Carry out the gas safety checks, electrical safety inspections and smoke and carbon monoxide alarm duties that the law puts on a landlord of a home, and give the tenant copies of the records.',
   'Insure the building (unless a superior landlord does so). The landlord does not insure the belongings of the tenant or the occupiers.'].forEach(c);
  h('Ending the tenancy');
  c('The landlord may end this tenancy early, by going back into the property under a court order (forfeiture), if any of these happens: (a) any rent is unpaid 14 days after it was due, whether or not it has been formally demanded; (b) the tenant has seriously or repeatedly broken this agreement; (c) the tenant goes into liquidation or administration, has a receiver appointed, makes an arrangement with its creditors, is struck off the register of companies or stops carrying on business. This does not affect any other claim the landlord has against the tenant.');
  c('While anyone is living at the property the landlord will not take the property back without a court order. A notice to quit given by the landlord will be in writing, will give at least 4 weeks, and will contain the information the law requires.');
  c('If the tenant or any occupier stays at the property after the tenancy has ended, the tenant will pay the landlord a sum equal to the rent for each day until the property is given back, as well as any loss this causes the landlord.');
  c('Anything left at the property when the tenancy ends may be removed by the landlord. The landlord will tell the tenant in writing and keep the items for 14 days, after which it may dispose of them, and the tenant will pay the reasonable cost of removal and storage.');
  if(Gs.length){
    h('Guarantee');
    c('In return for the landlord granting this tenancy, the guarantor guarantees that the tenant will pay the rent and keep to this agreement. If the tenant does not pay any rent or other sum when it is due, the guarantor will pay it to the landlord on written demand, and will make good any loss the landlord suffers because the tenant has broken this agreement.');
    c('The guarantee lasts for the whole of the tenancy, including any time it carries on after the fixed term and any time the tenant or an occupier stays after it ends. The guarantor is not released because the landlord gives the tenant extra time, does not enforce a term straight away, or agrees a change to this agreement that does not make the guarantor’s position materially worse.');
    c('If the tenant is wound up or dissolved, or a liquidator disclaims this agreement, the guarantor remains liable for all sums due up to the date the landlord gets the property back.');
    if(Gs.length>1)c('Where there is more than one guarantor, each is liable for the whole amount, individually and together.');
    c('The guarantor has been advised to take independent legal advice before signing.');
  }
  var X=(d.terms||[]).filter(function(t){return String(t.x||'').trim()});
  if(X.length){h('Extra terms');X.forEach(function(t){c((String(t.t||'').trim()?String(t.t).trim()+'. ':'')+String(t.x).trim().replace(/\s*\n\s*/g,' '))});c('If an extra term conflicts with another part of this agreement, the extra term applies.')}
  h('Notices and general terms');
  c('Notices under this agreement must be in writing. The tenant may serve notices (including notices in proceedings) on the landlord at the address given in section 1. The landlord may serve notices on the tenant at its registered office or at the property. Notices may also be sent by email where both sides have agreed to this in writing.');
  c('This agreement is the whole agreement between the landlord and the tenant about the property. It can only be changed in writing signed by both of them.');
  c('Only the landlord, the tenant and any guarantor may enforce this agreement. The occupiers and other third parties have no right to enforce it under the Contracts (Rights of Third Parties) Act 1999.');
  c('The tenant is responsible for any stamp duty land tax due on this tenancy.');
  c('This agreement is governed by the law of England and Wales, and the courts of England and Wales will deal with any dispute about it.');
  B.push({h:'Documents given to the tenant'});
  kv([['Energy Performance Certificate',d.epc||'To be given'],['Gas safety record',d.gas?(d.gsr?'Dated '+d.gsr:'To be given'):'Not applicable'],['Electrical installation condition report',d.eicr?'Dated '+d.eicr:'To be given']]);
  B.push({sig:{landlords:L.length?L:['Landlord'],tenants:[co+(String(d.coSign||'').trim()?' (by '+String(d.coSign).trim()+')':' (by a director or authorised signatory)')],guarantors:Gs.map(function(g){return g.split(',')[0]})}});
  return B;
}
function taDefaults(c,tn){
  var p=profA(),ap=tn?(tn.people||[]).filter(function(a){return a.name}):(c.applicants||[]).filter(function(a){return a.name}),G=function(k){return tn&&tfv(tn,k)!==''?tfv(tn,k):fv(c,k)};
  return {landlords:BIZ.owner||p.name||bizName(),noticeAddr:BIZ.address||'',llPhone:BIZ.phone||'',llEmail:BIZ.email||'',agent:fv(c,'agent')||'',tenants:(tn&&tnCorp(tn)&&String(tn.company||'').trim())?String(tn.company).trim()+(tn.companyNo?' (company number '+tn.companyNo+')':''):ap.map(function(a){return a.name}).join('\n'),
    property:paddr(c)||'',included:'',start:G('tenancyStart')||'',rent:G('rent')||'',freq:G('rentFreq')||'Monthly',rentDay:G('rentDay')||'',rentHow:'',
    billsIn:{},billsOut:{councilTax:1,gas:1,electricity:1,water:1,broadband:1,tv:1},billsNote:'The tenant arranges and pays these bills directly to the supplier when they are due.',
    deposit:G('deposit')||'',scheme:G('depositScheme')||'',tenantNotice:'2 months',grounds:{},otherGrounds:'',gas:fv(c,'gsrDate')?'yes':'',improve:'yes',supported:'',supportedWhy:'',extra:'',
    epc:[fv(c,'epcRating'),fv(c,'epcDate')?fd(fv(c,'epcDate')):''].filter(Boolean).join(', issued '),gsr:fv(c,'gsrDate')?fd(fv(c,'gsrDate')):'',eicr:fv(c,'eicrDate')?fd(fv(c,'eicrDate')):''};
}
function taOpen(caseId,tnId){var c=cases.filter(function(x){return x.id===caseId})[0];if(!c)return;taCase=caseId;taTn=tnId||null;var tn=tnId?tnList(c).filter(function(x){return x.id===tnId})[0]:null;if(tn&&tnCorp(tn)){var ag=tn.agreement&&tn.agreement.kind==='company'?tn.agreement:{};clLetRender(Object.assign(clDefaults(c,tn),ag));return}var d=Object.assign(taDefaults(c,tn),tn?((tn.agreement&&tn.agreement.kind!=='company'&&tn.agreement)||{}):(c.tenancyDoc||{}));taRender(d)}
function taRender(d){
  var i=function(k,l,ph,type){return '<label class="f">'+l+'<input id="ta-'+k+'" type="'+(type||'text')+'" value="'+esc(d[k]==null?'':d[k])+'" placeholder="'+esc(ph||'')+'"></label>'};
  var a=function(k,l,ph,rows){return '<label class="f wide">'+l+'<textarea id="ta-'+k+'" rows="'+(rows||2)+'" placeholder="'+esc(ph||'')+'">'+esc(d[k]||'')+'</textarea></label>'};
  var s=function(k,l,opts){return '<label class="f">'+l+'<select id="ta-'+k+'">'+opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(d[k])===o[0]?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select></label>'};
  var cb=function(grp,k,l){return '<label class="tacb"><input type="checkbox" data-tagrp="'+grp+'" data-tak="'+k+'"'+(d[grp]&&d[grp][k]?' checked':'')+'> '+esc(l)+'</label>'};
  overlay('taOv','<div class="dhd"><h2>Tenancy agreement</h2><button type="button" class="btn ghost" data-taclose="1">Close</button></div>'+
   '<p class="dnote">This is a template to help you, not legal advice. It follows the GOV.UK guidance on the written information landlords in England must give tenants from 1 May 2026. Check it against the latest guidance, or ask a solicitor or landlord association, before you use it. It is for England only.</p>'+
   '<div class="dcgrid"><div class="dcform">'+
   '<h3 class="tah">1. Landlord and tenants</h3><div class="grid">'+a('landlords','Landlord name(s), one per line')+a('noticeAddr','Address in England or Wales where tenants can serve notices on you')+i('llPhone','Landlord phone (optional)')+i('llEmail','Landlord email (optional)','', 'email')+i('agent','Letting agent (if any)')+a('tenants','Tenant name(s), one per line. Include every joint tenant')+'</div>'+
   '<h3 class="tah">2. Property and start</h3><div class="grid">'+a('property','Property address')+a('included','What is included (furniture, parking, garden, shared areas)','For example: furnished as per the inventory; parking space 3')+i('start','Tenancy start date','','date')+'</div>'+
   '<h3 class="tah">3. Rent</h3><div class="grid">'+i('rent','Rent (£)','','number')+s('freq','Rent period',[['Monthly','Monthly'],['Weekly','Weekly'],['Every 4 weeks','Every 4 weeks'],['Quarterly','Quarterly']])+i('rentDay','Rent due on (day of the month, or the day of the week)','1')+a('rentHow','How the tenant pays rent','For example: bank transfer to the account the landlord gives in writing')+'</div><div id="taDepWarn"></div>'+
   '<h3 class="tah">4. Bills</h3><p class="muted" style="font-size:12px;margin:0 0 4px">You can only ask tenants to pay council tax, utilities, TV licence, communications services and Green Deal charges.</p><div class="tacbs"><b>Included in the rent:</b>'+TA_BILLS.map(function(b){return cb('billsIn',b[0],b[1])}).join('')+'</div><div class="tacbs"><b>Tenant pays separately:</b>'+TA_BILLS.map(function(b){return cb('billsOut',b[0],b[1])}).join('')+'</div><div class="grid">'+a('billsNote','For bills the tenant pays separately: how much and when (or how and when you will tell them)')+'</div>'+
   '<h3 class="tah">5. Deposit</h3><div class="grid">'+i('deposit','Deposit (£). Leave blank if none','','number')+s('scheme','Deposit scheme',[['','Not chosen yet'],['DPS','Deposit Protection Service (DPS)'],['mydeposits','mydeposits'],['TDS','Tenancy Deposit Scheme (TDS)']])+'</div>'+
   '<h3 class="tah">6. Ending the tenancy</h3><div class="grid">'+s('tenantNotice','Notice the tenant must give',[['2 months','2 months (the maximum)'],['1 month','1 month'],['4 weeks','4 weeks']])+'</div><div class="tacbs"><b>Grounds you may rely on that need telling the tenant now (leave unticked if unsure):</b>'+cb('grounds','4A','Ground 4A (student house shares)')+cb('grounds','18','Ground 18 (supported accommodation)')+'</div><div class="grid">'+i('otherGrounds','Any other prior-notice grounds (2ZA to 2ZD, 4, 5 to 5H)','Leave blank if none')+'</div>'+
   '<h3 class="tah">7. Safety and the home</h3><div class="grid">'+s('gas','Is there a gas supply or gas appliance?',[['yes','Yes'],['','No']])+s('improve','May the tenant make improvements with your permission?',[['yes','Yes'],['','No']])+s('supported','Is this supported accommodation?',[['','No'],['yes','Yes']])+a('supportedWhy','If supported accommodation: why it meets that definition')+i('epc','EPC rating and date given')+i('gsr','Gas safety record date given')+i('eicr','Electrical report (EICR) date given')+'</div>'+
   '<h3 class="tah">8. Other terms (optional)</h3><div class="grid">'+a('extra','Extra terms, one per line. Do not add a fixed term, a rent review clause or fees the Tenant Fees Act bans.','',3)+'</div>'+
   '</div><div class="dcprev"><div class="muted" style="font-size:12px;margin-bottom:6px">Preview</div><div id="taPrev"></div></div></div>'+
   '<div class="mkact dcact"><button type="button" class="btn" data-tasave="1">Save details</button><button type="button" class="btn ghost" data-tapdf="dl">Download PDF</button><button type="button" class="btn ghost" data-tapdf="share">Share</button><button type="button" class="btn ghost" data-taprint="1">Print</button></div>',true);
  taPreview();
}
function taRead(){
  var d={};document.querySelectorAll('#taOv [id^="ta-"]').forEach(function(e){d[e.id.slice(3)]=e.value});
  if($('#clTerms')){d.terms=[];document.querySelectorAll('#clTerms .clterm').forEach(function(r){d.terms.push({t:r.querySelector('[data-clt="t"]').value.trim(),x:r.querySelector('[data-clt="x"]').value})})}
  ['billsIn','billsOut','grounds'].forEach(function(g){d[g]={}});document.querySelectorAll('#taOv [data-tagrp]').forEach(function(e){if(e.checked)d[e.getAttribute('data-tagrp')][e.getAttribute('data-tak')]=1});
  return d;
}
function lines(s){return String(s||'').split('\n').map(function(x){return x.trim()}).filter(Boolean)}
function taBlocks(d){
  if(d.kind==='company')return clBlocks(d);
  var L=lines(d.landlords),Tn=lines(d.tenants),B=[],h=function(t){B.push({h:t})},p=function(t){B.push({p:t})},kv=function(r){B.push({kv:r.filter(function(x){return x[1]})})},li=function(arr){B.push({li:arr})};
  var billName=function(k){return (TA_BILLS.filter(function(b){return b[0]===k})[0]||['',k])[1]};
  B.push({title:'Assured Periodic Tenancy Agreement'});B.push({sub:'including the written statement of terms (Housing Act 1988, section 16D). For a property in England.'});
  h('1. The landlord and the tenant');
  kv([['Landlord'+(L.length>1?'s':''),L.join(', ')],['Address for serving notices on the landlord',String(d.noticeAddr||'').replace(/\s*\n\s*/g,', ')],['Landlord phone',d.llPhone],['Landlord email',d.llEmail],['Letting agent',d.agent],['Tenant'+(Tn.length>1?'s':''),Tn.join(', ')]]);
  if(Tn.length>1)p('Where there is more than one tenant, each tenant is responsible both individually and together for keeping to this agreement, including paying the whole rent.');
  h('2. The property');kv([['Property address',String(d.property||'').replace(/\s*\n\s*/g,', ')],['Included',d.included]]);
  h('3. Type of tenancy and start date');
  p('This is an assured periodic tenancy under the Housing Act 1988, as amended by the Renters’ Rights Act 2025. It has no fixed end date. It continues from one rent period to the next until it is ended in a way the law allows.');
  kv([['Start date (when the tenant is first entitled to possession)',d.start?fd(d.start):''],['Rent period',d.freq]]);
  h('4. Rent');
  kv([['Rent',d.rent?gbp(d.rent)+' '+({'Monthly':'per month','Weekly':'per week','Every 4 weeks':'every 4 weeks','Quarterly':'per quarter'}[d.freq]||''):''],['Rent is due',d.rentDay?(/^\d+$/.test(String(d.rentDay))?'on day '+d.rentDay+' of each '+(d.freq==='Weekly'?'week':'month'):String(d.rentDay)):''],['How to pay',d.rentHow]]);
  p('Rent increases: if the landlord proposes a rent increase, the landlord will serve a notice on the tenant in accordance with section 13 of the Housing Act 1988.');
  h('5. Bills');
  var bin=Object.keys(d.billsIn||{}),bout=Object.keys(d.billsOut||{}).filter(function(k){return !(d.billsIn||{})[k]});
  p(bin.length?'The rent includes: '+bin.map(billName).join(', ')+'.':'The rent does not include any bills.');
  if(bout.length){p('The tenant pays these bills separately: '+bout.map(billName).join(', ')+'.');if(d.billsNote)p(d.billsNote)}
  p('The landlord will not require the tenant to pay any bill other than council tax, utilities, a TV licence, communications services or Green Deal charges.');
  h('6. Deposit');
  if(+d.deposit>0)p('The tenant will pay a deposit of '+gbp(d.deposit)+'. The landlord will protect it in a government-approved tenancy deposit scheme'+(d.scheme?' ('+d.scheme+')':'')+' within 30 days of receiving it, and give the tenant the required information about the scheme within the same 30 days.');
  else p('No deposit is taken.');
  h('7. The tenant ending the tenancy');
  p('The tenant may end this tenancy by giving the landlord at least '+(d.tenantNotice||'2 months')+'’ notice in writing. Any change to this notice period must be agreed in writing by all joint tenants, and it cannot be more than two months.');
  h('8. The landlord ending the tenancy');
  p('In most circumstances, the landlord can only end this tenancy by obtaining a court order for possession and having it enforced. Before going to court, the landlord (or one of the joint landlords) will usually need to serve a possession notice on the tenant. The notice must be in the correct form and must say which ground or grounds for possession the landlord is relying on. The minimum notice period depends on the ground or grounds used.');
  p('The only exception is where the Secretary of State has given the landlord written notice that the tenant is disqualified from renting because of their immigration status. In that case the landlord may give notice under the relevant immigration legislation instead.');
  var gr=Object.keys(d.grounds||{}).map(function(g){return 'Ground '+g}).concat(d.otherGrounds?[d.otherGrounds]:[]);
  if(gr.length)p('Prior notice: the landlord tells the tenant now that possession may be sought on the following ground(s) in Schedule 2 to the Housing Act 1988: '+gr.join('; ')+'.');
  h('9. The landlord’s legal duties');
  p('Fitness for human habitation: section 9A of the Landlord and Tenant Act 1985 requires the landlord to make sure the property is fit for human habitation, to the extent that section requires.');
  p('Repairs: section 11 of the Landlord and Tenant Act 1985 requires the landlord, to the extent that section applies:');
  li(['to keep in repair the structure and exterior of the property;','to keep in repair and proper working order the installations for the supply of water, gas and electricity and for sanitation;','to keep in repair and proper working order the installations for space heating and heating water.']);
  p('Any term that tries to take away these repair duties has no effect unless a county court has authorised it.');
  p('Electrical safety: regulation 3 of the Electrical Safety Standards in the Private Rented Sector and Social Rented Sector (England) Regulations 2020 requires the landlord to make sure the electrical safety standards are met while the property is occupied under this tenancy; to have the electrical installations inspected and tested by a qualified person at least every five years (or sooner if the last report says so); and to obtain a report of the results, including the date of the next inspection, and give a copy to the tenant.');
  if(d.gas)p('Gas safety: regulation 36 of the Gas Safety (Installations and Use) Regulations 1998 requires the landlord to keep every relevant gas fitting and flue in a safe condition; to have each appliance and flue checked for safety by a Gas Safe registered engineer at the intervals set under those Regulations (currently every 12 months); and to obtain a record of each check, including the date of the next check, and give a copy to each tenant.');
  if(d.improve)p('Adaptations for disability: under section 190 of the Equality Act 2010, where a disabled person lives in the property as their only or main home, the landlord must not unreasonably refuse consent to an improvement that would help them use and enjoy it. "Disabled person" is defined in section 6 and "improvement" in section 190(9) of that Act.');
  h('10. Pets');
  p('The tenant may keep a pet at the property if they ask for the landlord’s consent under section 16A of the Housing Act 1988 and the landlord consents. The landlord must not unreasonably refuse consent.');
  if(d.supported){h('11. Supported accommodation');p('This tenancy is granted for supported accommodation.'+(d.supportedWhy?' The tenant’s occupation meets that definition because: '+d.supportedWhy:''))}
  h((d.supported?'12':'11')+'. Other terms of this agreement');
  li(['The tenant will pay the rent, and any bills they are responsible for, on time.','The tenant will take reasonable care of the property and its contents, and report repairs or problems to the landlord promptly.','The tenant will not cause a nuisance or annoyance to neighbours.','The landlord or someone acting for them may enter at reasonable times to inspect, carry out repairs or safety checks, after giving at least 24 hours’ notice in writing, except in an emergency.','The tenant will not sublet or take in lodgers without the landlord’s written consent, which will not be unreasonably refused.','The tenant will not make alterations without the landlord’s written consent.','At the end of the tenancy the tenant will leave the property in the same condition as at the start, apart from fair wear and tear.','The landlord will fit a working smoke alarm on each storey used as living accommodation and a carbon monoxide alarm in any room with a fixed combustion appliance (other than a gas cooker), check they work on the first day of the tenancy, and repair or replace them when told they are faulty.','The landlord will not interfere with the tenant’s right to live in the property in peace.'].concat(lines(d.extra)));
  h('Documents given to the tenant');
  kv([['Energy Performance Certificate',d.epc||'To be given'],['Gas safety record',d.gas?(d.gsr?'Dated '+d.gsr:'To be given'):'Not applicable'],['Electrical installation condition report',d.eicr?'Dated '+d.eicr:'To be given'],['Deposit scheme information',+d.deposit>0?'Within 30 days of receiving the deposit':'Not applicable']]);
  h('Notices');
  p('The tenant may serve notices on the landlord at the address in section 1. The landlord may serve notices on the tenant at the property. Notices may also be sent by email where both sides have agreed to this in writing.');
  B.push({sig:{landlords:L.length?L:['Landlord'],tenants:Tn.length?Tn:['Tenant']}});
  return B;
}
function taHtml(d){
  return '<div class="dpage ta">'+(okLogo(BIZ.logo)?'<img class="dlogo" src="'+BIZ.logo+'" alt="" style="max-height:50px">':'')+taBlocks(d).map(function(b){
    if(b.title)return '<div class="dbig" style="margin-top:6px">'+esc(b.title)+'</div>';if(b.sub)return '<div class="muted" style="margin-bottom:8px">'+esc(b.sub)+'</div>';
    if(b.h)return '<h4>'+esc(b.h)+'</h4>';if(b.p)return '<p>'+esc(b.p)+'</p>';if(b.li)return '<ul>'+b.li.map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul>';
    if(b.kv)return '<table class="dkv">'+b.kv.map(function(r){return '<tr><td>'+esc(r[0])+'</td><td>'+nl2br(r[1])+'</td></tr>'}).join('')+'</table>';
    if(b.sig)return '<h4>Signatures</h4>'+b.sig.landlords.map(function(n){return '<div class="dsig"><span>Landlord: '+esc(n)+'</span><span>Signed ____________________</span><span>Date __________</span></div>'}).join('')+b.sig.tenants.map(function(n){return '<div class="dsig"><span>Tenant: '+esc(n)+'</span><span>Signed ____________________</span><span>Date __________</span></div>'}).join('')+(b.sig.guarantors||[]).map(function(n){return '<div class="dsig"><span>Guarantor: '+esc(n)+'</span><span>Signed ____________________</span><span>Date __________</span></div>'}).join('');
    return '';
  }).join('')+'<div class="dfoot">Created with '+esc((window.MD_CONFIG||{}).appName||'MySimpleDesk')+' on '+fd(iso(TODAY))+'. A template, not legal advice.</div></div>';
}
function taPdf(d){
  var P=new Pdf(),G=[0.35,0.41,0.47],A=[0.18,0.29,0.25];
  if(okLogo(BIZ.logo)&&BIZ.logoW){var s=Math.min(140/BIZ.logoW,45/BIZ.logoH);P.image(BIZ.logo,BIZ.logoW,BIZ.logoH,40,36,BIZ.logoW*s,BIZ.logoH*s);P.y=36+BIZ.logoH*s+12}
  var para=function(t,size,bold,ind,rgb){wrapT(t,515-(ind||0),size,bold).forEach(function(x){P.need(size+4);P.t(40+(ind||0),P.y,x,size,bold,'l',rgb);P.y+=size+3.5})};
  taBlocks(d).forEach(function(b){
    if(b.title){P.t(40,P.y,b.title,18,true,'l',A);P.y+=24}
    else if(b.sub){para(b.sub,9,false,0,G);P.y+=6}
    else if(b.h){P.need(40);P.y+=6;P.t(40,P.y,b.h,11,true,'l',A);P.y+=16}
    else if(b.p){para(b.p,9.5);P.y+=5}
    else if(b.li){b.li.forEach(function(x){var ls=wrapT(x,500,9.5);P.need(ls.length*13);P.t(44,P.y,'•',9.5);ls.forEach(function(l){P.t(55,P.y,l,9.5);P.y+=13})});P.y+=4}
    else if(b.kv){b.kv.forEach(function(r){var lw=wrapT(r[0],170,9,true),vw=wrapT(r[1],330,9.5),n=Math.max(lw.length,vw.length);P.need(n*13+4);lw.forEach(function(l,i){P.t(40,P.y+i*13,l,9,true,'l',G)});vw.forEach(function(l,i){P.t(220,P.y+i*13,l,9.5)});P.y+=n*13+4});P.y+=4}
    else if(b.sig){P.need(60);P.y+=8;P.t(40,P.y,'Signatures',11,true,'l',A);P.y+=20;b.sig.landlords.map(function(n){return 'Landlord: '+n}).concat(b.sig.tenants.map(function(n){return 'Tenant: '+n})).concat((b.sig.guarantors||[]).map(function(n){return 'Guarantor: '+n})).forEach(function(n){P.need(40);P.t(40,P.y,n,9.5,true);P.y+=22;P.line(40,P.y,300,[0.3,0.3,0.3]);P.line(340,P.y,555,[0.3,0.3,0.3]);P.y+=4;P.t(40,P.y,'Signed',7.5,false,'l',G);P.t(340,P.y,'Date',7.5,false,'l',G);P.y+=20})}
  });
  return P.bytes((d.kind==='company'?'Company let tenancy agreement':'Assured periodic tenancy agreement')+' · '+String(d.property||'').replace(/\s*\n\s*/g,', ').slice(0,80)+' · A template, not legal advice');
}
function taPreview(){
  var d=taRead(),p=$('#taPrev');if(p)p.innerHTML=taHtml(d);
  var cw=$('#clWarn');if(cw){var tm=+d.termMonths||0;cw.innerHTML=d.termType!=='periodic'&&tm>36?'<p class="dnote">A term of more than 3 years must be made as a deed, and one of more than 7 years must be registered at the Land Registry. This template is for terms of up to 3 years. Ask a solicitor for a longer lease.</p>':d.termType!=='periodic'&&d.start&&tm>0?'<p class="muted" style="font-size:12px;margin:4px 0 0">The fixed term ends on '+fd(clEnd(d.start,tm))+'.</p>':''}
  var w=$('#taDepWarn');if(w){var rent=+d.rent||0,dep=+d.deposit||0,yr=rent*({'Monthly':12,'Weekly':52,'Every 4 weeks':13,'Quarterly':4}[d.freq]||12),cap=r2(yr/52*(yr>=50000?6:5));w.innerHTML=dep&&rent&&dep>cap?'<p class="dnote">The deposit is more than the legal maximum of '+(yr>=50000?6:5)+' weeks’ rent ('+gbp(cap)+') under the Tenant Fees Act 2019.</p>':''}
}
function taSave(quiet){var d=taRead();d.savedAt=Date.now();var c=cases.filter(function(x){return x.id===taCase})[0];if(!c)return d;if(taTn){var nl=tnList(c).map(function(t){return t.id===taTn?Object.assign({},t,{agreement:d}):t});patch(c.id,{tenancies:nl});if(openId===c.id&&$('#caseForm'))setTimeout(function(){lastAuto=JSON.stringify(collectForm())},80);var bt=document.querySelector('[data-tnag="'+taTn+'"]');if(bt)bt.textContent=d.kind==='company'?'Open company let agreement':'Open tenancy agreement'}else patch(c.id,{tenancyDoc:d});if(!quiet)toast(d.kind==='company'?'Company let agreement details saved':'Tenancy agreement details saved');setTimeout(function(){if(openId)renderLive()},60);return d}

/* --- events --- */
document.addEventListener('click',function(e){
  var t=e.target;if(!t||!t.closest)return;var b,v;
  if(t.closest('[data-bizopen]')){openBiz();return}
  if(t.closest('[data-bzclose]')||t.id==='bzOv'){closeOv('bzOv');return}
  if(t.closest('[data-bzunlock]')){if(window.CD_reGate&&window.CD_reGate('biz'))openBiz();return}
  if(t.closest('[data-bzsave]')){bizSave();return}
  if(t.closest('[data-bzlogodel]')){bizDraftLogo='del';var lb=$('#bzLogoBox');if(lb)lb.innerHTML='<span class="muted">Logo will be removed when you save</span>';return}
  if((b=t.closest('[data-dcnew]'))){if(openId)dcOpen(openId,null,b.getAttribute('data-dcnew'));return}
  if((b=t.closest('[data-dcopen]'))){v=b.getAttribute('data-dcopen').split('|');dcOpen(v[0],v[1]);return}
  if(t.closest('[data-dcclose]')||t.id==='dcOv'){closeOv('dcOv');return}
  if(t.closest('[data-dladd]')){dcRead();dcDoc.lines.push({d:'',q:1,p:'',v:vatOn()?(BIZ.vatRate!=null?BIZ.vatRate:20):0});var tb=$('#dcLines');if(tb)tb.innerHTML=dcDoc.lines.map(dcLineRow).join('');dcPreview();return}
  if((b=t.closest('[data-dldel]'))){dcRead();dcDoc.lines.splice(+b.getAttribute('data-dldel'),1);if(!dcDoc.lines.length)dcDoc.lines.push({d:'',q:1,p:'',v:0});var tb2=$('#dcLines');if(tb2)tb2.innerHTML=dcDoc.lines.map(dcLineRow).join('');dcPreview();return}
  if(t.closest('[data-dcsave]')){dcSave();return}
  if((b=t.closest('[data-dcpdf]'))){var d1=dcSave(true);if(!d1)return;fileOut(dcPdf(d1),(d1.kind==='quote'?'Quote-':'Invoice-')+String(d1.number).replace(/[^A-Za-z0-9-]+/g,'')+'.pdf',b.getAttribute('data-dcpdf'));dcRender();return}
  if(t.closest('[data-dcprint]')){var d2=dcSave(true);if(d2){dcRender();printHtml(dcHtml(d2))}return}
  if(t.closest('[data-dcconv]')){var q=dcSave(true);if(!q)return;q.status='accepted';var cq=cases.filter(function(x){return x.id===dcCase})[0];if(cq)patch(cq.id,{docs:docsOf(cq).map(function(x){return x.id===q.id?Object.assign({},x,{status:'accepted'}):x})});dcOpen(dcCase,null,'invoice',q);toast('Invoice started from quote '+q.number+'. Check it, then Save.');return}
  if((b=t.closest('[data-dcdel]'))){if(!b.classList.contains('armed')){b.classList.add('armed');b.textContent='Confirm delete';return}var cd=cases.filter(function(x){return x.id===dcCase})[0];if(cd)patch(cd.id,{docs:docsOf(cd).filter(function(x){return x.id!==dcDoc.id})});closeOv('dcOv');toast('Deleted');setTimeout(function(){if(openId)renderLive();if(view==='invoices')render()},60);return}
  if((b=t.closest('[data-ivf]'))){ivFilter=b.getAttribute('data-ivf');render();return}
  if((b=t.closest('[data-taopen]'))){taOpen(b.getAttribute('data-taopen'));return}
  if(t.closest('[data-taclose]')||t.id==='taOv'){closeOv('taOv');if($('#gnOv'))setTimeout(gnAgSync,150);return}
  if(t.closest('[data-cladd]')){var pk=$('#clPick'),ct=CL_TERMS[+pk.value]||CL_TERMS[0],bx=$('#clTerms');bx.insertAdjacentHTML('beforeend',clTermRow({t:ct[1]?ct[0]:'',x:ct[1]}));var nr=bx.lastElementChild;nr.scrollIntoView({block:'nearest'});nr.querySelector(ct[1]?'textarea':'input').focus();taPreview();return}
  if((b=t.closest('[data-clrm]'))){b.closest('.clterm').remove();taPreview();return}
  if(t.closest('[data-tasave]')){taSave();return}
  if((b=t.closest('[data-tapdf]'))){var td=taSave(true);fileOut(taPdf(td),(td.kind==='company'?'Company-let-agreement-':'Tenancy-agreement-')+String(td.property||'property').split(/[\n,]/)[0].replace(/[^A-Za-z0-9]+/g,'-').slice(0,40)+'.pdf',b.getAttribute('data-tapdf'));return}
  if(t.closest('[data-taprint]')){var td2=taSave(true);printHtml(taHtml(td2));return}
});
document.addEventListener('input',function(e){var t=e.target;if(!t||!t.closest)return;if(t.closest('#dcOv'))dcPreview();else if(t.closest('#taOv'))taPreview()});
document.addEventListener('change',function(e){var t=e.target;if(!t||!t.closest)return;if(t.closest('#dcOv'))dcPreview();else if(t.closest('#taOv'))taPreview()});


/* ---------- landlords: property page with tenants and certificates ---------- */
function tfv(tn,k){var v=tn?tn[k]:null;if(v!==''&&v!=null)return v;var f=T.tByKey&&T.tByKey[k];if(f&&f.auto&&tn){var s=tfv(tn,f.auto.from);return s&&/^\d{4}-\d{2}-\d{2}$/.test(s)?autoDate(s,f.auto):''}return ''}
function tnMigrate(c){
  var ap=(c.applicants||[]).filter(function(a){return a&&a.name}),has=ap.length||c.rent||c.tenancyStart||c.deposit;if(!has)return [];
  var tn={id:'tmig',status:'current',people:ap.map(function(a){return {name:a.name,phone:a.phone||'',email:a.email||''}})};
  (T.tenancyFields||[]).forEach(function(f){if(f.k!=='status'&&c[f.k]!=null&&c[f.k]!=='')tn[f.k]=c[f.k]});if(c.tenancyDoc)tn.agreement=c.tenancyDoc;return [tn];
}
function tnList(c){return (c&&c.tenancies)||(T.tenancyMode&&c?tnMigrate(c):[])}
function tnCurrent(c){return tnList(c).filter(function(t){return (t.status||'current')==='current'})}
function tnCorp(tn){return (tn&&tn.tenantType)==='corporate'}
function tnAgLabel(tn){var corp=tnCorp(tn),has=tn.agreement&&((tn.agreement.kind==='company')===corp);return (has?'Open ':'Create ')+(corp?'company let agreement':'tenancy agreement')}
function tnDir(v,i){return '<div class="tnd" style="display:flex;gap:8px;align-items:flex-end;margin:0 0 8px"><label class="f" style="flex:1;margin:0">Director<input data-td="1" maxlength="80" value="'+esc(v||'')+'"></label><button type="button" class="btn ghost sm" data-tnrmd="1">Remove</button></div>'}
function tnCoHtml(tn){
  var corp=tnCorp(tn),dirs=(tn.directors||[]).filter(Boolean).slice(0,4);
  return '<div class="tntype"><label class="f">Type of tenant<select data-tf="tenantType"><option value="private"'+(corp?'':' selected')+'>Private tenant</option><option value="corporate"'+(corp?' selected':'')+'>Corporate tenant</option></select></label></div>'+
   '<div class="tnco" style="'+(corp?'':'display:none')+'"><div class="grid" style="margin:0 0 10px"><label class="f">Company name<input data-tf="company" maxlength="120" value="'+esc(tn.company||'')+'"></label><label class="f">Company registration number<input data-tf="companyNo" maxlength="20" value="'+esc(tn.companyNo||'')+'"></label></div>'+
   '<div class="tndirs">'+(dirs.length?dirs:['']).map(tnDir).join('')+'</div><button type="button" class="btn ghost sm" data-tnaddd="1"'+(dirs.length>=4?' style="display:none"':'')+'>Add director</button>'+
   '<p class="muted" style="margin:10px 0 8px;font-size:12px">A company usually cannot hold an assured tenancy, so the deposit and rent increase rules for ordinary tenants on this page may not apply to a company let. Use the company let agreement button at the bottom of this card.</p>'+
   '<p style="margin:0 0 6px;font-weight:600;font-size:13px">Contact at the company</p></div>';
}
function tnCoSync(card){
  var s=card.querySelector('[data-tf="tenantType"]'),corp=s&&s.value==='corporate',co=card.querySelector('.tnco'),ab=card.querySelector('[data-tnaddp]'),ad=card.querySelector('[data-tnaddd]');
  if(co)co.style.display=corp?'':'none';if(ab)ab.textContent=corp?'Add another contact':'Add joint tenant';
  var agb=card.querySelector('[data-tnag]');if(agb){var tid=card.getAttribute('data-tn'),tn0=tnList(currentCase()||{}).filter(function(x){return x.id===tid})[0]||{};agb.textContent=tnAgLabel(Object.assign({},tn0,{tenantType:corp?'corporate':'private'}))}
  if(ad)ad.style.display=card.querySelectorAll('.tnd').length>=4?'none':'';
  if(corp){var tt=card.querySelector('[data-tf="tenancyType"]');if(tt&&!tt.value)tt.value='Company let'}
}
document.addEventListener('change',function(e){var t=e.target;if(t&&t.getAttribute&&t.getAttribute('data-tf')==='tenantType'){var cd=t.closest('.tncard');if(cd)tnCoSync(cd)}if(t&&t.id==='f-postcode')t.value=pcFmt(t.value)});
document.addEventListener('input',function(e){var t=e.target;if(t&&t.id==='f-propertyAddress'&&t.value.trim()){t.style.borderColor='';var m=$('#paErr');if(m)m.remove()}});
function paNeed(){var f=$('#f-propertyAddress');if(!f)return;f.style.borderColor='#b3261e';if(!$('#paErr'))f.insertAdjacentHTML('afterend','<span id="paErr" role="alert" style="color:#b3261e;font-size:12px;font-weight:600">Address line one is needed before the property can be saved.</span>');var fs=f.closest('fieldset');if(fs&&fs.classList.contains('col-closed')){var cb=fs.querySelector('[data-coltoggle]');if(cb)cb.click()}f.scrollIntoView({block:'center'});try{f.focus({preventScroll:true})}catch(x){}}
function tnNames(tn){if(tnCorp(tn)&&String(tn.company||'').trim())return String(tn.company).trim();return (tn.people||[]).map(function(p){return p.name}).filter(Boolean).join(' & ')}
function tnMonthly(tn){var r=+tfv(tn,'rent')||0,f=tfv(tn,'rentFreq');return f==='Weekly'?r*52/12:f==='Every 4 weeks'?r*13/12:f==='Quarterly'?r/3:r}
function rentSum(c){return tnCurrent(c).reduce(function(a,t){return a+tnMonthly(t)},0)}
function occOf(c){var cur=tnCurrent(c);if(!cur.length)return 'Vacant';return cur.some(function(t){return tfv(t,'noticeDate')})?'Notice given':'Let'}
function occChip(c){var o=occOf(c);return '<span class="chip '+(o==='Let'?'ok':o==='Vacant'?'warn':'bad')+'">'+o+'</span>'}
function tnReminders(c){
  var out=[];if(!T.tenancyReminders)return out;
  tnCurrent(c).forEach(function(tn){T.tenancyReminders.forEach(function(r){
    if(r.unless&&r.unless.some(function(k){return tfv(tn,k)!==''}))return;
    var d=tfv(tn,r.k),key='t:'+tn.id+':'+r.k;if(!d||!/^\d{4}-\d{2}-\d{2}$/.test(d)||(c.remDone&&c.remDone[key]===d))return;
    out.push({date:d,label:r.l+(tnNames(tn)?' · '+tnNames(tn):''),key:key,sec:false});
  })});
  return out;
}
function tfHtml(f,tn){
  var v=tn[f.k];
  if(f.t==='sel'){var opts=(f.o||[]).map(function(x){return Array.isArray(x)?x:[x,x===''?'Choose…':x]}),cur=v==null?(f.k==='status'?'current':''):v;return '<label class="f">'+esc(f.l)+'<select data-tf="'+f.k+'">'+opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(o[0]===cur?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select></label>'}
  if(f.t==='date'&&f.auto)return '<label class="f">'+esc(f.l)+'<input data-tf="'+f.k+'" type="date" data-auto="'+(v?'0':'1')+'" data-tfrom="'+f.auto.from+'" value="'+esc(tfv(tn,f.k))+'"></label>';
  var inp='<input data-tf="'+f.k+'" type="'+((f.t==='money'||f.t==='num')?'number" step="any" inputmode="decimal':f.t==='date'?'date':'text')+'" value="'+esc(v==null?'':v)+'">';
  if(f.t==='money')inp='<span class="ig"><i>£</i>'+inp+'</span>';
  return '<label class="f">'+esc(f.l)+inp+'</label>';
}
function tnPerson(p){p=p||{};return '<div class="tnp"><label class="f">Name<input data-tp="name" value="'+esc(p.name||'')+'"></label><label class="f">Phone<input data-tp="phone" type="tel" value="'+esc(p.phone||'')+'"><span class="pl">'+plinks(p.phone)+'</span></label><label class="f">Email<input data-tp="email" type="email" value="'+esc(p.email||'')+'"><span class="pl el">'+elinks(p.email)+'</span></label><button type="button" class="x" data-tnrmp="1" aria-label="Remove this tenant">×</button></div>'}
/* tenant card sections: the basics always show; deposit and checks fold away behind a one-line summary */
var TN_GROUPS=[['rent','Tenancy and rent',['status','tenancyType','tenancyStart','rent','rentFreq','rentDay']],
  ['deposit','Deposit',['deposit','depositReceived','depositDue','depositScheme','depositProtected']],
  ['checks','Checks, rent increases and notices',['rightToRent','infoSheet','lastRentIncrease','nextRentIncrease','noticeDate','moveOut']]];
function tnSumDeposit(tn){
  var dep=+tfv(tn,'deposit')||0,sch=tfv(tn,'depositScheme'),rec=tfv(tn,'depositReceived'),due=tfv(tn,'depositDue'),pr=tfv(tn,'depositProtected');
  if(sch==='Not taken')return ['','No deposit taken'];
  if(pr)return ['ok',(dep?money(dep)+' · ':'')+'protected'+(sch?' with '+sch:'')+' on '+fd(pr)];
  if(rec&&due)return [diff(due)<0?'bad':'warn',(dep?money(dep)+' · ':'')+'not protected yet · protect by '+fd(due)];
  if(dep)return ['',money(dep)+(sch?' · '+sch:'')];
  return ['','Not added yet'];
}
function tnSumChecks(tn){
  var out=[],rtr=tfv(tn,'rightToRent'),nx=tfv(tn,'nextRentIncrease'),nt=tfv(tn,'noticeDate'),mo=tfv(tn,'moveOut');
  out.push(rtr?'Right to rent checked '+fd(rtr):'Right to rent not recorded');
  if(nx)out.push('next rent increase from '+fd(nx));if(nt)out.push('notice '+fd(nt));if(mo)out.push('moving out '+fd(mo));
  return [rtr?'':'warn',out.join(' · ')];
}
function tnSections(tn,isNew){
  var F=T.tenancyFields||[],used={},grid=function(keys){return '<div class="grid">'+keys.map(function(k){used[k]=1;var f=T.tByKey[k];return f?tfHtml(f,tn):''}).join('')+'</div>'};
  var g=TN_GROUPS.map(function(x){return [x[0],x[1],x[2].filter(function(k){return T.tByKey&&T.tByKey[k]})]});
  F.forEach(function(f){if(!g.some(function(x){return x[2].indexOf(f.k)>-1}))g[g.length-1][2].push(f.k)});
  var h='<div class="tnsec"><div class="tnsh">'+esc(g[0][1])+'</div>'+grid(g[0][2])+'</div>'+rlBox(tn,currentCase()||{});
  g.slice(1).forEach(function(x){if(!x[2].length)return;var sm=x[0]==='deposit'?tnSumDeposit(tn):tnSumChecks(tn),open=sm[0]==='bad'||(x[0]==='deposit'&&sm[0]==='warn');
    h+='<details class="tnsec tnfold"'+(open?' open':'')+'><summary><span class="tnsh">'+esc(x[1])+'</span><span class="tnsum '+sm[0]+'">'+(sm[0]==='bad'||sm[0]==='warn'?'&#9888; ':'')+esc(isNew&&sm[1]==='Not added yet'?'Add later if you like':sm[1])+'</span></summary>'+grid(x[2])+'</details>'});
  return h;
}
function tnCard(tn,isNew,others){
  var ended=(tn.status||'current')==='ended',nm=tnNames(tn),rent=tfv(tn,'rent'),st=tfv(tn,'tenancyStart');
  var sum=(nm||'New tenant')+(rent!==''?' · '+money(rent)+(tfv(tn,'rentFreq')?' '+String(tfv(tn,'rentFreq')).toLowerCase():''):'')+(st?' · from '+fd(st):'')+(ended&&tfv(tn,'moveOut')?' to '+fd(tfv(tn,'moveOut')):'');
  return '<details class="tncard'+(ended?' ended':'')+(isNew?' isnew':' locked')+'" data-tn="'+esc(tn.id)+'"'+(isNew?' data-new="1"':'')+(ended?'':' open')+'><summary><b>'+esc(isNew?'Create tenant':sum)+'</b> <span class="chip '+(ended?'':'ok')+'">'+(isNew?'Not saved yet':ended?'Previous tenant':'Current')+'</span><span class="chip tnlk">Locked</span></summary>'+
   (isNew&&others?'<label class="tnmove"><input type="checkbox" data-tnmove="1" checked> Move '+esc(others)+' to Previous tenants when this tenant is saved</label>':'')+
   '<div class="tnsec"><div class="tnsh">Who is renting</div>'+tnCoHtml(tn)+'<div class="tnpeople">'+((tn.people&&tn.people.length)?tn.people:[{}]).map(tnPerson).join('')+'</div><button type="button" class="btn ghost sm" data-tnaddp="1">'+(tnCorp(tn)?'Add another contact':'Add joint tenant')+'</button></div>'+
   tnSections(tn,isNew)+
   '<div class="tnacts">'+(isNew?'':'<button type="button" class="btn ghost sm" data-tnag="'+esc(tn.id)+'">'+tnAgLabel(tn)+'</button><button type="button" class="btn ghost sm" data-tnstmt="'+esc(tn.id)+'">Rent statement</button>')+'<span class="sp"></span>'+
   (isNew?'<button type="button" class="btn ghost sm" data-tncancel="1">Cancel</button>':'<button type="button" class="btn ghost sm danger" data-tnrm="1">Delete tenant</button><button type="button" class="btn ghost sm" data-tnedit="1">Edit</button>')+
   '<button type="button" class="btn sm" data-tnsave="1">Save tenant</button></div></details>';
}
/* ---------- property folder and uploaded documents (landlord) ---------- */
var DZ_BTN='background:none;border:0;padding:0;font:inherit;font-weight:600;color:var(--accent);cursor:pointer;text-align:left',pfTried={},pfRun=false,dzBusy=false;
function pfClean(s,n){return String(s||'').replace(/[\\\/:*?"<>|#%~&{}\u0000-\u001f]/g,' ').replace(/\s+/g,' ').replace(/^[ .]+|[ .]+$/g,'').slice(0,n||80).replace(/[ .]+$/,'')}
function pfName(c,used){
  var a=pfClean(String(c.propertyAddress||'').split(/[\n,]/)[0])||('Property '+(c.clientNo||''));
  var clash=(used&&used[a.toLowerCase()])||cases.some(function(x){return x.id!==c.id&&x.folder&&String(x.folder.name||'').toLowerCase()===a.toLowerCase()});
  return clash?a+' ('+(c.clientNo||String(c.id||'').slice(0,4))+')':a;
}
function dzFiles(c,k){return ((c&&c.files)||[]).filter(function(f){return f.k===k})}
function dzInner(c,k,label){
  var fl=dzFiles(c,k),up=function(t){return '<button type="button" style="'+DZ_BTN+'" data-dzup="'+esc(k)+'">'+esc(t)+'</button>'},rm=function(f){return '<button type="button" style="'+DZ_BTN+';color:#8a98a3" data-dzrm="'+esc(f.id)+'">Remove</button>'};
  if(k==='other')return fl.map(function(f){return '<div class="pl" style="flex-wrap:wrap;margin:0 0 8px"><a href="'+esc(f.url)+'" target="_blank" rel="noopener">'+esc(f.name)+'</a>'+rm(f)+'</div>'}).join('')+'<div class="pl">'+up('Upload a document')+'</div>';
  if(!fl.length)return up('Upload '+label);
  var f=fl[fl.length-1];
  return '<a href="'+esc(f.url)+'" target="_blank" rel="noopener" title="'+esc(f.name)+'">Open '+esc(label)+'</a>'+up('Replace')+rm(f);
}
function dzSpan(c,f){return '<span class="pl dz" style="flex-wrap:wrap" data-dz="'+esc(f.k)+'" data-dzl="'+esc(f.doc)+'">'+dzInner(c,f.k,f.doc)+'</span>'}
function dzFolderHtml(c){
  var f=c&&c.folder,w=window.CD_files?window.CD_files.where():'file storage';
  if(f&&f.name)return '<p class="muted" style="margin:0 0 8px;font-size:12px">Folder in your '+esc(w)+': <b>Properties › '+esc(f.name)+'</b></p>'+(f.url?'<div class="pl" style="margin:0 0 10px"><a href="'+esc(f.url)+'" target="_blank" rel="noopener">Open property folder</a></div>':'');
  return '<p class="muted" style="margin:0 0 8px;font-size:12px">A folder for this property is made in your '+esc(w)+' when the property is saved. It is named after the first line of the address.</p>';
}
function dzSide(c){return '<fieldset data-sec="docs"><legend>Property documents</legend><div id="dzFolder">'+dzFolderHtml(c)+'</div><div data-dz="other" data-dzl="document">'+dzInner(c,'other','document')+'</div><p class="muted" style="margin:8px 0 0;font-size:12px">Certificates can also be uploaded next to their dates. Files up to 50 MB.</p></fieldset>'}
function dzRefresh(c){document.querySelectorAll('#caseForm [data-dz]').forEach(function(el){el.innerHTML=el.hasAttribute('data-dzlg')?lgDocInner(c,el.getAttribute('data-dz')):dzInner(c,el.getAttribute('data-dz'),el.getAttribute('data-dzl'))});var ff=$('#dzFolder');if(ff)ff.innerHTML=dzFolderHtml(c)}
function dzErr(e){
  if(e&&e.renew)return 'Google Drive needs reconnecting. Press the yellow bar at the bottom, then upload again.';
  if(navigator.onLine===false||(e instanceof TypeError))return 'Could not reach your file storage. Check you are online, then upload again.';
  if(e&&e.status===507)return 'Your file storage is full.';
  return 'Could not upload the file ('+((e&&e.message)||'try again')+').';
}
function dzPick(k,lg){
  if(!openId){toast('Add the property address first. It saves itself, then try again.');return}
  if(!window.CD_files||!window.CD_files.can()){toast('Could not reach your file storage. Check you are online, then try again.');return}
  if(dzBusy){toast('Still uploading the last file. Try again in a moment.');return}
  var inp=document.createElement('input');inp.type='file';inp.id='dzFile';inp.accept='.pdf,.jpg,.jpeg,.png,.heic,.webp,.doc,.docx,.xls,.xlsx,.txt,image/*,application/pdf';inp.style.display='none';
  var old=$('#dzFile');if(old)old.remove();document.body.appendChild(inp);
  inp.addEventListener('change',function(){var file=inp.files&&inp.files[0];inp.remove();if(!file)return;if(lg&&dzFiles(currentCase(),k).length)lgAsk(k,file);else dzSend(k,file,lg?'keep':'')});
  inp.click();
}
function dzSend(k,file,mode){
  var id=openId,c=currentCase();if(!id||!c)return;
  if(!file.size){toast('That file is empty.');return}
  if(file.size>window.CD_files.max){toast('That file is over 50 MB. Choose a smaller file.');return}
  var el=document.querySelector('#caseForm [data-dz="'+k+'"]'),label=(el&&el.getAttribute('data-dzl'))||'document';
  var ext=(/\.[A-Za-z0-9]{1,8}$/.exec(file.name)||[''])[0].toLowerCase(),dt=(($('#f-'+k)||{}).value)||iso(TODAY);
  var fname=k==='other'?(pfClean(file.name.slice(0,file.name.length-ext.length),100)||'Document')+ext:label.charAt(0).toUpperCase()+label.slice(1)+' '+dt+ext;
  if(mode==='keep'&&k!=='other'&&dzFiles(c,k).some(function(f){return String(f.name).toLowerCase()===fname.toLowerCase()}))fname=fname.slice(0,fname.length-ext.length)+' (added '+iso(TODAY)+')'+ext;
  var folder=(c.folder&&c.folder.name)||pfName(c);
  dzBusy=true;pfTried[id]=1;toast('Uploading '+file.name+'…',true);
  window.CD_files.upload(folder,fname,file).then(function(res){
    dzBusy=false;
    var cur=cases.filter(function(x){return x.id===id})[0]||c;
    var old=mode==='replace'?(cur.files||[]).filter(function(f){return f.k===k}):[];
    var files=(cur.files||[]).filter(function(f){return k==='other'||mode==='keep'||f.k!==k});
    files.push({id:'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),k:k,name:res.name,url:res.url,fid:res.id,size:file.size,at:Date.now()});
    var up={files:files};if(res.folder&&res.folder.name&&!(cur.folder&&cur.folder.url))up.folder=res.folder;
    patch(id,up);toast('Uploaded to Properties › '+folder);
    if(openId===id)dzRefresh(Object.assign({},cur,up));
    if(old.length&&window.CD_files.trash){var w=window.CD_files.where(),bin=w==='Google Drive'?'Google Drive bin':w+' recycle bin';
      Promise.all(old.map(function(f){return f.fid?window.CD_files.trash(f.fid).then(function(){return true},function(){return false}):Promise.resolve(false)})).then(function(rs){
        var bad=rs.filter(function(x){return !x}).length;
        toast(bad?'Uploaded. '+bad+' old document'+(bad>1?'s':'')+' could not be moved to the '+bin+'. Delete '+(bad>1?'them':'it')+' from the property folder yourself.':'Uploaded. The old document'+(old.length>1?'s are':' is')+' in your '+bin+'.');
      })}
  },function(e){dzBusy=false;toast(dzErr(e))});
}
function dzRemove(fid){
  var id=openId,c=currentCase();if(!id||!c)return;
  if(!confirm('Remove this link? The file itself stays in the property folder.'))return;
  var up={files:(c.files||[]).filter(function(f){return f.id!==fid})};
  patch(id,up);dzRefresh(Object.assign({},c,up));
}
document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest?e.target.closest('[data-dzup],[data-dzrm]'):null;if(!t)return;
  e.preventDefault();
  if(t.hasAttribute('data-dzup'))dzPick(t.getAttribute('data-dzup'),!!t.closest('[data-dzlg]'));else dzRemove(t.getAttribute('data-dzrm'));
});
/* makes the storage folder for every property that has an address and no folder yet (new and existing properties) */
function pfSweep(){
  if(!T.tenancyMode||pfRun||!window.CD_files||!window.CD_files.can())return;
  var todo=cases.filter(function(c){return String(c.propertyAddress||'').trim()&&!(c.folder&&c.folder.name)&&!pfTried[c.id]});
  if(!todo.length)return;pfRun=true;var used={};
  (function next(){
    var c=todo.shift();if(!c){pfRun=false;return}
    pfTried[c.id]=1;var nm=pfName(c,used);used[nm.toLowerCase()]=1;
    window.CD_files.folder(nm).then(function(f){
      if(f&&f.name){patch(c.id,{folder:f});if(openId===c.id){var cur=currentCase()||c;dzRefresh(Object.assign({},cur,{folder:f}))}}
      next();
    },function(){next()});
  })();
}
function llBody(c){
  var main=T.sections.filter(function(s){return !s.side}),side=T.sections.filter(function(s){return s.side});
  var tenants=tnFsHtml(c);
  var prop=main.map(function(s,i){return secFs(s.id,esc(s.title))+(i===0?fld('clientNo','Property reference',c.clientNo)+sel('type','Type',c.type,typeOpts(c.type)):'')+s.fields.map(function(f){return fieldHtml(f,c)}).join('')+'</div></fieldset>'}).join('');
  return '<div class="llgrid"><div class="llmain">'+prop+tenants+'</div>'+
   '<aside class="llside">'+advBox(fv(c,'btlFixedUntil'),'Buy-to-let mortgage deal')+lgBox(c)+side.map(function(s){return secFs(s.id,esc(s.title))+s.fields.map(function(f){return fieldHtml(f,c)}).join('')+'</div></fieldset>'}).join('')+dzSide(c)+'</aside></div>';
}
/* Tenants section: current tenants, then a closed list of previous tenants.
   A newly added tenant (data-new) moves the current tenants to Previous tenants when it is saved, unless the box on the new card is unticked. */
function tnFsHtml(c){
  var all=tnList(c),cur=all.filter(function(t){return (t.status||'current')!=='ended'}),prev=all.filter(function(t){return (t.status||'current')==='ended'}).sort(function(a,b){return String(tfv(b,'moveOut')||tfv(b,'tenancyStart')||'').localeCompare(String(tfv(a,'moveOut')||tfv(a,'tenancyStart')||''))});
  var sum=cur.length?cur.map(tnNames).filter(Boolean).join(', '):'Vacant';
  return '<fieldset id="tnFs"><legend>Tenants <span class="lgsum">'+esc(sum)+'</span></legend>'+
   '<div class="tnbar"><span class="tnh">Current tenant'+(cur.length>1?'s':'')+'</span><button type="button" class="btn sm" id="addTn">Create tenant</button></div>'+
   '<div id="tns">'+cur.map(function(t){return tnCard(t)}).join('')+'</div>'+
   (cur.length?'':'<p class="muted" id="tnEmpty" style="margin:0 0 8px">No current tenant. Press Create tenant to add one.</p>')+
   '<details class="tnprev" id="tnPrev"><summary><span class="tnh">Previous tenants</span> <span class="chip">'+prev.length+'</span></summary><div id="tnsPrev">'+(prev.length?prev.map(function(t){return tnCard(t)}).join(''):'<p class="muted" style="margin:6px 0">No previous tenants yet.</p>')+'</div></details></fieldset>';
}
/* a saved tenant is locked (read only) until Edit is pressed; rent payments stay usable */
function tnLock(card,on){
  card.classList.toggle('locked',!!on);
  card.querySelectorAll('[data-tf],[data-tp],[data-td],[data-tnmove]').forEach(function(i){i.disabled=!!on;var l=i.closest('label.f');if(l&&!l.closest('.rlrow'))l.classList.toggle('blank',!!on&&(!String(i.value||'').trim()||(i.getAttribute('data-tf')==='tenantType'&&i.value==='private')||(i.getAttribute('data-tf')==='status'&&i.value==='current')))});
  var lk=card.querySelector('.tnlk');if(lk)lk.textContent=on?'Locked':'Editing';
}
function tnLockAll(){document.querySelectorAll('#tnFs .tncard.locked').forEach(function(cd){tnLock(cd,true)})}
function tnRedraw(){
  var fs=$('#tnFs'),c=currentCase();if(!fs||!c)return;
  var wasPrev=($('#tnPrev')||{}).open,closed=fs.classList.contains('col-closed');
  var tmp=document.createElement('div');tmp.innerHTML=tnFsHtml(c);var nf=tmp.firstChild;fs.parentNode.replaceChild(nf,fs);
  if(wasPrev)$('#tnPrev').open=true;
  colOpen['tenants']=!closed;decorateSecs();tnLockAll();
  if(typeof rhRender==='function')rhRender();updStrip();
}
function tnSaveNow(msg){
  if(!openId){toast('Add address line one of the property first. It saves itself, then save the tenant.');paNeed();return false}
  var data=collectForm();patch(openId,data);lastAuto=JSON.stringify(data);
  setTimeout(function(){tnRedraw();if(msg)toast(msg)},80);return true;
}
function tnCollect(){
  var cards=document.querySelectorAll('#tnFs .tncard');if(!$('#tns'))return null;
  var old=tnList(currentCase()||{}),out=[];
  cards.forEach(function(card){
    if(card.hasAttribute('data-new')&&!Array.prototype.some.call(card.querySelectorAll('[data-tp="name"],[data-tf="company"],[data-tp="phone"],[data-tp="email"]'),function(i){return i.value.trim()}))return;
    var id=card.getAttribute('data-tn'),prev=old.filter(function(t){return t.id===id})[0]||{},tn=Object.assign({},prev,{id:id});
    card.querySelectorAll('[data-tf]').forEach(function(e){var k=e.getAttribute('data-tf');tn[k]=e.type==='number'?num(e.value):e.value.trim()});
    (T.tenancyFields||[]).forEach(function(f){if(f.auto&&tn[f.k]){var s=tfv(Object.assign({},tn,{[f.k]:''}),f.auto.from);if(s&&tn[f.k]===autoDate(s,f.auto))tn[f.k]=''}});
    tn.rentLog=[];card.querySelectorAll('.rlrow').forEach(function(r){var o={id:r.getAttribute('data-rlid')};r.querySelectorAll('[data-rl]').forEach(function(i){var k=i.getAttribute('data-rl');o[k]=i.type==='number'?num(i.value):i.value});if(o.due||o.amount!=null)tn.rentLog.push(o)});
    tn.tenantType=tn.tenantType==='corporate'?'corporate':'private';tn.directors=[];card.querySelectorAll('[data-td]').forEach(function(i){var v=i.value.trim();if(v&&tn.directors.length<4)tn.directors.push(v)});
    tn.people=[];card.querySelectorAll('.tnp').forEach(function(r){var p={};r.querySelectorAll('[data-tp]').forEach(function(i){p[i.getAttribute('data-tp')]=i.value.trim()});if(p.name||p.phone||p.email)tn.people.push(p)});
    out.push(tn);
  });
  var nw=Array.prototype.slice.call(document.querySelectorAll('#tns .tncard[data-new]')).filter(function(cd){var b=cd.querySelector('[data-tnmove]');if(b&&!b.checked)return false;return Array.prototype.some.call(cd.querySelectorAll('[data-tp="name"],[data-tf="company"]'),function(i){return i.value.trim()})});
  if(nw.length){
    var ids=nw.map(function(cd){return cd.getAttribute('data-tn')}),st=(out.filter(function(t){return t.id===ids[0]})[0]||{}).tenancyStart,end=st&&/^\d{4}-\d{2}-\d{2}$/.test(st)?addDays(st,-1):iso(TODAY);
    out.forEach(function(t){if(ids.indexOf(t.id)<0&&(t.status||'current')==='current'){t.status='ended';if(!t.moveOut)t.moveOut=end}});
  }
  return out;
}
document.addEventListener('click',function(e){
  var t=e.target;if(!t||!t.closest)return;var b;
  if(t.id==='addTn'){var box=$('#tns');if(!box)return;if(box.querySelector('[data-new]')){toast('Finish or cancel the new tenant first.');box.querySelector('[data-new] [data-tp="name"]').focus();return}var em=$('#tnEmpty');if(em)em.remove();
    var oth=Array.prototype.map.call(box.querySelectorAll('.tncard'),function(cd){var sel=cd.querySelector('[data-tf="status"]');if(sel&&sel.value==='ended')return '';var n=Array.prototype.map.call(cd.querySelectorAll('[data-tp="name"]'),function(i){return i.value.trim()}).filter(Boolean).join(' & ');var co=cd.querySelector('[data-tf="company"]');return (co&&co.value.trim()&&cd.querySelector('[data-tf="tenantType"]').value==='corporate')?co.value.trim():(n||'the current tenant')}).filter(Boolean);
    box.querySelectorAll('.tncard').forEach(function(cd){cd.open=false});
    box.insertAdjacentHTML('afterbegin',tnCard({id:'t'+uid(),status:'current',people:[{}]},true,oth.join(' and ')));var fs0=$('#tnFs');if(fs0&&fs0.classList.contains('col-closed')){var cb0=fs0.querySelector('[data-coltoggle]');if(cb0)cb0.click()}var f=box.querySelector('.tncard [data-tp="name"]');if(f){f.focus();f.scrollIntoView({block:'center'})}return}
  if((b=t.closest('[data-tnsave]'))){var sc=b.closest('.tncard');if(sc.hasAttribute('data-new')){var hasNm=Array.prototype.some.call(sc.querySelectorAll('[data-tp="name"],[data-tf="company"]'),function(i){return i.value.trim()});if(!hasNm){toast('Add the tenant\'s name first.');var nf=sc.querySelector('[data-tp="name"]');if(nf)nf.focus();return}}
    var mv=sc.hasAttribute('data-new')&&sc.querySelector('[data-tnmove]')&&sc.querySelector('[data-tnmove]').checked;tnSaveNow(mv?'Tenant saved. The previous tenant moved to Previous tenants.':'Tenant saved');return}
  if((b=t.closest('[data-tnedit]'))){var ec=b.closest('.tncard');ec.open=true;tnLock(ec,false);var f1=ec.querySelector('[data-tp="name"]');if(f1)f1.focus();return}
  if((b=t.closest('[data-tncancel]'))){b.closest('.tncard').remove();if(!document.querySelector('#tns .tncard'))$('#tns').insertAdjacentHTML('afterend','<p class="muted" id="tnEmpty" style="margin:0 0 8px">No current tenant. Press Create tenant to add one.</p>');updStrip();return}
  if((b=t.closest('[data-tnaddd]'))){var cdd=b.closest('.tncard'),bx=cdd.querySelector('.tndirs');if(bx.querySelectorAll('.tnd').length<4){bx.insertAdjacentHTML('beforeend',tnDir(''));var li=bx.querySelectorAll('[data-td]');li[li.length-1].focus()}tnCoSync(cdd);return}
  if((b=t.closest('[data-tnrmd]'))){var cdr=b.closest('.tncard'),bx2=cdr.querySelector('.tndirs');if(bx2.querySelectorAll('.tnd').length>1)b.closest('.tnd').remove();else b.closest('.tnd').querySelector('input').value='';tnCoSync(cdr);return}
  if((b=t.closest('[data-tnaddp]'))){var cd=b.closest('.tncard');cd.querySelector('.tnpeople').insertAdjacentHTML('beforeend',tnPerson({}));return}
  if((b=t.closest('[data-tnrmp]'))){var pp=b.closest('.tnpeople');if(pp.querySelectorAll('.tnp').length>1)b.closest('.tnp').remove();else b.closest('.tnp').querySelectorAll('input').forEach(function(i){i.value=''});return}
  if((b=t.closest('[data-tnrm]'))){if(!b.classList.contains('armed')){b.classList.add('armed');b.textContent='Press again to delete';setTimeout(function(){if(b.isConnected&&b.classList.contains('armed')){b.classList.remove('armed');b.textContent='Delete tenant'}},5000);return}b.closest('.tncard').remove();tnSaveNow('Tenant deleted');return}
  if((b=t.closest('[data-tnag]'))){e.preventDefault();if(!openId){toast('Add the property address first. The property saves itself, then try again.');return}var tid=b.getAttribute('data-tnag'),data=collectForm();patch(openId,data);lastAuto=JSON.stringify(data);setTimeout(function(){taOpen(openId,tid)},60);return}
});
document.addEventListener('input',function(e){
  var t=e.target;if(!t||!t.closest||!t.closest('.tncard'))return;var card=t.closest('.tncard');
  if(t.hasAttribute('data-tf')){var k=t.getAttribute('data-tf');
    if(t.hasAttribute('data-tfrom')){if(t.value)t.setAttribute('data-auto','0');else{t.setAttribute('data-auto','1');var src=card.querySelector('[data-tf="'+t.getAttribute('data-tfrom')+'"]'),af=T.tByKey[k];t.value=src&&src.value?autoDate(src.value,af.auto):''}}
    card.querySelectorAll('[data-tfrom="'+k+'"]').forEach(function(dep){if(dep.getAttribute('data-auto')!=='1')return;var f=T.tByKey[dep.getAttribute('data-tf')];dep.value=t.value&&/^\d{4}-\d{2}-\d{2}$/.test(t.value)?autoDate(t.value,f.auto):''});
  }
  if(t.getAttribute('data-tp')==='phone'){var pl=t.parentNode.querySelector('.pl');if(pl)pl.innerHTML=plinks(t.value)}
  if(t.getAttribute('data-tp')==='email'){var el=t.parentNode.querySelector('.el');if(el)el.innerHTML=elinks(t.value)}
  updStrip();
});
document.addEventListener('change',function(e){var t=e.target;if(t&&t.closest&&t.closest('.tncard'))updStrip()});
document.addEventListener('click',function(e){var g=e.target&&e.target.closest&&e.target.closest('[data-rltog]');if(!g)return;var row=g.closest('.rlrow'),open=row.classList.toggle('rlc')===false;g.setAttribute('aria-expanded',String(open));g.querySelector('.rlx').textContent=open?'Hide':'Details'});
document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-rlmore]');if(!b)return;var bx=b.closest('.rlrows');if(bx)bx.querySelectorAll('.rlold').forEach(function(r){r.hidden=false});b.remove()});

/* ---------- rent payments, rent invoices and sending invoices ---------- */
function rlStep(d,freq,day){if(freq==='Weekly')return addDays(d,7);if(freq==='Every 4 weeks')return addDays(d,28);var n=addMonths(d,freq==='Quarterly'?3:1);if(day&&day>=1&&day<=31){var p=pd(n),last=new Date(p.getFullYear(),p.getMonth()+1,0).getDate();n=iso(new Date(p.getFullYear(),p.getMonth(),Math.min(day,last)))}return n}
function rlPeriod(due,freq){if(!due)return '';var end=addDays(rlStep(due,freq||'Monthly'),-1);return fd(due)+' to '+fd(end)}
function rlState(r){if(r.status==='paid')return 'paid';return r.due&&diff(r.due)<0?'over':'due'}
/* paid months fold to one line ("Oct 2026 · £1,150 · Paid 1 Oct"); press it to see or change the details */
function rlSumLine(r){
  var dm=function(d,o){return /^\d{4}-\d{2}-\d{2}$/.test(d||'')?pd(d).toLocaleDateString('en-GB',o):''};
  var mon=dm(r.due,{month:'short',year:'numeric'})||'No date',pdl=dm(r.paidDate,{day:'numeric',month:'short'});
  return '<button type="button" class="rlsum" data-rltog="1" aria-expanded="false"><span class="rlm">'+esc(mon)+'</span><span class="rla">'+(r.amount!=null&&r.amount!==''?money(r.amount):'')+'</span><span class="chip ok">Paid'+(pdl?' '+esc(pdl):'')+'</span>'+(r.invId?'<span class="rli">Invoice</span>':'')+'<span class="rlx">Details</span></button>';
}
function rlRow(r,c){
  var st=rlState(r),inv=r.invId?docsOf(c).filter(function(d){return d.id===r.invId})[0]:null;
  return '<div class="rlrow'+(st==='paid'?' rlpaid rlc':'')+'" data-rlid="'+esc(r.id)+'">'+(st==='paid'?rlSumLine(r):'')+'<label class="f">Due date<input type="date" data-rl="due" value="'+esc(r.due||'')+'"></label>'+
   '<label class="f">Amount<span class="ig"><i>£</i><input type="number" step="any" data-rl="amount" value="'+esc(r.amount==null?'':r.amount)+'"></span></label>'+
   '<label class="f">Rent<select data-rl="status"><option value="due"'+(r.status!=='paid'?' selected':'')+'>Rent due</option><option value="paid"'+(r.status==='paid'?' selected':'')+'>Rent paid</option></select></label>'+
   '<label class="f">Payment date<input type="date" data-rl="paidDate" value="'+esc(r.paidDate||'')+'"></label><input type="hidden" data-rl="invId" value="'+esc(r.invId||'')+'">'+
   '<div class="rlact"><span class="chip '+(st==='paid'?'ok':st==='over'?'bad':'warn')+'">'+(st==='paid'?'Paid':st==='over'?'Overdue':'Due')+'</span><button type="button" class="btn ghost sm" data-rlinv="1">'+(inv?'Send invoice '+esc(inv.number):'Create invoice')+'</button><button type="button" class="x" data-rlrm="1" aria-label="Remove this rent line">×</button></div></div>';
}
function rlBox(tn,c){
  var rows=(tn.rentLog||[]).slice().sort(function(a,b){return a.due<b.due?1:a.due>b.due?-1:0});
  return '<div class="rlbox"><div class="rlh"><b>Rent payments</b><button type="button" class="btn ghost sm" data-rladd="1">Add next rent</button></div><div class="rlrows">'+(rows.length?rows.map(function(r,i){return i<6?rlRow(r,c):rlRow(r,c).replace('<div class="rlrow','<div hidden class="rlrow rlold')}).join('')+(rows.length>6?'<button type="button" class="btn ghost sm" data-rlmore="1">Show '+(rows.length-6)+' older payment'+(rows.length===7?'':'s')+'</button>':''):'<p class="muted rlnone" style="margin:4px 0">No rent lines yet. Press Add next rent.</p>')+'</div></div>';
}
function rlNextDue(card){
  var g=function(k){var e=card.querySelector('[data-tf="'+k+'"]');return e?e.value:''},freq=g('rentFreq')||'Monthly',day=+g('rentDay')||0,start=g('tenancyStart');
  var dues=Array.prototype.map.call(card.querySelectorAll('.rlrow [data-rl="due"]'),function(i){return i.value}).filter(Boolean).sort();
  if(dues.length)return rlStep(dues[dues.length-1],freq,day);
  var base=start||iso(TODAY);if(day&&freq!=='Weekly'&&freq!=='Every 4 weeks'){var p=pd(base),last=new Date(p.getFullYear(),p.getMonth()+1,0).getDate(),cand=iso(new Date(p.getFullYear(),p.getMonth(),Math.min(day,last)));if(cand<base)cand=rlStep(cand,'Monthly',day);return cand}
  return base;
}
function rlReminders(c){
  var out=[];tnCurrent(c).forEach(function(tn){(tn.rentLog||[]).forEach(function(r){if(r.status==='paid'||!r.due)return;var k='r:'+r.id;if(c.remDone&&c.remDone[k]===r.due)return;out.push({date:r.due,label:'Rent '+(r.amount?money(r.amount)+' ':'')+'due'+(tnNames(tn)?' · '+tnNames(tn):''),key:k,sec:false})})});return out;
}
function rentStatusCell(c){
  var rows=[];tnCurrent(c).forEach(function(tn){(tn.rentLog||[]).forEach(function(r){rows.push(r)})});
  if(!rows.length)return '<span class="muted">—</span>';
  var unpaid=rows.filter(function(r){return r.status!=='paid'&&r.due}).sort(function(a,b){return a.due<b.due?-1:1}),over=unpaid.filter(function(r){return diff(r.due)<0});
  if(over.length)return '<span class="chip bad">Overdue '+money(over.reduce(function(a,r){return a+(+r.amount||0)},0))+'</span>';
  if(unpaid.length)return '<span class="chip warn">Due '+fd(unpaid[0].due)+'</span>';
  return '<span class="chip ok">Paid</span>';
}
/* send window: download, share, WhatsApp, email */
var snCase=null,snDoc=null;
function snPeople(c,d){
  var ppl=[];
  if(d.tnId){var tn=tnList(c).filter(function(t){return t.id===d.tnId})[0];if(tn)ppl=tn.people||[]}
  if(!ppl.length)ppl=T.tenancyMode?[].concat.apply([],tnCurrent(c).map(function(t){return t.people||[]})):(c.applicants||[]);
  return ppl.filter(function(p){return p&&(p.name||p.phone||p.email)});
}
function snMsg(d,p){
  var f=bdFirst(p&&p.name||''),pay=BIZ.payDetails&&d.status!=='paid'?'\n\nHow to pay:\n'+BIZ.payDetails+'\nPlease use reference '+d.number+'.':'';
  return 'Hello'+(f?' '+f:'')+',\n\n'+(d.kind==='quote'?'Please find your quote '+d.number+' for '+gbp(d.total||dcTotals(d).total)+'. It is valid until '+fd(d.due)+'.':'Please find your '+(d.rentRow?'rent ':'')+'invoice '+d.number+' for '+gbp(d.total||dcTotals(d).total)+', due on '+fd(d.due)+'.')+pay+'\n\nThank you,\n'+(bizName()||profA().name||'');
}
function snFile(d){return (d.kind==='quote'?'Quote-':'Invoice-')+String(d.number).replace(/[^A-Za-z0-9-]+/g,'')+'.pdf'}
var snUrl=null;
function snOpen(caseId,docId){
  var c=cases.filter(function(x){return x.id===caseId})[0];if(!c)return;var d=docsOf(c).filter(function(x){return x.id===docId})[0];if(!d)return;snCase=caseId;snDoc=docId;
  var ppl=snPeople(c,d),mailOn=window.CD_mail&&window.CD_mail.on(),kind=d.kind==='quote'?'Quote':'Invoice';
  if(snUrl){try{URL.revokeObjectURL(snUrl)}catch(e){}snUrl=null}
  var viewer;
  if(window.CD_DEMO)viewer='<p class="muted" style="font-size:12px;margin:0 0 6px">Claude’s preview cannot show PDF files, so the demo shows the same invoice as a page. In the real app the PDF itself appears here.</p><div class="dcprev" style="position:static;max-height:none">'+dcHtml(d)+'</div>';
  else if(navigator.pdfViewerEnabled===false)viewer='<p class="muted" style="font-size:12px;margin:0 0 6px">This browser cannot show PDFs inside the app, so here is the same invoice as a page. Download PDF or Share PDF gives you the PDF file.</p><div class="dcprev" style="position:static;max-height:none">'+dcHtml(d)+'</div>';
  else{try{snUrl=URL.createObjectURL(new Blob([dcPdf(d)],{type:'application/pdf'}))}catch(e){}viewer=snUrl?'<iframe class="snpdf" src="'+snUrl+'#view=FitH" title="'+kind+' PDF"></iframe>':'<div class="dcprev" style="position:static">'+dcHtml(d)+'</div>'}
  overlay('snOv','<div class="dhd"><h2>'+kind+' '+esc(d.number)+' <span class="muted" style="font-size:14px;font-weight:400">'+gbp(d.total||dcTotals(d).total)+(d.kind==='quote'?' · valid until ':' · due ')+fd(d.due)+'</span> '+dcChip(d)+'</h2><button type="button" class="btn ghost" data-snclose="1">Close</button></div>'+
   '<div class="snbar">'+(ppl.length?ppl.map(function(p,i){var intl=bdIntl(p.phone),em=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.email||''));
     return '<div class="snp"><b>'+esc(p.name||'No name')+'</b>'+
      '<div class="snc"><span class="num">'+esc(p.phone||'No mobile number')+'</span>'+(intl?'<a class="btn sm bdwa" target="_blank" rel="noopener" data-snvia="whatsapp|'+i+'" href="https://wa.me/'+intl+'?text='+encodeURIComponent(snMsg(d,p))+'">Send by WhatsApp</a>':'')+'</div>'+
      '<div class="snc"><span>'+esc(p.email||'No email address')+'</span>'+(em?(mailOn?'<button type="button" class="btn sm" data-snmail="'+i+'">Send by email (PDF attached)</button>':(window.CD_mail&&window.CD_mail.can&&!window.CD_mail.can()?'':'<button type="button" class="btn sm ghost" data-snmailon="1">Turn on emailing</button>'))+'<a class="btn sm ghost" data-snvia="email app|'+i+'" href="mailto:'+esc(p.email)+'?subject='+encodeURIComponent(kind+' '+d.number+' from '+(bizName()||''))+'&body='+encodeURIComponent(snMsg(d,p).replace(/\n/g,'\r\n'))+'">Email app</a>':'')+'</div></div>'}).join(''):'<p class="dnote" style="margin:0">No phone number or email saved for this tenant or client.</p>')+'</div>'+
   '<div class="add" style="margin:8px 0"><button type="button" class="btn ghost sm" data-snpdf="dl">Download PDF</button><button type="button" class="btn ghost sm" data-snpdf="share">Share PDF (phone)</button><button type="button" class="btn ghost sm" data-snprint="1">Print</button><span class="muted" style="font-size:12px;align-self:center">WhatsApp from a link cannot attach the PDF: on a phone use Share PDF and pick WhatsApp; on a computer drag the downloaded PDF into the chat.</span></div>'+
   ((d.sent||[]).length?'<p class="muted" style="font-size:12px;margin:0 0 6px">Sent: '+d.sent.map(function(s){return esc(s.via)+(s.to?' to '+esc(s.to):'')+' '+shortStamp(s.at)}).join(' · ')+'</p>':'')+viewer,true);
}
function snMark(via,to){
  var c=cases.filter(function(x){return x.id===snCase})[0];if(!c)return;
  patch(c.id,{docs:docsOf(c).map(function(x){if(x.id!==snDoc)return x;var y=Object.assign({},x);if(y.status==='draft')y.status='sent';y.sent=(y.sent||[]).concat([{via:via,to:to,at:Date.now()}]);return y})});
}
document.addEventListener('click',function(e){
  var t=e.target;if(!t||!t.closest)return;var b;
  if((b=t.closest('[data-rladd]'))){rlAdd(b.closest('.tncard'));rhRender();return}
  if((b=t.closest('[data-rlrm]'))){if(!b.classList.contains('armed')){b.classList.add('armed');b.textContent='Remove?';return}b.closest('.rlrow').remove();return}
  if((b=t.closest('[data-rlinv]'))){
    e.preventDefault();if(!openId){toast('Add the property address first. The property saves itself, then try again.');return}
    var row=b.closest('.rlrow'),card2=b.closest('.tncard'),tnId=card2.getAttribute('data-tn'),rowId=row.getAttribute('data-rlid'),inv=row.querySelector('[data-rl="invId"]').value;
    if(inv&&docsOf(currentCase()).some(function(x){return x.id===inv})){snOpen(openId,inv);return}
    var data=collectForm();patch(openId,data);lastAuto=JSON.stringify(data);
    var c=currentCase(),tn=(data.tenancies||[]).filter(function(x){return x.id===tnId})[0]||{},r=(tn.rentLog||[]).filter(function(x){return x.id===rowId})[0]||{};
    var amt=+r.amount||+tfv(tn,'rent')||0;if(!amt){toast('Add the rent amount first');return}
    if(!tnNames(tn)){toast('Add the tenant’s name first');return}
    dcCase=openId;dcDoc={id:'d'+uid(),kind:'invoice',number:dcNewNumber('invoice'),date:iso(TODAY),due:r.due||iso(TODAY),status:r.status==='paid'?'paid':'draft',paidDate:r.status==='paid'?(r.paidDate||iso(TODAY)):'',toName:tnNames(tn),toAddr:paddr(c),job:'',lines:[{d:'Rent for '+rlPeriod(r.due||iso(TODAY),tfv(tn,'rentFreq'))+'\n'+String(c.propertyAddress||'').split('\n')[0],q:1,p:amt,v:0}],notes:'',isNew:true,rentRow:rowId,tnId:tnId};
    var d=dcSave(true);if(!d)return;
    row.querySelector('[data-rl="invId"]').value=d.id;b.textContent='Send invoice '+d.number;
    var d2=collectForm();patch(openId,{tenancies:d2.tenancies});lastAuto=JSON.stringify(d2);
    setTimeout(function(){snOpen(openId,d.id)},80);return;
  }
  if((b=t.closest('[data-dcsend]'))){var ds=dcSave(true);if(ds){closeOv('dcOv');setTimeout(function(){snOpen(dcCase,ds.id)},80)}return}
  if(t.closest('[data-snclose]')||t.id==='snOv'){closeOv('snOv');if(snUrl){try{URL.revokeObjectURL(snUrl)}catch(e){}snUrl=null}return}
  if(t.closest('[data-snprint]')){var c6=cases.filter(function(x){return x.id===snCase})[0],d6=c6&&docsOf(c6).filter(function(x){return x.id===snDoc})[0];if(d6)printHtml(dcHtml(d6));return}
  if((b=t.closest('[data-snpdf]'))){var c3=cases.filter(function(x){return x.id===snCase})[0],d3=c3&&docsOf(c3).filter(function(x){return x.id===snDoc})[0];if(d3){fileOut(dcPdf(d3),snFile(d3),b.getAttribute('data-snpdf'));if(b.getAttribute('data-snpdf')==='share')snMark('shared PDF','')}return}
  if((b=t.closest('[data-snvia]'))){var v=b.getAttribute('data-snvia').split('|'),c4=cases.filter(function(x){return x.id===snCase})[0],d4=c4&&docsOf(c4).filter(function(x){return x.id===snDoc})[0],p4=d4&&snPeople(c4,d4)[+v[1]];if(p4)snMark(v[0],v[0]==='whatsapp'?(p4.phone||''):(p4.email||''));return}
  if(t.closest('[data-snmailon]')){if(window.confirm('Microsoft will ask you to allow '+((window.MD_CONFIG||{}).appName||'MySimpleDesk')+' to send email as you. You only do this once. Continue?'))window.CD_mail.enable();return}
  if((b=t.closest('[data-snmail]'))){
    var c5=cases.filter(function(x){return x.id===snCase})[0],d5=c5&&docsOf(c5).filter(function(x){return x.id===snDoc})[0],p5=d5&&snPeople(c5,d5)[+b.getAttribute('data-snmail')];if(!p5)return;
    b.disabled=true;b.textContent='Sending…';
    window.CD_mail.send({to:[p5.email],subject:(d5.kind==='quote'?'Quote ':'Invoice ')+d5.number+' from '+(bizName()||''),text:snMsg(d5,p5),name:snFile(d5),bytes:dcPdf(d5)}).then(function(){snMark('email',p5.email);toast('Emailed '+d5.number+' to '+p5.email+(window.CD_DEMO?' (demo: nothing was really sent)':''));b.textContent='Sent ✓'},function(err){b.disabled=false;b.textContent='Email with PDF attached';toast(err&&err.perm?'Permission to send email was removed. Turn emailing on again.':'Could not send the email. Check your connection and try again.')});
    return;
  }
});
document.addEventListener('change',function(e){
  var t=e.target;if(!t||!t.closest)return;var row=t.closest('.rlrow');if(!row)return;var k=t.getAttribute('data-rl');
  var st=row.querySelector('[data-rl="status"]'),pdv=row.querySelector('[data-rl="paidDate"]');
  if(k==='status'&&t.value==='paid'&&!pdv.value)pdv.value=iso(TODAY);
  if(k==='status'&&t.value==='due')pdv.value='';
  if(k==='paidDate'&&t.value)st.value='paid';
  var paid=st.value==='paid',chip=row.querySelector('.rlact .chip'),due=row.querySelector('[data-rl="due"]').value;
  if(chip){var s2=paid?'paid':(due&&diff(due)<0?'over':'due');chip.className='chip '+(s2==='paid'?'ok':s2==='over'?'bad':'warn');chip.textContent=s2==='paid'?'Paid':s2==='over'?'Overdue':'Due'}
  var inv=row.querySelector('[data-rl="invId"]').value;
  if(inv&&openId&&(k==='status'||k==='paidDate')){var c=currentCase();if(c)patch(c.id,{docs:docsOf(c).map(function(x){if(x.id!==inv)return x;return Object.assign({},x,paid?{status:'paid',paidDate:pdv.value||iso(TODAY)}:{status:x.status==='paid'?'sent':x.status,paidDate:''})})})}
});

/* ---------- rent status next to the rent, at the top of the property page ---------- */
function rlAdd(card){var box=card.querySelector('.rlrows');if(!box)return null;var nn=box.querySelector('.rlnone');if(nn)nn.remove();var rent=(card.querySelector('[data-tf="rent"]')||{}).value;box.insertAdjacentHTML('afterbegin',rlRow({id:'r'+uid(),due:rlNextDue(card),amount:rent===''?'':+rent,status:'due'},currentCase()||{}));return box.firstElementChild}
function rhPick(card){
  var keep=card.getAttribute('data-rhrow'),rows=Array.prototype.slice.call(card.querySelectorAll('.rlrow'));
  if(keep){var k=rows.filter(function(r){return r.getAttribute('data-rlid')===keep})[0];if(k)return k}
  var due=rows.filter(function(r){return r.querySelector('[data-rl="status"]').value!=='paid'}).sort(function(a,b){var x=a.querySelector('[data-rl="due"]').value,y=b.querySelector('[data-rl="due"]').value;return x<y?-1:x>y?1:0})[0];
  var row=due||rlAdd(card);if(row)card.setAttribute('data-rhrow',row.getAttribute('data-rlid'));return row;
}
function rhRender(){
  var box=$('#rentHead');if(!box)return;
  var cards=Array.prototype.slice.call(document.querySelectorAll('#tns .tncard')).filter(function(cd){var s=cd.querySelector('[data-tf="status"]');return !s||s.value!=='ended'});
  box.innerHTML=cards.map(function(cd){
    var rent=(cd.querySelector('[data-tf="rent"]')||{}).value;if(rent===''||rent==null)return '';
    var row=rhPick(cd);if(!row)return '';
    var g=function(k){return row.querySelector('[data-rl="'+k+'"]').value},paid=g('status')==='paid',inv=g('invId'),nm=Array.prototype.map.call(cd.querySelectorAll('.tnp [data-tp="name"]'),function(i){return i.value}).filter(Boolean).join(' & '),freq=(cd.querySelector('[data-tf="rentFreq"]')||{}).value;
    var st=paid?'paid':(g('due')&&diff(g('due'))<0?'over':'due');
    return '<div class="rh" data-rhcard="'+esc(cd.getAttribute('data-tn'))+'"><div class="rhl"><b>Rent '+money(+g('amount')||+rent)+'</b>'+(freq?' <span class="muted">'+esc(freq.toLowerCase())+'</span>':'')+(nm?'<div class="muted" style="font-size:12px">'+esc(nm)+'</div>':'')+'</div>'+
     '<label class="rhf">Rent<select data-rh="status"><option value="due"'+(paid?'':' selected')+'>Due</option><option value="paid"'+(paid?' selected':'')+'>Paid</option></select></label>'+
     '<label class="rhf">Due date<input type="date" data-rh="due" value="'+esc(g('due'))+'"></label>'+
     (paid?'<label class="rhf">Payment date<input type="date" data-rh="paidDate" value="'+esc(g('paidDate'))+'"></label><button type="button" class="btn" data-rhinv="1">'+(inv?'Open invoice':'Create invoice')+'</button>':'<span class="chip '+(st==='over'?'bad':'warn')+'" style="align-self:center">'+(st==='over'?'Overdue':'Due')+(g('due')?' '+fd(g('due')):'')+'</span>')+
     '</div>';
  }).join('');
}
function rhRow(el){var h=el.closest('[data-rhcard]'),cd=h&&document.querySelector('#tns .tncard[data-tn="'+h.getAttribute('data-rhcard')+'"]');return cd?rhPick(cd):null}
document.addEventListener('change',function(e){
  var t=e.target;if(!t||!t.getAttribute||!t.getAttribute('data-rh'))return;var row=rhRow(t);if(!row)return;
  var k=t.getAttribute('data-rh'),inp=row.querySelector('[data-rl="'+k+'"]');inp.value=t.value;inp.dispatchEvent(new Event('change',{bubbles:true}));
  rhRender();updStrip();
});
document.addEventListener('click',function(e){
  var t=e.target;if(!t||!t.closest)return;var b=t.closest('[data-rhinv]');if(!b)return;var row=rhRow(b);if(!row)return;var btn=row.querySelector('[data-rlinv]');if(btn)btn.click();setTimeout(rhRender,150);
});
document.addEventListener('change',function(e){var t=e.target;if(t&&t.closest&&(t.closest('.rlrow')||(t.getAttribute&&/^(rent|rentFreq|status)$/.test(t.getAttribute('data-tf')||''))))setTimeout(rhRender,0)});

/* ---------- landlords: expenses, and rent and expenses reports for the accountant ---------- */
var EXP_CATS=['Repairs and maintenance','Insurance','Letting agent and management fees','Legal, accountancy and professional fees','Council tax, utilities, ground rent and service charges','Mortgage interest and finance costs','Cleaning, gardening and other services','Travel','Replacing furnishings and appliances','Other'];
function expList(c){return ((c&&c.expenses)||[]).slice().sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:0})}
function taxYear(d){var p=pd(d),y=p.getFullYear(),start=new Date(y,3,6);if(p<start)y--;return {from:y+'-04-06',to:(y+1)+'-04-05',label:y+'/'+String(y+1).slice(2)}}
var exCase=null,exEdit=null;
function exCommit(){
  var c=cases.filter(function(x){return x.id===exCase})[0];if(!c)return false;var amt=parseFloat(($('#ex-amt')||{}).value),dt=($('#ex-date')||{}).value;
  if(!dt||!(amt>0)){toast('Add the date and an amount, or clear the amount to close without saving');return false}
  var vals={date:dt,cat:$('#ex-cat').value,amount:r2(amt),to:($('#ex-to').value||'').trim(),desc:($('#ex-desc').value||'').trim()};
  if(exEdit){var eid=exEdit;patch(c.id,{expenses:(c.expenses||[]).map(function(x){return x.id===eid?Object.assign({},x,vals,{edited:Date.now()}):x})});toast('Expense updated')}
  else{patch(c.id,{expenses:(c.expenses||[]).concat([Object.assign({id:'e'+uid(),added:Date.now()},vals)])});toast('Expense added')}
  return true;
}
function expOpen(caseId,editId){
  var c=cases.filter(function(x){return x.id===caseId})[0];if(!c)return;if(caseId!==exCase)editId=null;exCase=caseId;exEdit=editId||null;
  var ed=exEdit?((c.expenses||[]).filter(function(x){return x.id===exEdit})[0]||null):null;if(!ed)exEdit=null;
  var l=expList(c),ty=taxYear(iso(TODAY)),tyTot=l.filter(function(e){return e.date>=ty.from&&e.date<=ty.to}).reduce(function(a,e){return a+(+e.amount||0)},0);
  overlay('exOv','<div class="dhd"><h2>Expenses · '+esc(names(c))+'</h2><button type="button" class="btn" data-exclose="1">Save and close</button></div>'+
   '<p class="muted" style="margin:4px 0 10px">Tax year '+ty.label+' so far: <b>'+gbp(tyTot)+'</b> · '+l.length+' expense'+(l.length===1?'':'s')+' in total. These go into the rent and expenses report for your accountant (Account › Generate documents).</p>'+
   (ed?'<p style="margin:0 0 6px;font-weight:600">Editing the expense from '+fd(ed.date)+'</p>':'')+'<div class="exadd grid'+(ed?' editing':'')+'"><label class="f">Date<input id="ex-date" type="date" value="'+(ed?esc(ed.date):iso(TODAY))+'"></label><label class="f">Category<select id="ex-cat">'+EXP_CATS.concat(ed&&EXP_CATS.indexOf(ed.cat)<0&&ed.cat?[ed.cat]:[]).map(function(k){return '<option'+(ed&&ed.cat===k?' selected':'')+'>'+esc(k)+'</option>'}).join('')+'</select></label>'+
   '<label class="f">Amount<span class="ig"><i>£</i><input id="ex-amt" type="number" step="any" inputmode="decimal" value="'+(ed?esc(ed.amount):'')+'"></span></label><label class="f">Paid to<input id="ex-to" placeholder="Supplier or tradesperson" value="'+(ed?esc(ed.to||''):'')+'"></label>'+
   '<label class="f wide">Description<input id="ex-desc" placeholder="For example: boiler repair, annual landlord insurance" value="'+(ed?esc(ed.desc||''):'')+'"></label></div>'+
   '<div class="add" style="margin:6px 0 12px"><button type="button" class="btn" data-exadd="1">'+(ed?'Save changes':'Add expense')+'</button>'+(ed?'<button type="button" class="btn ghost" data-excancel="1">Cancel edit</button>':'')+'<span class="muted" style="font-size:12px;align-self:center">Keep the receipts. Do not type bank or card numbers here.</span></div>'+
   (l.length?'<div class="tw"><table class="extab"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid to</th><th>Amount</th><th></th></tr></thead><tbody>'+l.map(function(e){return '<tr><td>'+fd(e.date)+'</td><td>'+esc(e.cat||'')+'</td><td>'+esc(e.desc||'')+'</td><td>'+esc(e.to||'')+'</td><td class="num">'+gbp(e.amount)+'</td><td class="exact"><button type="button" class="exed" data-exedit="'+esc(e.id)+'">Edit</button><button type="button" class="x" data-exdel="'+esc(e.id)+'" aria-label="Delete expense">×</button></td></tr>'}).join('')+'</tbody></table></div>':'<p class="muted">No expenses recorded for this property yet.</p>'),true);
}
/* report */
var gnSel=null;
function gnRange(k){var t=iso(TODAY),ty=taxYear(t);if(k==='lasttax'){var ly=taxYear(addDays(ty.from,-1));return [ly.from,ly.to]}if(k==='thistax')return [ty.from,t];if(k==='lastcal'){var y=TODAY.getFullYear()-1;return [y+'-01-01',y+'-12-31']}if(k==='thiscal')return [TODAY.getFullYear()+'-01-01',t];return null}
function ACC(){var a=BIZ.accountant||{};return {name:a.name||'',phone:a.phone||'',email:a.email||BIZ.accountantEmail||'',address:a.address||''}}
function accOpen(back){
  var a=ACC();
  overlay('accOv','<div class="dhd"><h2>Your accountant</h2><button type="button" class="btn ghost" data-accclose="1">Close</button></div>'+
   '<p class="muted" style="margin:4px 0 10px">Used for the rent and expenses report: their name and address go on the report, and "Email to my accountant" sends it to this email.</p>'+
   '<div class="grid"><label class="f">Name<input id="acc-name" value="'+esc(a.name)+'" placeholder="Accountant or firm name"></label>'+
   '<label class="f">Phone<input id="acc-phone" type="tel" value="'+esc(a.phone)+'"><span class="cl">'+plinks(a.phone)+'</span></label>'+
   '<label class="f">Email address<input id="acc-email" type="email" value="'+esc(a.email)+'"><span class="cl">'+elinks(a.email)+'</span></label>'+
   '<label class="f wide">Address<textarea id="acc-address" rows="3">'+esc(a.address)+'</textarea></label></div>'+
   '<p id="accMsg" class="muted" style="color:#b42318;min-height:1em"></p><div class="add"><button type="button" class="btn" data-accsave="'+(back?'gn':'1')+'">Save accountant</button></div>');
}
function accSave(back){
  var g=function(k){var e=$('#acc-'+k);return e?e.value.trim():''},d={name:g('name'),phone:g('phone'),email:g('email'),address:g('address')};
  if(d.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)){$('#accMsg').textContent='Check the email address.';return}
  var nb=Object.assign({},BIZ,{accountant:d});delete nb.accountantEmail;BIZ=nb;if(setCol)write('set-biz',function(){return setCol.doc('business').set(nb)});
  closeOv('accOv');toast('Accountant saved');if($('#gnOv')){gnAccRender();gnPreview()}
}
window.CD_openAcc=function(){accOpen(false)};
function gnAccRender(){var b=$('#gnAcc');if(!b)return;var a=ACC();
  b.innerHTML=(a.name||a.email||a.phone)?'<div><b>Accountant:</b> '+esc(a.name||'(no name)')+(a.address?'<div class="muted" style="white-space:pre-line">'+esc(a.address)+'</div>':'')+
   (a.phone?'<div>'+esc(a.phone)+' <span class="cl">'+plinks(a.phone)+'</span></div>':'')+(a.email?'<div>'+esc(a.email)+' <span class="cl">'+elinks(a.email)+'</span></div>':'')+'</div><button type="button" class="btn ghost sm" data-accedit="1">Edit accountant</button>'
   :'<div class="muted">No accountant saved yet. Add their name, phone, email and address so the report is addressed to them.</div><button type="button" class="btn sm" data-accedit="1">Add your accountant</button>';
}
function gnMort(c,from,to){
  var pay=+c.mortPayment||0;if(!(pay>0))return {rows:[],tot:0,est:0};
  var day=Math.min(31,Math.max(1,Math.round(+c.mortDay||1))),rows=[],f=pd(from),t=pd(to),y=f.getFullYear(),m=f.getMonth();
  while(y<t.getFullYear()||(y===t.getFullYear()&&m<=t.getMonth())){var last=new Date(y,m+1,0).getDate(),d=y+'-'+String(m+1).padStart(2,'0')+'-'+String(Math.min(day,last)).padStart(2,'0');if(d>=from&&d<=to)rows.push({date:d,amount:pay});m++;if(m>11){m=0;y++}}
  var bal=+c.mortBalance||0,rate=+c.mortRate||0,io=c.mortMethod==='interest-only',r=rate/1200,today=iso(TODAY);
  if(bal>0&&rate>0){
    if(io)rows.forEach(function(x){x.i=r2(Math.min(bal*r,pay))});
    else{var past=rows.filter(function(x){return x.date<=today}),fut=rows.filter(function(x){return x.date>today}),B=bal;
      for(var k=past.length-1;k>=0;k--){var Bp=(B+pay)/(1+r);past[k].i=r2(Math.min(Bp*r,pay));B=Bp}
      B=bal;fut.forEach(function(x){x.i=r2(Math.min(B*r,pay));B=B*(1+r)-pay})}
  }else rows.forEach(function(x){x.i=io?pay:null});
  var est=r2(rows.reduce(function(a,x){return a+(x.i||0)},0));
  return {rows:rows,tot:r2(pay*rows.length),est:est,method:c.mortMethod||'',rate:rate,bal:bal,lender:c.btlLender||''};
}
function gnData(from,to,ids){
  var props=cases.filter(function(c){return c.stage!=='lost'&&(!ids||ids.indexOf(c.id)>-1)}).sort(function(a,b){return names(a).localeCompare(names(b))});
  return props.map(function(c){
    var rent=[];tnList(c).forEach(function(tn){(tn.rentLog||[]).forEach(function(r){if(r.status!=='paid')return;var d=r.paidDate||r.due;if(!d||d<from||d>to)return;rent.push({date:d,due:r.due,who:tnNames(tn),amount:+r.amount||0})})});
    rent.sort(function(a,b){return a.date<b.date?-1:1});
    var ex=((c.expenses)||[]).filter(function(e){return e.date&&e.date>=from&&e.date<=to}).sort(function(a,b){return a.date<b.date?-1:1});
    var rt=rent.reduce(function(a,r){return a+r.amount},0),et=ex.reduce(function(a,e){return a+(+e.amount||0)},0);
    return {c:c,rent:rent,ex:ex,rt:r2(rt),et:r2(et),mo:gnMort(c,from,to)};
  });
}
function gnTotals(rows){var cats={};rows.forEach(function(p){p.ex.forEach(function(e){cats[e.cat||'Other']=r2((cats[e.cat||'Other']||0)+(+e.amount||0))})});
  var s=function(f){return r2(rows.reduce(function(a,p){return a+f(p)},0))},rt=s(function(p){return p.rt}),et=s(function(p){return p.et}),mt=s(function(p){return p.mo.tot}),me=s(function(p){return p.mo.est});
  return {rt:rt,et:et,mt:mt,me:me,cats:cats,left:r2(rt-et-mt),net:r2(rt-et-me)}}
/* the summary at the top of the report: the four totals, then one line for each property */
var GN_NET='Net rental income (rent less expenses and mortgage interest)';
function gnSumRows(tt){return [['Total rent received',tt.rt],['Total mortgage interest paid'+(tt.me?' (estimated)':''),tt.me],['Total expenses',tt.et],[GN_NET,tt.net]]}
function gnNet(p){return r2(p.rt-p.et-p.mo.est)}
var MORT_NOTE='Mortgage payments are worked out from the monthly payment on each property. Only the interest part of a mortgage counts for tax (as a basic-rate tax credit for individual landlords); capital repayments do not. The interest figure is an estimate from the balance and rate: use your lender’s annual statement for the exact amount.';
function mLabel(mo){return [mo.method==='interest-only'?'Interest only':mo.method==='repayment'?'Repayment':'',mo.lender,mo.rate?mo.rate+'%':''].filter(Boolean).join(' · ')}
function gnHtml(rows,from,to){
  var tt=gnTotals(rows),fin=tt.cats['Mortgage interest and finance costs']||0,a=ACC();
  return '<div class="dpage">'+(okLogo(BIZ.logo)?'<img class="dlogo" src="'+BIZ.logo+'" alt="" style="max-height:50px">':'')+'<div class="dbig" style="margin-top:6px">Rent received and expenses</div><div class="muted">'+esc(bizName()||profA().name||'')+' · '+fd(from)+' to '+fd(to)+'</div>'+
   (a.name?'<div style="margin-top:6px;font-size:12px">Prepared for: <b>'+esc(a.name)+'</b>'+(a.address?', '+esc(a.address.replace(/\n/g,', ')):'')+'</div>':'')+
   '<h4 style="margin:14px 0 4px;color:#2F4A40">Summary</h4><table class="dsum" style="margin:0;min-width:320px">'+gnSumRows(tt).map(function(r,n){return '<tr'+(n===3?' class="dgt"':'')+'><td>'+esc(r[0])+'</td><td>'+gbp(r[1])+'</td></tr>'}).join('')+'</table>'+
   (tt.mt?'<p class="muted" style="font-size:11px;margin:6px 0 0">Total mortgage payments, interest and capital together: '+gbp(tt.mt)+'. Left after expenses and mortgage payments: '+gbp(tt.left)+'.</p>':'')+
   (rows.length>1?'<h4 style="margin:14px 0 4px;color:#2F4A40">Summary by property</h4><table class="dtab"><thead><tr><th>Property</th><th>Rent received</th><th>Mortgage interest</th><th>Expenses</th><th>Net income</th></tr></thead><tbody>'+rows.map(function(p){return '<tr><td>'+esc(names(p.c))+'</td><td>'+gbp(p.rt)+'</td><td>'+gbp(p.mo.est)+'</td><td>'+gbp(p.et)+'</td><td>'+gbp(gnNet(p))+'</td></tr>'}).join('')+'<tr><td><b>Total, '+rows.length+' properties</b></td><td><b>'+gbp(tt.rt)+'</b></td><td><b>'+gbp(tt.me)+'</b></td><td><b>'+gbp(tt.et)+'</b></td><td><b>'+gbp(tt.net)+'</b></td></tr></tbody></table>':'')+
   (tt.mt?'<p class="muted" style="font-size:11px">'+esc(MORT_NOTE)+(fin?' You have also entered '+gbp(fin)+' of mortgage interest as an expense, so check it is not counted twice.':'')+'</p>':fin?'<p class="muted" style="font-size:11px">Includes '+gbp(fin)+' of mortgage interest and finance costs. For individual landlords these get tax relief as a basic-rate tax credit rather than as an expense, so your accountant will treat them separately.</p>':'')+
   (Object.keys(tt.cats).length?'<h4 style="margin:14px 0 4px;color:#2F4A40">Expenses by category</h4><table class="dkv">'+Object.keys(tt.cats).sort().map(function(k){return '<tr><td>'+esc(k)+'</td><td>'+gbp(tt.cats[k])+'</td></tr>'}).join('')+'</table>':'')+
   rows.map(function(p){return '<h4 style="margin:18px 0 4px;color:#2F4A40">'+esc(names(p.c))+'</h4>'+
     '<table class="dtab"><thead><tr><th>Rent received</th><th>Tenant</th><th>For rent due</th><th>Amount</th></tr></thead><tbody>'+(p.rent.length?p.rent.map(function(r){return '<tr><td>'+fd(r.date)+'</td><td>'+esc(r.who)+'</td><td>'+fd(r.due)+'</td><td>'+gbp(r.amount)+'</td></tr>'}).join(''):'<tr><td colspan="4" class="muted">None in this period</td></tr>')+'<tr><td colspan="3"><b>Total rent</b></td><td><b>'+gbp(p.rt)+'</b></td></tr></tbody></table>'+
     '<table class="dtab" style="margin-top:6px"><thead><tr><th>Expense date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead><tbody>'+(p.ex.length?p.ex.map(function(e){return '<tr><td>'+fd(e.date)+'</td><td>'+esc(e.cat||'')+'</td><td>'+esc([e.desc,e.to].filter(Boolean).join(' · '))+'</td><td>'+gbp(e.amount)+'</td></tr>'}).join(''):'<tr><td colspan="4" class="muted">None in this period</td></tr>')+'<tr><td colspan="3"><b>Total expenses</b></td><td><b>'+gbp(p.et)+'</b></td></tr></tbody></table>'+
     (p.mo.rows.length?'<table class="dtab" style="margin-top:6px"><thead><tr><th>Mortgage payment</th><th>Details</th><th>Interest part</th><th>Amount</th></tr></thead><tbody>'+p.mo.rows.map(function(r){return '<tr><td>'+fd(r.date)+'</td><td>'+esc(mLabel(p.mo))+'</td><td>'+(r.i==null?'—':gbp(r.i))+'</td><td>'+gbp(r.amount)+'</td></tr>'}).join('')+'<tr><td colspan="2"><b>Total mortgage payments</b></td><td><b>'+(p.mo.est?gbp(p.mo.est):'—')+'</b></td><td><b>'+gbp(p.mo.tot)+'</b></td></tr></tbody></table>':'')}).join('')+
   '<div class="dfoot">Prepared from the records kept in '+esc((window.MD_CONFIG||{}).appName||'MySimpleDesk')+' on '+fd(iso(TODAY))+'. Check against your bank statements and receipts.</div></div>';
}
function gnPdf(rows,from,to){
  var P=new Pdf(),G=[0.35,0.41,0.47],A=[0.18,0.29,0.25],tt=gnTotals(rows),a=ACC();
  if(okLogo(BIZ.logo)&&BIZ.logoW){var s=Math.min(140/BIZ.logoW,45/BIZ.logoH);P.image(BIZ.logo,BIZ.logoW,BIZ.logoH,40,36,BIZ.logoW*s,BIZ.logoH*s);P.y=36+BIZ.logoH*s+12}
  P.t(40,P.y,'Rent received and expenses',18,true,'l',A);P.y+=24;P.t(40,P.y,(bizName()||profA().name||'')+'  ·  '+fd(from)+' to '+fd(to),10,false,'l',G);P.y+=16;
  if(a.name){wrapT('Prepared for: '+a.name+(a.address?', '+a.address.replace(/\n/g,', '):''),515,9.5).forEach(function(l){P.t(40,P.y,l,9.5);P.y+=12})}
  P.y+=8;
  P.t(40,P.y,'Summary',11,true,'l',A);P.y+=16;
  gnSumRows(tt).forEach(function(r,i){var last=i===3;P.t(40,P.y,r[0],10,last);P.t(420,P.y,gbp(r[1]),10,last,'r');P.y+=15});
  if(tt.mt){wrapT('Total mortgage payments, interest and capital together: '+gbp(tt.mt)+'. Left after expenses and mortgage payments: '+gbp(tt.left)+'.',515,8.5).forEach(function(l){P.t(40,P.y,l,8.5,false,'l',G);P.y+=11})}
  if(rows.length>1){
    var SX=[325,405,470,549],shd=function(p){p.rect(40,p.y,515,16,[0.93,0.95,0.94]);p.t(46,p.y+4,'Property',8.5,true);['Rent received','Mortgage interest','Expenses','Net income'].forEach(function(h,i){p.t(SX[i],p.y+4,h,8.5,true,'r')});p.y+=20};
    P.y+=8;P.need(60);P.t(40,P.y,'Summary by property',11,true,'l',A);P.y+=16;shd(P);
    rows.forEach(function(p){var ls=wrapT(names(p.c),205,9),h=Math.max(1,ls.length)*11+3;P.need(h,shd);ls.forEach(function(l,i){P.t(46,P.y+i*11,l,9)});[p.rt,p.mo.est,p.et,gnNet(p)].forEach(function(v,i){P.t(SX[i],P.y,gbp(v),9,false,'r')});P.y+=h;P.line(40,P.y-2,555)});
    P.need(16);P.t(46,P.y+2,'Total, '+rows.length+' properties',9.5,true);[tt.rt,tt.me,tt.et,tt.net].forEach(function(v,i){P.t(SX[i],P.y+2,gbp(v),9.5,true,'r')});P.y+=20;
  }
  var fin=tt.cats['Mortgage interest and finance costs']||0,note=tt.mt?MORT_NOTE+(fin?' You have also entered '+gbp(fin)+' of mortgage interest as an expense, so check it is not counted twice.':''):fin?'Includes '+gbp(fin)+' of mortgage interest and finance costs. For individual landlords these get tax relief as a basic-rate tax credit rather than as an expense, so your accountant will treat them separately.':'';
  if(note){P.y+=4;wrapT(note,515,8.5).forEach(function(l){P.t(40,P.y,l,8.5,false,'l',G);P.y+=11})}
  var cats=Object.keys(tt.cats).sort();if(cats.length){P.y+=8;P.t(40,P.y,'Expenses by category',11,true,'l',A);P.y+=16;cats.forEach(function(k){P.need(14);P.t(40,P.y,k,9.5);P.t(400,P.y,gbp(tt.cats[k]),9.5,false,'r');P.y+=13})}
  var table=function(head,cols,data,total){
    var hd=function(p){p.rect(40,p.y,515,16,[0.93,0.95,0.94]);head.forEach(function(h,i){p.t(cols[i][0],p.y+4,h,8.5,true,cols[i][1])});p.y+=20};
    P.need(40);hd(P);
    if(!data.length){P.t(46,P.y,'None in this period',9,false,'l',G);P.y+=14}
    data.forEach(function(r){var lines=wrapT(r[2],cols[3][0]-cols[2][0]-60,9),h=Math.max(1,lines.length)*11+3;P.need(h,hd);P.t(cols[0][0],P.y,r[0],9);P.t(cols[1][0],P.y,wrapT(r[1],cols[2][0]-cols[1][0]-8,9)[0]||'',9);lines.forEach(function(l,i){P.t(cols[2][0],P.y+i*11,l,9)});P.t(cols[3][0],P.y,r[3],9,false,'r');P.y+=h;P.line(40,P.y-2,555)});
    P.need(16);P.t(46,P.y+2,total[0],9.5,true);P.t(cols[3][0],P.y+2,total[1],9.5,true,'r');P.y+=20;
  };
  rows.forEach(function(p){
    P.need(80);P.y+=10;wrapT(names(p.c),515,12,true).forEach(function(l){P.t(40,P.y,l,12,true,'l',A);P.y+=15});P.y+=2;
    table(['Rent received','Tenant','For rent due','Amount'],[[46,'l'],[120,'l'],[330,'l'],[549,'r']],p.rent.map(function(r){return [fd(r.date),r.who,fd(r.due),gbp(r.amount)]}),['Total rent',gbp(p.rt)]);
    table(['Expense date','Category','Description','Amount'],[[46,'l'],[120,'l'],[300,'l'],[549,'r']],p.ex.map(function(e){return [fd(e.date),e.cat||'',[e.desc,e.to].filter(Boolean).join(' · '),gbp(e.amount)]}),['Total expenses',gbp(p.et)]);
    if(p.mo.rows.length)table(['Mortgage payment','Details','Interest part','Amount'],[[46,'l'],[150,'l'],[420,'l'],[549,'r']],p.mo.rows.map(function(r){return [fd(r.date),mLabel(p.mo),r.i==null?'-':gbp(r.i),gbp(r.amount)]}),['Total mortgage payments'+(p.mo.est?' (interest part '+gbp(p.mo.est)+')':''),gbp(p.mo.tot)]);
  });
  P.need(30);P.y+=6;wrapT('Prepared from the records kept in '+((window.MD_CONFIG||{}).appName||'MySimpleDesk')+' on '+fd(iso(TODAY))+'. Check against your bank statements and receipts.',515,8).forEach(function(l){P.t(40,P.y,l,8,false,'l',G);P.y+=10});
  return P.bytes('Rent received and expenses · '+fd(from)+' to '+fd(to));
}
function gnCsv(rows){
  var q=function(v){return '"'+csvCell(v).replace(/"/g,'""')+'"'},out=[['Property','Type','Date','Tenant or category','Detail','Amount','Interest part'].map(q).join(',')];
  var tt=gnTotals(rows);gnSumRows(tt).forEach(function(r){out.push([rows.length>1?'All properties':names(rows[0]?rows[0].c:{}),'Summary','',r[0],'',r[1]].map(q).join(','))});
  if(rows.length>1)rows.forEach(function(p){[['Rent received',p.rt],['Mortgage interest paid',p.mo.est],['Expenses',p.et],['Net rental income',gnNet(p)]].forEach(function(r){out.push([names(p.c),'Summary','',r[0],'',r[1]].map(q).join(','))})});
  rows.forEach(function(p){p.rent.forEach(function(r){out.push([names(p.c),'Rent received',r.date,r.who,'For rent due '+r.due,r.amount].map(q).join(','))});p.ex.forEach(function(e){out.push([names(p.c),'Expense',e.date,e.cat||'',[e.desc,e.to].filter(Boolean).join(' - '),e.amount].map(q).join(','))});p.mo.rows.forEach(function(r){out.push([names(p.c),'Mortgage payment',r.date,mLabel(p.mo),'',r.amount,r.i==null?'':r.i].map(q).join(','))})});
  return '﻿'+out.join('\r\n')+'\r\n';
}
function gnHas(r){return gnData(r[0],r[1]).some(function(p){return p.rent.length||p.ex.length})}
function gnOpen(){
  var pre=gnHas(gnRange('lasttax'))||!gnHas(gnRange('thistax'))?'lasttax':'thistax',r=gnRange(pre),props=cases.filter(function(c){return c.stage!=='lost'}).sort(function(a,b){return names(a).localeCompare(names(b))});
  overlay('gnOv','<div class="dhd"><h2>Reports and agreements</h2><button type="button" class="btn ghost" data-gnclose="1">Close</button></div>'+
   '<h3 style="margin:6px 0 4px;font-size:16px">Rent and expenses report</h3>'+
   '<p class="muted" style="margin:4px 0 10px">A report of rent received, expenses and mortgage payments for your accountant. Choose the dates and properties, then download it as a PDF or a spreadsheet (CSV), or email it.</p>'+
   '<div id="gnAcc" class="gnacc"></div>'+
   '<div class="chips" style="margin:0 0 8px">'+[['lasttax','Last tax year'],['thistax','This tax year so far'],['lastcal','Last calendar year'],['thiscal','This calendar year']].map(function(x){return '<button type="button" data-gnr="'+x[0]+'" aria-pressed="'+(x[0]===pre)+'">'+x[1]+'</button>'}).join('')+'</div>'+
   '<div class="grid"><label class="f">From<input id="gn-from" type="date" value="'+r[0]+'"></label><label class="f">To<input id="gn-to" type="date" value="'+r[1]+'"></label></div>'+
   '<div class="grid"><label class="f wide">Report for<select id="gn-mode"><option value="all">All properties, in one report</option><option value="each">All properties, a separate report for each</option>'+props.map(function(c){return '<option value="p:'+esc(c.id)+'">'+esc(names(c))+' only</option>'}).join('')+'</select></label></div>'+
   '<div class="tacbs" id="gnPick"><b>Properties:</b>'+props.map(function(c){return '<label class="tacb"><input type="checkbox" data-gnp="'+esc(c.id)+'" checked> '+esc(names(c))+'</label>'}).join('')+'</div>'+
   '<div class="add" style="margin:10px 0"><button type="button" class="btn ghost" data-gnout="pdf">Download PDF</button><button type="button" class="btn ghost" data-gnout="csv">Download spreadsheet (CSV)</button><button type="button" class="btn ghost" data-gnout="share">Share PDF (phone)</button><button type="button" class="btn" data-gnout="mail">Email to my accountant</button><button type="button" class="btn ghost" data-gnout="print">Print</button></div>'+
   '<div id="gnPrev" class="dcprev" style="position:static;max-height:460px;overflow:auto"></div>'+
   '<div style="margin-top:18px">'+gnAgHtml(props)+'</div>',true);
  gnAccRender();gnAgSync();gnPreview();
}
function gnRead(){var from=($('#gn-from')||{}).value,to=($('#gn-to')||{}).value,mode=($('#gn-mode')||{}).value||'all',ids=mode.indexOf('p:')===0?[mode.slice(2)]:Array.prototype.filter.call(document.querySelectorAll('[data-gnp]'),function(i){return i.checked}).map(function(i){return i.getAttribute('data-gnp')});var rows=gnData(from,to,ids);return {from:from,to:to,ids:ids,rows:rows,mode:mode,each:mode==='each',one:mode!=='all'&&rows.length===1?rows[0].c:null}}
/* the reports to make: one for everything, or one for each property */
function gnParts(g){return g.each?g.rows.map(function(r){return {rows:[r],c:r.c}}):[{rows:g.rows,c:g.one}]}
function gnModeSync(){var m=($('#gn-mode')||{}).value||'all',pk=$('#gnPick');if(pk)pk.style.display=m.indexOf('p:')===0?'none':''}
/* ---------- tenancy and lease agreements, chosen by property (in Generate documents) ----------
   Tenancy agreement: the tenant is a person (assured periodic tenancy). Lease agreement: the tenant is a company (company let, fixed term). */
function gnAgHtml(props){
  return '<fieldset style="margin:6px 0 0"><legend>Tenancy and lease agreements</legend>'+
   '<p class="muted" style="margin:0 0 8px;font-size:12.5px">Choose the kind of agreement and the property. A tenancy agreement is for a tenant who is a person. A lease agreement is for a tenant that is a company, for a fixed term of up to 3 years.</p>'+
   (props.length?'<div class="grid"><label class="f">Agreement<select id="gn-agkind"><option value="tenancy">Tenancy agreement</option><option value="lease">Lease agreement (company tenant)</option></select></label>'+
   '<label class="f">Property<select id="gn-agprop">'+props.map(function(c){return '<option value="'+esc(c.id)+'">'+esc(names(c))+'</option>'}).join('')+'</select></label>'+
   '<label class="f wide">Tenant<select id="gn-agtn"></select></label></div>'+
   '<p class="muted" id="gnAgMsg" style="margin:0 0 8px;font-size:12.5px"></p>'+
   '<div class="add" style="margin:0"><button type="button" class="btn" id="gnAgGo">Create agreement</button></div>':'<p class="muted" style="margin:0">Add a property first.</p>')+'</fieldset>';
}
function gnAgSync(){
  var k=$('#gn-agkind'),p=$('#gn-agprop'),s=$('#gn-agtn'),m=$('#gnAgMsg'),go=$('#gnAgGo');if(!k||!p||!s)return;
  var lease=k.value==='lease',c=cases.filter(function(x){return x.id===p.value})[0],keep=s.value;
  var tns=tnList(c).filter(function(t){return tnCorp(t)===lease}).sort(function(a,b){return ((a.status||'current')==='current'?0:1)-((b.status||'current')==='current'?0:1)});
  var opts=tns.map(function(t){var has=t.agreement&&((t.agreement.kind==='company')===lease);return '<option value="'+esc(t.id)+'">'+esc((tnNames(t)||'Tenant with no name yet')+((t.status||'current')==='current'?'':' (previous tenant)')+(has?' · agreement saved':''))+'</option>'});
  if(!lease)opts.push('<option value="">No tenant yet: start a blank agreement for this property</option>');
  s.innerHTML=opts.join('');if(keep&&tns.some(function(t){return t.id===keep}))s.value=keep;
  var none=lease&&!tns.length;s.disabled=none;if(go)go.disabled=none;
  if(none)s.innerHTML='<option value="">No company tenant on this property</option>';
  if(m)m.textContent=none?'This property has no company tenant. Open the property, add the tenant and set Type of tenant to Corporate tenant, then come back here.':'';
  var t0=tns.filter(function(t){return t.id===s.value})[0],saved=t0?(t0.agreement&&((t0.agreement.kind==='company')===lease)):(!lease&&c&&c.tenancyDoc);
  if(go)go.textContent=(saved?'Open ':'Create ')+(lease?'lease agreement':'tenancy agreement');
}
function gnPreview(){var g=gnRead(),p=$('#gnPrev');if(!p)return;if(!g.from||!g.to||g.from>g.to){p.innerHTML='<p class="muted" style="padding:10px">Choose a start date before the end date.</p>';return}
  var out=[];g.rows.forEach(function(r){(r.c.expenses||[]).forEach(function(e){if(e.date&&(e.date<g.from||e.date>g.to))out.push(e.date)})});out.sort();
  p.innerHTML=(out.length?'<div class="gnwarn">'+out.length+' expense'+(out.length===1?' is':'s are')+' dated outside these dates ('+fd(out[0])+(out.length>1?' to '+fd(out[out.length-1]):'')+'), so '+(out.length===1?'it is':'they are')+' not in this report. Change the dates to include '+(out.length===1?'it':'them')+'.</div>':'')+gnParts(g).map(function(x){return gnHtml(x.rows,g.from,g.to)}).join('<hr style="margin:18px 0;border:0;border-top:2px dashed #D4DBDF">')}
function gnFile(g,ext,c){return 'Rent-and-expenses-'+(c?pfClean(names(c),50).replace(/[\s,]+/g,'-')+'-':'')+g.from+'-to-'+g.to+'.'+ext}
document.addEventListener('click',function(e){
  var t=e.target;if(!t||!t.closest)return;var b;
  if(t.id==='expBtn'){if(!openId){toast('Add the property address first. It saves itself, then try again.');return}patch(openId,collectForm());lastAuto=JSON.stringify(collectForm());expOpen(openId);return}
  if(t.closest('[data-exclose]')||t.id==='exOv'){var pend=(($('#ex-amt')||{}).value||'').trim();if(pend||exEdit){if(!exCommit())return}closeOv('exOv');exEdit=null;return}
  if(t.closest('[data-exadd]')){if(exCommit())setTimeout(function(){expOpen(exCase)},60);return}
  if((b=t.closest('[data-exedit]'))){expOpen(exCase,b.getAttribute('data-exedit'));var f=$('#ex-amt');if(f)f.focus();return}
  if(t.closest('[data-excancel]')){expOpen(exCase);return}
  if((b=t.closest('[data-exdel]'))){if(!b.classList.contains('armed')){b.classList.add('armed');b.textContent='Delete?';return}var c2=cases.filter(function(x){return x.id===exCase})[0];if(c2)patch(c2.id,{expenses:(c2.expenses||[]).filter(function(x){return x.id!==b.getAttribute('data-exdel')})});setTimeout(function(){expOpen(exCase)},60);return}
  if(t.closest('[data-gnopen]')){gnOpen();return}
  if(t.closest('[data-gnclose]')||t.id==='gnOv'){closeOv('gnOv');return}
  if((b=t.closest('[data-gnr]'))){var rg=gnRange(b.getAttribute('data-gnr'));$('#gn-from').value=rg[0];$('#gn-to').value=rg[1];document.querySelectorAll('[data-gnr]').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});gnPreview();return}
  if((b=t.closest('[data-gnout]'))){
    var g=gnRead(),how=b.getAttribute('data-gnout');if(!g.from||!g.to||g.from>g.to){toast('Choose a start date before the end date');return}
    var acc=ACC().email;
    var parts=gnParts(g);if(!parts.length||!g.rows.length){toast('Choose at least one property');return}
    if(g.each&&(how==='share'||how==='mail')){toast('To email or share, choose all properties in one report, or one property. Download gives a separate file for each property.');return}
    if(how==='csv'){parts.forEach(function(x,n){setTimeout(function(){var blob=new Blob([gnCsv(x.rows)],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=gnFile(g,'csv',x.c);document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},4000)},n*500)});toast((parts.length>1?parts.length+' spreadsheets saved, one for each property.':'Spreadsheet saved.')+(window.CD_DEMO?' (In the Claude demo, downloads are blocked.)':''));return}
    if(how==='print'){printHtml(parts.map(function(x){return gnHtml(x.rows,g.from,g.to)}).join('<div style="page-break-after:always"></div>'));return}
    if(how==='pdf'){parts.forEach(function(x,n){setTimeout(function(){fileOut(gnPdf(x.rows,g.from,g.to),gnFile(g,'pdf',x.c),'dl')},n*500)});if(parts.length>1)toast(parts.length+' PDFs, one for each property. If only one arrives, allow multiple downloads in your browser.');return}
    if(how==='share'){fileOut(gnPdf(g.rows,g.from,g.to),gnFile(g,'pdf',g.one),'share');return}
    if(how==='mail'){
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acc)){toast('Add your accountant’s email address first');accOpen(true);return}
      var tt=gnTotals(g.rows),txt='Hello'+(ACC().name?' '+ACC().name:'')+',\n\nPlease find attached my rent received and expenses from '+fd(g.from)+' to '+fd(g.to)+'.\n\nRent received: '+gbp(tt.rt)+'\nExpenses: '+gbp(tt.et)+(tt.mt?'\nMortgage payments: '+gbp(tt.mt):'')+'\n\nThank you,\n'+(profA().name||bizName()||'');
      if(!(window.CD_mail&&window.CD_mail.on())){window.location.href='mailto:'+acc+'?subject='+encodeURIComponent('Rent and expenses '+fd(g.from)+' to '+fd(g.to))+'&body='+encodeURIComponent(txt.replace(/\n/g,'\r\n')+'\r\n\r\n(Please attach the PDF you downloaded.)');return}
      b.disabled=true;b.textContent='Sending…';
      window.CD_mail.send({to:[acc],subject:'Rent and expenses '+fd(g.from)+' to '+fd(g.to),text:txt,name:gnFile(g,'pdf',g.one),bytes:gnPdf(g.rows,g.from,g.to)}).then(function(){b.disabled=false;b.textContent='Email to my accountant';toast('Report emailed to '+acc+(window.CD_DEMO?' (demo: nothing was really sent)':''))},function(err){b.disabled=false;b.textContent='Email to my accountant';toast(err&&err.perm?'Permission to send email was removed. Turn emailing on again in Settings.':'Could not send the email. Try again.')});
      return;
    }
  }
  if(t.closest('[data-accedit]')){accOpen(!!$('#gnOv'));return}
  if(t.closest('[data-accclose]')||t.id==='accOv'){closeOv('accOv');return}
  if((b=t.closest('[data-accsave]'))){accSave(b.getAttribute('data-accsave'));return}
  if(t.closest('[data-bookappt]')){apOpen(null,iso(TODAY));return}
  if(t.id==='saveCloseBtn'){saveCase();return}
});
document.addEventListener('input',function(e){var t=e.target;if(t&&t.closest&&t.closest('#gnOv')&&(t.id==='gn-from'||t.id==='gn-to'))gnPreview()});
document.addEventListener('change',function(e){var t=e.target;if(t&&t.closest&&t.closest('#gnOv')){if(/^gn-ag/.test(t.id||'')){gnAgSync();return}gnModeSync();gnPreview()}});
document.addEventListener('click',function(e){var t=e.target&&e.target.closest?e.target.closest('#gnAgGo'):null;if(!t)return;e.preventDefault();var p=$('#gn-agprop'),s=$('#gn-agtn');if(p&&p.value)taOpen(p.value,(s&&s.value)||null)});

/* rent not paid by its due date: add a task to contact the tenant; tick it off when the rent is marked paid */
var rtBusy=false;
function rtSweep(){
  if(!T||!T.tenancyMode||!col||rtBusy)return;var today=iso(TODAY);
  cases.forEach(function(c){
    if(c.stage==='lost')return;var tasks=(c.tasks||[]).slice(),made=Object.assign({},c.rtMade||{}),changed=false;
    tnList(c).forEach(function(tn){
      (tn.rentLog||[]).forEach(function(r){
        var ref='rent:'+tn.id+':'+r.id,ex=tasks.filter(function(x){return x.ref===ref})[0];
        if(r.status==='paid'){if(ex&&!ex.done){tasks=tasks.map(function(x){return x===ex?Object.assign({},x,{done:true,doneAt:Date.now()}):x});changed=true}return}
        if(tn.status!=='current'||!r.due||r.due>=today||ex||made[ref])return;made[ref]=today;
        var who=(tn.people||[]).filter(function(p){return p.name}),ph=who.map(function(p){return p.phone}).filter(Boolean)[0]||'';
        tasks.push({id:uid(),ref:ref,text:'Contact '+(who.map(function(p){return p.name}).join(' & ')||'the tenant')+(ph?' ('+ph+')':'')+' to remind them to pay the rent of '+gbp(+r.amount||+tn.rent||0)+' that was due '+fd(r.due),due:today,time:'',done:false,created:Date.now(),pri:true,auto:'rent'});changed=true;
      });
    });
    if(changed){rtBusy=true;patch(c.id,{tasks:tasks,rtMade:made}).then(function(){rtBusy=false},function(){rtBusy=false})}
  });
}
/* mortgage: split the monthly payment into interest and capital */
function mortSplit(bal,rate,pay,method){bal=+bal||0;rate=+rate||0;pay=+pay||0;if(!(bal>0&&rate>0))return null;var i=r2(bal*rate/1200);if(method==='interest-only')return {i:i,c:0};return {i:pay?Math.min(i,pay):i,c:pay?r2(Math.max(0,pay-i)):0}}
function mcRender(){
  if(!T||!T.tenancyMode)return;var m=$('#f-mortMethod');if(!m)return;var f=m.closest('.f')||m.parentNode,box=$('#mortCalc');
  if(!box){box=document.createElement('div');box.id='mortCalc';box.className='mortcalc';var g=f.parentNode;g.insertBefore(box,f.nextSibling)}
  var v=function(k){var e=$('#f-'+k);return e?e.value:''},s=mortSplit(v('mortBalance'),v('mortRate'),v('mortPayment'),m.value),pay=+v('mortPayment')||0;
  if(!s){box.innerHTML='<span class="muted">Add the balance and interest rate to see how much of each payment is interest.</span>';return}
  box.innerHTML=m.value==='interest-only'?'Interest only: about <b>'+gbp(s.i)+'</b> a month is interest'+(pay&&Math.abs(pay-s.i)>1?' (your payment is '+gbp(pay)+')':'')+'.'
   :'Interest part: about <b>'+gbp(s.i)+'</b> a month'+(pay?', capital repaid about <b>'+gbp(s.c)+'</b>':'')+'. '+(m.value?'':'Choose the payment method. ')+'<span class="muted">Worked out from the balance and rate; the interest part falls a little each month as the balance goes down.</span>';
}
document.addEventListener('input',function(e){var t=e.target;if(t&&/^f-mort(Rate|Balance|Payment|Method)$/.test(t.id||''))mcRender()});
document.addEventListener('change',function(e){var t=e.target;if(t&&t.id==='f-mortMethod')mcRender()});
/* ---------- start ---------- */
render();
claude.use('db').then(function(d){
  db=d;
  if(!db){render();return}
  col=db.collection('cases');
  nbCol=db.collection('notebook');
  apCol=db.collection('appointments');
  mkCol=db.collection('marketing');
  setCol=db.collection('settings');var tradeSeen=false;setCol.onSnapshot(bizSnap,function(){});
  setCol.onSnapshot(function(s){var d0=s.docs.filter(function(x){return x.id==='trade'})[0],tid=d0&&d0.data().trade;if(!tid||!window.CD_TRADES.all[tid])return;tradeSeen=true;if(window.CD_TRADES.only)return;var ov=$('#tpOv');if(ov&&!window.CD_tradeChosen())ov.remove();if(tid!==T.id||!window.CD_tradeChosen()){window.CD_tradeSet(tid);if(openId!==undefined)closeDrawer();applyTrade();render();renderSide()}});
  (window.CD_firstPull||Promise.resolve()).then(function(){if(tradeSeen)return;if(window.CD_tradeChosen())write('set-trade',function(){return setCol.doc('trade').set({trade:T.id,updatedAt:Date.now()})});else openTradePicker(true)});
  mkCol.onSnapshot(function(s){var d=s.docs.filter(function(x){return x.id==='contacts'})[0];mkItems=(d&&d.data().items)||[];var dm=s.docs.filter(function(x){return x.id==='messages'})[0];mkMsgsDoc=(dm&&dm.data().items)||null;if(view==='marketing'&&!$('#mkOv')&&!mkMsgEdit)mkList()});
  apCol.onSnapshot(function(s){appts=s.docs.map(function(x){return Object.assign({id:x.id},x.data())});if(view==='appointments'&&!$('#apOv'))render();if(view==='tasks'&&!$('#apOv')){var hc2=$('#homeCal');if(hc2)hc2.innerHTML=apHome()}var na=$('#nextAppt');if(na&&openId)na.innerHTML=apNextHtml(openId);renderNav()},function(){});
  nbCol.onSnapshot(function(s){var all=s.docs.map(function(x){return Object.assign({id:x.id},x.data())}),tp=all.filter(function(x){return x.id==='bday-template'})[0];bdCfg=tp?(tp.messages&&tp.messages.length?{messages:tp.messages,signature:tp.signature!=null?tp.signature:''}:(tp.text?{messages:[tp.text],signature:''}:{messages:null,signature:null})):{messages:null,signature:null};bdCfg.islamic=(tp&&tp.islamic&&tp.islamic.length)?tp.islamic:null;var gdoc=all.filter(function(x){return x.id==='bday-gender'})[0];bdGen=(gdoc&&gdoc.map)||{};notes=all.filter(function(x){return x.id!=='bday-template'&&x.id!=='bday-gender'});if(view==='notebook')renderNotebook();if(view==='birthdays'){var a2=document.activeElement;if(!(a2&&a2.id==='bdTplText')){bdTplRender();bdRender()}}},function(){});
  col.onSnapshot(function(snap){
    cases=snap.docs.map(function(x){return Object.assign({id:x.id},x.data())});
    loaded=true;
    var ae=document.activeElement;
    var typing=ae&&(ae.id==='q');
    render();if(trayOpen)renderTray();clearTimeout(window.__rt);window.__rt=setTimeout(function(){rtSweep();pfSweep()},400);
    if(typing){var q=$('#q');q.focus&&q.focus()}
    if(openId){var ae2=document.activeElement;if(!(ae2&&(/^(ntText|prText|tkText|ntEdit)$/.test(ae2.id||'')||(ae2.closest&&(ae2.closest('table.nt.xl')||ae2.closest('[data-tkbox]'))))))renderLive()}
  },function(){loaded=true;db=null;render();toast('Lost connection to your saved cases')});
});
})();
