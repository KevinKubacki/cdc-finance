
var $=function(i){return document.getElementById(i)};
var C={ent:{n:'Compte entreprise',v:'var(--c-ent)'},liv:{n:'Livret A',sub:'part Canins des Champs',v:'var(--c-liv)'},esp:{n:'Espèces maison',v:'var(--c-esp)'}};
var KEYS=['ent','liv','esp'];
function pad2(n){return n<10?'0'+n:''+n}
function todayISO(){var d=new Date();return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())}
var TODAY=todayISO();
var VERSION='2.0';
var DEF_DATE='2026-08-31';
var S={
  initDate:DEF_DATE,init:{ent:0,liv:0,esp:0},deps:[],sorties:[],exps:[],noauto:[],bk:{ok:'',cls:{},rules:{},keep:[]},
  open:{},goalOn:false,goal:1800,view:'home',
  prov:true,gopen:{out:true,in:true,dx:false,bal:false},fa:null,fb:null,years:[],sel:null,regOpen:false,setupOpen:false
};
var M=null;
function uid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

/* ---------- Filtres enregistrés sur l'appareil ---------- */
var FK='cdcfin.filtres';
function loadF(){try{var o=JSON.parse(localStorage.getItem(FK)||'null');if(o){S.prov=o.prov!==false;if(o.gopen){S.gopen={out:o.gopen.out!==false,in:o.gopen.in!==false,dx:!!o.gopen.dx,bal:!!o.gopen.bal}}else if(o.bal){S.gopen.bal=true};S.fa=o.fa||null;S.fb=o.fb||null;S.years=o.years||[];S.regOpen=!!o.regOpen}}catch(e){}}
function saveF(){try{localStorage.setItem(FK,JSON.stringify({prov:S.prov,gopen:S.gopen,fa:S.fa,fb:S.fb,years:S.years,regOpen:S.regOpen}))}catch(e){}}
function resetF(){S.prov=true;S.fa=null;S.fb=null;S.years=[];S.sel=null;S.regOpen=false;saveF();renderSyn();toast('Filtres réinitialisés')}
loadF();

/* ---------- Annuler / rétablir ---------- */
var UNDO=[],REDO=[],lastKey=null,lastT=0,tmr=null;
function snap(){return JSON.stringify({i:S.init,d:S.initDate,dp:S.deps,so:S.sorties,ex:S.exps,g:S.goal,go:S.goalOn,na:S.noauto,bk:S.bk})}
function restore(js){var o=JSON.parse(js);S.init=o.i;S.initDate=o.d;S.deps=o.dp;S.sorties=o.so;S.exps=o.ex;S.goal=o.g;S.goalOn=o.go;S.noauto=o.na||[];S.bk=o.bk||{ok:'',cls:{},rules:{},keep:[]}}
function hist(label,key){
  var now=Date.now();
  if(key&&key===lastKey&&now-lastT<2000){lastT=now;return}
  UNDO.push({s:snap(),l:label});if(UNDO.length>100)UNDO.shift();
  REDO.length=0;lastKey=key||null;lastT=now;updHist();
}
function updHist(){
  var u=$('b-undo'),r=$('b-redo');
  if(UNDO.length)u.classList.remove('off');else u.classList.add('off');
  if(REDO.length)r.classList.remove('off');else r.classList.add('off');
}
function toast(t,act){
  var e=$('toast');e.textContent=t;e.classList.toggle('act',!!act);
  if(act){var b=document.createElement('button');b.type='button';b.textContent=act.l;b.onclick=function(){e.classList.remove('on');act.f()};e.appendChild(b)}
  e.classList.add('on');
  clearTimeout(tmr);tmr=setTimeout(function(){e.classList.remove('on')},act?6000:2200);
}
function afterHist(msg,act){
  if(!$('modal').hidden)closeM();
  if(S.bk.ok&&BK)bankApply();
  lastKey=null;refresh();
  if(S.view==='set')renderSet();
  updHist();toast(msg,act);
}
function undo(){
  if(!UNDO.length){toast('Rien à annuler');return}
  var e=UNDO.pop();REDO.push({s:snap(),l:e.l});restore(e.s);afterHist('Annulé : '+e.l,{l:'Rétablir',f:redo});
}
function redo(){
  if(!REDO.length){toast('Rien à rétablir');return}
  var e=REDO.pop();UNDO.push({s:snap(),l:e.l});restore(e.s);afterHist('Rétabli : '+e.l,{l:'Annuler',f:undo});
}

function num(v){var x=parseFloat(String(v).replace(/\s/g,'').replace(',','.'));return isNaN(x)?0:x}
function eur(n){return Math.round(n).toLocaleString('fr-FR')+' €'}
function cpt(n){var a=Math.abs(n);if(a>=1000){var s=(Math.round(a/100)/10).toString().replace('.',',');return (n<0?'-':'')+s+'k'}return (n<0?'-':'')+Math.round(a)}
function kfmt(n){if(n>=10000)return (Math.round(n/100)/10).toString().replace('.',',')+' k€';return eur(n)}
function fd(i){var p=i.split('-');return p[2]+'/'+p[1]+'/'+p[0]}
function mLabel(k){var p=k.split('-');var s=new Date(+p[0],+p[1]-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});return s.charAt(0).toUpperCase()+s.slice(1)}
function mMY(k){var p=k.split('-');return new Date(+p[0],+p[1]-1,1).toLocaleDateString('fr-FR',{month:'short',year:'numeric'})}
function mAbbr(k){var p=k.split('-');return new Date(+p[0],+p[1]-1,1).toLocaleDateString('fr-FR',{month:'short'}).replace('.','')}
function dot(c){return '<i class="dot" style="background:'+C[c].v+'"></i>'}
function cname(c){return C[c].n+(C[c].sub?' ('+C[c].sub+')':'')}
function sumL(x){var t=0;x.lines.forEach(function(l){t+=l.m});return t}

function bal(){
  var b={ent:S.init.ent,liv:S.init.liv,esp:S.init.esp};
  S.sorties.forEach(function(s){s.lines.forEach(function(l){b[l.c]-=l.m})});
  S.exps.forEach(function(s){s.lines.forEach(function(l){b[l.c]-=l.m})});
  S.deps.forEach(function(d){b[d.c]+=d.m});
  return b;
}
function lastUpd(){var d=S.initDate;S.deps.forEach(function(x){if(x.date>d)d=x.date});return d}
function byMonth(arr){
  var o={},ord=[];
  arr.slice().sort(function(a,b){return a.date<b.date?-1:1}).forEach(function(x){
    var k=x.date.slice(0,7);
    if(!o[k]){o[k]={k:k,total:0,n:0,list:[]};ord.push(k)}
    o[k].list.push(x);o[k].n++;o[k].total+=(x.lines?sumL(x):x.m);
  });
  return ord.map(function(k){return o[k]});
}
function nextMonth(iso){
  var p=iso.split('-');var y=+p[0],m=+p[1]+1;if(m>12){m=1;y++}
  var dim=new Date(y,m,0).getDate(),d=Math.min(+p[2],dim);
  return y+'-'+pad2(m)+'-'+pad2(d);
}
/* Salaire récurrent : la source est le dernier salaire qui contient une ligne récurrente ; le suivant tombe le mois d'après. */
function recSource(){
  var src=null;
  S.sorties.forEach(function(s){
    if(!s.lines.some(function(l){return l.r}))return;
    if(!src||s.date>src.date||(s.date===src.date&&s.id>src.id))src=s;
  });
  return src;
}
function recNext(){
  var src=recSource();if(!src)return null;
  var d=nextMonth(src.date),id='r'+d;
  if(S.noauto.indexOf(id)>=0||S.sorties.some(function(x){return x.id===id}))return null;
  var lines=src.lines.filter(function(l){return l.r}).map(function(l){return {c:l.c,m:l.m,r:true}});
  return {id:id,date:d,lines:lines};
}
function autoRec(){
  var made=0,g=0,n,last='';
  while(g++<48&&(n=recNext())&&n.date<=TODAY){
    /* banque reliée : le virement « Duo Confort » du mois est déjà là → on y ajoute la part récurrente au lieu de créer un 2e salaire */
    var bs=(bankOn()&&S.bk.ok)?S.sorties.filter(function(s){return Math.abs(dDiff(s.date,n.date))<=7&&s.lines.some(function(l){return l.c==='ent'&&l.b})&&!s.lines.some(function(l){return l.r})})[0]:null;
    if(bs){
      n.lines.forEach(function(l){if(l.c==='ent')bs.lines.forEach(function(x){if(x.c==='ent'&&x.b)x.r=true});else bs.lines.push({c:l.c,m:l.m,r:true})});
      last=bs.date;made++;continue;
    }
    S.sorties.push({id:n.id,date:n.date,lines:n.lines});last=n.date;made++;
  }
  if(made){refresh();toast(made>1?made+' salaires récurrents ajoutés':'Salaire récurrent du '+fd(last)+' ajouté')}
  return made;
}

function renderFixed(){
  var b=bal(),t=0;KEYS.forEach(function(k){t+=b[k]});
  var h='<div class="card"><div class="head"><div><div class="lbl">Trésorerie totale</div><div class="total">'+eur(t)+'</div></div>'+
    bankPill()+'</div>';
  KEYS.forEach(function(k){
    var bk=(k==='ent'&&bankOn()),sub=C[k].sub?'<small>'+C[k].sub+'</small>':'';
    if(bk)sub=bankSub();
    h+='<div class="acc"><button class="accb" onclick="openAcct(\''+k+'\')" aria-label="Voir les mouvements : '+C[k].n+'">'+dot(k)+'<div class="nm">'+C[k].n+sub+'</div>'+
      '<span class="amt'+(b[k]<0?' neg':'')+'">'+eur(b[k])+'</span><svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>'+
      (bk?'':'<button class="btn pri sm" onclick="openDep(\''+k+'\')" aria-label="Ajouter un dépôt sur '+C[k].n+'">+ Dépôt</button>')+'</div>';
  });
  h+='</div>'+bankBanner()+'<div class="bgrid"><button class="btn pri big" onclick="openSortie()">Saisir un salaire</button><button class="btn dep big" onclick="openExp()">Dépense ponctuelle</button></div><div class="sec">Derniers mouvements</div>';
  $('fixed').innerHTML=h;
}

function mrow(id,title,cls,amt,open,det){
  return '<div class="mv'+(open?' open':'')+'"><button class="mrow" aria-expanded="'+open+'" onclick="tog(\''+id+'\')"><div class="l"><b>'+title+'</b></div><b class="amt '+cls+'">'+amt+'</b>'+
    '<svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>'+(open?'<div class="det">'+det+'</div>':'')+'</div>';
}
function cnt(n,s,p){return '<p class="cnt">'+n+' '+(n>1?p:s)+' ce mois-ci</p>'}
var HK='cdcfin.accueil',HV={s:true,d:true,x:true};
try{var _h=JSON.parse(localStorage.getItem(HK)||'null');if(_h)HV={s:_h.s!==false,d:_h.d!==false,x:_h.x!==false}}catch(e){}
function togHV(k){HV[k]=!HV[k];try{localStorage.setItem(HK,JSON.stringify(HV))}catch(e){}renderList()}
function hvBar(){
  function cb(k,l){return '<label class="ck"><input type="checkbox"'+(HV[k]?' checked':'')+' onchange="togHV(\''+k+'\')"><span class="bx"></span>'+l+'</label>'}
  return '<div class="ckrow"><span class="ckl">Afficher</span>'+cb('s','Salaires')+cb('d','Dépôts')+cb('x','Dépenses')+'</div>';
}
function renderList(){
  var items=[];
  var sal=byMonth(S.sorties);
  (HV.s?sal:[]).forEach(function(m){
    var id='s:'+m.k,det=cnt(m.n,'sortie','sorties');
    m.list.slice().reverse().forEach(function(s){
      det+='<div class="srt"><div class="l"><div><b>'+fd(s.date)+'</b><span class="amt minus">− '+eur(sumL(s))+'</span></div>'+
        s.lines.map(function(l){return '<div class="muted"><span>'+dot(l.c)+C[l.c].n+(l.r?'<span class="tag">↻ mensuel</span>':'')+(l.b?'<span class="tag bk">⛓ banque</span>':'')+'</span><span>− '+eur(l.m)+'</span></div>'}).join('')+
        '</div><button class="btn sm" onclick="openSortie(\''+s.id+'\')">Modifier</button></div>';
    });
    items.push({d:m.list[m.list.length-1].date,h:mrow(id,'Salaire · '+mLabel(m.k),'minus','− '+eur(m.total),!!S.open[id],det)});
  });
  byMonth(HV.d?S.deps:[]).forEach(function(m){
    var id='d:'+m.k,det=cnt(m.n,'dépôt','dépôts');
    m.list.slice().reverse().forEach(function(d){
      det+='<div class="srt"><div class="l"><div><b>'+fd(d.date)+'</b><span class="amt plus">+ '+eur(d.m)+'</span></div>'+
        '<div class="muted"><span>'+dot(d.c)+(d.t?esc(d.t):C[d.c].n)+(d.b?'<span class="tag bk">⛓</span>':'')+'</span></div></div><button class="btn sm" onclick="openDep(\''+d.c+'\',\''+d.id+'\')">'+(d.b?'Voir':'Modifier')+'</button></div>';
    });
    items.push({d:m.list[m.list.length-1].date,h:mrow(id,'Dépôts · '+mLabel(m.k),'plus','+ '+eur(m.total),!!S.open[id],det)});
  });
  byMonth(HV.x?S.exps:[]).forEach(function(m){
    var id='x:'+m.k,det=cnt(m.n,'dépense','dépenses');
    m.list.slice().reverse().forEach(function(x){
      det+='<div class="srt"><div class="l"><div><b>'+esc(x.label)+(x.b?'<span class="tag bk">⛓</span>':'')+'</b><span class="amt minus">− '+eur(sumL(x))+'</span></div>'+
        '<div class="muted"><span>'+fd(x.date)+'</span></div>'+
        x.lines.map(function(l){return '<div class="muted"><span>'+dot(l.c)+C[l.c].n+'</span><span>− '+eur(l.m)+'</span></div>'}).join('')+
        '</div><button class="btn sm" onclick="openExp(\''+x.id+'\')">Modifier</button></div>';
    });
    items.push({d:m.list[m.list.length-1].date,h:mrow(id,'Dépenses · '+mLabel(m.k),'minus','− '+eur(m.total),!!S.open[id],det)});
  });
  if(HV.s){
    var nx=recNext();
    if(nx){var tt=0;nx.lines.forEach(function(l){tt+=l.m});
      items.push({d:'9999',h:'<div class="mv next"><div class="mrow" style="cursor:default"><div class="l"><b>Prévu le '+fd(nx.date)+'</b><small>↻ salaire récurrent, ajouté automatiquement</small></div><b class="amt minus">− '+eur(tt)+'</b></div></div>'});}
  }
  items.sort(function(a,b){return a.d<b.d?1:-1});
  var empty=!S.deps.length&&!S.sorties.length&&!S.exps.length;
  var msg=empty?'<div class="card welcome"><b>Bienvenue dans CdC Finance</b><p class="note">Commencez par saisir vos soldes de départ (compte entreprise, Livret A, espèces au '+fd(S.initDate)+'), puis ajoutez vos salaires, dépôts et dépenses.</p><button class="btn pri" onclick="S.setupOpen=true;go(\'set\')">Saisir les soldes de départ</button></div>':(items.length?'':'<p class="note" style="text-align:center;padding:14px 0">Rien à afficher : cochez au moins un type.</p>');
  $('scroll').innerHTML=(empty?'':hvBar())+msg+items.map(function(i){return i.h}).join('')+'<p class="note" style="text-align:center;margin-top:6px">Début : soldes saisis au '+fd(S.initDate)+'</p>';
}
function tog(k){S.open[k]=!S.open[k];renderList()}

