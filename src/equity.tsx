/** @jsxImportSource hono/jsx */
// Texas Hold'em equity calculator. All computation runs in the browser.

import { ENGINE_JS } from './engine';
import { EquityTabs } from './range';
export { ENGINE_JS };

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
    <EquityTabs on="hand" />
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
