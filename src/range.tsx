/** @jsxImportSource hono/jsx */
// Range vs range equity page. Computation runs in a Web Worker built from the same source strings.
import { ENGINE_JS } from './engine';
import { RANGE_ENGINE_JS, RANGE_JS } from './range-engine';

const WORKER_SRC = ENGINE_JS + RANGE_JS + RANGE_ENGINE_JS +
  `onmessage=function(e){var d=e.data;rangeEquity(d.ranges,d.board,d.dead,d.opt,function(f){postMessage({p:f})},function(r){postMessage({r:r})})};`;

const PRESETS: [string, string][] = [
  ['全部（隨機）', '22+, A2+, K2+, Q2+, J2+, T2+, 92+, 82+, 72+, 62+, 52+, 42+, 32'],
  ['QQ+, AK', 'QQ+, AK'],
  ['TT+, AQ+', 'TT+, AQ+'],
  ['例：較緊開池', '66+, A9s+, KTs+, QTs+, JTs, ATo+, KJo+'],
  ['例：較鬆開池', '22+, A2s+, K8s+, Q9s+, J9s+, T8s+, 98s, 87s, 76s, 65s, A8o+, KTo+, QTo+, JTo'],
];

const UI_JS = `
(function(){
var $=function(id){return document.getElementById(id)};
var S={players:[{text:'AA'},{text:'KK'}],active:0},worker=null,t0=0;
var SY={s:'♠',h:'♥',d:'♦',c:'♣'};
function parsed(i){return parseRange(S.players[i].text)}
function info(i){
  var p=parsed(i),all=rangeCombos(p).length,b=parseCards($('board').value)||[],d=parseCards($('dead').value)||[],u={};
  b.concat(d).forEach(function(c){u[c]=1});
  var live=rangeCombos(p).filter(function(c){return !u[c[0]]&&!u[c[1]]}).length;
  var t=all+' combos（'+(all/1326*100).toFixed(1)+'%）';if(live!==all)t+=' · 移除已知牌後 '+live;
  if(p.errors.length)t+=' · 睇唔明：'+p.errors.join(' ');
  return {text:t,err:p.errors.length>0};
}
function renderPlayers(){
  var box=$('players');box.innerHTML='';
  S.players.forEach(function(pl,i){
    var w=document.createElement('div');w.className='rp'+(S.active===i?' on':'');
    var h=document.createElement('div');h.className='rp-h';
    var b=document.createElement('b');b.textContent=i===0?'玩家 1（你）':'對手 '+i;h.appendChild(b);
    var ed=document.createElement('button');ed.type='button';ed.className='btn sm';ed.textContent=S.active===i?'編輯緊 ▾':'用 grid 編輯';
    ed.onclick=function(){S.active=i;renderAll()};h.appendChild(ed);
    if(S.players.length>2){var x=document.createElement('button');x.type='button';x.className='btn sm';x.textContent='×';x.setAttribute('aria-label','移除');
      x.onclick=function(){S.players.splice(i,1);if(S.active>=S.players.length)S.active=0;clearRes();renderAll()};h.appendChild(x)}
    w.appendChild(h);
    var ta=document.createElement('textarea');ta.rows=2;ta.value=pl.text;ta.spellcheck=false;ta.setAttribute('autocapitalize','off');
    ta.placeholder='例如 TT+, AJs+, KQo, A5s-A2s, AsKd';
    ta.oninput=function(){pl.text=ta.value;S.active=i;clearRes();renderGrid();updInfo()};
    ta.onfocus=function(){if(S.active!==i){S.active=i;renderGrid();markActive()}};
    w.appendChild(ta);
    var s=document.createElement('div');s.className='sub rp-i';w.appendChild(s);
    box.appendChild(w);
  });
  updInfo();
  $('addP').disabled=S.players.length>=6;
}
function markActive(){Array.prototype.forEach.call($('players').children,function(w,i){w.classList.toggle('on',i===S.active);w.querySelector('.btn').textContent=i===S.active?'編輯緊 ▾':'用 grid 編輯'})}
function updInfo(){Array.prototype.forEach.call($('players').children,function(w,i){var x=info(i),e=w.querySelector('.rp-i');e.textContent=x.text;e.classList.toggle('down',x.err)})}
var drag=null;
function renderGrid(){
  var g=$('rgrid'),p=parsed(S.active);g.innerHTML='';
  $('gridLbl').textContent=S.active===0?'玩家 1（你）':'對手 '+S.active;
  for(var r=0;r<13;r++)for(var c=0;c<13;c++){
    var l=cellLabel(r,c),e=document.createElement('div');
    e.className='rc '+(r===c?'pp':c>r?'su':'of')+(p.labels[l]?' sel':'');e.textContent=l.length===3?l.slice(0,2)+l[2]:l;e.dataset.l=l;g.appendChild(e);
  }
}
function setLabel(l,on){
  var p=parsed(S.active);if(on)p.labels[l]=true;else delete p.labels[l];
  S.players[S.active].text=formatRange(p.labels,p.combos);
  var ta=$('players').children[S.active].querySelector('textarea');ta.value=S.players[S.active].text;
  var e=$('rgrid').querySelector('[data-l="'+l+'"]');if(e)e.classList.toggle('sel',on);
}
function cellAt(ev){var t=document.elementFromPoint(ev.clientX,ev.clientY);return t&&t.dataset&&t.dataset.l?t:null}
$('rgrid').addEventListener('pointerdown',function(ev){var t=cellAt(ev);if(!t)return;ev.preventDefault();drag={on:!t.classList.contains('sel'),done:{}};drag.done[t.dataset.l]=1;setLabel(t.dataset.l,drag.on);clearRes();updInfo()});
$('rgrid').addEventListener('pointermove',function(ev){if(!drag)return;var t=cellAt(ev);if(!t||drag.done[t.dataset.l])return;drag.done[t.dataset.l]=1;setLabel(t.dataset.l,drag.on);updInfo()});
document.addEventListener('pointerup',function(){drag=null});
document.addEventListener('pointercancel',function(){drag=null});
function setActiveText(t){S.players[S.active].text=t;clearRes();renderAll()}
$('preset').onchange=function(){if(this.value)setActiveText(this.value);this.value=''};
$('gClear').onclick=function(){setActiveText('')};
$('addP').onclick=function(){if(S.players.length<6){S.players.push({text:''});S.active=S.players.length-1;clearRes();renderAll()}};
$('board').oninput=$('dead').oninput=function(){clearRes();updInfo()};
function renderAll(){renderPlayers();renderGrid()}
function msg(t){$('msg').textContent=t;$('msg').hidden=!t}
function clearRes(){if(!worker)$('res').innerHTML='';msg('')}
function done(){if(worker){worker.terminate();worker=null}$('calc').hidden=false;$('stop').hidden=true}
function show(R){
  done();
  if(R.error){$('res').innerHTML='';return msg(R.error)}
  var h='<div class="tbl-wrap"><table><thead><tr><th>玩家</th><th>範圍</th><th>Equity</th><th>Win</th><th>Tie</th></tr></thead><tbody>';
  S.players.forEach(function(p,i){
    var name=i===0?'你':'對手 '+i,txt=p.text.length>40?p.text.slice(0,40)+'…':p.text;
    h+='<tr><td>'+name+'</td><td class="sub rtxt">'+txt.replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})+'<br>'+R.combos[i]+' combos</td><td><b>'+R.eq[i].toFixed(2)+'%</b>'+(R.exact?'':'<span class="sub"> ±'+R.ci[i].toFixed(2)+'</span>')+'<div class="bar-eq"><i style="width:'+R.eq[i].toFixed(2)+'%"></i></div></td><td>'+R.win[i].toFixed(2)+'%</td><td>'+R.tie[i].toFixed(2)+'%</td></tr>';
  });
  h+='</tbody></table></div><p class="sub" style="margin:8px 0 0">'+(R.exact?'窮舉（exhaustive），結果準確':'Monte Carlo 模擬，± 係 95% 信賴區間（百分點）')+' · '+R.trials.toLocaleString('en-US')+' 個牌局 · '+((Date.now()-t0)/1000).toFixed(2)+' 秒</p>';
  $('res').innerHTML=h;
  try{$('resCard').scrollIntoView({behavior:'smooth',block:'nearest'})}catch(e){}
}
$('calc').onclick=function(){
  msg('');
  var b=parseCards($('board').value),d=parseCards($('dead').value);
  if(!b)return msg('公共牌格式唔啱，例如：Ah Kd 7c');
  if(!d)return msg('已移除嘅牌格式唔啱，例如：2c 3d');
  if(b.length&&b.length<3||b.length>5)return msg('公共牌要係 0、3、4 或 5 張。');
  var bad=[];S.players.forEach(function(p,i){if(parsed(i).errors.length)bad.push(i===0?'你':'對手 '+i)});
  if(bad.length)return msg(bad.join('、')+' 嘅範圍有睇唔明嘅寫法。');
  var u={},dup=false;b.concat(d).forEach(function(c){if(u[c])dup=true;u[c]=1});if(dup)return msg('公共牌同已移除嘅牌有重複。');
  var ranges=S.players.map(function(p,i){return rangeCombos(parsed(i))});
  for(var i=0;i<ranges.length;i++)if(!ranges[i].length)return msg((i===0?'你':'對手 '+i)+' 嘅範圍係空嘅。');
  var opt={iterations:+$('iters').value};
  $('calc').hidden=true;$('stop').hidden=false;$('res').innerHTML='<div class="sub">計算中… <span id="prog"></span></div>';t0=Date.now();
  var payload={ranges:ranges,board:b,dead:d,opt:opt};
  try{
    worker=new Worker(URL.createObjectURL(new Blob([${JSON.stringify(WORKER_SRC).replace(/</g, '\\u003c')}],{type:'text/javascript'})));
    worker.onmessage=function(e){if(e.data.p!==undefined){var p=$('prog');if(p)p.textContent=Math.round(e.data.p*100)+'%'}else show(e.data.r)};
    worker.onerror=function(e){done();msg('計算出錯：'+(e.message||''))};
    worker.postMessage(payload);
  }catch(e){
    // no Worker support: run on the page in chunks
    worker=null;rangeEquity(ranges,b,d,opt,function(f){var p=$('prog');if(p)p.textContent=Math.round(f*100)+'%'},show);
  }
};
$('stop').onclick=function(){done();$('res').innerHTML='<div class="sub">已停止。</div>'};
renderAll();
})();
`;