/* ---------- Synthèse ---------- */
var H=150,PB=34,TOP=40,YW=30;
function synMonths(){
  var map={},keys=[];
  function blank(k){return {k:k,out:0,inn:0,tin:0,dx:0,ob:{ent:0,liv:0,esp:0},ib:{ent:0,liv:0,esp:0},xb:{ent:0,liv:0,esp:0},os:[],is:[],xs:[]}}
  function g(k){if(!map[k]){map[k]=blank(k);keys.push(k)}return map[k]}
  S.sorties.forEach(function(s){var m=g(s.date.slice(0,7));s.lines.forEach(function(l){m.ob[l.c]+=l.m});m.out+=sumL(s);m.os.push({d:s.date,v:sumL(s)})});
  S.deps.forEach(function(d){var m=g(d.date.slice(0,7));m.ib[d.c]+=d.m;m.inn+=d.m;if(d.tr)m.tin+=d.m;m.is.push({d:d.date,v:d.m,c:d.c})});
  S.exps.forEach(function(x){if(x.tr)return;var m=g(x.date.slice(0,7));x.lines.forEach(function(l){m.xb[l.c]+=l.m});m.dx+=sumL(x);m.xs.push({d:x.date,v:sumL(x),t:x.label})});
  if(!keys.length)return [];
  keys.sort();
  var a=keys[0].split('-'),z=keys[keys.length-1].split('-');
  var y=+a[0],mo=+a[1],out=[];
  while(y<+z[0]||(y===+z[0]&&mo<=+z[1])){
    var k=y+'-'+(mo<10?'0'+mo:mo);
    out.push(map[k]||blank(k));mo++;if(mo>12){mo=1;y++}
  }
  return out;
}
function curRange(all){
  var N=all.length,i;
  if(S.years&&S.years.length){
    var fa=-1,fb=-1;
    all.forEach(function(m,j){if(S.years.indexOf(+m.k.slice(0,4))>=0){if(fa<0)fa=j;fb=j}});
    if(fa>=0)return [fa,fb];
  }
  if(S.fa==null||S.fb==null)return [Math.max(0,N-12),N-1];
  var a=N-1,b=0;
  for(i=0;i<N;i++){if(all[i].k>=S.fa){a=i;break}}
  for(i=N-1;i>=0;i--){if(all[i].k<=S.fb){b=i;break}}
  if(a>b){var t=a;a=b;b=t}
  return [a,b];
}
function selMonths(all){
  if(S.years&&S.years.length){
    var f=all.filter(function(m){return S.years.indexOf(+m.k.slice(0,4))>=0});
    if(f.length)return f;
  }
  var r=curRange(all);return all.slice(r[0],r[1]+1);
}
function synW(){return Math.max(240,($('syn-scroll').clientWidth||360)-26)}
function lay(n,Wp){
  if(n<=3)return {cw:56,gap:40,mode:'full',ext:true,vs:1,step:1,padR:44};
  var gap=n<=7?8:(n<=14?4:(n<=40?2:1));
  var cw=Math.floor((Wp-(n-1)*gap)/n);cw=Math.max(2,Math.min(cw,64));
  var mode=cw>=48?'full':(cw>=30?'cmp':'rot');
  return {cw:cw,gap:gap,mode:mode,ext:false,vs:Math.max(1,Math.ceil(11/(cw+gap))),step:Math.max(1,Math.ceil(34/(cw+gap))),padR:0};
}
function niceMax(v,cnt){
  var steps=[50,100,200,250,500,1000,2000,2500,5000,10000,20000,25000,50000,100000],st=steps[steps.length-1];
  for(var i=0;i<steps.length;i++){if(Math.ceil(v/steps[i])<=cnt){st=steps[i];break}}
  return {step:st,max:Math.max(st,Math.ceil(v/st)*st)};
}
function colLabel(m,idx,n,L,st){
  if((n-1-idx)%L.step!==0)return '';
  var yr=m.k.slice(0,4),y=(yr!==st.py)?'<small>'+yr+'</small>':'';
  st.py=yr;
  return '<span class="mlab">'+mAbbr(m.k)+y+'</span>';
}
function vlab(txt,L,idx,n,cls){
  if((n-1-idx)%L.vs!==0)return '';
  return '<span class="v'+(L.mode==='rot'?' rot':'')+(cls?' '+cls:'')+'">'+txt+'</span>';
}
function grad(c){return 'background:'+c+';background:linear-gradient(180deg,color-mix(in srgb,'+c+' 80%,#fff),'+c+')'}
function barChart(ms,segsOf,totOf,vmax,lines,W,sel){
  var n=ms.length,Wp=W-YW,L=lay(n,Wp),cols='',st={py:null};
  var nm=niceMax(vmax,4),AX=nm.max,ch=H+PB+TOP;
  var rad=Math.max(2,Math.min(7,L.cw/2));
  ms.forEach(function(m,idx){
    var segs=segsOf(m),tot=totOf(m),y=0,inner='',ext=[];
    segs.forEach(function(s){
      if(s.v<=0)return;
      var h=s.v/AX*H;
      var lab='';
      if(L.mode==='full'&&h>=17)lab='<span>'+eur(s.v)+'</span>';
      else if(L.mode==='cmp'&&h>=15)lab='<span>'+cpt(s.v)+'</span>';
      inner+='<div class="sg" style="bottom:'+y+'px;height:'+h+'px;'+grad(s.c)+'">'+lab+'</div>';
      if(L.ext&&h<17)ext.push({y:y+h/2,t:eur(s.v),c:s.c});
      y+=h;
    });
    ext.sort(function(a,b){return a.y-b.y});
    var last=-99,eh='';
    ext.forEach(function(e){var p=Math.max(e.y,last+14,7);last=p;eh+='<div class="ex" style="bottom:'+(p-7)+'px"><u style="background:'+e.c+'"></u>'+e.t+'</div>'});
    var vt=tot>0?(L.mode==='full'?eur(tot):cpt(tot)):'';
    cols+='<button class="col'+(sel===m.k?' on':'')+'" style="width:'+L.cw+'px;margin-right:'+(idx<n-1?L.gap:0)+'px" onclick="pick(\''+m.k+'\')" aria-label="'+mLabel(m.k)+' : '+eur(tot)+'">'+
      (vt?vlab(vt,L,idx,n):'')+
      '<div class="stk" style="height:'+y+'px"><div class="fill" style="border-radius:'+rad+'px '+rad+'px 2px 2px">'+inner+'</div>'+eh+'</div>'+colLabel(m,idx,n,L,st)+'</button>';
  });
  var grid='';
  for(var t=0;t<=AX;t+=nm.step){
    var by=PB+t/AX*H;
    grid+=(t>0?'<div class="gl" style="left:'+YW+'px;right:0;bottom:'+by+'px"></div>':'')+'<div class="yl" style="width:'+(YW-5)+'px;bottom:'+(by-7)+'px">'+cpt(t)+'</div>';
  }
  var cw=n*L.cw+(n-1)*L.gap;
  var plot='<div class="plot" style="left:'+YW+'px;right:0;top:0;bottom:'+PB+'px;justify-content:center;padding-right:'+L.padR+'px">'+cols+'</div>';
  return '<div class="chart'+(sel?' hs':'')+'" style="height:'+ch+'px;width:'+W+'px">'+grid+'<div class="base" style="left:'+YW+'px;right:0;bottom:'+PB+'px"></div>'+plot+lines(AX)+'</div>';
}
function balChart(ms,W,sel){
  var n=ms.length,Wp=W-YW,L=lay(n,Wp),st={py:null},Hb=54,LH=30,mid=Hb+LH,PH=2*mid,cols='';
  var mx=1;ms.forEach(function(m){mx=Math.max(mx,Math.abs(m.inn-m.tin-m.out-m.dx))});
  var nm=niceMax(mx,2),AX=nm.max;
  var rad=Math.max(2,Math.min(6,L.cw/2));
  ms.forEach(function(m,idx){
    var d=m.inn-m.tin-m.out-m.dx,h=Math.abs(d)/AX*Hb,pos=d>=0,hh=Math.max(h,2);
    var col=pos?'var(--accent)':'var(--neg-bar)';
    var bar=d===0?'':'<div class="bb" style="'+grad(col)+';height:'+hh+'px;'+(pos?'bottom:'+mid+'px;border-radius:'+rad+'px '+rad+'px 2px 2px':'top:'+(PH-mid)+'px;border-radius:2px 2px '+rad+'px '+rad+'px')+'"></div>';
    var txt=(pos?'+':'−')+(L.mode==='full'?' '+eur(Math.abs(d)):cpt(Math.abs(d)));
    var lab='';
    if(d!==0&&(n-1-idx)%L.vs===0)lab='<span class="v'+(L.mode==='rot'?' rot':'')+' '+(pos?'plus':'minus')+'" style="position:absolute;left:50%;'+(pos?'bottom:'+(mid+h+3)+'px':'top:'+(PH-mid+h+3)+'px')+';transform:'+(L.mode==='rot'?'translateX(-50%) rotate(180deg)':'translateX(-50%)')+';margin:0">'+txt+'</span>';
    cols+='<button class="col'+(sel===m.k?' on':'')+'" style="width:'+L.cw+'px;margin-right:'+(idx<n-1?L.gap:0)+'px" onclick="pick(\''+m.k+'\')" aria-label="'+mLabel(m.k)+' : '+(pos?'+ ':'− ')+eur(Math.abs(d))+'">'+bar+lab+colLabel(m,idx,n,L,st)+'</button>';
  });
  var grid='';
  for(var t=-AX;t<=AX;t+=nm.step){
    var by=PB+mid+t/AX*Hb;
    if(t!==0)grid+='<div class="gl" style="left:'+YW+'px;right:0;bottom:'+by+'px"></div>';
    grid+='<div class="yl" style="width:'+(YW-5)+'px;bottom:'+(by-7)+'px">'+(t>0?'+':'')+cpt(t)+'</div>';
  }
  var plot='<div class="plot" style="left:'+YW+'px;right:0;top:0;bottom:'+PB+'px;justify-content:center;padding-right:'+L.padR+'px">'+cols+'</div>';
  return '<div class="chart'+(sel?' hs':'')+'" style="height:'+(PH+PB)+'px;width:'+W+'px">'+grid+'<div class="base" style="left:'+YW+'px;right:0;bottom:'+PB+'px"></div><div class="zl" style="left:'+YW+'px;right:0;bottom:'+(PB+mid)+'px"></div>'+plot+'</div>';
}
function pick(k){S.sel=(S.sel===k)?null:k;renderSynBody()}
function provChips(by){var t='';KEYS.forEach(function(k){if(by[k]>0)t+='<span class="chip">'+dot(k)+C[k].n+' '+eur(by[k])+'</span>'});return t}
function capHtml(m,kind){
  var t='';
  if(kind==='out'){
    t='<b>'+mLabel(m.k)+'</b><span class="minus">− '+eur(m.out)+'</span>'+(S.prov?provChips(m.ob):'');
  }else if(kind==='in'){
    t='<b>'+mLabel(m.k)+'</b><span class="plus">+ '+eur(m.inn)+'</span>'+(S.prov?provChips(m.ib):'');
  }else if(kind==='dx'){
    t='<b>'+mLabel(m.k)+'</b><span class="minus">− '+eur(m.dx)+'</span>';
    m.xs.forEach(function(x){t+='<span class="chip">'+esc(x.t)+' · '+eur(x.v)+'</span>'});
    if(S.prov)t+=provChips(m.xb);
    if(!m.xs.length)t+='<span class="chip">Aucune dépense</span>';
  }else{
    var d=m.inn-m.tin-m.out-m.dx;
    t='<b>'+mLabel(m.k)+'</b><span class="'+(d>=0?'plus':'minus')+'">'+(d>=0?'+ ':'− ')+eur(Math.abs(d))+'</span><span class="chip">Dépôts '+eur(m.inn-m.tin)+' · Salaires '+eur(m.out)+' · Dépenses '+eur(m.dx)+'</span>';
  }
  return '<div class="cap">'+t+'</div>';
}

