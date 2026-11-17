/** @jsxImportSource hono/jsx */
// Texas Hold'em equity calculator. All computation runs in the browser.

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

const UI_JS = `
(function(){
var RK='23456789TJQKA',SY=['♠','♥','♦','♣'],SL='shdc';
var S={hero:[],board:[],dead:[],opps:[[]]},active='hero',busy=false;
var $=function(id){return document.getElementById(id)};
function cardEl(c,cls){var e=document.createElement('span');e.className='pc'+((c&3)===1||(c&3)===2?' red':'')+(cls?' '+cls:'');e.textContent=RK[c>>2]+SY[c&3];e.dataset.c=c;return e}
function limit(k){return k==='hero'?2:k==='board'?5:k==='dead'?52:2}
function get(k){if(k.indexOf('opp')===0)return S.opps[+k.slice(3)];return S[k]}
function usedAll(){var u={};['hero','board','dead'].forEach(function(k){S[k].forEach(function(c){u[c]=k})});S.opps.forEach(function(o,i){o.forEach(function(c){u[c]='opp'+i})});return u}
function slot(k,label,hint){
  var a=get(k),w=document.createElement('div');w.className='slot'+(active===k?' on':'');w.onclick=function(){active=k;render()};
  var h=document.createElement('div');h.className='slot-h';
  var t=document.createElement('b');t.textContent=label;h.appendChild(t);
  var r=document.createElement('span');r.className='sub hint';r.textContent=hint;h.appendChild(r);
  if(k.indexOf('opp')===0&&S.opps.length>1){var x=document.createElement('button');x.type='button';x.className='btn sm x';x.textContent='×';x.setAttribute('aria-label','移除'+label);x.onclick=function(e){e.stopPropagation();S.opps.splice(+k.slice(3),1);active='hero';clearRes();render()};h.appendChild(x)}
  w.appendChild(h);
  var cs=document.createElement('div');cs.className='cards';
  a.forEach(function(c,i){var e=cardEl(c);e.title='撳一下移除';e.onclick=function(ev){ev.stopPropagation();a.splice(i,1);active=k;clearRes();render()};cs.appendChild(e)});
  var lim=limit(k);if(lim<=5)for(var i=a.length;i<lim;i++){var ph=document.createElement('span');ph.className='pc empty';ph.textContent='?';cs.appendChild(ph)}
  w.appendChild(cs);w.id='slot-'+k;return w;
}
function render(){
  var box=$('slots');box.innerHTML='';
  box.appendChild(slot('hero','你嘅手牌','2 張'));
  S.opps.forEach(function(o,i){box.appendChild(slot('opp'+i,'對手 '+(i+1),o.length<2?'留空＝隨機':'2 張'))});
  box.appendChild(slot('board','公共牌（Board）','0–5 張，可留空'));
  box.appendChild(slot('dead','已移除嘅牌','可留空'));
  $('addOpp').disabled=S.opps.length>=8;
  var u=usedAll(),g=$('grid');g.innerHTML='';
  for(var s=0;s<4;s++)for(var r=12;r>=0;r--){(function(c){var e=cardEl(c,u[c]!==undefined?'used':'');e.onclick=function(){pick(c)};g.appendChild(e)})(r*4+s)}
  $('activeLbl').textContent=labelOf(active);
}
function labelOf(k){return k==='hero'?'你嘅手牌':k==='board'?'公共牌':k==='dead'?'已移除嘅牌':'對手 '+(+k.slice(3)+1)}
function nextSlot(){var order=['hero'].concat(S.opps.map(function(_,i){return 'opp'+i}),['board']);for(var i=0;i<order.length;i++)if(get(order[i]).length<limit(order[i]))return order[i];return active}
function pick(c){
  if(busy)return;var u=usedAll();
  if(u[c]!==undefined){var a=get(u[c]);a.splice(a.indexOf(c),1);clearRes();render();return}
  var a=get(active);if(a.length>=limit(active)){msg(labelOf(active)+'已經滿咗。');return}
  a.push(c);a.sort(function(x,y){return y-x});
  if(a.length>=limit(active)&&active!=='dead')active=nextSlot();
  clearRes();render();
}
function msg(t){$('msg').textContent=t;$('msg').hidden=!t}
function clearRes(){$('res').innerHTML='';msg('')}
function pct(x){return x.toFixed(2)+'%'}
function calc(){
  if(busy)return;msg('');
  if(S.hero.length!==2)return msg('請揀齊你嘅 2 張手牌。');
  if(S.board.length>0&&S.board.length<3)return msg('公共牌要係 0、3、4 或 5 張。');
  var players=[S.hero].concat(S.opps),labels=['你'].concat(S.opps.map(function(o,i){return '對手 '+(i+1)}));
  var left=52-S.hero.length-S.board.length-S.dead.length;S.opps.forEach(function(o){left-=o.length});
  var need=5-S.board.length;S.opps.forEach(function(o){need+=2-o.length});
  if(need>left)return msg('剩餘嘅牌唔夠發。');
  busy=true;$('calc').disabled=true;$('res').innerHTML='<div class="sub">計算中… <span id="prog"></span></div>';
  var t0=Date.now();
  setTimeout(function(){equity(players.map(function(p){return p.slice()}),S.board.slice(),S.dead.slice(),{},function(f){var p=$('prog');if(p)p.textContent=Math.round(f*100)+'%'},function(R){
    busy=false;$('calc').disabled=false;
    var h='<div class="tbl-wrap"><table><thead><tr><th>玩家</th><th>手牌</th><th>Equity</th><th>Win</th><th>Tie</th></tr></thead><tbody>';
    players.forEach(function(p,i){
      var cards=p.length?p.map(function(c){return '<span class="pc sm'+((c&3)===1||(c&3)===2?' red':'')+'">'+RK[c>>2]+SY[c&3]+'</span>'}).join(''):'<span class="sub">隨機</span>';
      if(p.length===1)cards+='<span class="sub"> + 隨機</span>';
      h+='<tr><td>'+labels[i]+'</td><td>'+cards+'</td><td><b>'+pct(R.eq[i])+'</b><div class="bar-eq"><i style="width:'+R.eq[i].toFixed(2)+'%"></i></div></td><td>'+pct(R.win[i])+'</td><td>'+pct(R.tie[i])+'</td></tr>';
    });
    h+='</tbody></table></div><p class="sub" style="margin:8px 0 0">'+(R.exact?'窮舉（exhaustive）':'Monte Carlo 模擬')+' · '+R.trials.toLocaleString('en-US')+' 個牌局 · '+((Date.now()-t0)/1000).toFixed(2)+' 秒</p>';
    $('res').innerHTML=h;
    try{$('resCard').scrollIntoView({behavior:'smooth',block:'nearest'})}catch(e){}
  })},10);
}
$('addOpp').onclick=function(){if(S.opps.length<8){S.opps.push([]);active='opp'+(S.opps.length-1);clearRes();render()}};
$('reset').onclick=function(){S={hero:[],board:[],dead:[],opps:[[]]};active='hero';clearRes();render()};
$('calc').onclick=calc;
render();
})();
`;

