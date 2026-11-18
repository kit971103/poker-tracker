/** @jsxImportSource hono/jsx */
// Board texture page: how two ranges hit a flop (or turn).
import { ENGINE_JS } from './engine';
import { RANGE_JS } from './range-engine';
import { EquityTabs } from './range';
import { TEXTURE_JS } from './texture-engine';

const WORKER_SRC = ENGINE_JS + RANGE_JS + TEXTURE_JS +
  `onmessage=function(e){var d=e.data;textureAnalysis(d.h,d.v,d.board,d.samples,function(f){postMessage({p:f})},function(r){postMessage({r:r})})};`;

const UI_JS = `
(function(){
var $=function(id){return document.getElementById(id)},worker=null,last=null,k=10,t0=0;
function info(id,out){var p=parseRange($(id).value),n=rangeCombos(p).length;$(out).textContent=n+' combos（'+(n/1326*100).toFixed(1)+'%）'+(p.errors.length?' · 睇唔明：'+p.errors.join(' '):'');$(out).classList.toggle('down',p.errors.length>0)}
['hero','vill'].forEach(function(id){$(id).oninput=function(){info(id,id+'Info')};info(id,id+'Info')});
function msg(t){$('msg').textContent=t;$('msg').hidden=!t}
function pct(x,d){return (x*100).toFixed(d===undefined?1:d)+'%'}
function esc(s){return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
function hist(s,cls){
  var max=Math.max.apply(null,s.hist.concat([0.0001])),h='<div class="hist '+cls+'">';
  s.hist.forEach(function(v,i){var lo=Math.round(i*100/k),hi=Math.round((i+1)*100/k);
    h+='<div class="hb" title="'+lo+'–'+hi+'%：'+pct(v)+' 嘅 combos"><i style="height:'+(v/max*100).toFixed(1)+'%"></i></div>'});
  h+='</div><div class="hx"><span>0%</span><span>50%</span><span>100%</span></div>';return h;
}
function render(){
  if(!last)return;var R=last,hs=eqSummary(R.hero.eqs,k),vs=eqSummary(R.vill.eqs,k);
  var h='<h2 style="margin-top:4px">Range advantage 同 nut advantage</h2><div class="tbl-wrap"><table><thead><tr><th></th><th>Range advantage<br><span class="sub">平均 equity</span></th><th>Nut advantage<br><span class="sub">equity &gt; 80% 嘅 combos</span></th><th>Combos</th></tr></thead><tbody>';
  h+='<tr><td>你</td><td><b>'+pct(hs.mean)+'</b></td><td><b>'+pct(hs.nut)+'</b></td><td>'+hs.n+'</td></tr>';
  h+='<tr><td>對手</td><td><b>'+pct(vs.mean)+'</b></td><td><b>'+pct(vs.nut)+'</b></td><td>'+vs.n+'</td></tr></tbody></table></div>';
  var ra=hs.mean>vs.mean?'你':'對手',na=hs.nut>vs.nut?'你':hs.nut<vs.nut?'對手':null;
  h+='<p class="sub">Range advantage 喺 <b>'+ra+'</b>'+(na?'；nut advantage 喺 <b>'+na+'</b>':'；nut advantage 打和')+(na&&na!==ra?'。<b>兩者指向相反方向</b>：一方整體較強，另一方有較多 nuts。':'。')+'</p>';
  h+='<h2>Equity 分佈</h2><div class="row" style="justify-content:space-between"><span class="sub">每個 combo 對住對方成個範圍嘅 equity，分 '+k+' 格</span><span class="toggle"><a href="#" data-k="10" class="'+(k===10?'on':'')+'">10 格</a><a href="#" data-k="20" class="'+(k===20?'on':'')+'">20 格</a></span></div>';
  h+='<div class="hists"><div><b>你</b>'+hist(hs,'h1')+'</div><div><b>對手</b>'+hist(vs,'h2')+'</div></div>';
  h+='<h2>牌型命中分佈</h2><div class="tbl-wrap"><table><thead><tr><th>牌型</th><th>你</th><th>對手</th></tr></thead><tbody>';
  HC.forEach(function(c){var a=R.hero.dist.counts[c[0]],b=R.vill.dist.counts[c[0]];if(!a&&!b)return;
    var pa=a/R.hero.dist.total,pb=b/R.vill.dist.total;
    h+='<tr><td>'+c[1]+'</td><td>'+pct(pa)+' <span class="sub">('+a+')</span><div class="bar-eq h1"><i style="width:'+(pa*100).toFixed(1)+'%"></i></div></td><td>'+pct(pb)+' <span class="sub">('+b+')</span><div class="bar-eq h2"><i style="width:'+(pb*100).toFixed(1)+'%"></i></div></td></tr>'});
  h+='</tbody><tfoot><tr><td>合計</td><td>100% <span class="sub">('+R.hero.dist.total+')</span></td><td>100% <span class="sub">('+R.vill.dist.total+')</span></td></tr></tfoot></table></div>';
  h+='<p class="sub">每個 combo 只計最高牌型（例如有對又有聽牌就當對子）。公共牌嘅對子／三條唔當係玩家自己嘅牌型。';
  h+=' Equity 係每個 combo 抽 '+R.samples.toLocaleString('en-US')+' 次對手 combo 同發牌估算 · '+((R.ms)/1000).toFixed(1)+' 秒</p>';
  $('res').innerHTML=h;
  $('res').querySelectorAll('[data-k]').forEach(function(a){a.onclick=function(e){e.preventDefault();k=+a.dataset.k;render()}});
}
function done(){if(worker){worker.terminate();worker=null}$('calc').hidden=false;$('stop').hidden=true}
$('calc').onclick=function(){
  msg('');var b=parseCards($('board').value);
  if(!b||b.length<3||b.length>4)return msg('公共牌要 3 張（flop）或者 4 張（turn），例如：Kh 9h 4c');
  var hp=parseRange($('hero').value),vp=parseRange($('vill').value);
  if(hp.errors.length||vp.errors.length)return msg('範圍有睇唔明嘅寫法。');
  var H=rangeCombos(hp),V=rangeCombos(vp);if(!H.length||!V.length)return msg('兩邊都要有範圍。');
  var samples=+$('samples').value;
  $('calc').hidden=true;$('stop').hidden=false;$('res').innerHTML='<div class="sub">計算中… <span id="prog"></span></div>';t0=Date.now();
  function got(r){done();if(r.error){$('res').innerHTML='';return msg(r.error)}r.samples=samples;r.ms=Date.now()-t0;last=r;render()}
  function prog(f){var p=$('prog');if(p)p.textContent=Math.round(f*100)+'%'}
  try{
    worker=new Worker(URL.createObjectURL(new Blob([${JSON.stringify(WORKER_SRC).replace(/</g, '\\u003c')}],{type:'text/javascript'})));
    worker.onmessage=function(e){if(e.data.p!==undefined)prog(e.data.p);else got(e.data.r)};
    worker.onerror=function(e){done();msg('計算出錯：'+(e.message||''))};
    worker.postMessage({h:H,v:V,board:b,samples:samples});
  }catch(e){worker=null;setTimeout(function(){textureAnalysis(H,V,b,samples,prog,got)},10)}
};
$('stop').onclick=function(){done();$('res').innerHTML='<div class="sub">已停止。</div>'};
})();
`;