function regHtml(ms,tOut,tIn,tDx){
  var paid=ms.filter(function(m){return m.out>0}),np=paid.length;
  var mean=0,sd=0,i;
  paid.forEach(function(m){mean+=m.out});if(np)mean/=np;
  paid.forEach(function(m){sd+=(m.out-mean)*(m.out-mean)});if(np)sd=Math.sqrt(sd/np);
  var cv=mean?sd/mean:0;
  var lvl=np<2?'Trop peu de mois':(cv<0.08?'Très régulier':(cv<0.18?'Plutôt régulier':'Variable'));
  var mn=null,mxm=null;
  paid.forEach(function(m){if(!mn||m.out<mn.out)mn=m;if(!mxm||m.out>mxm.out)mxm=m});
  var none=ms.length-np,multi=ms.filter(function(m){return m.os.length>1}).length;
  var rows='';
  function row(a,b){rows+='<div class="rrow"><span>'+a+'</span><span>'+b+'</span></div>'}
  var phrase='';
  if(np>=2){
    phrase='<p class="note" style="margin-bottom:8px">Vous vous versez en moyenne <b>'+eur(mean)+'</b> par mois, à environ '+eur(sd)+' près.'+
      (cv>=0.18?' Les montants varient beaucoup d\'un mois à l\'autre.':'')+'</p>';
    row('Salaire moyen (mois payés)',eur(mean));
    row('Mois le plus bas',mMY(mn.k)+' · '+eur(mn.out));
    row('Mois le plus haut',mMY(mxm.k)+' · '+eur(mxm.out));
  }else phrase='<p class="note">Choisissez une période d\'au moins deux mois payés pour évaluer la régularité.</p>';
  row('Mois sans salaire',String(none)+' sur '+ms.length);
  row('Versé en plusieurs fois',multi+' mois sur '+ms.length);
  if(paid.length>=6){
    var l3=0,p3=0;
    for(i=0;i<3;i++){l3+=paid[paid.length-1-i].out;p3+=paid[paid.length-4-i].out}
    var dd=(l3-p3)/3;
    row('Tendance (3 derniers mois)',Math.abs(dd)<10?'stable':((dd>0?'+ ':'− ')+eur(Math.abs(dd))+' par mois'));
  }
  if(tDx>0)row('Dépenses ponctuelles',eur(tDx));
  if(tOut+tDx>0)row('Dépôts / sorties totales',Math.round(tIn/(tOut+tDx)*100)+' %');
  if(S.goalOn&&ms.length){var ok=ms.filter(function(m){return m.out>=S.goal}).length;row('Objectif de '+eur(S.goal)+' atteint',ok+' mois sur '+ms.length)}
  var note=(tOut+tDx>0&&tIn<tOut+tDx)?'<p class="note" style="margin-top:8px">Les dépôts sont inférieurs aux sorties sur cette période : la trésorerie baisse.</p>':'';
  return '<details class="card reg" '+(S.regOpen?'open':'')+' ontoggle="S.regOpen=this.open;saveF()"><summary><b>Régularité des salaires</b><span class="pill">'+lvl+'</span></summary>'+phrase+rows+note+'</details>';
}

function yearsOf(all){var ys=[];all.forEach(function(m){var y=+m.k.slice(0,4);if(ys.indexOf(y)<0)ys.push(y)});return ys}
function renderYears(){
  var all=synMonths(),el=$('yrs');if(!el)return;
  el.innerHTML=yearsOf(all).map(function(y){return '<button class="tg" aria-pressed="'+(S.years.indexOf(y)>=0)+'" onclick="togYear('+y+')">'+y+'</button>'}).join('');
}
function renderFilt(){
  var all=synMonths(),N=all.length,r=curRange(all);
  var h='<div class="filt"><div class="frow">'+
    '<button class="tg" aria-pressed="'+S.prov+'" onclick="setF(\'prov\',!S.prov)">Provenance des fonds</button>'+
    '<button class="rst" onclick="resetF()" aria-label="Réinitialiser les filtres"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>Réinitialiser</button></div>'+
    '<div class="frow"><div class="yrs" id="yrs"></div><span class="sp"></span><span class="lbl" id="rg-lbl"></span></div>';
  if(N>1){
    h+='<div class="rng'+(S.years.length?' off':'')+'" id="rng"><div class="trk"></div><div class="selr" id="rg-sel"></div>'+
      '<input type="range" id="rg-a" min="0" max="'+(N-1)+'" step="1" value="'+r[0]+'" oninput="rngIn(\'a\',this.value)" aria-label="Début de la période">'+
      '<input type="range" id="rg-b" min="0" max="'+(N-1)+'" step="1" value="'+r[1]+'" oninput="rngIn(\'b\',this.value)" aria-label="Fin de la période"></div>';
  }
  h+='</div>';
  $('syn-filt').innerHTML=h;
  renderYears();updRange(all,r[0],r[1]);
}
function updRange(all,a,b){
  var N=all.length,lbl=$('rg-lbl'),sel=$('rg-sel');
  if(lbl){
    var ms=selMonths(all);
    lbl.textContent=S.years.length?(ms.length+' mois · '+S.years.join(', ')):(mMY(all[a].k)+' → '+mMY(all[b].k)+' · '+(b-a+1)+' mois');
  }
  if(sel){
    var fa=N>1?a/(N-1):0,fb=N>1?b/(N-1):1;
    sel.style.left='calc(9px + (100% - 18px) * '+fa+')';
    sel.style.width='calc((100% - 18px) * '+(fb-fa)+')';
  }
}
function rngIn(w,v){
  var all=synMonths();
  if(S.years.length){var rr=curRange(all);S.fa=all[rr[0]].k;S.fb=all[rr[1]].k;S.years=[]}
  var r=curRange(all),a=r[0],b=r[1];v=+v;
  if(w==='a')a=Math.min(v,b);else b=Math.max(v,a);
  $('rg-a').value=a;$('rg-b').value=b;
  S.fa=all[a].k;S.fb=all[b].k;
  var rg=$('rng');if(rg)rg.classList.remove('off');
  renderYears();updRange(all,a,b);saveF();renderSynBody();
}
function togYear(y){
  var i=S.years.indexOf(y);
  if(i>=0)S.years.splice(i,1);else{S.years.push(y);S.years.sort()}
  saveF();
  var all=synMonths(),r=curRange(all),a=$('rg-a'),b=$('rg-b'),rg=$('rng');
  if(a&&b){a.value=r[0];b.value=r[1]}
  if(rg){if(S.years.length)rg.classList.add('off');else rg.classList.remove('off')}
  renderYears();updRange(all,r[0],r[1]);renderSynBody();
}
function togG(k){S.gopen[k]=!S.gopen[k];saveF();renderSynBody()}
function setF(k,v){S[k]=v;saveF();renderFilt();renderSynBody()}

function renderSyn(){
  var all=synMonths();
  if(!all.length){$('syn-kpi').innerHTML='';$('syn-filt').innerHTML='';$('syn-scroll').innerHTML='<div class="card"><p class="note">Pas encore de mouvements. Saisissez un salaire ou un dépôt depuis l\'accueil.</p></div>';return}
  renderFilt();renderSynBody();
}
function renderSynBody(){
  var all=synMonths();if(!all.length)return;
  var ms=selMonths(all),W=synW();
  var sel=null;ms.forEach(function(m){if(m.k===S.sel)sel=m.k});
  var capK=sel||ms[ms.length-1].k,capM=ms.filter(function(m){return m.k===capK})[0];
  var tOut=0,tIn=0,tDx=0,tTin=0;ms.forEach(function(m){tOut+=m.out;tIn+=m.inn;tDx+=m.dx;tTin+=m.tin});
  var avg=tOut/ms.length;

  function kt(c,l,v,full){return '<div class="kt '+c+'" title="'+full+'"><span class="kl">'+l+'</span><b>'+v+'</b></div>'}
  $('syn-kpi').innerHTML='<div class="kpi">'+kt('k-avg','Moyenne / mois',kfmt(avg),eur(avg))+kt('k-out','Salaires versés',kfmt(tOut),eur(tOut))+kt('k-in','Dépôts',kfmt(tIn),eur(tIn))+'</div>';

  var mxO=Math.max(avg,1);ms.forEach(function(m){mxO=Math.max(mxO,m.out)});
  if(S.goalOn)mxO=Math.max(mxO,S.goal);
  var segO=function(m){return S.prov?KEYS.map(function(k){return {v:m.ob[k],c:C[k].v}}):[{v:m.out,c:'var(--tone-out)'}]};
  var linesO=function(AX){
    var s='<div class="hl a" style="left:'+YW+'px;right:0;bottom:'+(PB+avg/AX*H)+'px"></div>';
    if(S.goalOn)s+='<div class="hl g" style="left:'+YW+'px;right:0;bottom:'+(PB+S.goal/AX*H)+'px"></div>';
    return s;
  };
  var mxI=1;ms.forEach(function(m){mxI=Math.max(mxI,m.inn)});
  var segI=function(m){return S.prov?KEYS.map(function(k){return {v:m.ib[k],c:C[k].v}}):[{v:m.inn,c:'var(--accent)'}]};
  var mxX=1;ms.forEach(function(m){mxX=Math.max(mxX,m.dx)});
  var segX=function(m){return S.prov?KEYS.map(function(k){return {v:m.xb[k],c:C[k].v}}):[{v:m.dx,c:'var(--tone-dep)'}]};
  var noLines=function(){return ''};

  var h=sel?'':'<p class="note" style="font-size:12px">Touchez une barre pour voir le détail du mois.</p>';
  function leg(kind){
    var t='';
    if(kind==='bal')t='<span class="chip"><i class="dot" style="background:var(--accent)"></i>Dépôts > sorties</span><span class="chip"><i class="dot" style="background:var(--neg-bar)"></i>Sorties > dépôts</span>';
    else if(S.prov)KEYS.forEach(function(k){t+='<span class="chip">'+dot(k)+C[k].n+'</span>'});
    else{var cc=kind==='out'?'var(--tone-out)':(kind==='in'?'var(--accent)':'var(--tone-dep)');var nn=kind==='out'?'Salaires':(kind==='in'?'Dépôts':'Dépenses');t='<span class="chip"><i class="dot" style="background:'+cc+'"></i>'+nn+'</span>'}
    if(kind==='out'){
      t+='<span class="chip"><i class="ls" style="border-color:var(--tone-avg)"></i>Moyenne '+eur(avg)+' / mois</span>';
      if(S.goalOn)t+='<span class="chip"><i class="ls" style="border-color:var(--c-liv)"></i>Objectif '+eur(S.goal)+'</span>';
    }
    return '<div class="legend">'+t+'</div>';
  }
  function cp(kind){return sel?capHtml(capM,kind):''}
  function gcard(k,title,amtHtml,body){
    var o=!!S.gopen[k];
    return '<div class="card gc'+(o?' open':'')+'"><button class="gh" aria-expanded="'+o+'" onclick="togG(\''+k+'\')"><span class="ctit">'+title+'</span>'+amtHtml+'<svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>'+(o?'<div class="gb">'+body+'</div>':'')+'</div>';
  }
  h+=gcard('out','Salaires versés','<span class="minus">− '+eur(tOut)+'</span>',barChart(ms,segO,function(m){return m.out},mxO,linesO,W,sel)+leg('out')+cp('out'));
  h+=gcard('in','Dépôts de trésorerie','<span class="plus">+ '+eur(tIn)+'</span>',tIn>0?barChart(ms,segI,function(m){return m.inn},mxI,noLines,W,sel)+leg('in')+cp('in'):'<p class="note">Aucun dépôt sur cette période.</p>');
  h+=gcard('dx','Dépenses','<span class="minus">− '+eur(tDx)+'</span>',tDx>0?barChart(ms,segX,function(m){return m.dx},mxX,noLines,W,sel)+leg('dx')+cp('dx'):'<p class="note">Aucune dépense sur cette période.</p>');
  var net=tIn-tTin-tOut-tDx;
  h+=gcard('bal','Balance dépôts − sorties','<span class="'+(net>=0?'plus':'minus')+'">'+(net>=0?'+ ':'− ')+eur(Math.abs(net))+'</span>',balChart(ms,W,sel)+leg('bal')+cp('bal'));
  h+=regHtml(ms,tOut,tIn,tDx);
  $('syn-scroll').innerHTML=h;
}

