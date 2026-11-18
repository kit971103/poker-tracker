/** @jsxImportSource hono/jsx */
import type { Child, FC } from 'hono/jsx';
import { DENOMS, displayName, dollarsPerChip, fmt, money, net, signed, type Game, type GameRow, type NameMode } from './lib';

const CSS = `
:root{--bg:#f6f5f1;--card:#ffffff;--ink:#1c1917;--muted:#78716c;--line:#e7e5e4;--accent:#14532d;--accent-ink:#ffffff;--up:#15803d;--down:#b91c1c;--warn-bg:#fef3c7;--warn:#92400e}
@media (prefers-color-scheme:dark){:root{--bg:#0c0f0d;--card:#151a17;--ink:#ecebe7;--muted:#9ca3a0;--line:#26302b;--accent:#4ade80;--accent-ink:#052e16;--up:#4ade80;--down:#f87171;--warn-bg:#3b2a0a;--warn:#fbbf24}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}
header{background:var(--card);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:5}
.bar{max-width:960px;margin:0 auto;padding:10px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.brand{font-weight:700;letter-spacing:.02em;text-decoration:none;display:flex;align-items:center;gap:8px}
nav{display:flex;gap:4px;flex-wrap:wrap}
nav a{text-decoration:none;padding:6px 10px;border-radius:8px;color:var(--muted);font-size:14px}
nav a.on{background:var(--accent);color:var(--accent-ink)}
.spacer{flex:1}
main{max-width:960px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:4px 0 2px}
h2{font-size:17px;margin:24px 0 8px}
.sub{color:var(--muted);font-size:13px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin:12px 0}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.tbl-wrap{overflow-x:auto;margin:0 -14px;padding:0 14px}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
th,td{padding:8px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
th{font-size:12px;color:var(--muted);font-weight:600}
th:first-child,td:first-child{text-align:left}
td.name{white-space:normal;min-width:110px}
tr:last-child td{border-bottom:0}
tfoot td{font-weight:600;border-top:2px solid var(--line)}
.up{color:var(--up)}.down{color:var(--down)}
.pill{display:inline-block;font-size:12px;padding:2px 8px;border-radius:999px;border:1px solid var(--line);color:var(--muted)}
.pill.live{background:var(--up);border-color:var(--up);color:#fff}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:7px 12px;font:inherit;font-size:14px;cursor:pointer;text-decoration:none;min-height:36px}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink);font-weight:600}
.btn.danger{color:var(--down)}
.btn.sm{padding:4px 9px;min-height:30px;font-size:13px}
input,select{font:inherit;padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);min-height:36px}
input[type=number]{width:72px;text-align:right}
label{font-size:13px;color:var(--muted)}
.field{display:flex;flex-direction:column;gap:4px}
.grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.warn{background:var(--warn-bg);color:var(--warn);border-radius:8px;padding:8px 12px;font-size:14px}
.chip{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;font-size:10px;font-weight:700;border:3px dashed;flex:none}
.stats{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}
.stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}
.stat b{display:block;font-size:20px}
.toggle{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.toggle a{padding:5px 10px;text-decoration:none;font-size:13px;color:var(--muted)}
.toggle a.on{background:var(--accent);color:var(--accent-ink)}

.prow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}
.pname{font-weight:600;overflow-wrap:anywhere}
.more{position:relative}.more>summary{list-style:none}.more>summary::-webkit-details-marker{display:none}
.pop{position:absolute;right:0;top:100%;z-index:3;min-width:240px;box-shadow:0 8px 24px rgba(0,0,0,.12)}
.cnt{padding:10px 0;border-bottom:1px solid var(--line)}
.denoms{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:8px}
.denom{display:flex;flex-direction:column;align-items:center;gap:4px}
.denom input{width:100%;text-align:center;padding:7px 2px}
.ac{position:relative;flex:1;min-width:180px}.ac input{width:100%}
.ac-list{position:absolute;left:0;right:0;top:100%;z-index:4;margin:4px 0 0;padding:4px 0;list-style:none;max-height:260px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.12)}
.ac-list li{padding:10px 12px;cursor:pointer}.ac-list li:hover{background:var(--bg)}
footer{max-width:960px;margin:24px auto;padding:0 16px;color:var(--muted);font-size:12px}
`;

export const Layout: FC<{ title: string; active?: string; admin?: string; head?: Child; children?: Child }> = ({ title, active, admin, head, children }) => (
  <html lang="zh-Hant-HK">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title} · Poker Tracker</title>
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      {head}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </head>
    <body>
      <header>
        <div class="bar">
          <a class="brand" href="/">
            <span class="chip" style={`background:${DENOMS[3].bg};border-color:#fff;color:#fff;width:22px;height:22px`}></span>
            Poker Tracker
          </a>
          <nav>
            <a href="/" class={active === 'game' ? 'on' : ''}>當前遊戲</a>
            <a href="/dashboard" class={active === 'dashboard' ? 'on' : ''}>Dashboard</a>
            <a href="/games" class={active === 'games' ? 'on' : ''}>歷史</a>
            <a href="/players" class={active === 'players' ? 'on' : ''}>玩家</a>
            <a href="/equity" class={active === 'equity' ? 'on' : ''}>Equity</a>
          </nav>
          <span class="spacer"></span>
          {admin ? (
            <span class="sub">管理員：{admin}</span>
          ) : (
            <a class="btn sm" href="/admin">管理</a>
          )}
        </div>
      </header>
      <main>{children}</main>
      <footer>手動重新整理以更新數據。</footer>
    </body>
  </html>
);