const CSS = `
.slots{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
#slot-board,#slot-dead{grid-column:1/-1}
.slot{border:2px solid var(--line);border-radius:10px;padding:8px 10px;cursor:pointer;background:var(--card)}
.slot.on{border-color:var(--accent)}
.slot-h{display:flex;align-items:center;gap:6px;min-height:30px}.slot-h b{white-space:nowrap}
.slot-h .hint{flex:1;text-align:right;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.btn.x{min-height:26px;padding:0 8px;font-size:16px;line-height:1}
.cards{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;min-height:44px}
.pc{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:44px;padding:0 4px;border:1px solid var(--line);border-radius:6px;background:#fff;color:#1c1917;font-weight:700;font-size:15px;cursor:pointer;user-select:none}
.pc.red{color:#c81e1e}
.pc.empty{background:transparent;color:var(--muted);border-style:dashed;cursor:inherit}
.pc.sm{min-width:28px;height:30px;font-size:13px;margin-right:3px;cursor:default}
.deck{display:grid;grid-template-columns:repeat(13,1fr);gap:4px;margin-top:10px}
.deck .pc{min-width:0;height:40px;padding:0;font-size:13px}
.deck .pc.used{opacity:.22}
@media (max-width:480px){.deck{gap:2px}.deck .pc{height:36px;font-size:11px;border-radius:4px}}
.bar-eq{height:4px;background:var(--line);border-radius:2px;margin-top:3px;min-width:60px}
.bar-eq i{display:block;height:100%;background:var(--accent);border-radius:2px}
`;

export const EquityPage = () => (
  <>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h1>Equity 計算機</h1>
    <div class="sub">揀一個欄位，再喺下面撳牌加入；撳已揀嘅牌可以移除。對手手牌留空就當隨機牌。</div>
    <div class="slots" id="slots" style="margin-top:12px"></div>
    <div class="card">
      <div class="sub">而家加牌去：<b id="activeLbl"></b></div>
      <div class="deck" id="grid"></div>
    </div>
    <div class="row" style="margin-top:10px">
      <button type="button" class="btn" id="addOpp">＋ 加對手</button>
      <button type="button" class="btn" id="reset">全部清除</button>
      <span class="spacer"></span>
      <button type="button" class="btn primary" id="calc">計算 Equity</button>
    </div>
    <div class="warn" id="msg" hidden style="margin-top:10px"></div>
    <div class="card" id="resCard" style="padding-top:6px">
      <div id="res"><div class="sub">結果會喺度顯示。</div></div>
    </div>
    <noscript><div class="warn">呢頁需要 JavaScript。</div></noscript>
    <script dangerouslySetInnerHTML={{ __html: ENGINE_JS + UI_JS }} />
  </>
);