/* ---------- Réglages ---------- */
function setInit(k,v){hist('Soldes de départ','i-'+k);S.init[k]=num(v);renderFixed()}
function setInitDate(v){if(!v)return;hist('Date de départ');S.initDate=v;$('init-lbl').textContent='au '+fd(v);renderFixed();renderList()}
function setGoalOn(b){hist('Objectif mensuel');S.goalOn=b}
function setGoal(v){hist('Objectif mensuel','goal');S.goal=num(v)}
function syLabel(){
  if(!API)return {t:'Non connecté au Google Sheet',c:'warn'};
  if(!CODE)return {t:'Code d\'accès à saisir',c:'warn'};
  if(SY.err)return {t:'Hors connexion · nouvel essai automatique',c:'warn'};
  if(SY.rev===null)return {t:'Connexion…',c:'wait'};
  if(JSON.stringify(dataObj())!==SY.base||SY.busy)return {t:'Enregistrement…',c:'wait'};
  return {t:'À jour'+(SY.okAt?' · '+new Date(SY.okAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):''),c:'ok'};
}
function paintSync(){
  var l=syLabel(),d=$('sdot');
  if(d){d.className='sdot '+l.c;d.hidden=(l.c==='ok');d.title=l.t}
  var e=$('sy-line');if(e){e.textContent=l.t;e.className='sy '+l.c}
}
var DEFERRED=null,IS_IOS=/iphone|ipad|ipod/i.test(navigator.userAgent),STANDALONE=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone;
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();DEFERRED=e;if(S.view==='set')renderSet();var b=$('lg-inst');if(b)b.hidden=false});
window.addEventListener('appinstalled',function(){DEFERRED=null;if(S.view==='set')renderSet()});
function doInstall(){if(!DEFERRED)return;DEFERRED.prompt();DEFERRED.userChoice.then(function(){DEFERRED=null;if(S.view==='set')renderSet();var b=$('lg-inst');if(b)b.hidden=true})}
function testSync(){
  if(!API){toast('Adresse du script absente (config.js)');return}
  if(!CODE){showLogin();return}
  var t0=Date.now();
  call('ping',[CODE]).then(function(r){
    if(handle(r))return;
    SY.sheetUrl=r.sheetUrl||SY.sheetUrl;toast('Connexion OK · script '+r.version+' · '+(Date.now()-t0)+' ms');if(S.view==='set')renderSet();
  }).catch(function(){toast('Pas de réseau ou script injoignable')});
}
function changeCode(){CODE='';lsSet(LS_CODE,'');showLogin()}
function renderSet(){
  var l=syLabel();
  $('v-set').innerHTML=
   '<div class="card set"><div class="row"><b>Synchronisation</b><span class="sy '+l.c+'" id="sy-line">'+l.t+'</span></div>'+
   '<div class="row2"><button class="btn sm" onclick="testSync()">Tester la connexion</button>'+(SY.sheetUrl?'<a class="btn sm" href="'+SY.sheetUrl+'" target="_blank" rel="noopener">Ouvrir le Google Sheet</a>':'')+(API?'<button class="btn sm" onclick="changeCode()">Changer le code</button>':'')+'</div>'+
   '<p class="note">Chaque modification est enregistrée toute seule dans le Google Sheet, et reprise sur les autres appareils.</p></div>'+
   bankCard()+
   ((DEFERRED&&!STANDALONE)?'<div class="card set"><div class="row"><b>Installer l\'application</b><button class="btn pri sm" onclick="doInstall()">Installer</button></div><p class="note">Ajoute CdC Finance sur l\'écran d\'accueil du téléphone.</p></div>':'')+
   ((IS_IOS&&!STANDALONE)?'<div class="card set"><b>Installer sur iPhone</b><p class="note">Dans Safari : bouton Partager, puis « Sur l\'écran d\'accueil ».</p></div>':'')+
   '<div class="card set"><div class="row"><b>Objectif mensuel</b><label><input type="checkbox" id="goalOn" '+(S.goalOn?'checked':'')+' onchange="setGoalOn(this.checked)" aria-label="Activer l\'objectif mensuel"></label></div>'+
   '<div class="row"><label for="goalAmt" class="muted">Montant visé</label><input type="text" inputmode="decimal" id="goalAmt" value="'+S.goal+'" oninput="setGoal(this.value)"></div>'+
   '<p class="note">Affiche une ligne d\'objectif sur la synthèse et indique chaque mois s\'il est atteint.</p></div>'+
   '<details class="card set" id="set-init"'+(S.setupOpen?' open':'')+'><summary><b>Soldes de départ</b><span class="lbl" id="init-lbl">au '+fd(S.initDate)+'</span></summary>'+
   '<div class="row"><label for="i-date" class="muted">Date du départ</label><input type="date" id="i-date" value="'+S.initDate+'" onchange="setInitDate(this.value)"></div>'+
   KEYS.map(function(k){return '<div class="row"><label for="i-'+k+'">'+dot(k)+C[k].n+(C[k].sub?'<small class="muted"> ('+C[k].sub+')</small>':'')+'</label><input type="text" inputmode="decimal" id="i-'+k+'" value="'+(S.init[k]||'')+'" placeholder="0" oninput="setInit(\''+k+'\',this.value)"></div>'}).join('')+
   '<p class="note">À renseigner une seule fois, au lancement de l\'appli. Les salaires, les dépenses et les dépôts s\'ajoutent ensuite.</p></details>'+
   '<div class="card set ghost"><div class="row"><b>Seuil d\'alerte de trésorerie</b><span class="pill">version suivante</span></div>'+
   '<p class="note">Prévenir quand un compte, ou le total, passe sous un seuil tampon. À calibrer ensemble avec les bilans annuels.</p></div>'+
   '<p class="ver">CdC Finance · V'+VERSION+'</p>';
}

function go(v,pop){
  if(!pop){
    try{
      if(v==='home'){if(history.state&&history.state.v){history.back();return}}
      else if(history.state&&history.state.v){history.replaceState({v:v},'')}
      else history.pushState({v:v},'');
    }catch(e){}
  }
  S.view=v;
  ['home','syn','set','rap'].forEach(function(x){$('v-'+x).hidden=(x!==v);var t=$('t-'+x);if(!t)return;if(x===v)t.setAttribute('aria-current','page');else t.removeAttribute('aria-current')});
  $('b-back').hidden=(v==='home');$('hb').hidden=(v!=='home');
  if(v==='syn')renderSyn();if(v==='set')renderSet();if(v==='rap')renderRap();
}
window.addEventListener('popstate',function(e){
  if(!$('modal').hidden){M=null;BACK=null;ACC=null;$('modal').hidden=true}
  go((e.state&&e.state.v)||'home',true);
});

/* ---------- Fenêtres ---------- */
var BACK=null,ACC=null;
function closeM(){var b=BACK;BACK=null;M=null;$('modal').hidden=true;if(b)openAcct(b,ACC&&ACC.f)}
function closeAcct(){ACC=null;BACK=null;$('modal').hidden=true}
function accEvents(k){
  var ev=[],i=0;
  S.deps.forEach(function(d){if(d.c===k)ev.push({t:'d',id:d.id,date:d.date,m:d.m,lab:d.t||'Dépôt',bk:!!d.b,o:i++})});
  S.sorties.forEach(function(s){s.lines.forEach(function(l){if(l.c===k)ev.push({t:'s',id:s.id,date:s.date,m:-l.m,lab:'Salaire'+(l.r?' · récurrent':''),bk:!!l.b,o:i++})})});
  S.exps.forEach(function(x){x.lines.forEach(function(l){if(l.c===k)ev.push({t:'x',id:x.id,date:x.date,m:-l.m,lab:x.label,bk:!!x.b,o:i++})})});
  ev.sort(function(a,b){return a.date<b.date?-1:(a.date>b.date?1:a.o-b.o)});
  var run=S.init[k];ev.forEach(function(e){run+=e.m;e.bal=run});
  return ev;
}
function openAcct(k,f){
  ACC={k:k,f:f||'all'};M=null;
  var ev=accEvents(k),b=bal()[k];
  var vis=ev.filter(function(e){return ACC.f==='all'||(ACC.f==='in'?e.m>0:e.m<0)}).reverse();
  var rows=vis.map(function(e){
    return '<button class="arow" onclick="accEdit(\''+e.t+'\',\''+e.id+'\')" aria-label="Modifier : '+esc(e.lab)+' du '+fd(e.date)+'">'+
      '<div class="al"><b>'+esc(e.lab)+'</b><small>'+fd(e.date)+(e.bk?' · ⛓ banque':'')+'</small></div>'+
      '<div class="ar"><span class="amt '+(e.m>0?'plus':'minus')+'">'+(e.m>0?'+ ':'− ')+eur(Math.abs(e.m))+'</span><small>solde '+eur(e.bal)+'</small></div>'+
      '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button>';
  }).join('');
  if(ACC.f==='all')rows+='<div class="arow start"><div class="al"><b>Solde de départ</b><small>'+fd(S.initDate)+'</small></div><div class="ar"><span class="amt">'+eur(S.init[k])+'</span></div></div>';
  function tg(id,l){return '<button class="tg" aria-pressed="'+(ACC.f===id)+'" onclick="openAcct(\''+k+'\',\''+id+'\')">'+l+'</button>'}
  $('sheet').innerHTML='<div class="ahead"><div><div class="lbl">'+dot(k)+cname(k)+'</div><div class="total" style="font-size:26px">'+eur(b)+'</div></div>'+
    '<button class="ico" onclick="closeAcct()" aria-label="Fermer" title="Fermer" style="margin:0"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'+
    '<div class="frow">'+tg('all','Tout')+tg('in','Entrées')+tg('out','Sorties')+'<span class="sp"></span>'+((k==='ent'&&bankOn())?'':'<button class="btn pri sm" onclick="accDep(\''+k+'\')">+ Dépôt</button>')+'</div>'+
    '<p class="cnt" style="margin:0">'+vis.length+' mouvement'+(vis.length>1?'s':'')+' · touchez une ligne pour la modifier</p>'+
    '<div class="alist">'+(rows||'<p class="note" style="padding:12px 0">Aucun mouvement.</p>')+'</div>';
  $('modal').hidden=false;
}
function accEdit(t,id){
  BACK=ACC.k;
  if(t==='s')openSortie(id);else if(t==='x')openExp(id);else openDep(null,id);
}
function accDep(k){BACK=k;openDep(k)}
function openSortie(id){
  if(id){var s=S.sorties.filter(function(x){return x.id===id})[0];
    M={kind:'s',id:id,date:s.date,lines:s.lines.map(function(l){var o={c:l.c,m:l.m,r:l.r};if(l.b)o.b=l.b;return o})};M.bank=s.lines.some(function(l){return l.b})}
  else M={kind:'s',id:null,date:TODAY,lines:[{c:'ent',m:0,r:false}]};
  M.del=false;M.err='';drawS();$('modal').hidden=false;
}
function openExp(id){
  if(id){var x=S.exps.filter(function(e){return e.id===id})[0];
    M={kind:'x',id:id,date:x.date,label:x.label,lines:x.lines.map(function(l){return {c:l.c,m:l.m,r:false}}),b:x.b,tr:x.tr};M.bank=!!x.b}
  else M={kind:'x',id:null,date:TODAY,label:'',lines:[{c:'ent',m:0,r:false}]};
  M.del=false;M.err='';drawS();$('modal').hidden=false;
}
function curRec(){return (M.kind==='x'?S.exps:S.sorties).filter(function(x){return x.id===M.id})[0]}
function drawS(){
  var x=M.kind==='x',lockD=!!M.bank,dis=' disabled';
  var h='<h2>'+(x?(M.tr?'Transfert vers le Livret A':(M.id?'Modifier la dépense':'Dépense ponctuelle')):(M.id?'Modifier le salaire':'Saisir un salaire'))+'</h2>'+
   (M.bank?'<p class="note bkn">⛓ '+(x?'Dépense lue à la banque : date et montant fixés par la banque'+(M.tr?'.':', libellé modifiable.'):'Virement lu à la banque : la ligne Compte entreprise est fixée par la banque. Vous pouvez ajouter la part en espèces ou sur le Livret A.')+'</p>':'')+
   '<div class="fld"><label for="m-date" class="lbl">'+(x?'Date de la dépense':'Date du salaire')+'</label><input type="date" id="m-date" value="'+M.date+'" onchange="M.date=this.value"'+(lockD?dis:'')+'></div>'+
   (x?'<div class="fld"><label for="m-lib" class="lbl">Libellé</label><input type="text" id="m-lib" value="'+esc(M.label||'')+'" placeholder="Vétérinaire, matériel, assurance…" oninput="M.label=this.value"'+(M.tr?dis:'')+'></div>':'');
  M.lines.forEach(function(l,i){
    var lk=!!l.b||(x&&M.bank);
    h+='<div class="ln'+(lk?' lk':'')+'"><div class="r"><select aria-label="Compte prélevé" onchange="M.lines['+i+'].c=this.value;upd()"'+(lk?dis:'')+'>'+
      KEYS.map(function(k){return '<option value="'+k+'"'+(l.c===k?' selected':'')+'>'+cname(k)+'</option>'}).join('')+'</select></div>'+
      '<div class="r"><input type="text" inputmode="decimal" placeholder="Montant en €" aria-label="Montant" value="'+(l.m||'')+'" oninput="M.lines['+i+'].m=num(this.value);upd()"'+(lk?dis:'')+'></div>'+
      '<div class="r2">'+(x?'<span>'+(lk?'⛓ banque':'')+'</span>':'<label class="rec"><input type="checkbox" '+(l.r?'checked':'')+' onchange="M.lines['+i+'].r=this.checked"> Salaire récurrent (chaque mois)</label>'+(l.b?'<span class="tag bk">⛓ banque</span>':''))+
      (M.lines.length>1&&!lk?'<button class="btn sm del" onclick="rmLine('+i+')">Retirer</button>':'')+'</div></div>';
  });
  if(M.lines.length<3&&!(x&&M.bank))h+='<button class="btn" onclick="addLine()">+ Prélever aussi sur un autre compte</button>';
  h+='<div class="recap"><div class="lbl">'+(x?'Dépense totale':'Salaire total')+'</div><div class="big" id="m-tot">0 €</div><div id="m-after"></div></div><p class="err" id="m-err">'+M.err+'</p>'+
    '<div class="acts">'+(M.id&&!M.bank?'<button class="btn del" id="m-del" onclick="delS()">Supprimer</button>':'')+'<button class="btn" onclick="closeM()">Annuler</button><button class="btn pri" onclick="saveS()">Enregistrer</button></div>';
  $('sheet').innerHTML=h;upd();
}
function upd(){
  var t=0;M.lines.forEach(function(l){t+=l.m});
  $('m-tot').textContent=eur(t);
  var b=bal();
  if(M.id){curRec().lines.forEach(function(l){b[l.c]+=l.m})}
  M.lines.forEach(function(l){b[l.c]-=l.m});
  $('m-after').innerHTML=KEYS.map(function(k){return '<div class="row"><span>'+C[k].n+' après sortie</span><span class="'+(b[k]<0?'neg':'')+'">'+eur(b[k])+'</span></div>'}).join('');
}
function addLine(){var u=KEYS.filter(function(k){return !M.lines.some(function(l){return l.c===k})})[0]||'ent';M.lines.push({c:u,m:0,r:false});drawS()}
function rmLine(i){M.lines.splice(i,1);drawS()}
function saveS(){
  var t=0,x=M.kind==='x';M.lines.forEach(function(l){t+=l.m});
  if(!M.date){M.err='Choisissez une date.';$('m-err').textContent=M.err;return}
  if(x&&!(M.label||'').trim()){M.err='Indiquez le libellé de la dépense.';$('m-err').textContent=M.err;return}
  if(t<=0){M.err='Saisissez au moins un montant.';$('m-err').textContent=M.err;return}
  var lines=M.lines.filter(function(l){return l.m>0||l.b}).map(function(l){var o={c:l.c,m:l.m,r:!!l.r};if(l.b)o.b=l.b;return o});
  if(x){
    hist(M.id?'modification d\'une dépense':'saisie d\'une dépense');
    lines=lines.map(function(l){return {c:l.c,m:l.m}});
    if(M.id){var e=curRec();e.date=M.date;e.label=M.label.trim();e.lines=lines}
    else S.exps.push({id:uid('x'),date:M.date,label:M.label.trim(),lines:lines});
    S.open['x:'+M.date.slice(0,7)]=true;
  }else{
    hist(M.id?'modification d\'un salaire':'saisie d\'un salaire');
    if(M.id){var s=curRec();s.date=M.date;s.lines=lines}
    else S.sorties.push({id:uid('s'),date:M.date,lines:lines});
    S.open['s:'+M.date.slice(0,7)]=true;
  }
  closeM();refresh();
}
function delS(){
  var b=$('m-del');
  if(!M.del){M.del=true;b.textContent='Confirmer la suppression';return}
  if(M.kind==='x'){hist('suppression d\'une dépense');S.exps=S.exps.filter(function(x){return x.id!==M.id})}
  else{hist('suppression d\'un salaire');var gone=curRec();if(gone&&gone.lines.some(function(l){return l.r})&&S.noauto.indexOf('r'+gone.date)<0)S.noauto.push('r'+gone.date);S.sorties=S.sorties.filter(function(x){return x.id!==M.id})}
  closeM();refresh();
}

