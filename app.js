
var $=function(i){return document.getElementById(i)};
var C={ent:{n:'Compte entreprise',v:'var(--c-ent)'},liv:{n:'Livret A',sub:'part Canins des Champs',v:'var(--c-liv)'},esp:{n:'Espèces maison',v:'var(--c-esp)'}};
var KEYS=['ent','liv','esp'];
function pad2(n){return n<10?'0'+n:''+n}
function todayISO(){var d=new Date();return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())}
var TODAY=todayISO();
var VERSION='1.0';
var DEF_DATE='2026-08-31';
var S={
  initDate:DEF_DATE,init:{ent:0,liv:0,esp:0},deps:[],sorties:[],exps:[],noauto:[],
  open:{},goalOn:false,goal:1800,view:'home',
  prov:true,bal:false,fa:null,fb:null,years:[],sel:null,regOpen:false,setupOpen:false
};
var M=null;
function uid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

/* ---------- Filtres enregistrés sur l'appareil ---------- */
var FK='cdcfin.filtres';
function loadF(){try{var o=JSON.parse(localStorage.getItem(FK)||'null');if(o){S.prov=o.prov!==false;S.bal=!!o.bal;S.fa=o.fa||null;S.fb=o.fb||null;S.years=o.years||[];S.regOpen=!!o.regOpen}}catch(e){}}
function saveF(){try{localStorage.setItem(FK,JSON.stringify({prov:S.prov,bal:S.bal,fa:S.fa,fb:S.fb,years:S.years,regOpen:S.regOpen}))}catch(e){}}
function resetF(){S.prov=true;S.bal=false;S.fa=null;S.fb=null;S.years=[];S.sel=null;S.regOpen=false;saveF();renderSyn();toast('Filtres réinitialisés')}
loadF();

/* ---------- Annuler / rétablir ---------- */
var UNDO=[],REDO=[],lastKey=null,lastT=0,tmr=null;
function snap(){return JSON.stringify({i:S.init,d:S.initDate,dp:S.deps,so:S.sorties,ex:S.exps,g:S.goal,go:S.goalOn,na:S.noauto})}
function restore(js){var o=JSON.parse(js);S.init=o.i;S.initDate=o.d;S.deps=o.dp;S.sorties=o.so;S.exps=o.ex;S.goal=o.g;S.goalOn=o.go;S.noauto=o.na||[]}
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
function toast(t){
  var e=$('toast');e.textContent=t;e.classList.add('on');
  clearTimeout(tmr);tmr=setTimeout(function(){e.classList.remove('on')},2200);
}
function afterHist(msg){
  if(!$('modal').hidden)closeM();
  lastKey=null;refresh();
  if(S.view==='set')renderSet();
  updHist();toast(msg);
}
function undo(){
  if(!UNDO.length){toast('Rien à annuler');return}
  var e=UNDO.pop();REDO.push({s:snap(),l:e.l});restore(e.s);afterHist('Annulé : '+e.l);
}
function redo(){
  if(!REDO.length){toast('Rien à rétablir');return}
  var e=REDO.pop();UNDO.push({s:snap(),l:e.l});restore(e.s);afterHist('Rétabli : '+e.l);
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
  var made=0,g=0,n;
  while(g++<48&&(n=recNext())&&n.date<=TODAY){S.sorties.push({id:n.id,date:n.date,lines:n.lines});made++;}
  if(made){refresh();toast(made>1?made+' salaires récurrents ajoutés':'Salaire récurrent du '+fd(S.sorties[S.sorties.length-1].date)+' ajouté')}
  return made;
}

