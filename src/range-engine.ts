// Range parsing / formatting and range-vs-range equity. Plain ES5 source text: it runs in a Web Worker
// and on the page, and the tests eval it in Node. Depends on eval7 / choose from ENGINE_JS.
//
// Cards: 0..51, rank = c >> 2 (0 = '2' .. 12 = 'A'), suit = c & 3 (s h d c).
// Hand classes ("labels"): 'AA', 'AKs', 'AKo' — 169 in total, 1326 combos.

export const RANGE_JS = `
var RR='23456789TJQKA',RS='shdc';
function rIdx(ch){return RR.indexOf(String(ch).toUpperCase())}
/* grid cell (row, col), 0 = Ace: diagonal pairs, upper-right suited, lower-left offsuit */
function cellLabel(r,c){var a=12-r,b=12-c;if(r===c)return RR[a]+RR[a];if(c>r)return RR[a]+RR[b]+'s';return RR[b]+RR[a]+'o'}
function labelCombos(l){
  var a=rIdx(l[0]),b=rIdx(l[1]),out=[],s,t;
  if(a===b){for(s=0;s<4;s++)for(t=s+1;t<4;t++)out.push([a*4+s,a*4+t])}
  else if(l[2]==='s'){for(s=0;s<4;s++)out.push([a*4+s,b*4+s])}
  else{for(s=0;s<4;s++)for(t=0;t<4;t++)if(s!==t)out.push([a*4+s,b*4+t])}
  return out;
}
function labelSize(l){return l.length===2?6:l[2]==='s'?4:12}
function cardStr(c){return RR[c>>2]+RS[c&3]}
function lbl(hi,lo,suf){return hi===lo?RR[hi]+RR[hi]:RR[hi]+RR[lo]+suf}
/* text -> {labels:{AKs:true,...}, combos:[[c1,c2],...] (explicit combos like AsKd), errors:[token,...]} */
function parseRange(text){
  var out={labels:{},combos:[],errors:[]},seen={};
  String(text||'').split(/[\\s,;]+/).forEach(function(tok){
    if(!tok)return;
    var m,R='([2-9TJQKAtjqka])';
    function add(hi,lo,suf){if(hi===lo){out.labels[lbl(hi,hi)]=true;return}
      if(lo>hi){var x=hi;hi=lo;lo=x}
      if(!suf||suf==='s')out.labels[lbl(hi,lo,'s')]=true;
      if(!suf||suf==='o')out.labels[lbl(hi,lo,'o')]=true}
    if((m=new RegExp('^'+R+'([shdc])'+R+'([shdc])$').exec(tok))){
      var c1=rIdx(m[1])*4+RS.indexOf(m[2]),c2=rIdx(m[3])*4+RS.indexOf(m[4]);
      if(c1===c2){out.errors.push(tok);return}
      var k=Math.min(c1,c2)+','+Math.max(c1,c2);if(!seen[k]){seen[k]=1;out.combos.push([Math.max(c1,c2),Math.min(c1,c2)])}return}
    var T=tok.toUpperCase().replace(/([SO])(\\+?)$/,function(_,s,p){return s.toLowerCase()+p}).replace(/([SO])-/,function(_,s){return s.toLowerCase()+'-'});
    var P='([2-9TJQKA])';
    if((m=new RegExp('^'+P+'\\\\1(\\\\+)?$').exec(T))){var r=rIdx(m[1]);for(var i=r;i<=(m[2]?12:r);i++)add(i,i);return}
    if((m=new RegExp('^'+P+'\\\\1-'+P+'\\\\2$').exec(T))){var a=rIdx(m[1]),b=rIdx(m[2]);for(var j=Math.min(a,b);j<=Math.max(a,b);j++)add(j,j);return}
    if((m=new RegExp('^'+P+P+'([so])?(\\\\+)?$').exec(T))){
      var h=rIdx(m[1]),l=rIdx(m[2]);if(h===l){out.errors.push(tok);return}
      if(l>h){var y=h;h=l;l=y}
      if(m[4]){for(var q=l;q<h;q++)add(h,q,m[3])}else add(h,l,m[3]);return}
    if((m=new RegExp('^'+P+P+'([so])?-'+P+P+'([so])?$').exec(T))){
      var h1=rIdx(m[1]),k1=rIdx(m[2]),h2=rIdx(m[4]),k2=rIdx(m[5]);
      if(h1!==h2||(m[3]||'')!==(m[6]||'')||k1===h1||k2===h2){out.errors.push(tok);return}
      for(var z=Math.min(k1,k2);z<=Math.max(k1,k2);z++)if(z!==h1)add(h1,z,m[3]);return}
    out.errors.push(tok);
  });
  return out;
}
/* {labels, combos} -> canonical text, e.g. "TT+, 66-22, AJs+, A5s-A2s, KQo, AsKd" */
function formatRange(labels,combos){
  var parts=[],r,hi,k;
  function runs(list){var o=[],cur=null;list.forEach(function(x){if(cur&&x===cur[1]-1)cur[1]=x;else{cur=[x,x];o.push(cur)}});return o}
  var pr=[];for(r=12;r>=0;r--)if(labels[lbl(r,r)])pr.push(r);
  runs(pr).forEach(function(u){
    if(u[0]===12&&u[1]<12)parts.push(lbl(u[1],u[1])+'+');
    else if(u[0]===u[1])parts.push(lbl(u[0],u[0]));
    else parts.push(lbl(u[0],u[0])+'-'+lbl(u[1],u[1]));
  });
  for(hi=12;hi>=1;hi--){
    var ks={s:[],o:[]};
    for(k=hi-1;k>=0;k--){if(labels[lbl(hi,k,'s')])ks.s.push(k);if(labels[lbl(hi,k,'o')])ks.o.push(k)}
    var groups=ks.s.join()===ks.o.join()?[['',ks.s]]:[['s',ks.s],['o',ks.o]];
    groups.forEach(function(g){runs(g[1]).forEach(function(u){
      var t=RR[hi];
      if(u[0]===hi-1&&u[1]<u[0])parts.push(t+RR[u[1]]+g[0]+'+');
      else if(u[0]===u[1])parts.push(t+RR[u[0]]+g[0]);
      else parts.push(t+RR[u[0]]+g[0]+'-'+t+RR[u[1]]+g[0]);
    })});
  }
  (combos||[]).forEach(function(c){parts.push(cardStr(c[0])+cardStr(c[1]))});
  return parts.join(', ');
}
/* all combos of a parsed range (labels + explicit combos), deduplicated */
function rangeCombos(p){
  var out=[],seen={};
  function push(c){var a=Math.max(c[0],c[1]),b=Math.min(c[0],c[1]),k=a*52+b;if(!seen[k]){seen[k]=1;out.push([a,b])}}
  for(var l in p.labels)if(p.labels[l])labelCombos(l).forEach(push);
  p.combos.forEach(push);
  return out;
}
/* "Ah Kd 7c" / "AhKd7c" -> [cards] or null */
function parseCards(str){
  var s=String(str||'').replace(/[\\s,]+/g,''),out=[],seen={};
  if(s.length%2)return null;
  for(var i=0;i<s.length;i+=2){var r=rIdx(s[i]),u=RS.indexOf(s[i+1].toLowerCase());if(r<0||u<0)return null;var c=r*4+u;if(seen[c])return null;seen[c]=1;out.push(c)}
  return out;
}
`;