function openDep(c,id){
  if(id){var d=S.deps.filter(function(x){return x.id===id})[0];
    if(d.b){M={kind:'d',id:id,ro:true};
      $('sheet').innerHTML='<h2>'+(d.tr?'Transfert depuis le Compte entreprise':'Dépôt lu à la banque')+'</h2>'+
        '<div class="rrow"><span>Date</span><span>'+fd(d.date)+'</span></div><div class="rrow"><span>Compte</span><span>'+cname(d.c)+'</span></div>'+
        '<div class="rrow"><span>Montant</span><span class="plus">+ '+eur2(d.m)+'</span></div>'+(d.t?'<div class="rrow"><span>Libellé</span><span>'+esc(d.t)+'</span></div>':'')+
        '<p class="note bkn">⛓ Vient de la banque : ce mouvement ne se modifie pas.</p><div class="acts"><button class="btn pri" onclick="closeM()">Fermer</button></div>';
      $('modal').hidden=false;return}
    M={kind:'d',id:id,c:d.c,m:d.m,date:d.date}}
  else M={kind:'d',id:null,c:(c==='ent'&&bankOn())?'liv':c,m:0,date:TODAY};
  M.del=false;
  var ks=KEYS.filter(function(k){return !(k==='ent'&&bankOn()&&M.c!=='ent')});
  $('sheet').innerHTML='<h2>'+(id?'Modifier le dépôt':'Ajouter un dépôt')+'</h2>'+
   '<div class="fld"><label class="lbl" for="d-c">Compte</label><select id="d-c" onchange="M.c=this.value">'+ks.map(function(k){return '<option value="'+k+'"'+(M.c===k?' selected':'')+'>'+cname(k)+'</option>'}).join('')+'</select></div>'+
   '<div class="fld"><label class="lbl" for="d-m">Montant déposé</label><input type="text" inputmode="decimal" id="d-m" value="'+(M.m||'')+'" placeholder="Montant en €" oninput="M.m=num(this.value)"></div>'+
   '<div class="fld"><label class="lbl" for="d-d">Date de mise à jour des soldes</label><input type="date" id="d-d" value="'+M.date+'" onchange="M.date=this.value"></div>'+
   '<p class="err" id="m-err"></p><div class="acts">'+(id?'<button class="btn del" id="m-del" onclick="delD()">Supprimer</button>':'')+'<button class="btn" onclick="closeM()">Annuler</button><button class="btn pri" onclick="saveD()">Enregistrer</button></div>';
  $('modal').hidden=false;
}
function saveD(){
  if(M.m<=0||!M.date){$('m-err').textContent='Saisissez un montant et une date.';return}
  hist(M.id?'modification d\'un dépôt':'ajout d\'un dépôt');
  if(M.id){var d=S.deps.filter(function(x){return x.id===M.id})[0];d.c=M.c;d.m=M.m;d.date=M.date}
  else S.deps.push({id:uid('d'),date:M.date,c:M.c,m:M.m});
  S.open['d:'+M.date.slice(0,7)]=true;
  closeM();refresh();
}
function delD(){
  var b=$('m-del');
  if(!M.del){M.del=true;b.textContent='Confirmer la suppression';return}
  hist('suppression d\'un dépôt');
  S.deps=S.deps.filter(function(x){return x.id!==M.id});closeM();refresh();
}
function refresh(){renderFixed();renderList();if(S.view==='syn')renderSyn();if(S.view==='rap')renderRap()}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('modal').hidden)closeM()});
window.addEventListener('resize',function(){if(S.view==='syn')renderSynBody()});

/* ====================== Banque : Compte entreprise relié au Crédit Mutuel ====================== */
/* Règles (validées par Kevin le 31/10/2026) : entrée = dépôt ; sortie = dépense ; virement « Duo Confort » = salaire de Susan ;
   sortie vers le Livret A = transfert (dépense du compte pro + dépôt sur le Livret, hors graphique Dépenses), demandé une fois puis retenu. */
var BK=null,BK_BUSY=false,RP=null,BANK_AFTER=null;
var SAL_RE=/DUO ?CONFORT/;
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function bankOn(){return !!(BK&&BK.linked)}
function r2(n){return Math.round(n*100)/100}
function eur2(n){return r2(n).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €'}
function sgn2(n){return (n>0?'+ ':n<0?'− ':'')+eur2(Math.abs(n))}
function nrmL(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim()}
function ruleKey(s){return nrmL(s).replace(/\b\d+\b/g,' ').replace(/\s+/g,' ').trim().slice(0,80)}
function dDiff(a,b){return Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/864e5)}
function addD(iso,n){return new Date(Date.parse(iso+'T12:00:00Z')+n*864e5).toISOString().slice(0,10)}
function sameM(a,b){return Math.abs(a-b)<0.005}
function when(iso){var d=new Date(iso);if(isNaN(d))return '';var hm=d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});var dd=d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());return dd===todayISO()?'aujourd\'hui '+hm:fd(dd)+' '+hm}
function errTxt(e){return e==='limite'?'Limite de lectures de la banque atteinte':e==='expire'?'Accord bancaire expiré':'Lecture de la banque en erreur'}
function findBy(arr,id){for(var i=0;i<arr.length;i++)if(arr[i].id===id)return arr[i];return null}
function entSum(x){var t=0;x.lines.forEach(function(l){if(l.c==='ent')t+=l.m});return t}

