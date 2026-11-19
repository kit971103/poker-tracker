/** @jsxImportSource hono/jsx */
// Score card PNG (1200×630 for link previews, 1080×1350 portrait for phones).
// Drawn on a <canvas> in the browser, so the Worker does no rasterising (Workers' CPU limit is tight)
// and the image uses a real CJK font: Noto Sans TC is loaded from Google Fonts with a `text=` subset
// of exactly the characters on the card; emoji fall back to the device's emoji font.
import { displayName, dollarsPerChip, net, type Game, type GameRow, type NameMode } from './lib';

export type CardData = {
  id: number;
  title: string;
  date: string;
  meta: string;
  players: { name: string; chips: number; usd: number | null }[];
};

export function cardData(game: Game, rows: GameRow[], names: NameMode): CardData {
  const dpc = dollarsPerChip(game);
  const ps = rows.filter((r) => r.player_id !== 0);
  const buyins = game.base_buyin > 0 ? ps.reduce((s, r) => s + r.buyin, 0) / game.base_buyin : 0;
  const cash = game.cash % 1 ? game.cash.toFixed(2) : String(game.cash);
  return {
    id: game.id,
    title: game.name,
    date: game.date,
    meta: `${ps.length} 人 · ${Math.round(buyins * 10) / 10} 次買入 · 每次 $${cash} · BB ${game.bb_size}`,
    players: ps
      .map((r) => ({ name: displayName(r, names), chips: net(r), usd: dpc > 0 ? Math.round(net(r) * dpc * 100) / 100 : null }))
      .sort((a, b) => b.chips - a.chips),
  };
}

export const cardJson = (d: unknown) => JSON.stringify(d).replace(/</g, '\\u003c');

/** Browser-side renderer. Exposes window.PokerCard = { render(data, layout) -> Promise<Blob>, ... }. */
export const CARD_JS = `
(function(){
var FONT='"Noto Sans TC","PingFang HK","PingFang TC","Hiragino Sans","Microsoft JhengHei",system-ui,sans-serif';
var C={bg:'#0f3b23',panel:'rgba(255,255,255,0.06)',ink:'#f5f5f0',muted:'rgba(245,245,240,0.62)',up:'#4ade80',down:'#fca5a5',gold:'#facc15',line:'rgba(255,255,255,0.12)'};
var fontReady={};
function loadFont(text){
  // one stylesheet per distinct character set; resolves even if the font never arrives (falls back to system fonts)
  var chars=Array.from(new Set(Array.from(text))).filter(function(ch){return ch.codePointAt(0)>32}).sort().join('');
  if(fontReady[chars])return fontReady[chars];
  var href='https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700&display=block&text='+encodeURIComponent(chars);
  var l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);
  var p=new Promise(function(res){l.onload=res;l.onerror=res}).then(function(){
    if(!document.fonts||!document.fonts.load)return;
    return Promise.all([document.fonts.load('400 32px "Noto Sans TC"',chars),document.fonts.load('700 32px "Noto Sans TC"',chars)]);
  });
  return fontReady[chars]=Promise.race([p,new Promise(function(res){setTimeout(res,4000)})]);
}
function fmt(n,dg){return Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:dg,maximumFractionDigits:dg})}
function sgn(n){return n>0?'+':n<0?'−':'±'}
function chips(n){return sgn(n)+fmt(n,0)}
function usd(n){return sgn(n)+'$'+fmt(n,2)}
function col(n){return n>0?C.up:n<0?C.down:C.muted}
function rr(x,a,b,w,h,r){x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath()}
function fit(x,t,max){if(x.measureText(t).width<=max)return t;var a=Array.from(t);while(a.length>1&&x.measureText(a.join('')+'…').width>max)a.pop();return a.join('')+'…'}
function draw(d,layout){
  var tall=layout==='tall',W=tall?1080:1200,H=tall?1350:630,P=tall?70:56;
  var cv=document.createElement('canvas');cv.width=W;cv.height=H;var x=cv.getContext('2d');
  x.fillStyle=C.bg;x.fillRect(0,0,W,H);
  x.strokeStyle=C.line;x.lineWidth=2;rr(x,18,18,W-36,H-36,24);x.stroke();
  x.textBaseline='alphabetic';
  // header
  x.fillStyle=C.ink;x.font='700 '+(tall?60:46)+'px '+FONT;x.fillText(fit(x,d.title,W-2*P-220),P,P+(tall?56:40));
  x.fillStyle=C.muted;x.font='400 '+(tall?30:24)+'px '+FONT;x.fillText(fit(x,d.date+' · '+d.meta,W-2*P),P,P+(tall?106:80));
  x.textAlign='right';x.font='700 '+(tall?24:20)+'px '+FONT;x.fillStyle=C.gold;x.fillText('POKER TRACKER',W-P,P+(tall?50:36));x.textAlign='left';
  // rows
  var n=d.players.length,top=P+(tall?150:112),bottom=H-P+(tall?0:10);
  var cols=(!tall&&n>6)?2:1,per=Math.ceil(n/cols),gap=28;
  var rowH=Math.min(tall?120:74,(bottom-top)/Math.max(per,1)),colW=(W-2*P-(cols-1)*gap)/cols;
  var big=rowH>=60?1:0.82,hasUsd=d.players.some(function(p){return p.usd!==null});
  d.players.forEach(function(p,i){
    var c=Math.floor(i/per),r=i%per,X=P+c*(colW+gap),Y=top+r*rowH,h=rowH-8,mid=Y+h/2;
    var win=i===0&&p.chips>0;
    x.fillStyle=win?'rgba(250,204,21,0.16)':C.panel;rr(x,X,Y,colW,h,14);x.fill();
    if(win){x.strokeStyle=C.gold;x.lineWidth=2;rr(x,X,Y,colW,h,14);x.stroke()}
    x.textBaseline='middle';
    x.fillStyle=win?C.gold:C.muted;x.font='700 '+Math.round(24*big)+'px '+FONT;x.fillText(String(i+1),X+18,mid);
    var right=X+colW-18;
    x.textAlign='right';
    var mainTxt=hasUsd&&p.usd!==null?usd(p.usd):chips(p.chips);
    x.fillStyle=col(p.chips);x.font='700 '+Math.round((tall?38:32)*big)+'px '+FONT;x.fillText(mainTxt,right,hasUsd?mid-Math.round((tall?14:9)*big):mid);
    var mw=x.measureText(mainTxt).width;
    if(hasUsd){x.font='400 '+Math.round((tall?22:18)*big)+'px '+FONT;x.fillStyle=C.muted;x.fillText(chips(p.chips)+' 籌碼',right,mid+Math.round((tall?24:17)*big));mw=Math.max(mw,x.measureText(chips(p.chips)+' 籌碼').width)}
    x.textAlign='left';
    var nx=X+58,nameMax=right-mw-24-nx;
    if(win){x.font='700 '+Math.round(18*big)+'px '+FONT;var tag='👑 大贏家',tw=x.measureText(tag).width+20;
      if(nameMax-tw>120){x.fillStyle=C.gold;rr(x,right-mw-24-tw,mid-16*big,tw,32*big,16*big);x.fill();x.fillStyle='#1c1917';x.fillText(tag,right-mw-14-tw,mid+1);nameMax-=tw+12}}
    x.fillStyle=C.ink;x.font='700 '+Math.round((tall?34:28)*big)+'px '+FONT;x.fillText(fit(x,p.name,nameMax),nx,mid+1);
    x.textBaseline='alphabetic';
  });
  return cv;
}
function allText(d){return d.title+d.date+d.meta+'POKER TRACKER 大贏家籌碼 +−±$.,0123456789…'+d.players.map(function(p){return p.name}).join('')}
function render(d,layout){
  return loadFont(allText(d)).then(function(){
    var cv=draw(d,layout);
    return new Promise(function(res,rej){cv.toBlob(function(b){b?res(b):rej(new Error('toBlob failed'))},'image/png')});
  });
}
function fileName(d,layout){return 'poker-game-'+d.id+(layout==='tall'?'-portrait':'')+'.png'}
function save(blob,name){
  var f;try{f=new File([blob],name,{type:'image/png'})}catch(e){}
  function dl(){var u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(u);a.remove()},2000)}
  // phones: share sheet (straight into WhatsApp); if the gesture expired or sharing is refused, fall back to a download
  if(f&&navigator.canShare&&navigator.canShare({files:[f]})&&matchMedia('(pointer:coarse)').matches){
    return navigator.share({files:[f]}).catch(function(e){if(!e||e.name!=='AbortError')dl()})}
  dl();
}
function upload(d){
  return render(d,'wide').then(function(b){return fetch('/admin/games/'+d.id+'/card',{method:'POST',body:b,headers:{'content-type':'image/png'},credentials:'same-origin',redirect:'manual'})})
    .then(function(r){return r.ok});
}
window.PokerCard={render:render,save:save,upload:upload,fileName:fileName};
})();
`;