export const RANGE_ENGINE_JS = `
/* ranges: array (one per player) of combo lists [[c1,c2],...]; board 0..5 cards; dead: any.
   done({eq,win,tie,ci,trials,exact,combos}) — percentages; ci = 95% half-width in percentage points (0 when exact).
   done({error}) when a range has no usable combo or the ranges cannot be dealt together. */
function rangeEquity(ranges,board,dead,opt,progress,done){
  opt=opt||{};var n=ranges.length,used={},i,j,k;
  board.concat(dead).forEach(function(c){used[c]=1});
  var R=ranges.map(function(r){return r.filter(function(c){return !used[c[0]]&&!used[c[1]]})});
  for(i=0;i<n;i++)if(!R[i].length)return done({error:'玩家 '+(i+1)+' 嘅範圍喺移除已知牌之後冇可用 combo。'});
  var deck=[];for(i=0;i<52;i++)if(!used[i])deck.push(i);
  var bNeed=5-board.length,eq=new Float64Array(n),win=new Float64Array(n),tie=new Float64Array(n),sq=new Float64Array(n),trials=0;
  var hands=[];for(i=0;i<n;i++)hands.push(new Array(7));
  var bd=board.slice();for(i=board.length;i<5;i++)bd.push(0);
  var sc=new Array(n),share=new Float64Array(n);
  function score(){
    var best=-1,cnt=0;
    for(k=0;k<n;k++){var h=hands[k];for(var b=0;b<5;b++)h[2+b]=bd[b];var v=eval7(h,7);sc[k]=v;if(v>best){best=v;cnt=1}else if(v===best)cnt++}
    for(k=0;k<n;k++){var s=sc[k]===best?1/cnt:0;share[k]=s;eq[k]+=s;sq[k]+=s*s;if(s===1)win[k]++;else if(s>0)tie[k]++}
    trials++;
  }
  function finish(exact){
    var f=function(a){return Array.prototype.map.call(a,function(x){return trials?100*x/trials:0})};
    var ci=Array.prototype.map.call(eq,function(s,i){if(exact||trials<2)return 0;var m=s/trials,v=Math.max(0,sq[i]/trials-m*m);return 196*Math.sqrt(v/trials)});
    done({eq:f(eq),win:f(win),tie:f(tie),ci:ci,trials:trials,exact:exact,combos:R.map(function(r){return r.length})});
  }
  // exhaustive when the deal space is small: valid combo tuples x board run-outs
  var tuples=1;for(i=0;i<n;i++)tuples*=R[i].length;
  var runouts=choose(deck.length-2*n,bNeed),maxExact=opt.maxExact||1500000;
  if(tuples*runouts<=maxExact){
    var taken={};
    (function pick(p){
      if(p===n){
        var rest=deck.filter(function(c){return !taken[c]});
        (function rec(start,d){if(d===bNeed){score();return}for(var x=start;x<rest.length;x++){bd[board.length+d]=rest[x];rec(x+1,d+1)}})(0,0);
        return;
      }
      for(var t=0;t<R[p].length;t++){var c=R[p][t];if(taken[c[0]]||taken[c[1]])continue;
        taken[c[0]]=taken[c[1]]=1;hands[p][0]=c[0];hands[p][1]=c[1];pick(p+1);taken[c[0]]=taken[c[1]]=0}
    })(0);
    if(!trials)return done({error:'各玩家嘅範圍冇辦法同時發出（全部撞牌）。'});
    return finish(true);
  }
  // Monte Carlo: rejection-sample a conflict-free combo tuple (uniform over valid deals), then deal the board
  var N=opt.iterations||200000,chunk=opt.chunk||20000,mark=new Int32Array(52),stamp=0,fails=0;
  (function step(){
    var end=Math.min(N,trials+chunk);
    while(trials<end){
      stamp++;var ok=true;
      for(i=0;i<n&&ok;i++){var c=R[i][Math.floor(Math.random()*R[i].length)];
        if(mark[c[0]]===stamp||mark[c[1]]===stamp)ok=false;else{mark[c[0]]=mark[c[1]]=stamp;hands[i][0]=c[0];hands[i][1]=c[1]}}
      if(!ok){if(++fails>50*N+100000)return trials?finish(false):done({error:'各玩家嘅範圍幾乎冇辦法同時發出（撞牌太多）。'});continue}
      for(j=board.length;j<5;j++){var x;do{x=deck[Math.floor(Math.random()*deck.length)]}while(mark[x]===stamp);mark[x]=stamp;bd[j]=x}
      score();
    }
    if(trials<N){if(progress)progress(trials/N);setTimeout(step,0)}else finish(false);
  })();
}
`;