function bkLines(){
  return (BK&&BK.lines||[]).filter(function(l){return l.date>S.initDate}).slice()
    .sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:(a.id<b.id?-1:1)});
}
function bkLinked(){
  var o={};
  S.deps.forEach(function(d){if(d.b)o[d.b]=1});S.exps.forEach(function(x){if(x.b)o[x.b]=1});
  S.sorties.forEach(function(s){s.lines.forEach(function(l){if(l.b)o[l.b]=1})});
  return o;
}
function bkClass(L){
  var c=S.bk.cls[L.id];if(c)return c;
  if(L.amt>0)return 'dep';
  var n=nrmL(L.label);
  if(SAL_RE.test(n))return 'sal';
  var r=S.bk.rules[ruleKey(L.label)];if(r)return r;
  if(/LIVRET/.test(n))return 'ask';
  return 'exp';
}
/* Ce que la banque apporte : rapprochements avec vos saisies, mouvements à créer, questions, saisies sans équivalent à la banque */
function bankPlan(){
  var P={link:[],make:[],ask:[],salNew:[],check:[]};
  if(!BK||!BK.lines)return P;
  var used=bkLinked(),tk={};
  function best(c){c.sort(function(a,b){return a.dd-b.dd});return c[0]||null}
  bkLines().forEach(function(L){
    if(used[L.id])return;
    var c=bkClass(L),a=Math.abs(L.amt),cand=[],m;
    if(c==='ask'){P.ask.push(L);return}
    if(c==='sal'){
      S.sorties.forEach(function(s){s.lines.forEach(function(l,i){var k='s'+s.id+':'+i,d=Math.abs(dDiff(s.date,L.date));
        if(l.c==='ent'&&!l.b&&!tk[k]&&d<=5&&sameM(l.m,a))cand.push({k:k,s:s,i:i,dd:d})})});
      m=best(cand);
      if(!m){S.sorties.forEach(function(s){if(s.id.charAt(0)!=='r')return;s.lines.forEach(function(l,i){var k='s'+s.id+':'+i,d=Math.abs(dDiff(s.date,L.date));
        if(l.c==='ent'&&!l.b&&!tk[k]&&d<=7)cand.push({k:k,s:s,i:i,dd:d})})});m=best(cand)}
      if(m){tk[m.k]=1;P.link.push({L:L,t:'s',id:m.s.id,i:m.i,adj:!sameM(m.s.lines[m.i].m,a),what:'Salaire du '+fd(m.s.date)});return}
      P.salNew.push(L);return;
    }
    if(c==='dep'||c==='liv'){
      var acc=c==='dep'?'ent':'liv';
      S.deps.forEach(function(d){var k='d'+d.id,dd=Math.abs(dDiff(d.date,L.date));if(!d.b&&!d.tr&&d.c===acc&&!tk[k]&&dd<=5&&sameM(d.m,a))cand.push({k:k,id:d.id,dd:dd,date:d.date})});
      m=best(cand);if(m)tk[m.k]=1;
      if(c==='dep'){if(m){P.link.push({L:L,t:'d',id:m.id,what:'Dépôt du '+fd(m.date)});return}P.make.push({L:L,t:'d'});return}
      P.make.push({L:L,t:'l',id:m?m.id:null});return;
    }
    S.exps.forEach(function(x){var k='x'+x.id,d=Math.abs(dDiff(x.date,L.date));if(!x.b&&!tk[k]&&d<=5&&sameM(entSum(x),a))cand.push({k:k,id:x.id,dd:d,lab:x.label,date:x.date})});
    m=best(cand);
    if(m){tk[m.k]=1;P.link.push({L:L,t:'x',id:m.id,what:'Dépense « '+m.lab+' » du '+fd(m.date)});return}
    P.make.push({L:L,t:'x'});
  });
  if(bankOn()){
    var ref=BK.balDate||'';(BK.lines||[]).forEach(function(l){if(l.date>ref)ref=l.date});
    if(BK.last&&BK.last.slice(0,10)>ref)ref=BK.last.slice(0,10);
    if(ref){
      var lim=addD(ref,-4),keep=S.bk.keep;
      var ok=function(key,date){return date>S.initDate&&date<=lim&&keep.indexOf(key)<0};
      S.deps.forEach(function(d){if(d.c==='ent'&&!d.b&&!tk['d'+d.id]&&ok(d.id,d.date))P.check.push({t:'d',id:d.id,key:d.id,date:d.date,amt:d.m,label:'Dépôt saisi'})});
      S.exps.forEach(function(x){var a=entSum(x);if(a>0&&!x.b&&!tk['x'+x.id]&&ok(x.id,x.date))P.check.push({t:'x',id:x.id,key:x.id,date:x.date,amt:a,label:'Dépense saisie « '+x.label+' »'})});
      var usedC={};
      S.sorties.forEach(function(s){s.lines.forEach(function(l,i){if(l.c==='ent'&&!l.b&&!tk['s'+s.id+':'+i]&&ok('s:'+s.id,s.date)){var c={t:'s',id:s.id,key:'s:'+s.id,l:l,date:s.date,amt:l.m,label:'Salaire saisi (part Compte entreprise)'};c.cand=salCand(c,usedC);P.check.push(c)}})});
      P.check.sort(function(a,b){return a.date<b.date?-1:1});
    }
  }
  return P;
}
/* salaire saisi sans virement reconnu : un virement du même montant classé en dépense est peut-être le salaire (libellé différent de « Duo Confort ») */
function salCand(c,usedC){
  var best=null;
  bkLines().forEach(function(L){
    if(L.amt>=0||usedC[L.id]||bkClass(L)!=='exp'||!sameM(-L.amt,c.amt))return;
    var d=Math.abs(dDiff(L.date,c.date));if(d>5)return;
    var e=S.exps.filter(function(x){return x.b===L.id})[0];
    if(e&&e.id!=='b'+L.id)return;
    if(!best||d<best.d)best={L:L,d:d};
  });
  if(best)usedC[best.L.id]=1;
  return best?best.L:null;
}
function linkOne(x){
  var L=x.L;
  if(x.t==='s'){var s=findBy(S.sorties,x.id);if(!s||!s.lines[x.i])return 0;var l=s.lines[x.i];if(x.adj)l.m=Math.abs(L.amt);l.b=L.id;return 1}
  if(x.t==='x'){var e=findBy(S.exps,x.id);if(!e)return 0;e.b=L.id;return 1}
  if(x.t==='d'){var d=findBy(S.deps,x.id);if(!d)return 0;d.b=L.id;if(!d.t)d.t=L.label;return 1}
  return 0;
}
function makeOne(x){
  var L=x.L,a=Math.abs(L.amt),id='b'+L.id;
  if(x.t==='x'){if(findBy(S.exps,id))return 0;S.exps.push({id:id,date:L.date,label:L.label,lines:[{c:'ent',m:a}],b:L.id});return 1}
  if(x.t==='d'){if(findBy(S.deps,id))return 0;S.deps.push({id:id,date:L.date,c:'ent',m:a,b:L.id,t:L.label});return 1}
  if(x.t==='l'){
    if(findBy(S.exps,id))return 0;
    S.exps.push({id:id,date:L.date,label:'Transfert → Livret A',lines:[{c:'ent',m:a}],b:L.id,tr:'liv'});
    var d=x.id?findBy(S.deps,x.id):null;
    if(d){d.b=L.id;if(!d.t)d.t='Transfert depuis le Compte entreprise';d.tr='ent'}
    else if(!findBy(S.deps,'t'+L.id))S.deps.push({id:'t'+L.id,date:L.date,c:'liv',m:a,b:L.id,t:'Transfert depuis le Compte entreprise',tr:'ent'});
    return 1;
  }
  return 0;
}
function makeSal(L){var id='b'+L.id;if(findBy(S.sorties,id))return 0;S.sorties.push({id:id,date:L.date,lines:[{c:'ent',m:Math.abs(L.amt),r:false,b:L.id}]});return 1}
/* une fois le rapprochement validé : tout ce qui est sûr s'applique tout seul (ids déterministes → pas de doublon entre appareils) */
function bankApply(){
  if(!S.bk.ok||!BK)return 0;
  var P=bankPlan(),n=0;
  P.link.forEach(function(x){n+=linkOne(x)});
  P.make.forEach(function(x){n+=makeOne(x)});
  P.salNew.forEach(function(L){n+=makeSal(L)});
  return n;
}
function bankAfter(quiet){
  if(!S.bk.ok||!BK)return;
  var n=bankApply();
  if(n){refresh();if(!quiet)toast(n>1?n+' mouvements de la banque ajoutés':'1 mouvement de la banque ajouté')}
}
function bankTodo(P){P=P||bankPlan();return P.ask.length+P.check.length+(S.bk.ok?0:P.salNew.length)}
function bankOpening(){
  if(!BK||BK.bal==null)return null;
  var lim=BK.balDate||'9999-12-31',inn=0,out=0;
  bkLines().forEach(function(L){if(L.date<=lim){if(L.amt>0)inn+=L.amt;else out+=L.amt}});
  return {bal:BK.bal,date:BK.balDate,inn:r2(inn),out:r2(out),open:r2(BK.bal-inn-out)};
}
function entAt(d){
  var b=S.init.ent;
  S.deps.forEach(function(x){if(x.c==='ent'&&x.date<=d)b+=x.m});
  S.sorties.forEach(function(s){if(s.date<=d)s.lines.forEach(function(l){if(l.c==='ent')b-=l.m})});
  S.exps.forEach(function(x){if(x.date<=d)x.lines.forEach(function(l){if(l.c==='ent')b-=l.m})});
  return r2(b);
}
function bankGap(){if(!bankOn()||!S.bk.ok||BK.bal==null)return 0;return r2(entAt(BK.balDate||TODAY)-BK.bal)}

/* ---------- Accueil ---------- */
function bankPill(){
  if(!bankOn())return '<span class="pill"><i></i>Soldes au '+fd(lastUpd())+'</span>';
  if(BK.err)return '<button class="pill wn" onclick="go(\'set\')"><i></i>'+(BK.err==='expire'?'Accord banque expiré':'Banque : à vérifier')+'</button>';
  return '<span class="pill"><i></i>Banque · '+(BK.last?when(BK.last):'en attente')+'</span>';
}
function bankSub(){
  var g=bankGap();
  if(!S.bk.ok)return '<small class="wn">⛓ Rapprochement à faire</small>';
  if(Math.abs(g)>=0.01)return '<small class="wn">Écart avec la banque : '+sgn2(g)+'</small>';
  return '<small>⛓ Relié à la banque</small>';
}
function bankBanner(){
  if(!BK)return '';
  var out='';
  function bn(t,sub,btn,fn){return '<div class="bkb"><div><b>'+t+'</b>'+(sub?'<small>'+sub+'</small>':'')+'</div><button class="btn sm pri" onclick="'+fn+'">'+btn+'</button></div>'}
  if(bankOn()||(BK.lines&&BK.lines.length)){
    if(!S.bk.ok&&BK.lines&&BK.lines.length)out+=bn('Rapprochement bancaire à faire','Solde de départ et saisies à vérifier une fois.','Commencer',"go('rap')");
    else if(S.bk.ok){var n=bankTodo();if(n)out+=bn(n+' mouvement'+(n>1?'s':'')+' bancaire'+(n>1?'s':'')+' à traiter','','Voir',"go('rap')")}
  }
  if(bankOn()){
    var days=BK.until?dDiff(BK.until,TODAY):999;
    if(BK.err==='expire'||days<0)out+=bn('Accord bancaire expiré','À renouveler pour continuer à lire le compte pro.','Renouveler','bankStart()');
    else if(days<=15)out+=bn('Accord bancaire à renouveler','Valable jusqu\'au '+fd(BK.until)+'.','Renouveler','bankStart()');
  }
  return out;
}

