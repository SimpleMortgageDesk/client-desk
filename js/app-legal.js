'use strict';
/* MySimpleDesk app: Quotes and invoices, and the landlord tools: legal to let, repairs, tax checks and rent statements.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- business details, quotes, invoices and tenancy agreements ---------- */
var BIZ={},HOME=null;
function bizSnap(s){var d=s.docs.filter(function(x){return x.id==='business'})[0];BIZ=d?d.data():{};var hd=s.docs.filter(function(x){return x.id==='home'})[0],nh=hd?hd.data():null;if(JSON.stringify(nh)!==JSON.stringify(HOME)){HOME=nh;if(view==='cases'||view==='assets'||view==='myhome')render();renderRem();renderNav()}if(view==='invoices')render();if(T.tenancyMode)renderSide()}
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
  var fl=dzFiles(c,k).slice().reverse(),up=dzCam(k,'Take photo')+'<button type="button" style="'+DZ_BTN+'" data-dzup="'+esc(k)+'">Upload</button>';
  if(!fl.length)return up;
  var lk=function(f,t){return '<a href="'+esc(f.url)+'" target="_blank" rel="noopener" title="'+esc(f.name)+'">'+esc(t)+'</a>'};
  var dl=function(f){return '<button type="button" style="'+DZ_BTN+';color:#8a98a3" data-dzrm="'+esc(f.id)+'">Delete</button>'};
  if(fl.length===1)return up+lk(fl[0],'Show')+dl(fl[0]);
  return up+'<details style="flex:1 1 100%;order:2"><summary style="cursor:pointer;font-weight:600;color:var(--accent)">Show ('+fl.length+' documents)</summary><div style="display:flex;flex-direction:column;gap:4px;margin:6px 0 2px">'+fl.map(function(f){return '<span style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">'+lk(f,f.name)+dl(f)+'</span>'}).join('')+'</div></details>';
}
/* a second upload for the same item asks first: keep the old documents as well, or replace them */
var lgPend=null;
function lgAsk(k,file,cam){
  var c=currentCase(),n=dzFiles(c,k).length,w=window.CD_files.where(),bin=w==='Google Drive'?'Google Drive bin':w+' recycle bin';
  lgPend={k:k,file:file,cam:cam};
  overlay('lgAskOv','<h2>A document is already saved here</h2><p style="margin:0 0 14px">You are uploading <b>'+esc(file.name)+'</b>. What should happen to the '+(n>1?n+' documents':'document')+' already saved?</p>'+
   '<div style="display:flex;flex-direction:column;gap:10px">'+
   '<button type="button" class="btn" data-lgask="keep" style="text-align:left;white-space:normal">Keep old and add this one<br><span style="font-weight:400;font-size:12.5px">Both stay in the property folder. The new one is saved with its date in the name.</span></button>'+
   '<button type="button" class="btn ghost" data-lgask="replace" style="text-align:left;white-space:normal">Replace the old '+(n>1?'documents':'document')+'<br><span style="font-weight:400;font-size:12.5px">The old '+(n>1?'ones move':'one moves')+' to your '+esc(bin)+'.</span></button>'+
   '<button type="button" class="btn ghost" data-lgask="cancel">Cancel</button></div>');
}
document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest?e.target.closest('[data-lgask]'):null;if(!t)return;
  e.preventDefault();var m=t.getAttribute('data-lgask'),p=lgPend;lgPend=null;closeOv('lgAskOv');
  if(p&&m!=='cancel')dzSend(p.k,p.file,m,p.cam);
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