/** Download / share buttons on a closed game's page. */
export const CardButtons = ({ data, autoUpload }: { data: CardData; autoUpload?: CardData }) => (
  <div class="row" style="margin-top:4px">
    <button type="button" class="btn sm" data-card="wide">⬇ 成績卡（橫）</button>
    <button type="button" class="btn sm" data-card="tall">⬇ 成績卡（直）</button>
    <span class="sub" id="cardMsg"></span>
    <script
      dangerouslySetInnerHTML={{
        __html: `${CARD_JS}
(function(){var d=${cardJson(data)},m=document.getElementById('cardMsg');
document.querySelectorAll('[data-card]').forEach(function(b){b.addEventListener('click',function(){
  var l=b.dataset.card;b.disabled=true;m.textContent='生成中…';
  PokerCard.render(d,l).then(function(blob){m.textContent='';return PokerCard.save(blob,PokerCard.fileName(d,l))})
  .catch(function(e){m.textContent='生成失敗：'+e.message}).then(function(){b.disabled=false});
})});
${
  autoUpload
    ? `PokerCard.upload(${cardJson(autoUpload)}).then(function(ok){if(ok)m.textContent='已更新連結預覽圖。'}).catch(function(){});
try{history.replaceState(null,'',location.pathname)}catch(e){}`
    : ''
}
})();`,
      }}
    />
  </div>
);

/** Open Graph / Twitter meta for a game page. */
export const GameMeta = ({ origin, game, data, hasImage }: { origin: string; game: Game; data: CardData; hasImage: boolean }) => {
  const top = data.players[0];
  const desc =
    `${data.date} · ${data.meta}` +
    (game.status === 'closed' && top && top.chips > 0 ? ` · 大贏家 ${top.name} ${top.usd !== null ? `+$${top.usd.toFixed(2)}` : `+${top.chips}`}` : '');
  return (
    <>
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Poker Tracker" />
      <meta property="og:title" content={data.title} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={`${origin}/games/${game.id}`} />
      <meta name="description" content={desc} />
      {hasImage && (
        <>
          <meta property="og:image" content={`${origin}/games/${game.id}/og.png`} />
          <meta property="og:image:type" content="image/png" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:image" content={`${origin}/games/${game.id}/og.png`} />
        </>
      )}
    </>
  );
};

export function toB64(buf: ArrayBuffer): string {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
export const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
export const isPng = (u: Uint8Array) => u.length > 8 && u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47;