/* ---------- Écran Rapprochement ---------- */
function rpInit(){RP=RP||{open:null,chk:{},sal:{},ask:{}};return RP}
function rpSet(k,id,v){rpInit();if(k==='open')RP.open=v;else RP[k][id]=v;renderRap()}
function rpReady(P){
  rpInit();var first=!S.bk.ok;
  if(first&&RP.open==null)return false;
  if(P.check.some(function(c){return !RP.chk[c.key]}))return false;
  if(first&&P.salNew.some(function(L){return !RP.sal[L.id]}))return false;
  if(P.ask.some(function(L){return !RP.ask[L.id]}))return false;
  return true;
}
function rbox(done,title,right,body){return '<div class="rb '+(done?'ok':'warn')+'"><div class="rbt"><b>'+title+'</b>'+(right||'')+'</div>'+body+'</div>'}
function rbtns(k,id,opts){return '<div class="acts">'+opts.map(function(o,i){return '<button class="btn sm'+(i===0?' pri':'')+'" onclick="rpSet(\''+k+'\',\''+id+'\',\''+o[0]+'\')">'+o[1]+'</button>'}).join('')+'</div>'}
function rdone(k,id,txt){return '<div class="rbt"><span class="small">'+txt+'</span><button class="btn sm" onclick="rpSet(\''+k+'\',\''+id+'\',null)">Modifier</button></div>'}
function renderRap(){
  var el=$('v-rap');if(!el)return;
  if(!BK||!BK.lines){el.innerHTML='<div class="card"><p class="note">Pas encore de données de la banque.</p></div>';return}
  rpInit();
  var P=bankPlan(),first=!S.bk.ok,h='',todo=bankTodo(P);
  if(first){var o0=bankOpening();if(!o0||Math.abs(r2(S.init.ent-o0.open))<0.01)RP.open=RP.open||'keep'}
  h+='<div class="card set"><b class="h">Rapprochement bancaire</b><p class="note">'+(first?'L\'appli compare vos saisies avec le compte pro depuis le '+fd(addD(S.initDate,1))+'. Rien n\'est appliqué avant « Valider ».':'Mouvements de la banque qui demandent votre avis.')+'</p>'+
    '<div class="row2"><span class="pill"><i></i>'+P.link.length+' retrouvé'+(P.link.length>1?'s':'')+'</span>'+(todo?'<span class="pill wn"><i></i>'+todo+' à traiter</span>':'')+'</div></div>';
  if(first)h+=rapOpening();
  var vh='';
  P.check.forEach(function(c){
    var v=RP.chk[c.key];
    vh+=rbox(!!v,c.label+' : '+eur2(c.amt),'<span class="small">'+fd(c.date)+'</span>',
      v?rdone('chk',c.key,v==='link'?'<b>Relié au virement « '+esc(c.cand.label)+' »</b>':v==='del'?'<b>Retiré de l\'appli</b>':'<b>Gardé tel quel</b>')
       :(c.cand?'<p class="note">La banque a un virement du même montant le '+fd(c.cand.date)+' : « '+esc(c.cand.label)+' ». Est-ce ce salaire ?</p>'+rbtns('chk',c.key,[['link','Oui, c\'est ce virement'],['del','Retirer de l\'appli'],['keep','Le garder tel quel']])
        :'<p class="note">Aucun mouvement de ce montant à la banque autour de cette date. Il a peut-être été fait sur un autre compte.</p>'+rbtns('chk',c.key,[['del','Retirer de l\'appli'],['keep','Le garder tel quel']])));
  });
  if(first)P.salNew.forEach(function(L){
    var v=RP.sal[L.id];
    vh+=rbox(!!v,'Virement Duo Confort : '+eur2(-L.amt),'<span class="small">'+fd(L.date)+'</span>',
      v?rdone('sal',L.id,v==='sal'?'<b>Ajouté aux salaires</b>':'<b>Compté comme dépense</b>')
       :'<p class="note">Reçu par Susan mais absent de ses salaires saisis.</p>'+rbtns('sal',L.id,[['sal','Ajouter comme salaire'],['exp','Pas un salaire (dépense)']]));
  });
  if(vh)h+='<div class="sec">À vérifier</div>'+vh;
  var ch='';
  P.ask.forEach(function(L){
    var v=RP.ask[L.id];
    ch+=rbox(!!v,esc(L.label),'<b class="num">'+sgn2(L.amt)+'</b>',
      v?rdone('ask',L.id,'<b>'+(v==='liv'?'Dépôt sur le Livret A':'Dépense')+'</b>')
       :'<p class="note">'+fd(L.date)+' · sortie vers un de vos comptes ? Le choix sera retenu pour ce libellé.</p>'+rbtns('ask',L.id,[['liv','Dépôt sur le Livret A'],['exp','Dépense ponctuelle']]));
  });
  if(ch)h+='<div class="sec">À classer</div>'+ch;
  if(P.link.length)h+='<details class="card set"><summary><b>Retrouvés automatiquement</b><span class="pill">'+P.link.length+'</span></summary>'+
    P.link.map(function(x){return '<div class="rrow"><span>'+esc(x.what)+'<small class="blk">↔ '+esc(x.L.label)+' · '+fd(x.L.date)+(x.adj?' · montant ajusté':'')+'</small></span><span>'+sgn2(x.L.amt)+'</span></div>'}).join('')+'</details>';
  if(first){
    var nd=0,nx=0,nl=0;P.make.forEach(function(x){if(x.t==='d')nd++;else if(x.t==='x')nx++;else nl++});
    if(nd+nx+nl)h+='<p class="note">La banque ajoutera aussi au Compte entreprise '+[nd?nd+' dépôt'+(nd>1?'s':''):'',nx?nx+' dépense'+(nx>1?'s':''):'',nl?nl+' transfert'+(nl>1?'s':'')+' vers le Livret A':''].filter(Boolean).join(', ')+'.</p>';
  }
  if(!first&&!todo&&!P.link.length)h+='<div class="rb ok"><b>Tout est rapproché.</b><p class="note">Les nouveaux mouvements se classent tout seuls ; seuls les cas inconnus demandent un geste.</p></div>';
  var ready=rpReady(P);
  if(first||todo)h+='<button class="btn pri big" id="rp-ok" '+(ready?'':'disabled ')+'onclick="rapValidate()">'+(ready?'Valider le rapprochement':'Traitez les points ci-dessus pour valider')+'</button>';
  el.innerHTML=h;
}
function rapOpening(){
  var o=bankOpening(),h='<div class="card set"><b>Solde de départ du Compte entreprise</b>';
  if(!o)return h+'<p class="note">Le solde de la banque n\'est pas encore lu : le solde de départ saisi ('+eur2(S.init.ent)+') est gardé.</p></div>';
  var diff=r2(S.init.ent-o.open);
  h+='<div class="eq"><span>Solde à la banque'+(o.date?' au '+fd(o.date):'')+'</span><b class="num">'+eur2(o.bal)+'</b>'+
    '<span class="muted">Entrées depuis le '+fd(addD(S.initDate,1))+'</span><span class="num muted">'+sgn2(o.inn)+'</span>'+
    '<span class="muted">Sorties depuis le '+fd(addD(S.initDate,1))+'</span><span class="num muted">'+sgn2(o.out)+'</span>'+
    '<span class="tot">Solde au '+fd(S.initDate)+' (calculé)</span><span class="tot num">'+eur2(o.open)+'</span></div>';
  if(Math.abs(diff)<0.01)return h+'<div class="rb ok"><span class="small">Le solde saisi ('+eur2(S.init.ent)+') correspond à la banque.</span></div></div>';
  h+='<div class="rb '+(RP.open?'ok':'warn')+'"><div class="rbt"><span>Saisi à la main</span><b class="num">'+eur2(S.init.ent)+'</b></div><div class="rbt"><span>Écart</span><b class="num">'+sgn2(diff)+'</b></div>';
  if(RP.open)h+=rdone('open','',RP.open==='use'?'Solde de départ retenu : <b>'+eur2(o.open)+'</b>':'Solde saisi gardé : <b>'+eur2(S.init.ent)+'</b>');
  else h+='<p class="note">Le solde saisi est trop '+(diff<0?'bas':'haut')+' de '+eur2(Math.abs(diff))+' par rapport à la banque.</p>'+rbtns('open','',[['use','Utiliser '+eur2(o.open)],['keep','Garder '+eur2(S.init.ent)]]);
  return h+'</div></div>';
}
function rmCheck(c){
  if(c.t==='d'){S.deps=S.deps.filter(function(x){return x.id!==c.id});return}
  if(c.t==='x'){var e=findBy(S.exps,c.id);if(!e)return;var rest=e.lines.filter(function(l){return l.c!=='ent'});if(rest.length)e.lines=rest;else S.exps=S.exps.filter(function(x){return x.id!==c.id});return}
  var s=findBy(S.sorties,c.id);if(!s)return;
  s.lines=s.lines.filter(function(l){return !(l.c==='ent'&&!l.b&&l.m===c.amt)});
  if(!s.lines.length){if(s.id.charAt(0)==='r'&&S.noauto.indexOf(s.id)<0)S.noauto.push(s.id);S.sorties=S.sorties.filter(function(x){return x.id!==c.id})}
}
function rapValidate(){
  var P=bankPlan(),first=!S.bk.ok;
  if(!rpReady(P))return;
  hist('rapprochement bancaire');
  if(first&&RP.open==='use'){var o=bankOpening();if(o)S.init.ent=o.open}
  P.check.forEach(function(c){var v=RP.chk[c.key];
    if(v==='keep'){if(S.bk.keep.indexOf(c.key)<0)S.bk.keep.push(c.key)}
    else if(v==='del')rmCheck(c);
    else if(v==='link'&&c.cand){var L=c.cand,k=ruleKey(L.label);S.exps=S.exps.filter(function(x){return x.id!=='b'+L.id});S.bk.cls[L.id]='sal';if(k.split(' ').length>=3)S.bk.rules[k]='sal'}});
  if(first)P.salNew.forEach(function(L){S.bk.cls[L.id]=RP.sal[L.id]==='exp'?'exp':'sal'});
  P.ask.forEach(function(L){var v=RP.ask[L.id];S.bk.cls[L.id]=v;S.bk.rules[ruleKey(L.label)]=v});
  S.bk=normBk(S.bk);
  if(first)S.bk.ok=TODAY;
  var n=bankApply();
  RP=null;refresh();go('home');
  toast('Rapprochement validé',{l:'Annuler',f:undo});
}

/* ---------- Réglages : carte Connexion bancaire ---------- */
function bankCard(){
  if(!API)return '';
  var h='<div class="card set" id="bk-card"><div class="row"><b>Connexion bancaire</b>';
  if(!BK&&SY.ver&&SY.ver<'2')return h+'<span class="sy warn">Script à mettre à jour</span></div><p class="note">Le script du Google Sheet est en version '+esc(SY.ver)+' : collez Code.gs version 2.0 (voir le LISEZ-MOI) pour relier la banque.</p></div>';
  if(!BK)return h+'<span class="sy">…</span></div><p class="note">Lecture des informations de la banque…</p></div>';
  if(!BK.conf)return h+'<span class="sy warn">À configurer</span></div><p class="note">La clé Enable Banking n\'est pas encore enregistrée dans le script : dans le Google Sheet, menu CdC Finance › Connexion bancaire (voir le LISEZ-MOI).</p></div>';
  if(BK.pending&&BK.pending.length){
    h+='<span class="sy warn">Compte à choisir</span></div><p class="note">La banque partage plusieurs comptes. Choisissez le compte pro actuel (pas l\'ancien à 0 €).</p>';
    BK.pending.forEach(function(a){h+='<button class="btn acb" onclick="bankChoose(\''+esc(a.uid)+'\')"><span><b>'+esc(a.name)+'</b> •••• '+esc(a.iban4)+'</span>'+(a.bal!=null?'<span class="num">'+eur2(a.bal)+'</span>':'')+'</button>'});
    return h+'</div>';
  }
  if(!BK.linked)return h+'<span class="sy">Non reliée</span></div><p class="note">Reliez le compte pro Canins des Champs (Crédit Mutuel) : ses mouvements arrivent tout seuls sur le Compte entreprise. Le Livret A et les espèces restent en saisie à la main.</p>'+
    '<div class="row2"><button class="btn pri sm" onclick="bankStart()">Relier la banque</button></div>'+(BK.lines&&BK.lines.length?'<p class="note">Les '+BK.lines.length+' opérations déjà lues restent dans l\'appli.</p>':'')+'</div>';
  var days=BK.until?dDiff(BK.until,TODAY):999,soon=days<=15;
  return h+'<span class="sy '+(BK.err?'warn':'ok')+'">'+(BK.err?errTxt(BK.err):'Reliée')+'</span></div>'+
    '<div class="rrow"><span>Compte</span><span>Crédit Mutuel · '+esc(BK.name)+' •••• '+esc(BK.iban4)+'</span></div>'+
    '<div class="rrow"><span>Dernière lecture</span><span>'+(BK.last?when(BK.last):'—')+'</span></div>'+
    (BK.bal!=null?'<div class="rrow"><span>Solde à la banque</span><span>'+eur2(BK.bal)+(BK.balDate?' au '+fd(BK.balDate):'')+'</span></div>':'')+
    '<div class="rrow"><span>Accord valable jusqu\'au</span><span class="'+(soon?'neg':'')+'">'+(BK.until?fd(BK.until):'—')+'</span></div>'+
    '<div class="row2"><button class="btn sm" onclick="bankSync(true)">Lire maintenant</button><button class="btn sm" onclick="go(\'rap\')">Rapprochement</button>'+
    '<button class="btn sm'+(soon||BK.err==='expire'?' pri':'')+'" onclick="bankStart()">Renouveler l\'accord</button><button class="btn sm del" id="bk-un" onclick="bankUnlink()">Délier</button></div>'+
    '<p class="note">Lecture automatique à l\'ouverture de l\'appli, au plus toutes les 2 heures. Entrées = dépôts, sorties = dépenses, virement « Duo Confort » = salaire.</p></div>';
}

/* ---------- Échanges avec le script ---------- */
function bkCall(fn,args){return call(fn,args).then(function(r){if(r&&(r.error==='CODE'||r.error==='BLOQUE'||r.error==='CONFIG')){handle(r);throw 'auth'}return r})}
function bankMsg(r){
  if(!r)return 'Pas de réponse du script';
  if(r.error==='BANQUE_CONFIG')return 'Clé Enable Banking absente du script';
  if(r.error==='FN')return 'Script pas à jour (version 2.0 attendue)';
  if(r.code)return errTxt(r.code);
  return 'Banque : '+(r.detail||r.error);
}
function bankStart(){
  if(!API||!CODE){toast('Connexion au Google Sheet nécessaire');return}
  toast('Ouverture de la banque…');
  bkCall('bankStart',[CODE]).then(function(r){if(r&&r.url)location.href=r.url;else toast(bankMsg(r))})
    .catch(function(e){if(e!=='auth')toast('Pas de réseau ou script injoignable')});
}
function bankChoose(uid){
  toast('Lecture du compte…');
  bkCall('bankChoose',[CODE,uid]).then(function(r){
    if(r.bank)setBank(r.bank);
    if(!r.ok){toast(bankMsg(r));return}
    SY.wait=0;SY.need=true;if(!S.bk.ok)go('rap');
  }).catch(function(e){if(e!=='auth')toast('Pas de réseau ou script injoignable')});
}
function bankSync(force){
  if(BK_BUSY||!API||!CODE||!bankOn())return;
  BK_BUSY=true;if(force)toast('Lecture de la banque…');
  bkCall('bankSync',[CODE,!!force]).then(function(r){
    BK_BUSY=false;if(r.bank)setBank(r.bank);
    var sy=r.sync||{};
    if(force)toast(sy.error?bankMsg(sy):(sy.n?sy.n+' nouvelle'+(sy.n>1?'s':'')+' opération'+(sy.n>1?'s':''):'Banque à jour'));
    if(sy.n||sy.error)SY.need=true;
  }).catch(function(e){BK_BUSY=false;if(force&&e!=='auth')toast('Pas de réseau ou script injoignable')});
}
function bankAuto(){
  if(!bankOn()||BK_BUSY||!CODE||SY.rev===null)return;
  if(Date.now()-(Date.parse(BK.last||'')||0)<2*3600e3)return;
  if(BK.err==='expire')return;
  bankSync(false);
}
function bankUnlink(){
  var b=$('bk-un');
  if(b&&!b.dataset.c){b.dataset.c='1';b.textContent='Confirmer : délier';return}
  bkCall('bankUnlink',[CODE]).then(function(r){if(r.bank)setBank(r.bank);toast(r.ok?'Banque déliée':bankMsg(r));SY.need=true})
    .catch(function(e){if(e!=='auth')toast('Pas de réseau ou script injoignable')});
}
function setBank(b){BK=b;persist();bankAfter();refresh();if(S.view==='set')renderSet()}
function afterPull(){
  bankAfter(false);
  if(BANK_AFTER){var v=BANK_AFTER;BANK_AFTER=null;if(v==='rap'&&S.bk.ok&&!bankTodo())v='home';go(v)}
  bankAuto();
}