const CSS = `
#stop[hidden],#calc[hidden]{display:none}
.tx-in{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.tx-in textarea{width:100%;font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);resize:vertical}
.tx-in input,.tx-in select{width:100%}
.hists{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-top:8px}
.hist{display:flex;align-items:flex-end;gap:2px;height:120px;border-bottom:1px solid var(--line);margin-top:6px}
.hb{flex:1;height:100%;display:flex;align-items:flex-end}
.hb i{display:block;width:100%;border-radius:2px 2px 0 0;min-height:1px}
.h1 i,.bar-eq.h1 i{background:var(--accent)}
.h2 i,.bar-eq.h2 i{background:#2563eb}
.hx{display:flex;justify-content:space-between;font-size:11px;color:var(--muted)}
.bar-eq{height:4px;background:var(--line);border-radius:2px;margin-top:3px;min-width:60px}
.bar-eq i{display:block;height:100%;border-radius:2px}
`;

export const TexturePage = () => (
  <>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h1>翻牌面質感分析</h1>
    <EquityTabs on="texture" />
    <div class="sub">睇兩個範圍喺某個 flop（或 turn）點樣分佈：係靠少量 nuts，定係整體均勻。範圍寫法同「範圍 vs 範圍」一樣。</div>
    <div class="card">
      <div class="tx-in">
        <div class="field">
          <label>你嘅範圍</label>
          <textarea id="hero" rows={2} spellcheck={false}>66+, A9s+, KTs+, QTs+, JTs, ATo+, KJo+</textarea>
          <span class="sub" id="heroInfo"></span>
        </div>
        <div class="field">
          <label>對手範圍</label>
          <textarea id="vill" rows={2} spellcheck={false}>22+, A2s+, K8s+, Q9s+, J9s+, T8s+, 98s, 87s, 76s, 65s, A8o+, KTo+, QTo+, JTo</textarea>
          <span class="sub" id="villInfo"></span>
        </div>
        <div class="field">
          <label>公共牌（3 或 4 張）</label>
          <input id="board" value="Kh 9h 4c" autocomplete="off" autocapitalize="off" spellcheck={false} />
        </div>
        <div class="field">
          <label>每個 combo 抽樣次數</label>
          <select id="samples">
            <option value="200">200（快）</option>
            <option value="600" selected>600</option>
            <option value="2000">2,000（準）</option>
          </select>
        </div>
      </div>
    </div>
    <div class="row">
      <span class="spacer"></span>
      <button type="button" class="btn" id="stop" hidden>停止</button>
      <button type="button" class="btn primary" id="calc">分析</button>
    </div>
    <div class="warn" id="msg" hidden style="margin-top:10px"></div>
    <div class="card" id="res" style="padding-top:6px"><div class="sub">結果會喺度顯示。</div></div>
    <noscript><div class="warn">呢頁需要 JavaScript。</div></noscript>
    <script dangerouslySetInnerHTML={{ __html: ENGINE_JS + RANGE_JS + TEXTURE_JS + UI_JS }} />
  </>
);