const CSS = `
#stop[hidden],#calc[hidden]{display:none}
.rps{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));margin-top:12px}
.rp{border:2px solid var(--line);border-radius:10px;padding:8px 10px;background:var(--card)}
.rp.on{border-color:var(--accent)}
.rp-h{display:flex;align-items:center;gap:6px;margin-bottom:6px}.rp-h b{flex:1}
.rp textarea{width:100%;font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);resize:vertical}
.rp-i{font-size:12px;margin-top:4px}
.rgrid{display:grid;grid-template-columns:repeat(13,1fr);gap:2px;margin-top:8px;touch-action:none;user-select:none;-webkit-user-select:none}
.rc{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;border-radius:4px;cursor:pointer;color:var(--muted);background:var(--bg);border:1px solid var(--line);font-variant-numeric:tabular-nums}
.rc.pp{background:color-mix(in srgb,var(--bg) 80%,#ca8a04)}
.rc.su{background:color-mix(in srgb,var(--bg) 88%,#2563eb)}
.rc.sel{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
@media (max-width:480px){.rgrid{gap:1px}.rc{font-size:8.5px;border-radius:3px;letter-spacing:-.02em}}
.rtxt{white-space:normal;max-width:180px;text-align:left}
.bar-eq{height:4px;background:var(--line);border-radius:2px;margin-top:3px;min-width:60px}
.bar-eq i{display:block;height:100%;background:var(--accent);border-radius:2px}
.cardin{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-top:10px}
.cardin input{width:100%}
`;

