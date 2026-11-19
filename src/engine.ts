// Texas Hold'em hand evaluator and equity engine, shipped to the browser as source text.

/**
 * Client-side engine (plain ES5 so it can be inlined and also eval'd in tests).
 * Card = 0..51, rank = c >> 2 (0 = '2' .. 12 = 'A'), suit = c & 3 (s h d c).
 * eval7 returns a comparable score: category << 20 | ranks packed in 4-bit nibbles.
 */
export const ENGINE_JS = `
function hiBit(m){return 31-Math.clz32(m)}
function kick(m,k,sh){var v=0;for(var i=0;i<k&&m;i++){var b=hiBit(m);v|=b<<(sh-4*i);m&=~(1<<b)}return v}
function straightHi(m){for(var h=12;h>=4;h--){if(((m>>(h-4))&31)===31)return h}return (m&0x100F)===0x100F?3:-1}
function eval7(cs,n){
  var cnt=[0,0,0,0,0,0,0,0,0,0,0,0,0],sm=[0,0,0,0],sc=[0,0,0,0],all=0,i,r,s;
  for(i=0;i<n;i++){var c=cs[i];r=c>>2;s=c&3;cnt[r]++;sm[s]|=1<<r;sc[s]++;all|=1<<r}
  for(s=0;s<4;s++)if(sc[s]>=5){var sf=straightHi(sm[s]);return sf>=0?(8<<20)|sf:(5<<20)|kick(sm[s],5,16)}
  var q=-1,t=-1,t2=-1,p1=-1,p2=-1;
  for(r=12;r>=0;r--){var k=cnt[r];if(k===4)q=r;else if(k===3){if(t<0)t=r;else if(t2<0)t2=r}else if(k===2){if(p1<0)p1=r;else if(p2<0)p2=r}}
  if(q>=0)return (7<<20)|(q<<16)|(hiBit(all&~(1<<q))<<12);
  if(t>=0&&(t2>=0||p1>=0))return (6<<20)|(t<<16)|(Math.max(t2,p1)<<12);
  var st=straightHi(all);if(st>=0)return (4<<20)|st;
  if(t>=0)return (3<<20)|(t<<16)|kick(all&~(1<<t),2,12);
  if(p2>=0)return (2<<20)|(p1<<16)|(p2<<12)|(hiBit(all&~(1<<p1)&~(1<<p2))<<8);
  if(p1>=0)return (1<<20)|(p1<<16)|kick(all&~(1<<p1),3,12);
  return kick(all,5,16);
}
function choose(n,k){if(k<0||k>n)return 0;var v=1;for(var i=1;i<=k;i++)v=v*(n-k+i)/i;return Math.round(v)}
/* players: array of known-card arrays (0..2 cards each); board: 0..5 cards; dead: any.
   Calls done({eq,win,tie,trials,exact}) — percentages per player. */
function equity(players,board,dead,opt,progress,done){
  opt=opt||{};var used={},i,j,n=players.length;
  players.concat([board,dead]).forEach(function(a){a.forEach(function(c){used[c]=1})});
  var deck=[];for(i=0;i<52;i++)if(!used[i])deck.push(i);
  var bNeed=5-board.length,pNeed=0;players.forEach(function(p){pNeed+=2-p.length});
  var eq=new Float64Array(n),win=new Float64Array(n),tie=new Float64Array(n),trials=0;
  var hands=players.map(function(p){var h=new Array(7);for(var k=0;k<p.length;k++)h[k]=p[k];return h});
  var sc=new Array(n);
  function score(bd){
    var best=-1,cntBest=0,k;
    for(k=0;k<n;k++){var h=hands[k];for(var b=0;b<5;b++)h[2+b]=bd[b];var v=eval7(h,7);sc[k]=v;if(v>best){best=v;cntBest=1}else if(v===best)cntBest++}
    for(k=0;k<n;k++)if(sc[k]===best){eq[k]+=1/cntBest;if(cntBest===1)win[k]++;else tie[k]++}
    trials++;
  }
  function finish(exact){var f=function(a){return Array.prototype.map.call(a,function(x){return trials?100*x/trials:0})};done({eq:f(eq),win:f(win),tie:f(tie),trials:trials,exact:exact})}
  var bd=board.slice();for(i=board.length;i<5;i++)bd.push(0);
  var combos=pNeed===0?choose(deck.length,bNeed):Infinity;
  if(combos<=(opt.maxExact||2000000)){
    var idx=[];
    (function rec(start,d){if(d===bNeed){score(bd);return}for(var x=start;x<deck.length;x++){bd[board.length+d]=deck[x];rec(x+1,d+1)}})(0,0);
    return finish(true);
  }
  var N=opt.iterations||200000,chunk=opt.chunk||20000,L=deck.length,dk=deck.slice(),M=pNeed+bNeed;
  (function step(){
    var end=Math.min(N,trials+chunk);
    while(trials<end){
      for(j=0;j<M;j++){var r=j+Math.floor(Math.random()*(L-j)),tmp=dk[j];dk[j]=dk[r];dk[r]=tmp}
      var p=0;
      for(i=0;i<n;i++)for(j=players[i].length;j<2;j++)hands[i][j]=dk[p++];
      for(j=board.length;j<5;j++)bd[j]=dk[p++];
      score(bd);
    }
    if(trials<N){if(progress)progress(trials/N);setTimeout(step,0)}else finish(false);
  })();
}
`;
