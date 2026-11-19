// Board texture analysis: hand-class distribution and per-combo equity distribution of a range on a flop/turn.
// Plain ES5 source text (Worker + page + tests). Depends on eval7 / straightHi (ENGINE_JS) and RANGE_JS.

export const TEXTURE_JS = `
/* hand classes, strongest first; every combo goes into exactly one (its highest) */
var HC=[
  ['sf','同花順'],['quads','四條'],['fh','葫蘆'],['flush','同花'],['straight','順子'],
  ['set','Set（暗三條）'],['trips','Trips（明三條）'],['twopair','兩對'],
  ['overpair','超對（overpair）'],['toppair','頂對（top pair）'],['midpair','中對（middle pair）'],['weakpair','弱對（bottom / under pair）'],
  ['combo','組合聽牌（同花 + 順子）'],['fd','同花聽牌（flush draw）'],['oesd','兩頭順聽牌（OESD）'],['gutshot','卡順（gutshot）'],
  ['air','空氣（air）']
];
/* hole: [c1,c2]; board: 3..5 cards. Classifies by what the hole cards contribute, so board pairs / trips
   that everyone shares do not count as the player's made hand. */
function classify(hole,board){
  var all=hole.concat(board),cat=eval7(all,all.length)>>20;
  if(cat===8)return 'sf';if(cat===7)return 'quads';if(cat===6)return 'fh';if(cat===5)return 'flush';if(cat===4)return 'straight';
  var cnt=[0,0,0,0,0,0,0,0,0,0,0,0,0],i;for(i=0;i<board.length;i++)cnt[board[i]>>2]++;
  var distinct=[];for(i=12;i>=0;i--)if(cnt[i])distinct.push(i);
  var a=hole[0]>>2,b=hole[1]>>2;
  if(a===b){
    if(cnt[a])return 'set';
    if(a>distinct[0])return 'overpair';
    if(distinct.length>1&&a>distinct[1])return 'midpair';
    return 'weakpair';
  }
  if(cnt[a]&&cnt[b])return 'twopair';
  if(cnt[a]||cnt[b]){
    var r=cnt[a]?a:b;
    if(cnt[r]>=2)return 'trips';
    var k=distinct.indexOf(r);
    return k===0?'toppair':k===1?'midpair':'weakpair';
  }
  if(board.length>=5)return 'air';
  // draws: need the hole cards to take part
  var fd=false,s,sc=[0,0,0,0];for(i=0;i<all.length;i++)sc[all[i]&3]++;
  for(s=0;s<4;s++)if(sc[s]===4&&((hole[0]&3)===s||(hole[1]&3)===s))fd=true;
  var mask=0,bmask=0;for(i=0;i<all.length;i++)mask|=1<<(all[i]>>2);for(i=0;i<board.length;i++)bmask|=1<<(board[i]>>2);
  var outs=0;for(var q=0;q<13;q++){if(mask&(1<<q))continue;if(straightHi(mask|(1<<q))>=0&&straightHi(bmask|(1<<q))<0)outs++}
  var sd=outs>=2?'oesd':outs===1?'gutshot':null;
  if(fd&&sd)return 'combo';if(fd)return 'fd';if(sd)return sd;
  return 'air';
}
/* {class: count} for the combos of a range that do not clash with the board/dead */
function classDist(combos,board){
  var out={},n=0;HC.forEach(function(h){out[h[0]]=0});
  combos.forEach(function(c){out[classify(c,board)]++;n++});
  return {counts:out,total:n};
}
/* per-combo equity of range A against range B on a 3/4-card board, by sampling villain combo + run-out.
   Returns Float64Array of equities in [0,1], aligned with A. */
function comboEquities(A,B,board,samples,progress){
  var used={},i;board.forEach(function(c){used[c]=1});
  var deck=[];for(i=0;i<52;i++)if(!used[i])deck.push(i);
  var need=5-board.length,h=new Array(7),v=new Array(7),bd=board.slice(),out=new Float64Array(A.length),mark=new Int32Array(52),stamp=0;
  for(i=board.length;i<5;i++)bd.push(0);
  for(var a=0;a<A.length;a++){
    var x=A[a],ok=B.filter(function(c){return c[0]!==x[0]&&c[0]!==x[1]&&c[1]!==x[0]&&c[1]!==x[1]});
    if(!ok.length){out[a]=NaN;continue}
    var eq=0;h[0]=x[0];h[1]=x[1];
    for(var t=0;t<samples;t++){
      stamp++;mark[x[0]]=mark[x[1]]=stamp;
      var y=ok[Math.floor(Math.random()*ok.length)];mark[y[0]]=mark[y[1]]=stamp;v[0]=y[0];v[1]=y[1];
      for(var j=board.length;j<5;j++){var z;do{z=deck[Math.floor(Math.random()*deck.length)]}while(mark[z]===stamp);mark[z]=stamp;bd[j]=z}
      for(j=0;j<5;j++){h[2+j]=bd[j];v[2+j]=bd[j]}
      var sh=eval7(h,7),sv=eval7(v,7);eq+=sh>sv?1:sh===sv?0.5:0;
    }
    out[a]=eq/samples;
    if(progress&&a%16===0)progress(a/A.length);
  }
  return out;
}
/* summary of an equity array: mean (range advantage), nut share (> 80%), histogram for k buckets */
function eqSummary(eqs,k){
  var n=0,sum=0,nut=0,hist=[];for(var i=0;i<k;i++)hist.push(0);
  for(i=0;i<eqs.length;i++){var e=eqs[i];if(e!==e)continue;n++;sum+=e;if(e>0.8)nut++;hist[Math.min(k-1,Math.floor(e*k))]++}
  return {n:n,mean:n?sum/n:0,nut:n?nut/n:0,hist:hist.map(function(c){return n?c/n:0})};
}
/* full analysis for two ranges; done({hero:{dist,eqs},vill:{dist,eqs}}) */
function textureAnalysis(heroCombos,villCombos,board,samples,progress,done){
  var u={};board.forEach(function(c){u[c]=1});
  var live=function(r){return r.filter(function(c){return !u[c[0]]&&!u[c[1]]})};
  var H=live(heroCombos),V=live(villCombos);
  if(!H.length||!V.length)return done({error:(!H.length?'你':'對手')+' 嘅範圍喺移除公共牌之後冇可用 combo。'});
  var tot=H.length+V.length;
  var he=comboEquities(H,V,board,samples,function(f){if(progress)progress(f*H.length/tot)});
  var ve=comboEquities(V,H,board,samples,function(f){if(progress)progress((H.length+f*V.length)/tot)});
  done({hero:{dist:classDist(H,board),eqs:Array.prototype.slice.call(he)},vill:{dist:classDist(V,board),eqs:Array.prototype.slice.call(ve)}});
}
`;