function renderFixed(){
  var b=bal(),t=0;KEYS.forEach(function(k){t+=b[k]});
  var h='<div class="card"><div class="head"><div><div class="lbl">Trésorerie totale</div><div class="total">'+eur(t)+'</div></div>'+
    '<span class="pill"><i></i>Soldes au '+fd(lastUpd())+'</span></div>';
  KEYS.forEach(function(k){
    h+='<div class="acc"><button class="accb" onclick="openAcct(\''+k+'\')" aria-label="Voir les mouvements : '+C[k].n+'">'+dot(k)+'<div class="nm">'+C[k].n+(C[k].sub?'<small>'+C[k].sub+'</small>':'')+'</div>'+
      '<span class="amt'+(b[k]<0?' neg':'')+'">'+eur(b[k])+'</span><svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>'+
      '<button class="btn pri sm" onclick="openDep(\''+k+'\')" aria-label="Ajouter un dépôt sur '+C[k].n+'">+ Dépôt</button></div>';
  });
  h+='</div><div class="bgrid"><button class="btn pri big" onclick="openSortie()">Saisir un salaire</button><button class="btn dep big" onclick="openExp()">Dépense ponctuelle</button></div><div class="sec">Derniers mouvements</div>';
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
        s.lines.map(function(l){return '<div class="muted"><span>'+dot(l.c)+C[l.c].n+(l.r?'<span class="tag">↻ mensuel</span>':'')+'</span><span>− '+eur(l.m)+'</span></div>'}).join('')+
        '</div><button class="btn sm" onclick="openSortie(\''+s.id+'\')">Modifier</button></div>';
    });
    items.push({d:m.list[m.list.length-1].date,h:mrow(id,'Salaire · '+mLabel(m.k),'minus','− '+eur(m.total),!!S.open[id],det)});
  });
  byMonth(HV.d?S.deps:[]).forEach(function(m){
    var id='d:'+m.k,det=cnt(m.n,'dépôt','dépôts');
    m.list.slice().reverse().forEach(function(d){
      det+='<div class="srt"><div class="l"><div><b>'+fd(d.date)+'</b><span class="amt plus">+ '+eur(d.m)+'</span></div>'+
        '<div class="muted"><span>'+dot(d.c)+C[d.c].n+'</span></div></div><button class="btn sm" onclick="openDep(\''+d.c+'\',\''+d.id+'\')">Modifier</button></div>';
    });
    items.push({d:m.list[m.list.length-1].date,h:mrow(id,'Dépôts · '+mLabel(m.k),'plus','+ '+eur(m.total),!!S.open[id],det)});
  });
  byMonth(HV.x?S.exps:[]).forEach(function(m){
    var id='x:'+m.k,det=cnt(m.n,'dépense','dépenses');
    m.list.slice().reverse().forEach(function(x){
      det+='<div class="srt"><div class="l"><div><b>'+x.label+'</b><span class="amt minus">− '+eur(sumL(x))+'</span></div>'+
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
  function blank(k){return {k:k,out:0,inn:0,dx:0,ob:{ent:0,liv:0,esp:0},ib:{ent:0,liv:0,esp:0},xb:{ent:0,liv:0,esp:0},os:[],is:[],xs:[]}}
  function g(k){if(!map[k]){map[k]=blank(k);keys.push(k)}return map[k]}
  S.sorties.forEach(function(s){var m=g(s.date.slice(0,7));s.lines.forEach(function(l){m.ob[l.c]+=l.m});m.out+=sumL(s);m.os.push({d:s.date,v:sumL(s)})});
  S.deps.forEach(function(d){var m=g(d.date.slice(0,7));m.ib[d.c]+=d.m;m.inn+=d.m;m.is.push({d:d.date,v:d.m,c:d.c})});
  S.exps.forEach(function(x){var m=g(x.date.slice(0,7));x.lines.forEach(function(l){m.xb[l.c]+=l.m});m.dx+=sumL(x);m.xs.push({d:x.date,v:sumL(x),t:x.label})});
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
  var mx=1;ms.forEach(function(m){mx=Math.max(mx,Math.abs(m.inn-m.out-m.dx))});
  var nm=niceMax(mx,2),AX=nm.max;
  var rad=Math.max(2,Math.min(6,L.cw/2));
  ms.forEach(function(m,idx){
    var d=m.inn-m.out-m.dx,h=Math.abs(d)/AX*Hb,pos=d>=0,hh=Math.max(h,2);
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
    m.xs.forEach(function(x){t+='<span class="chip">'+x.t+' · '+eur(x.v)+'</span>'});
    if(S.prov)t+=provChips(m.xb);
    if(!m.xs.length)t+='<span class="chip">Aucune dépense</span>';
  }else{
    var d=m.inn-m.out-m.dx;
    t='<b>'+mLabel(m.k)+'</b><span class="'+(d>=0?'plus':'minus')+'">'+(d>=0?'+ ':'− ')+eur(Math.abs(d))+'</span><span class="chip">Dépôts '+eur(m.inn)+' · Salaires '+eur(m.out)+' · Dépenses '+eur(m.dx)+'</span>';
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
    '<button class="tg" aria-pressed="'+S.bal+'" onclick="setF(\'bal\',!S.bal)">Balance</button>'+
    '<button class="ico" onclick="resetF()" aria-label="Réinitialiser les filtres" title="Réinitialiser les filtres"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg></button></div>'+
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
  var tOut=0,tIn=0,tDx=0;ms.forEach(function(m){tOut+=m.out;tIn+=m.inn;tDx+=m.dx});
  var avg=tOut/ms.length;

  function kt(c,l,v,full){return '<div class="kt '+c+'" title="'+full+'"><span class="kl">'+l+'</span><b>'+v+'</b></div>'}
  $('syn-kpi').innerHTML='<div class="kpi">'+kt('k-avg','Moy. / mois',kfmt(avg),eur(avg))+kt('k-out','Salaires',kfmt(tOut),eur(tOut))+kt('k-in','Dépôts',kfmt(tIn),eur(tIn))+kt('k-dx','Dépenses',kfmt(tDx),eur(tDx))+'</div>';

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

  var h=sel?'':'<p class="note" style="font-size:12px">Détail du dernier mois sous chaque graphique · touchez une barre pour changer de mois.</p>';
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
  function cp(kind){return capHtml(capM,kind)}
  h+='<div class="card"><div class="chead"><p class="ctit">Salaires versés</p><span class="minus">− '+eur(tOut)+'</span></div>'+barChart(ms,segO,function(m){return m.out},mxO,linesO,W,sel)+leg('out')+cp('out')+'</div>'+
    '<div class="card"><div class="chead"><p class="ctit">Dépôts de trésorerie</p><span class="plus">+ '+eur(tIn)+'</span></div>'+
    (tIn>0?barChart(ms,segI,function(m){return m.inn},mxI,noLines,W,sel)+leg('in')+cp('in'):'<p class="note">Aucun dépôt sur cette période.</p>')+'</div>'+
    '<div class="card"><div class="chead"><p class="ctit">Dépenses ponctuelles</p><span class="minus">− '+eur(tDx)+'</span></div>'+
    (tDx>0?barChart(ms,segX,function(m){return m.dx},mxX,noLines,W,sel)+leg('dx')+cp('dx'):'<p class="note">Aucune dépense ponctuelle sur cette période.</p>')+'</div>';
  if(S.bal){
    var net=tIn-tOut-tDx;
    h+='<div class="card"><div class="chead"><p class="ctit">Balance dépôts − sorties</p><span class="'+(net>=0?'plus':'minus')+'">'+(net>=0?'+ ':'− ')+eur(Math.abs(net))+'</span></div>'+balChart(ms,W,sel)+leg('bal')+cp('bal')+'</div>';
  }
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

function go(v){
  S.view=v;
  ['home','syn','set'].forEach(function(x){$('v-'+x).hidden=(x!==v);var t=$('t-'+x);if(x===v)t.setAttribute('aria-current','page');else t.removeAttribute('aria-current')});
  if(v==='syn')renderSyn();if(v==='set')renderSet();
}

/* ---------- Fenêtres ---------- */
var BACK=null,ACC=null;
function closeM(){var b=BACK;BACK=null;M=null;$('modal').hidden=true;if(b)openAcct(b,ACC&&ACC.f)}
function closeAcct(){ACC=null;BACK=null;$('modal').hidden=true}
function accEvents(k){
  var ev=[],i=0;
  S.deps.forEach(function(d){if(d.c===k)ev.push({t:'d',id:d.id,date:d.date,m:d.m,lab:'Dépôt',o:i++})});
  S.sorties.forEach(function(s){s.lines.forEach(function(l){if(l.c===k)ev.push({t:'s',id:s.id,date:s.date,m:-l.m,lab:'Salaire'+(l.r?' · récurrent':''),o:i++})})});
  S.exps.forEach(function(x){x.lines.forEach(function(l){if(l.c===k)ev.push({t:'x',id:x.id,date:x.date,m:-l.m,lab:x.label,o:i++})})});
  ev.sort(function(a,b){return a.date<b.date?-1:(a.date>b.date?1:a.o-b.o)});
  var run=S.init[k];ev.forEach(function(e){run+=e.m;e.bal=run});
  return ev;
}
function openAcct(k,f){
  ACC={k:k,f:f||'all'};M=null;
  var ev=accEvents(k),b=bal()[k];
  var vis=ev.filter(function(e){return ACC.f==='all'||(ACC.f==='in'?e.m>0:e.m<0)}).reverse();
  var rows=vis.map(function(e){
    return '<button class="arow" onclick="accEdit(\''+e.t+'\',\''+e.id+'\')" aria-label="Modifier : '+e.lab+' du '+fd(e.date)+'">'+
      '<div class="al"><b>'+e.lab+'</b><small>'+fd(e.date)+'</small></div>'+
      '<div class="ar"><span class="amt '+(e.m>0?'plus':'minus')+'">'+(e.m>0?'+ ':'− ')+eur(Math.abs(e.m))+'</span><small>solde '+eur(e.bal)+'</small></div>'+
      '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button>';
  }).join('');
  if(ACC.f==='all')rows+='<div class="arow start"><div class="al"><b>Solde de départ</b><small>'+fd(S.initDate)+'</small></div><div class="ar"><span class="amt">'+eur(S.init[k])+'</span></div></div>';
  function tg(id,l){return '<button class="tg" aria-pressed="'+(ACC.f===id)+'" onclick="openAcct(\''+k+'\',\''+id+'\')">'+l+'</button>'}
  $('sheet').innerHTML='<div class="ahead"><div><div class="lbl">'+dot(k)+cname(k)+'</div><div class="total" style="font-size:26px">'+eur(b)+'</div></div>'+
    '<button class="ico" onclick="closeAcct()" aria-label="Fermer" title="Fermer" style="margin:0"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'+
    '<div class="frow">'+tg('all','Tout')+tg('in','Entrées')+tg('out','Sorties')+'<span class="sp"></span><button class="btn pri sm" onclick="accDep(\''+k+'\')">+ Dépôt</button></div>'+
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
    M={kind:'s',id:id,date:s.date,lines:s.lines.map(function(l){return {c:l.c,m:l.m,r:l.r}})}}
  else M={kind:'s',id:null,date:TODAY,lines:[{c:'ent',m:0,r:false}]};
  M.del=false;M.err='';drawS();$('modal').hidden=false;
}
function openExp(id){
  if(id){var x=S.exps.filter(function(e){return e.id===id})[0];
    M={kind:'x',id:id,date:x.date,label:x.label,lines:x.lines.map(function(l){return {c:l.c,m:l.m,r:false}})}}
  else M={kind:'x',id:null,date:TODAY,label:'',lines:[{c:'ent',m:0,r:false}]};
  M.del=false;M.err='';drawS();$('modal').hidden=false;
}
function curRec(){return (M.kind==='x'?S.exps:S.sorties).filter(function(x){return x.id===M.id})[0]}
function drawS(){
  var x=M.kind==='x';
  var h='<h2>'+(x?(M.id?'Modifier la dépense':'Dépense ponctuelle'):(M.id?'Modifier le salaire':'Saisir un salaire'))+'</h2>'+
   '<div class="fld"><label for="m-date" class="lbl">'+(x?'Date de la dépense':'Date du salaire')+'</label><input type="date" id="m-date" value="'+M.date+'" onchange="M.date=this.value"></div>'+
   (x?'<div class="fld"><label for="m-lib" class="lbl">Libellé</label><input type="text" id="m-lib" value="'+(M.label||'').replace(/"/g,'&quot;')+'" placeholder="Vétérinaire, matériel, assurance…" oninput="M.label=this.value"></div>':'');
  M.lines.forEach(function(l,i){
    h+='<div class="ln"><div class="r"><select aria-label="Compte prélevé" onchange="M.lines['+i+'].c=this.value;upd()">'+
      KEYS.map(function(k){return '<option value="'+k+'"'+(l.c===k?' selected':'')+'>'+cname(k)+'</option>'}).join('')+'</select></div>'+
      '<div class="r"><input type="text" inputmode="decimal" placeholder="Montant en €" aria-label="Montant" value="'+(l.m||'')+'" oninput="M.lines['+i+'].m=num(this.value);upd()"></div>'+
      '<div class="r2">'+(x?'<span></span>':'<label class="rec"><input type="checkbox" '+(l.r?'checked':'')+' onchange="M.lines['+i+'].r=this.checked"> Salaire récurrent (chaque mois)</label>')+
      (M.lines.length>1?'<button class="btn sm del" onclick="rmLine('+i+')">Retirer</button>':'')+'</div></div>';
  });
  if(M.lines.length<3)h+='<button class="btn" onclick="addLine()">+ Prélever aussi sur un autre compte</button>';
  h+='<div class="recap"><div class="lbl">'+(x?'Dépense totale':'Salaire total')+'</div><div class="big" id="m-tot">0 €</div><div id="m-after"></div></div><p class="err" id="m-err">'+M.err+'</p>'+
    '<div class="acts">'+(M.id?'<button class="btn del" id="m-del" onclick="delS()">Supprimer</button>':'')+'<button class="btn" onclick="closeM()">Annuler</button><button class="btn pri" onclick="saveS()">Enregistrer</button></div>';
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
  var lines=M.lines.filter(function(l){return l.m>0});
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
  if(id){var d=S.deps.filter(function(x){return x.id===id})[0];M={kind:'d',id:id,c:d.c,m:d.m,date:d.date}}
  else M={kind:'d',id:null,c:c,m:0,date:TODAY};
  M.del=false;
  $('sheet').innerHTML='<h2>'+(id?'Modifier le dépôt':'Ajouter un dépôt')+'</h2>'+
   '<div class="fld"><label class="lbl" for="d-c">Compte</label><select id="d-c" onchange="M.c=this.value">'+KEYS.map(function(k){return '<option value="'+k+'"'+(M.c===k?' selected':'')+'>'+cname(k)+'</option>'}).join('')+'</select></div>'+
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
function refresh(){renderFixed();renderList();if(S.view==='syn')renderSyn()}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('modal').hidden)closeM()});
window.addEventListener('resize',function(){if(S.view==='syn')renderSynBody()});

/* ====================== Synchronisation Google Sheet ====================== */
var CFG=window.CDCF_CONFIG||{},API=CFG.apiUrl||'';
var LS_DATA='cdcfin.data',LS_CODE='cdcfin.code',LS_DEV='cdcfin.dev';
function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
var DEV=lsGet(LS_DEV);if(!DEV){DEV=uid('a');lsSet(LS_DEV,DEV)}
var CODE=lsGet(LS_CODE)||'';
var SY={rev:null,base:null,busy:false,err:'',okAt:0,wait:0,tries:0,sheetUrl:'',saved:''};

function dataObj(){return {init:S.init,initDate:S.initDate,deps:S.deps,sorties:S.sorties,exps:S.exps,goal:S.goal,goalOn:S.goalOn,noauto:S.noauto}}
function emptyData(){return {init:{ent:0,liv:0,esp:0},initDate:DEF_DATE,deps:[],sorties:[],exps:[],goal:1800,goalOn:false,noauto:[]}}
function norm(o){
  var i=o.init||{};
  return {
    init:{ent:+i.ent||0,liv:+i.liv||0,esp:+i.esp||0},
    initDate:o.initDate||DEF_DATE,
    deps:(o.deps||[]).map(function(d){return {id:d.id,date:d.date,c:d.c,m:+d.m}}),
    sorties:(o.sorties||[]).map(function(s){return {id:s.id,date:s.date,lines:s.lines.map(function(l){return {c:l.c,m:+l.m,r:!!l.r}})}}),
    exps:(o.exps||[]).map(function(x){return {id:x.id,date:x.date,label:x.label,lines:x.lines.map(function(l){return {c:l.c,m:+l.m}})}}),
    goal:o.goal!=null?+o.goal:1800,goalOn:!!o.goalOn,noauto:(o.noauto||[]).slice()
  };
}
function setData(o){var n=norm(o);S.init=n.init;S.initDate=n.initDate;S.deps=n.deps;S.sorties=n.sorties;S.exps=n.exps;S.goal=n.goal;S.goalOn=n.goalOn;S.noauto=n.noauto}

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
  return out;
}

function persist(){
  var s=JSON.stringify({rev:SY.rev,base:SY.base,data:dataObj()});
  if(s!==SY.saved){lsSet(LS_DATA,s);SY.saved=s}
}
(function loadLocal(){
  var r=lsGet(LS_DATA);if(!r)return;
  try{var o=JSON.parse(r);setData(o.data||{});SY.rev=(o.rev==null)?null:o.rev;SY.base=o.base||null;SY.saved=r}catch(e){}
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
    okSync();SY.sheetUrl=r.sheetUrl||SY.sheetUrl;
    if(r.empty){SY.rev=r.rev||0;SY.base=JSON.stringify(emptyData());persist();SY.first=false;autoRec();paintSync();return}
    takeRemote(r.state,r.rev,SY.rev===null);paintSync();
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
    if(SY.rev===null)pull();
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
  }else{TODAY=todayISO();SY.wait=0;autoRec();poll()}
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
  refresh();updHist();autoRec();paintSync();
  if(API&&!CODE)showLogin();
  if('serviceWorker' in navigator){
    var had=!!navigator.serviceWorker.controller,rl=false;
    navigator.serviceWorker.register('sw.js').catch(function(){});
    navigator.serviceWorker.addEventListener('controllerchange',function(){if(had&&!rl){rl=true;location.reload()}});
  }
}
start();