/* ---------- Retour de la page de la banque : ?code=…&state=… ---------- */
var BRET=(function(){
  try{var q=new URLSearchParams(location.search);if(q.get('state')&&(q.get('code')||q.get('error')))return {state:q.get('state'),code:q.get('code'),error:q.get('error')}}catch(e){}
  return null;
})();
if(BRET){try{history.replaceState(null,'',location.pathname+location.hash)}catch(e){}}
function sheetMsg(t,body,close){
  M=null;$('sheet').innerHTML='<h2>'+t+'</h2>'+body+(close?'<div class="acts"><button class="btn pri" onclick="closeAcct();if(API&&!CODE)showLogin()">Fermer</button></div>':'');$('modal').hidden=false;
}
function bankReturn(){
  var b=BRET;BRET=null;
  if(b.error){toast('Liaison annulée à la banque');if(API&&!CODE)showLogin();return}
  if(!API)return;
  sheetMsg('Connexion à la banque…','<p class="note">Enregistrement de l\'accord du Crédit Mutuel.</p>',false);
  call('bankFinish',[b.state,b.code]).then(function(r){
    if(!r||r.error){sheetMsg('La liaison n\'a pas abouti','<p class="note">'+(r&&r.error==='ETAT'?'Le lien de retour a expiré ou a déjà servi. Relancez « Relier la banque » depuis les Réglages.':esc(bankMsg(r)))+'</p>',true);return}
    if(!CODE){sheetMsg('Banque reliée ✓','<p class="note">'+(r.choose?'Retournez dans l\'appli CdC Finance installée pour choisir le compte pro.':'Retournez dans l\'appli CdC Finance installée : le rapprochement bancaire vous y attend.')+'</p>',true);return}
    closeAcct();toast('Banque reliée ✓');
    BANK_AFTER=r.choose?'set':'rap';SY.wait=0;SY.need=true;
  }).catch(function(){sheetMsg('La liaison n\'a pas abouti','<p class="note">Pas de réseau ou script injoignable.</p>',true)});
}

/* ====================== Synchronisation Google Sheet ====================== */
var CFG=window.CDCF_CONFIG||{},API=CFG.apiUrl||'';
var LS_DATA='cdcfin.data',LS_CODE='cdcfin.code',LS_DEV='cdcfin.dev';
function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
var DEV=lsGet(LS_DEV);if(!DEV){DEV=uid('a');lsSet(LS_DEV,DEV)}
var CODE=lsGet(LS_CODE)||'';
var SY={rev:null,base:null,busy:false,err:'',okAt:0,wait:0,tries:0,sheetUrl:'',saved:''};

function dataObj(){return {init:S.init,initDate:S.initDate,deps:S.deps,sorties:S.sorties,exps:S.exps,goal:S.goal,goalOn:S.goalOn,noauto:S.noauto,bk:S.bk}}
function emptyData(){return {init:{ent:0,liv:0,esp:0},initDate:DEF_DATE,deps:[],sorties:[],exps:[],goal:1800,goalOn:false,noauto:[],bk:{ok:'',cls:{},rules:{},keep:[]}}}
function norm(o){
  var i=o.init||{};
  return {
    init:{ent:+i.ent||0,liv:+i.liv||0,esp:+i.esp||0},
    initDate:o.initDate||DEF_DATE,
    deps:(o.deps||[]).map(function(d){var r={id:d.id,date:d.date,c:d.c,m:+d.m};if(d.b)r.b=d.b;if(d.t)r.t=d.t;if(d.tr)r.tr=d.tr;return r}),
    sorties:(o.sorties||[]).map(function(s){return {id:s.id,date:s.date,lines:s.lines.map(function(l){var r={c:l.c,m:+l.m,r:!!l.r};if(l.b)r.b=l.b;return r})}}),
    exps:(o.exps||[]).map(function(x){var r={id:x.id,date:x.date,label:x.label,lines:x.lines.map(function(l){return {c:l.c,m:+l.m}})};if(x.b)r.b=x.b;if(x.tr)r.tr=x.tr;return r}),
    goal:o.goal!=null?+o.goal:1800,goalOn:!!o.goalOn,noauto:(o.noauto||[]).slice(),
    bk:normBk(o.bk)
  };
}
function normBk(b){b=b||{};var o={ok:b.ok||'',cls:{},rules:{},keep:(b.keep||[]).slice()},k;
  Object.keys(b.cls||{}).sort().forEach(function(k){o.cls[k]=b.cls[k]});Object.keys(b.rules||{}).sort().forEach(function(k){o.rules[k]=b.rules[k]});return o}
function setData(o){var n=norm(o);S.init=n.init;S.initDate=n.initDate;S.deps=n.deps;S.sorties=n.sorties;S.exps=n.exps;S.goal=n.goal;S.goalOn=n.goalOn;S.noauto=n.noauto;S.bk=n.bk}

/* fusion à trois points : base (dernier état connu du serveur), local, serveur */
function merge(base,loc,srv){
  var out={};
  ['deps','sorties','exps'].forEach(function(k){
    var bm={},lm={},res=[],seen={};
    (base[k]||[]).forEach(function(x){bm[x.id]=JSON.stringify(x)});
    (loc[k]||[]).forEach(function(x){lm[x.id]=x});
    (srv[k]||[]).forEach(function(x){
      var id=x.id;
      if((id in bm)&&!(id in lm))return;                                    /* supprimé ici */
      if((id in lm)&&JSON.stringify(lm[id])!==bm[id]){res.push(lm[id]);seen[id]=1;return} /* modifié ici */
      res.push(x);seen[id]=1;
    });
    (loc[k]||[]).forEach(function(x){
      if(seen[x.id])return;
      if(!(x.id in bm)||JSON.stringify(x)!==bm[x.id])res.push(x);           /* ajouté ici, ou modifié ici alors que supprimé ailleurs */
    });
    out[k]=res;
  });
  var bi=base.init||{},li=loc.init||{},si=srv.init||{};out.init={};
  ['ent','liv','esp'].forEach(function(k){out.init[k]=(+li[k]!==+bi[k])?+li[k]:+si[k]});
  ['initDate','goal','goalOn'].forEach(function(k){out[k]=(JSON.stringify(loc[k])!==JSON.stringify(base[k]))?loc[k]:srv[k]});
  var na=(srv.noauto||[]).slice();(loc.noauto||[]).forEach(function(x){if(na.indexOf(x)<0)na.push(x)});out.noauto=na;
  var bb=normBk(base.bk),lb=normBk(loc.bk),sb=normBk(srv.bk),ob={ok:lb.ok!==bb.ok?lb.ok:sb.ok,cls:sb.cls,rules:sb.rules,keep:sb.keep.slice()};
  ['cls','rules'].forEach(function(f){Object.keys(lb[f]).forEach(function(k){if(lb[f][k]!==bb[f][k])ob[f][k]=lb[f][k]})});
  lb.keep.forEach(function(x){if(ob.keep.indexOf(x)<0)ob.keep.push(x)});
  out.bk=normBk(ob);
  return out;
}

function persist(){
  var s=JSON.stringify({rev:SY.rev,base:SY.base,data:dataObj(),bank:BK});
  if(s!==SY.saved){lsSet(LS_DATA,s);SY.saved=s}
}
(function loadLocal(){
  var r=lsGet(LS_DATA);if(!r)return;
  try{var o=JSON.parse(r);setData(o.data||{});SY.rev=(o.rev==null)?null:o.rev;SY.base=o.base||null;BK=o.bank||null;SY.saved=r}catch(e){}
})();

function call(fn,args){
  var ac=('AbortController' in window)?new AbortController():null;
  var t=setTimeout(function(){if(ac)ac.abort()},25000);
  return fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({fn:fn,args:args}),signal:ac?ac.signal:undefined,redirect:'follow'})
    .then(function(r){clearTimeout(t);return r.json()},function(e){clearTimeout(t);throw e});
}
function syErr(e){SY.err=e;SY.tries++;SY.wait=Date.now()+Math.min(30000,2000*Math.pow(2,SY.tries-1));paintSync()}
function handle(r){
  if(!r||!r.error)return false;
  if(r.error==='CODE'){CODE='';lsSet(LS_CODE,'');showLogin('Code incorrect.')}
  else if(r.error==='BLOQUE')showLogin('Trop d\'essais : réessayez dans 15 minutes.');
  else if(r.error==='CONFIG')showLogin('Le code d\'accès n\'est pas encore défini dans le script (Code.gs).');
  else syErr(r.error==='BUSY'?'occupé':'erreur');
  return true;
}
function okSync(){SY.tries=0;SY.err='';SY.okAt=Date.now()}

/* intègre l'état du serveur (avec fusion si des modifications locales attendent) */
function takeRemote(srv,rev,quiet){
  var cur=JSON.stringify(dataObj());
  var baseStr=SY.base||JSON.stringify(emptyData());
  var pending=(cur!==baseStr);
  var loc=JSON.parse(cur);
  var merged=pending?merge(JSON.parse(baseStr),loc,norm(srv)):null;
  setData(srv);SY.base=JSON.stringify(dataObj());SY.rev=rev;
  if(pending)setData(merged);
  var changed=JSON.stringify(dataObj())!==cur;
  if(changed){UNDO.length=0;REDO.length=0;lastKey=null;updHist()}
  persist();
  if(changed||SY.first){afterRemote(quiet)}
  SY.first=false;
}
function afterRemote(quiet){
  if(!$('modal').hidden){M=null;BACK=null;ACC=null;$('modal').hidden=true}
  refresh();if(S.view==='set')renderSet();
  if(!autoRec()&&!quiet)toast('Données mises à jour depuis un autre appareil');
}
SY.first=true;

function pull(){
  if(SY.busy||!API||!CODE)return;
  SY.busy=true;
  call('pull',[CODE]).then(function(r){
    SY.busy=false;if(handle(r))return;
    okSync();SY.sheetUrl=r.sheetUrl||SY.sheetUrl;SY.ver=r.version||SY.ver;
    var bch=r.bank&&JSON.stringify(r.bank)!==JSON.stringify(BK);if(r.bank)BK=r.bank;
    if(r.empty){SY.rev=r.rev||0;SY.base=JSON.stringify(emptyData());persist();SY.first=false;autoRec();if(bch)refresh();paintSync();afterPull();return}
    takeRemote(r.state,r.rev,SY.rev===null);
    if(bch){persist();refresh();if(S.view==='set')renderSet()}
    paintSync();afterPull();
  }).catch(function(){SY.busy=false;syErr('réseau')});
}
function push(cur){
  SY.busy=true;
  call('save',[CODE,DEV,SY.rev,JSON.parse(cur)]).then(function(r){
    SY.busy=false;if(handle(r))return;
    okSync();
    if(r.conflict){takeRemote(r.state,r.rev,false);paintSync();return}
    SY.rev=r.rev;SY.base=cur;persist();paintSync();
  }).catch(function(){SY.busy=false;syErr('réseau')});
}
function poll(){
  if(!API||!CODE||SY.busy||SY.rev===null||document.hidden)return;
  call('rev',[CODE]).then(function(r){
    if(handle(r))return;
    okSync();
    if(r.rev!==SY.rev&&JSON.stringify(dataObj())===SY.base&&!SY.busy)pull();
    paintSync();
  }).catch(function(){syErr('réseau')});
}
setInterval(function(){
  persist();
  if(API&&CODE&&!SY.busy&&Date.now()>=SY.wait){
    if(SY.rev===null||SY.need){SY.need=false;pull()}
    else{var cur=JSON.stringify(dataObj());if(cur!==SY.base)push(cur)}
  }
  paintSync();
},800);
setInterval(poll,15000);
document.addEventListener('visibilitychange',function(){
  if(document.hidden){
    var cur=JSON.stringify(dataObj());
    if(API&&CODE&&SY.rev!==null&&cur!==SY.base){try{navigator.sendBeacon(API,new Blob([JSON.stringify({fn:'save',args:[CODE,DEV,SY.rev,JSON.parse(cur)]})],{type:'text/plain;charset=utf-8'}))}catch(e){}}
    persist();
  }else{TODAY=todayISO();SY.wait=0;autoRec();poll();bankAuto()}
});
window.addEventListener('online',function(){SY.wait=0;poll()});
window.addEventListener('pagehide',persist);

/* ---------- Écran du code d'accès ---------- */
function showLogin(msg){
  if(!API)return;
  $('login').hidden=false;$('lg-msg').textContent=msg||'';
  var b=$('lg-inst');if(b)b.hidden=!(DEFERRED&&!STANDALONE);
  setTimeout(function(){$('lg-code').focus()},50);
}
function doLogin(ev){
  if(ev)ev.preventDefault();
  var v=$('lg-code').value.trim();if(!v)return;
  $('lg-btn').disabled=true;$('lg-msg').textContent='Vérification…';
  call('ping',[v]).then(function(r){
    $('lg-btn').disabled=false;
    if(r&&r.error){$('lg-msg').textContent=r.error==='CODE'?'Code incorrect.':r.error==='BLOQUE'?'Trop d\'essais : réessayez dans 15 minutes.':r.error==='CONFIG'?'Le code d\'accès n\'est pas encore défini dans le script (Code.gs).':'Erreur du script ('+r.error+').';return}
    CODE=v;lsSet(LS_CODE,v);SY.sheetUrl=r.sheetUrl||'';SY.wait=0;SY.err='';$('lg-code').value='';$('login').hidden=true;
    SY.rev=null;SY.first=true;pull();if(S.view==='set')renderSet();
  }).catch(function(){$('lg-btn').disabled=false;$('lg-msg').textContent='Pas de réseau ou script injoignable.'});
}

/* ---------- Démarrage ---------- */
function start(){
  refresh();updHist();autoRec();if(S.bk.ok&&BK&&bankApply())refresh();paintSync();
  if(BRET)bankReturn();
  else if(API&&!CODE)showLogin();
  if('serviceWorker' in navigator){
    var had=!!navigator.serviceWorker.controller,rl=false;
    navigator.serviceWorker.register('sw.js').catch(function(){});
    navigator.serviceWorker.addEventListener('controllerchange',function(){if(had&&!rl){rl=true;location.reload()}});
  }
}
start();