export const Chip: FC<{ k: string }> = ({ k }) => {
  const d = DENOMS.find((x) => x.key === k)!;
  return (
    <span class="chip" title={`${d.value}（${d.label}）`} style={`background:${d.bg};color:${d.fg};border-color:${d.ring}`}>
      {d.value}
    </span>
  );
};

export const Toggles: FC<{ names: NameMode; unit?: 'chips' | 'bb'; back: string }> = ({ names, unit, back }) => {
  const href = (p: Record<string, string>) => '/prefs?' + new URLSearchParams({ ...p, back }).toString();
  return (
    <div class="row">
      <span class="toggle">
        <a href={href({ names: 'nick' })} class={names === 'nick' ? 'on' : ''}>綽號</a>
        <a href={href({ names: 'real' })} class={names === 'real' ? 'on' : ''}>本名</a>
      </span>
      {unit && (
        <span class="toggle">
          <a href={href({ unit: 'chips' })} class={unit === 'chips' ? 'on' : ''}>籌碼</a>
          <a href={href({ unit: 'bb' })} class={unit === 'bb' ? 'on' : ''}>BB</a>
        </span>
      )}
    </div>
  );
};

export const Signed: FC<{ n: number; digits?: number }> = ({ n, digits }) => (
  <span class={n > 0 ? 'up' : n < 0 ? 'down' : ''}>{signed(n, digits)}</span>
);

/** Read-only result table for a game (open or closed). */
export const GameTable: FC<{ game: Game; rows: GameRow[]; names: NameMode }> = ({ game, rows, names }) => {
  const dpc = dollarsPerChip(game);
  const players = rows.filter((r) => r.player_id !== 0);
  const system = rows.filter((r) => r.player_id === 0);
  const closed = game.status === 'closed';
  const sorted = closed ? [...players].sort((a, b) => net(b) - net(a)) : players;
  const totalBuyin = players.reduce((s, r) => s + r.buyin, 0);
  const totalEnd = players.reduce((s, r) => s + (r.end_chips ?? 0), 0);
  const hasAdj = players.some((r) => r.adj !== 0);
  return (
    <div class="card">
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>玩家</th>
              <th>買入</th>
              <th>籌碼</th>
              {closed && <th>最後籌碼</th>}
              {closed && hasAdj && <th>差額調整</th>}
              {closed && <th>P/L（籌碼）</th>}
              {closed && dpc > 0 && <th>P/L（$）</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr>
                <td class="name">
                  <a href={`/players/${r.player_id}`}>{displayName(r, names)}</a>
                  {game.host_player_id === r.player_id && <span class="pill" style="margin-left:6px">host</span>}
                </td>
                <td>{game.base_buyin > 0 ? `${fmt(r.buyin / game.base_buyin, Number.isInteger(r.buyin / game.base_buyin) ? 0 : 2)} 次` : '—'}</td>
                <td>{fmt(r.buyin)}</td>
                {closed && <td>{fmt(r.end_chips ?? 0)}</td>}
                {closed && hasAdj && <td>{r.adj ? signed(r.adj) : ''}</td>}
                {closed && (
                  <td>
                    <Signed n={net(r)} />
                  </td>
                )}
                {closed && dpc > 0 && (
                  <td class={net(r) > 0 ? 'up' : net(r) < 0 ? 'down' : ''}>{money(net(r) * dpc)}</td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>{players.length} 人</td>
              <td>{game.base_buyin > 0 ? `${fmt(totalBuyin / game.base_buyin, 0)} 次` : ''}</td>
              <td>{fmt(totalBuyin)}</td>
              {closed && <td>{fmt(totalEnd)}</td>}
              {closed && hasAdj && <td></td>}
              {closed && <td></td>}
              {closed && dpc > 0 && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>
      {closed && game.diff_chips !== 0 && (
        <p class="sub" style="margin:8px 0 0">
          籌碼差額 {signed(game.diff_chips)}
          {game.diff_mode === 'host' && '，全數歸 host'}
          {game.diff_mode === 'ratio' && '，按贏家贏幅比例分配'}
          {system.length > 0 && '（舊記錄，以 [system] 抵銷）'}
        </p>
      )}
    </div>
  );
};

export const GameHeader: FC<{ game: Game; children?: Child }> = ({ game, children }) => (
  <div class="row" style="justify-content:space-between;align-items:flex-end">
    <div>
      <h1>
        {game.name}{' '}
        {game.status === 'open' ? <span class="pill live">進行中</span> : <span class="pill">已結束</span>}
      </h1>
      <div class="sub">
        {game.date} · 每次買入 {fmt(game.base_buyin)} 籌碼 = ${fmt(game.cash, game.cash % 1 ? 2 : 0)} · BB {game.bb_size}
        {!game.include_dashboard && ' · 不計入 Dashboard'}
      </div>
    </div>
    {children}
  </div>
);