export const EquityTabs = ({ on }: { on: 'hand' | 'range' | 'texture' }) => (
  <>
    <style dangerouslySetInnerHTML={{ __html: '.etabs{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;margin:6px 0 4px}.etabs a{padding:6px 12px;text-decoration:none;font-size:14px;color:var(--muted)}.etabs a.on{background:var(--accent);color:var(--accent-ink)}' }} />
    <div class="etabs">
      <a href="/equity" class={on === 'hand' ? 'on' : ''}>手牌</a>
      <a href="/equity/range" class={on === 'range' ? 'on' : ''}>範圍 vs 範圍</a>
      <a href="/equity/texture" class={on === 'texture' ? 'on' : ''}>翻牌面質感</a>
    </div>
  </>
);

export const RangePage = () => (
  <>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h1>Equity：範圍 vs 範圍</h1>
    <EquityTabs on="range" />
    <div class="sub">
      用文字輸入範圍（例如 <code>TT+, AJs+, KQo, A5s-A2s</code>，亦可以寫具體手牌 <code>AsKd</code>），或者揀一位玩家再喺 grid 撳／拖選。
      Grid 右上三角係同花（s），左下係唔同花（o），對角係對子。
    </div>
    <div class="rps" id="players"></div>
    <div class="row" style="margin-top:8px">
      <button type="button" class="btn" id="addP">＋ 加對手</button>
    </div>
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <span class="sub">Grid 編輯緊：<b id="gridLbl"></b></span>
        <span class="row">
          <select id="preset" aria-label="預設範圍">
            <option value="">套用預設…</option>
            {PRESETS.map(([l, t]) => <option value={t}>{l}</option>)}
          </select>
          <button type="button" class="btn sm" id="gClear">清除</button>
        </span>
      </div>
      <div class="rgrid" id="rgrid"></div>
    </div>
    <div class="card">
      <div class="cardin">
        <div class="field"><label>公共牌（0 / 3 / 4 / 5 張）</label><input id="board" placeholder="例如 Ah Kd 7c" autocomplete="off" autocapitalize="off" spellcheck={false} /></div>
        <div class="field"><label>已移除嘅牌（可留空）</label><input id="dead" placeholder="例如 2c" autocomplete="off" autocapitalize="off" spellcheck={false} /></div>
        <div class="field">
          <label>模擬次數</label>
          <select id="iters">
            <option value="50000">50,000（快）</option>
            <option value="200000" selected>200,000</option>
            <option value="1000000">1,000,000（準）</option>
          </select>
        </div>
      </div>
      <p class="sub" style="margin-bottom:0">牌嘅寫法：點數 2–9 T J Q K A，花色 s ♠ h ♥ d ♦ c ♣。組合數細嘅時候會自動改用窮舉。</p>
    </div>
    <div class="row">
      <span class="spacer"></span>
      <button type="button" class="btn" id="stop" hidden>停止</button>
      <button type="button" class="btn primary" id="calc">計算 Equity</button>
    </div>
    <div class="warn" id="msg" hidden style="margin-top:10px"></div>
    <div class="card" id="resCard" style="padding-top:6px">
      <div id="res"><div class="sub">結果會喺度顯示。</div></div>
    </div>
    <noscript><div class="warn">呢頁需要 JavaScript。</div></noscript>
    <script dangerouslySetInnerHTML={{ __html: ENGINE_JS + RANGE_JS + RANGE_ENGINE_JS + UI_JS }} />
  </>
);
