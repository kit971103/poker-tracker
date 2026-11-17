/** @jsxImportSource hono/jsx */
import { Hono, type Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { requireAccess } from './auth';
import {
  allocateDiff,
  chipTotal,
  parseChips,
  type ChipCounts,
  DENOMS,
  displayName,
  dollarsPerChip,
  fmt,
  money,
  net,
  signed,
  vancouverToday,
  type Env,
  type Game,
  type GameRow,
  type NameMode,
  type Player,
  type Unit,
} from './lib';
import { Chip, GameHeader, GameTable, Layout, Signed, Toggles } from './views';
import { EquityPage } from './equity';

type AppEnv = { Bindings: Env; Variables: { email: string } };
const app = new Hono<AppEnv>();

// ---------------------------------------------------------------- helpers

const render = (c: Context, node: unknown, status = 200) => c.html(`<!doctype html>${node}`, status as 200);

function prefs(c: Context): { names: NameMode; unit: Unit } {
  const raw = getCookie(c, 'prefs') ?? '';
  const p = new URLSearchParams(raw);
  return {
    names: p.get('names') === 'real' ? 'real' : 'nick',
    unit: p.get('unit') === 'bb' ? 'bb' : 'chips',
  };
}

const safeBack = (b: string | undefined) => (b && b.startsWith('/') && !b.startsWith('//') ? b : '/');

async function getGame(db: D1Database, id: number) {
  return db.prepare('SELECT * FROM games WHERE id = ?').bind(id).first<Game>();
}
async function getOpenGame(db: D1Database) {
  return db.prepare("SELECT * FROM games WHERE status = 'open' LIMIT 1").first<Game>();
}
async function getRows(db: D1Database, gameId: number) {
  const { results } = await db
    .prepare(
      `SELECT gp.*, p.name, p.nickname FROM game_players gp JOIN players p ON p.id = gp.player_id
       WHERE gp.game_id = ? ORDER BY gp.sort_order, gp.player_id`,
    )
    .bind(gameId)
    .all<GameRow>();
  return results;
}
const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const intOrNull = (v: unknown) => {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const go = (c: Context, path: string, msg?: string) =>
  c.redirect(msg ? `${path}${path.includes('?') ? '&' : '?'}msg=${encodeURIComponent(msg)}` : path, 303);

const Msg = ({ c }: { c: Context }) => {
  const m = c.req.query('msg');
  return m ? <div class="warn" style="margin:12px 0">{m}</div> : null;
};

// ---------------------------------------------------------------- public pages

app.get('/prefs', (c) => {
  const cur = new URLSearchParams(getCookie(c, 'prefs') ?? '');
  const names = c.req.query('names');
  const unit = c.req.query('unit');
  if (names === 'nick' || names === 'real') cur.set('names', names);
  if (unit === 'chips' || unit === 'bb') cur.set('unit', unit);
  setCookie(c, 'prefs', cur.toString(), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'Lax' });
  return c.redirect(safeBack(c.req.query('back')), 303);
});

app.get('/', async (c) => {
  const { names } = prefs(c);
  const open = await getOpenGame(c.env.DB);
  const game = open ?? (await c.env.DB.prepare("SELECT * FROM games WHERE status='closed' ORDER BY date DESC, id DESC LIMIT 1").first<Game>());
  if (!game) {
    return render(c, <Layout title="當前遊戲" active="game"><div class="card">未有任何遊戲。<a href="/admin">開新局</a></div></Layout>);
  }
  const rows = await getRows(c.env.DB, game.id);
  return render(
    c,
    <Layout title={game.name} active="game">
      {!open && <div class="warn" style="margin-bottom:12px">而家冇進行中嘅遊戲，以下係最近一場。</div>}
      <GameHeader game={game}>
        <div class="row">
          <Toggles names={names} back="/" />
          <a class="btn primary" href={open ? '/admin/game' : '/admin'}>{open ? '編輯' : '開新局'}</a>
        </div>
      </GameHeader>
      <GameTable game={game} rows={rows} names={names} />
    </Layout>,
  );
});

app.get('/games', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT g.*, COUNT(gp.player_id) - SUM(gp.player_id = 0) AS n_players,
            SUM(CASE WHEN gp.player_id <> 0 THEN gp.buyin ELSE 0 END) AS pot
     FROM games g LEFT JOIN game_players gp ON gp.game_id = g.id
     GROUP BY g.id ORDER BY g.date DESC, g.id DESC`,
  ).all<Game & { n_players: number; pot: number }>();
  return render(
    c,
    <Layout title="歷史" active="games">
      <h1>歷史遊戲</h1>
      <div class="sub">共 {results.length} 場</div>
      <div class="card">
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>遊戲</th><th>日期</th><th>人數</th><th>總買入</th><th>Dashboard</th></tr></thead>
            <tbody>
              {results.map((g) => (
                <tr>
                  <td class="name">
                    <a href={`/games/${g.id}`}>{g.name}</a> {g.status === 'open' && <span class="pill live">進行中</span>}
                  </td>
                  <td>{g.date}</td>
                  <td>{g.n_players ?? 0}</td>
                  <td>{fmt(g.pot ?? 0)}</td>
                  <td>{g.include_dashboard ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>,
  );
});

app.get('/games/:id{[0-9]+}', async (c) => {
  const { names } = prefs(c);
  const game = await getGame(c.env.DB, Number(c.req.param('id')));
  if (!game) return render(c, <Layout title="搵唔到"><div class="card">搵唔到呢場遊戲。</div></Layout>, 404);
  const rows = await getRows(c.env.DB, game.id);
  return render(
    c,
    <Layout title={game.name} active="games">
      <GameHeader game={game}>
        <Toggles names={names} back={`/games/${game.id}`} />
      </GameHeader>
      <GameTable game={game} rows={rows} names={names} />
      {rows.some((r) => r.memo) && (
        <div class="card sub">
          {rows.filter((r) => r.memo).map((r) => (
            <div>{displayName(r, names)}：{r.memo}</div>
          ))}
        </div>
      )}
    </Layout>,
  );
});

type DashRow = {
  player_id: number;
  name: string;
  nickname: string | null;
  n: number;
  w: number;
  net: number;
  net_bb: number;
  buyin: number;
};

app.get('/dashboard', async (c) => {
  const { names, unit } = prefs(c);
  const db = c.env.DB;
  const included = `g.status = 'closed' AND g.include_dashboard = 1 AND gp.player_id <> 0`;
  const [agg, stats, best, worst, series] = await db.batch([
    db.prepare(
      `SELECT gp.player_id, p.name, p.nickname, COUNT(*) AS n,
              SUM(CASE WHEN gp.end_chips + gp.adj - gp.buyin > 0 THEN 1 ELSE 0 END) AS w,
              SUM(gp.end_chips + gp.adj - gp.buyin) AS net,
              SUM((gp.end_chips + gp.adj - gp.buyin) * 1.0 / g.bb_size) AS net_bb,
              SUM(gp.buyin) AS buyin
       FROM game_players gp JOIN games g ON g.id = gp.game_id JOIN players p ON p.id = gp.player_id
       WHERE ${included} GROUP BY gp.player_id`,
    ),
    db.prepare(
      `SELECT COUNT(*) AS n, MIN(date) AS first, MAX(date) AS last FROM games g
       WHERE g.status = 'closed' AND g.include_dashboard = 1`,
    ),
    db.prepare(
      `SELECT p.name, p.nickname, g.date, g.name AS game, g.bb_size, gp.end_chips + gp.adj - gp.buyin AS v
       FROM game_players gp JOIN games g ON g.id = gp.game_id JOIN players p ON p.id = gp.player_id
       WHERE ${included} ORDER BY v DESC LIMIT 1`,
    ),
    db.prepare(
      `SELECT p.name, p.nickname, g.date, g.name AS game, g.bb_size, gp.end_chips + gp.adj - gp.buyin AS v
       FROM game_players gp JOIN games g ON g.id = gp.game_id JOIN players p ON p.id = gp.player_id
       WHERE ${included} ORDER BY v ASC LIMIT 1`,
    ),
    db.prepare(
      `SELECT g.id AS game_id, g.date, g.bb_size, gp.player_id, gp.end_chips + gp.adj - gp.buyin AS v
       FROM game_players gp JOIN games g ON g.id = gp.game_id
       WHERE ${included} ORDER BY g.date, g.id`,
    ),
  ]);
  const rows = (agg.results as DashRow[]).map((r) => {
    const total = unit === 'bb' ? r.net_bb : r.net;
    return { ...r, total, perGame: total / r.n, pct: r.w / r.n, adjPct: (r.w + 1) / (r.n + 2) };
  });
  rows.sort((a, b) => b.total - a.total);
  const s = stats.results[0] as { n: number; first: string; last: string };
  const days = s.n > 1 ? (Date.parse(s.last) - Date.parse(s.first)) / 86400000 / (s.n - 1) : 0;
  type Ext = { name: string; nickname: string | null; date: string; game: string; bb_size: number; v: number };
  const b = best.results[0] as Ext | undefined;
  const wv = worst.results[0] as Ext | undefined;
  const u = (v: number, bb: number) => (unit === 'bb' ? v / bb : v);
  const unitLabel = unit === 'bb' ? 'BB' : '籌碼';

  // cumulative line chart: players with 5+ games
  const regulars = rows.filter((r) => r.n >= 5);
  const gameIds: number[] = [];
  const gameDates: string[] = [];
  const perGame = new Map<number, Map<number, number>>();
  for (const r of series.results as { game_id: number; date: string; bb_size: number; player_id: number; v: number }[]) {
    if (!perGame.has(r.game_id)) {
      perGame.set(r.game_id, new Map());
      gameIds.push(r.game_id);
      gameDates.push(r.date);
    }
    perGame.get(r.game_id)!.set(r.player_id, u(r.v, r.bb_size));
  }
  const datasets = regulars.map((r) => {
    let cum = 0;
    return {
      label: displayName(r, names),
      data: gameIds.map((g) => {
        cum += perGame.get(g)!.get(r.player_id) ?? 0;
        return Math.round(cum * 10) / 10;
      }),
    };
  });
  const chartJson = JSON.stringify({ labels: gameDates, datasets }).replace(/</g, '\\u003c');
  const d = unit === 'bb' ? 1 : 0;

  return render(
    c,
    <Layout title="Dashboard" active="dashboard">
      <div class="row" style="justify-content:space-between">
        <div>
          <h1>Dashboard</h1>
          <div class="sub">只計已結束、標記為計入 Dashboard 嘅遊戲</div>
        </div>
        <Toggles names={names} unit={unit} back="/dashboard" />
      </div>

      <div class="stats" style="margin-top:12px">
        <div class="stat"><span class="sub">遊戲場數</span><b>{s.n}</b></div>
        <div class="stat"><span class="sub">平均相隔日數</span><b>{fmt(days, 1)}</b></div>
        {b && (
          <div class="stat">
            <span class="sub">單場最大贏</span>
            <b class="up">{signed(u(b.v, b.bb_size), d)}</b>
            <span class="sub">{displayName(b, names)} · {b.date}</span>
          </div>
        )}
        {wv && (
          <div class="stat">
            <span class="sub">單場最大輸</span>
            <b class="down">{signed(u(wv.v, wv.bb_size), d)}</b>
            <span class="sub">{displayName(wv, names)} · {wv.date}</span>
          </div>
        )}
      </div>

      <h2>排名</h2>
      <div class="card">
        <div class="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th style="text-align:left">玩家</th><th>場數</th><th>贏場</th><th>% above water</th>
                <th title="(贏場 + 1) / (場數 + 2)">Adj. %</th><th>總贏（{unitLabel}）</th><th>每場（{unitLabel}）</th><th>每場買入</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr>
                  <td>{i + 1}</td>
                  <td class="name" style="text-align:left"><a href={`/players/${r.player_id}`}>{displayName(r, names)}</a></td>
                  <td>{r.n}</td>
                  <td>{r.w}</td>
                  <td>{fmt(r.pct * 100)}%</td>
                  <td>{fmt(r.adjPct * 100)}%</td>
                  <td><Signed n={r.total} digits={d} /></td>
                  <td><Signed n={r.perGame} digits={unit === 'bb' ? 1 : 0} /></td>
                  <td>{fmt(r.buyin / r.n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2>累計走勢（{unitLabel}，5 場或以上嘅玩家）</h2>
      <div class="card" style="height:380px"><canvas id="chart"></canvas></div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var d=${chartJson};var ink=getComputedStyle(document.documentElement).getPropertyValue('--muted');
if(!window.Chart)return;new Chart(document.getElementById('chart'),{type:'line',data:{labels:d.labels,datasets:d.datasets.map(function(s){return Object.assign({},s,{pointRadius:0,borderWidth:2,tension:.2})})},
options:{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:ink,boxWidth:12}}},scales:{x:{ticks:{color:ink,maxTicksLimit:8}},y:{ticks:{color:ink}}}}});})();`,
        }}
      />
    </Layout>,
  );
});

app.get('/equity', (c) =>
  render(
    c,
    <Layout title="Equity 計算機" active="equity">
      <EquityPage />
    </Layout>,
  ),
);

app.get('/players', async (c) => {
  const { names } = prefs(c);
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.name, p.nickname, p.rep_hand,
            COUNT(gp.game_id) AS n,
            COALESCE(SUM(gp.end_chips + gp.adj - gp.buyin), 0) AS net,
            MAX(g.date) AS last
     FROM players p
     LEFT JOIN game_players gp ON gp.player_id = p.id
     LEFT JOIN games g ON g.id = gp.game_id AND g.status = 'closed'
     WHERE p.id <> 0 GROUP BY p.id ORDER BY n DESC, p.name`,
  ).all<Player & { n: number; net: number; last: string | null }>();
  return render(
    c,
    <Layout title="玩家" active="players">
      <div class="row" style="justify-content:space-between">
        <div>
          <h1>玩家</h1>
          <div class="sub">總計包括所有已結束遊戲（包括唔計入 Dashboard 嘅場）</div>
        </div>
        <Toggles names={names} back="/players" />
      </div>
      <div class="card">
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>玩家</th><th>{names === 'real' ? '綽號' : '本名'}</th><th>代表手牌</th><th>場數</th><th>總贏（籌碼）</th><th>最近一場</th></tr></thead>
            <tbody>
              {results.map((p) => (
                <tr>
                  <td class="name"><a href={`/players/${p.id}`}>{displayName(p, names)}</a></td>
                  <td class="sub">{names === 'real' ? p.nickname ?? '' : p.nickname ? p.name : ''}</td>
                  <td>{p.rep_hand ?? ''}</td>
                  <td>{p.n}</td>
                  <td><Signed n={p.net} /></td>
                  <td>{p.last ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>,
  );
});

app.get('/players/:id{[0-9]+}', async (c) => {
  const { names } = prefs(c);
  const id = Number(c.req.param('id'));
  const p = await c.env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first<Player>();
  if (!p || id === 0) return render(c, <Layout title="搵唔到"><div class="card">搵唔到呢位玩家。</div></Layout>, 404);
  const { results } = await c.env.DB.prepare(
    `SELECT g.id, g.name, g.date, g.status, g.include_dashboard, g.bb_size, g.cash, g.base_buyin,
            gp.buyin, gp.end_chips, gp.adj
     FROM game_players gp JOIN games g ON g.id = gp.game_id
     WHERE gp.player_id = ? ORDER BY g.date DESC, g.id DESC`,
  ).bind(id).all<{ id: number; name: string; date: string; status: string; include_dashboard: number; bb_size: number; cash: number; base_buyin: number; buyin: number; end_chips: number | null; adj: number }>();
  const closed = results.filter((r) => r.status === 'closed');
  const total = closed.reduce((s, r) => s + net(r), 0);
  const wins = closed.filter((r) => net(r) > 0).length;
  return render(
    c,
    <Layout title={displayName(p, names)} active="players">
      <div class="row" style="justify-content:space-between">
        <div>
          <h1>{displayName(p, names)}</h1>
          <div class="sub">
            {names === 'real' ? p.nickname : p.nickname ? p.name : ''}
            {p.rep_hand && ` · 代表手牌 ${p.rep_hand}`}
          </div>
        </div>
        <Toggles names={names} back={`/players/${id}`} />
      </div>
      <div class="stats" style="margin-top:12px">
        <div class="stat"><span class="sub">場數</span><b>{closed.length}</b></div>
        <div class="stat"><span class="sub">贏場</span><b>{wins}</b></div>
        <div class="stat"><span class="sub">總贏（籌碼）</span><b><Signed n={total} /></b></div>
      </div>
      <div class="card">
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>遊戲</th><th>日期</th><th>買入</th><th>最後籌碼</th><th>P/L（籌碼）</th><th>P/L（BB）</th><th>P/L（$）</th></tr></thead>
            <tbody>
              {results.map((r) => (
                <tr>
                  <td class="name">
                    <a href={`/games/${r.id}`}>{r.name}</a>
                    {r.status === 'open' && <span class="pill live" style="margin-left:6px">進行中</span>}
                    {!r.include_dashboard && <span class="pill" style="margin-left:6px">不計入</span>}
                  </td>
                  <td>{r.date}</td>
                  <td>{fmt(r.buyin)}</td>
                  <td>{r.status === 'closed' ? fmt(r.end_chips ?? 0) : '—'}</td>
                  <td>{r.status === 'closed' ? <Signed n={net(r)} /> : '—'}</td>
                  <td>{r.status === 'closed' ? <Signed n={net(r) / r.bb_size} digits={1} /> : '—'}</td>
                  <td>{r.status === 'closed' && r.cash > 0 ? money(net(r) * dollarsPerChip(r)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>,
  );
});

// ---------------------------------------------------------------- admin

app.use('/admin', requireAccess);
app.use('/admin/*', requireAccess);

app.get('/admin', async (c) => {
  const open = await getOpenGame(c.env.DB);
  if (open) return c.redirect('/admin/game', 303);
  const max = await c.env.DB.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM games').first<{ m: number }>();
  const next = (max?.m ?? 0) + 1;
  return render(
    c,
    <Layout title="開新局" admin={c.get('email')}>
      <div class="row" style="justify-content:space-between">
        <h1>開新局</h1>
        <a class="btn" href="/admin/players">玩家管理</a>
      </div>
      <Msg c={c} />
      <form class="card" method="post" action="/admin/games">
        <div class="grid">
          <div class="field"><label>名稱</label><input name="name" value={`Poker Game # ${next}`} required /></div>
          <div class="field"><label>日期</label><input type="date" name="date" value={vancouverToday()} required /></div>
          <div class="field"><label>每次買入（籌碼）</label><input type="number" name="base_buyin" value="1000" min="1" style="width:auto" /></div>
          <div class="field"><label>每次買入（$）</label><input type="number" name="cash" value="20" min="0" step="0.01" style="width:auto" /></div>
          <div class="field"><label>BB</label><input type="number" name="bb_size" value="2" min="1" style="width:auto" /></div>
          <div class="field"><label>Dashboard</label><label><input type="checkbox" name="include_dashboard" value="1" checked style="min-height:auto" /> 計入</label></div>
        </div>
        <p><button class="btn primary">開始</button></p>
      </form>
    </Layout>,
  );
});

app.post('/admin/games', async (c) => {
  const f = await c.req.parseBody();
  const db = c.env.DB;
  if (await getOpenGame(db)) return go(c, '/admin/game', '已經有一場進行中嘅遊戲。');
  const max = await db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM games').first<{ m: number }>();
  const id = (max?.m ?? 0) + 1;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(f.date)) ? String(f.date) : vancouverToday();
  try {
    await db
      .prepare(
        `INSERT INTO games (id, name, date, base_buyin, cash, bb_size, include_dashboard, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
      )
      .bind(
        id,
        String(f.name || `Poker Game # ${id}`).trim(),
        date,
        Math.max(1, Math.trunc(num(f.base_buyin, 1000))),
        Math.max(0, num(f.cash, 20)),
        Math.max(1, Math.trunc(num(f.bb_size, 2))),
        f.include_dashboard ? 1 : 0,
        c.get('email'),
      )
      .run();
  } catch {
    return go(c, '/admin', '開局失敗：可能已經有進行中嘅遊戲。');
  }
  return c.redirect('/admin/game', 303);
});

async function requireOpen(c: Context<AppEnv>) {
  const g = await getOpenGame(c.env.DB);
  return g;
}

app.get('/admin/game', async (c) => {
  const { names } = prefs(c);
  const db = c.env.DB;
  const game = await requireOpen(c);
  if (!game) return c.redirect('/admin', 303);
  const rows = await getRows(db, game.id);
  const { results: allPlayers } = await db.prepare('SELECT id, name, nickname FROM players WHERE id <> 0 ORDER BY name').all<Player>();
  const newName = c.req.query('newname');
  const counted = rows.length > 0 && rows.every((r) => r.end_chips !== null);
  const totalBuyin = rows.reduce((s, r) => s + r.buyin, 0);
  const totalEnd = rows.reduce((s, r) => s + (r.end_chips ?? 0), 0);
  const diff = totalEnd - totalBuyin;
  const dpc = dollarsPerChip(game);

  // close preview
  const pvHost = num(c.req.query('host'), NaN);
  const pvMode = c.req.query('mode') === 'host' ? 'host' : c.req.query('mode') === 'ratio' ? 'ratio' : null;
  const preview =
    counted && pvMode && rows.some((r) => r.player_id === pvHost)
      ? allocateDiff(rows.map((r) => ({ player_id: r.player_id, buyin: r.buyin, end_chips: r.end_chips! })), pvMode, pvHost)
      : null;

  const bi = (r: GameRow) => fmt(r.buyin / game.base_buyin, Number.isInteger(r.buyin / game.base_buyin) ? 0 : 2);

  return render(
    c,
    <Layout title={`管理：${game.name}`} admin={c.get('email')}>
      <GameHeader game={game}>
        <div class="row">
          <a class="btn" href="/">公開頁</a>
          <a class="btn" href="/admin/players">玩家管理</a>
        </div>
      </GameHeader>
      <Msg c={c} />

      <details class="card">
        <summary>遊戲設定</summary>
        <form method="post" action="/admin/game/meta" class="grid" style="margin-top:10px">
          <div class="field"><label>名稱</label><input name="name" value={game.name} required /></div>
          <div class="field"><label>日期</label><input type="date" name="date" value={game.date} /></div>
          <div class="field"><label>每次買入（籌碼）</label><input type="number" name="base_buyin" value={String(game.base_buyin)} min="1" style="width:auto" /></div>
          <div class="field"><label>每次買入（$）</label><input type="number" name="cash" value={String(game.cash)} min="0" step="0.01" style="width:auto" /></div>
          <div class="field"><label>BB</label><input type="number" name="bb_size" value={String(game.bb_size)} min="1" style="width:auto" /></div>
          <div class="field"><label>Dashboard</label><label><input type="checkbox" name="include_dashboard" value="1" checked={!!game.include_dashboard} style="min-height:auto" /> 計入</label></div>
          <div class="field"><label>&nbsp;</label><button class="btn">儲存設定</button></div>
        </form>
        <form method="post" action="/admin/game/delete" style="margin-top:12px" onsubmit="return confirm('確定刪除成場遊戲？呢個動作冇得還原。')">
          <button class="btn danger sm">刪除呢場遊戲</button>
        </form>
      </details>

      <h2>1. 玩家同買入</h2>
      <div class="card">
        <form method="post" action="/admin/game/add" class="row" id="addp">
          <div class="ac">
            <input name="name" id="addname" placeholder="輸入玩家名或綽號" required autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck={false}
              role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="acl" />
            <ul class="card ac-list" id="acl" role="listbox" hidden></ul>
          </div>
          <button class="btn primary">加入（買入 1 次）</button>
        </form>
        {/* Custom suggestion list: native <datalist> is unreliable on mobile (no popup after reload, prefix-only matching). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var P=${JSON.stringify(
              allPlayers.filter((p) => !rows.some((r) => r.player_id === p.id)).map((p) => [p.name, p.nickname ?? '']),
            ).replace(/</g, '\\u003c')};
var i=document.getElementById('addname'),l=document.getElementById('acl');if(!i||!l)return;
function close(){l.hidden=true;i.setAttribute('aria-expanded','false')}
function show(){var q=i.value.trim().toLowerCase();l.innerHTML='';
var m=P.filter(function(p){return !q||p[0].toLowerCase().indexOf(q)>=0||p[1].toLowerCase().indexOf(q)>=0}).slice(0,30);
if(!m.length){close();return}
m.forEach(function(p){var li=document.createElement('li');li.setAttribute('role','option');li.textContent=p[0];
if(p[1]){var s=document.createElement('span');s.className='sub';s.textContent=' '+p[1];li.appendChild(s)}
li.addEventListener('mousedown',function(e){e.preventDefault()});
li.addEventListener('click',function(){i.value=p[0];close();i.focus()});l.appendChild(li)});
l.hidden=false;i.setAttribute('aria-expanded','true')}
i.addEventListener('input',show);i.addEventListener('focus',show);
i.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
i.addEventListener('blur',function(){setTimeout(close,150)});})();`,
          }}
        />
        {newName && (
          <form method="post" action="/admin/game/add" class="warn" style="margin-top:10px">
            <div style="margin-bottom:8px">搵唔到「{newName}」。新增為新玩家並加入呢場？</div>
            <input type="hidden" name="confirm" value="1" />
            <div class="row">
              <input name="name" value={newName} required />
              <input name="nickname" placeholder="綽號（可選）" />
              <button class="btn primary">新增玩家</button>
              <a class="btn" href="/admin/game">取消</a>
            </div>
          </form>
        )}
        {rows.length > 0 && (
          <div style="margin-top:6px">
            {rows.map((r) => (
              <div class="prow">
                <div style="min-width:0">
                  <div class="pname">{displayName(r, names)}</div>
                  <div class="sub">{bi(r)} 次 · {fmt(r.buyin)}</div>
                </div>
                <div class="row" style="flex-wrap:nowrap;gap:6px">
                  <form method="post" action="/admin/game/buyin">
                    <input type="hidden" name="player_id" value={String(r.player_id)} />
                    <input type="hidden" name="delta" value="-1" />
                    <button class="btn sm" disabled={r.buyin <= 0} aria-label="減少一次買入">−</button>
                  </form>
                  <form method="post" action="/admin/game/buyin">
                    <input type="hidden" name="player_id" value={String(r.player_id)} />
                    <input type="hidden" name="delta" value="1" />
                    <button class="btn sm primary">+1</button>
                  </form>
                  <details class="more">
                    <summary class="btn sm" aria-label="更多">⋯</summary>
                    <div class="card pop">
                      <form method="post" action="/admin/game/buyin" class="row">
                        <input type="hidden" name="player_id" value={String(r.player_id)} />
                        <input type="number" name="set" value={String(r.buyin)} min="0" style="width:96px" />
                        <button class="btn sm">設定買入籌碼</button>
                      </form>
                      <form method="post" action="/admin/game/remove" style="margin-top:8px" onsubmit="return confirm('由呢場移除呢位玩家？')">
                        <input type="hidden" name="player_id" value={String(r.player_id)} />
                        <button class="btn sm danger">移除玩家</button>
                      </form>
                    </div>
                  </details>
                </div>
              </div>
            ))}
            <div class="prow" style="border:0;font-weight:600">
              <span>{rows.length} 人</span>
              <span>{fmt(totalBuyin / game.base_buyin, 0)} 次 · {fmt(totalBuyin)}</span>
            </div>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <h2>2. 散局點數</h2>
          <form class="card" method="post" action="/admin/game/chips" id="chips">
            {rows.map((r) => (
              <div class="cnt" data-buyin={String(r.buyin)}>
                <div class="row" style="justify-content:space-between">
                  <span class="pname">{displayName(r, names)}</span>
                  <span class="sub">
                    總數 <b class="tot">{r.end_chips === null ? '—' : fmt(r.end_chips)}</b> · 買入 {fmt(r.buyin)} · P/L{' '}
                    <b class="pl">{r.end_chips === null ? '—' : signed(r.end_chips - r.buyin)}</b>
                  </span>
                </div>
                <div class="denoms">
                  {DENOMS.map((d) => {
                    const v = parseChips(r.chips)[String(d.value)];
                    return (
                      <label class="denom">
                        <Chip k={d.key} />
                        <input type="number" inputmode="numeric" min="0" name={`${d.key}_${r.player_id}`} data-v={String(d.value)}
                          value={v === undefined ? '' : String(v)} aria-label={`${displayName(r, names)} ${d.value}（${d.label}）`} />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            <div class="row" style="justify-content:space-between;margin-top:10px;font-weight:600">
              <span>總計</span>
              <span>籌碼 <span id="sumEnd">{fmt(totalEnd)}</span> · 買入 {fmt(totalBuyin)} · 差額 <span id="sumDiff">{signed(diff)}</span></span>
            </div>
            <p class="row" style="margin-bottom:0">
              <button class="btn primary">儲存點數</button>
              <span class="sub">可以分幾次儲存；全部玩家都有點數先可以結束遊戲。</span>
            </p>
          </form>
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){var f=document.getElementById('chips');if(!f)return;var fm=function(n){return n.toLocaleString('en-US')};
function upd(){var se=0,sb=0;f.querySelectorAll('.cnt').forEach(function(tr){var t=0,any=false;tr.querySelectorAll('input').forEach(function(i){if(i.value!==''){any=true;t+=Number(i.value)*Number(i.dataset.v)}});
var b=Number(tr.dataset.buyin);sb+=b;se+=t;tr.querySelector('.tot').textContent=any?fm(t):'—';var p=t-b;tr.querySelector('.pl').textContent=any?((p>0?'+':p<0?'−':'')+fm(Math.abs(p))):'—';});
document.getElementById('sumEnd').textContent=fm(se);var d=se-sb;document.getElementById('sumDiff').textContent=(d>0?'+':d<0?'−':'')+fm(Math.abs(d));}
f.addEventListener('input',upd);})();`,
            }}
          />

          <h2 id="close">3. 結束遊戲</h2>
          <div class="card">
            {!counted ? (
              <div class="sub">未完成點數：{rows.filter((r) => r.end_chips === null).map((r) => displayName(r, names)).join('、')}</div>
            ) : (
              <>
                <p style="margin-top:0">
                  總籌碼 {fmt(totalEnd)}，總買入 {fmt(totalBuyin)}，差額{' '}
                  <b class={diff === 0 ? '' : 'down'}>{signed(diff)}</b>
                  {diff === 0 && '（平衡）'}
                </p>
                <form method="get" action="/admin/game#close" class="row">
                  <div class="field">
                    <label>Host</label>
                    <select name="host" required>
                      {rows.map((r) => (
                        <option value={String(r.player_id)} selected={r.player_id === pvHost}>{displayName(r, names)}</option>
                      ))}
                    </select>
                  </div>
                  <div class="field">
                    <label>差額處理</label>
                    <select name="mode">
                      <option value="ratio" selected={pvMode !== 'host'}>按贏家贏幅比例分配</option>
                      <option value="host" selected={pvMode === 'host'}>全數歸 host</option>
                    </select>
                  </div>
                  <div class="field"><label>&nbsp;</label><button class="btn">預覽結果</button></div>
                </form>
                {preview && (
                  <>
                    {preview.usedMode !== pvMode && <div class="warn" style="margin-top:10px">冇人贏錢，差額改為全數歸 host。</div>}
                    <div class="tbl-wrap" style="margin-top:10px">
                      <table>
                        <thead><tr><th>玩家</th><th>P/L（調整前）</th><th>差額調整</th><th>P/L（籌碼）</th>{dpc > 0 && <th>P/L（$）</th>}</tr></thead>
                        <tbody>
                          {[...rows]
                            .map((r) => ({ r, a: preview.adj.get(r.player_id) ?? 0 }))
                            .sort((x, y) => net({ ...y.r, adj: y.a }) - net({ ...x.r, adj: x.a }))
                            .map(({ r, a }) => {
                              const n = net({ ...r, adj: a });
                              return (
                                <tr>
                                  <td class="name">{displayName(r, names)}</td>
                                  <td>{signed(r.end_chips! - r.buyin)}</td>
                                  <td>{a ? signed(a) : ''}</td>
                                  <td><Signed n={n} /></td>
                                  {dpc > 0 && <td class={n > 0 ? 'up' : n < 0 ? 'down' : ''}>{money(n * dpc)}</td>}
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                    <form method="post" action="/admin/game/close" style="margin-top:12px" onsubmit="return confirm('結束之後就唔可以喺 app 修改。確定？')">
                      <input type="hidden" name="host" value={String(pvHost)} />
                      <input type="hidden" name="mode" value={pvMode!} />
                      <button class="btn primary">確認結束遊戲</button>
                    </form>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Layout>,
  );
});

app.post('/admin/game/meta', async (c) => {
  const game = await requireOpen(c);
  if (!game) return c.redirect('/admin', 303);
  const f = await c.req.parseBody();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(f.date)) ? String(f.date) : game.date;
  await c.env.DB.prepare('UPDATE games SET name = ?, date = ?, base_buyin = ?, cash = ?, bb_size = ?, include_dashboard = ? WHERE id = ?')
    .bind(
      String(f.name || game.name).trim(),
      date,
      Math.max(1, Math.trunc(num(f.base_buyin, game.base_buyin))),
      Math.max(0, num(f.cash, game.cash)),
      Math.max(1, Math.trunc(num(f.bb_size, game.bb_size))),
      f.include_dashboard ? 1 : 0,
      game.id,
    )
    .run();
  return go(c, '/admin/game', '設定已儲存。');
});

app.post('/admin/game/delete', async (c) => {
  const game = await requireOpen(c);
  if (!game) return c.redirect('/admin', 303);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM game_players WHERE game_id = ?').bind(game.id),
    c.env.DB.prepare("DELETE FROM games WHERE id = ? AND status = 'open'").bind(game.id),
  ]);
  return go(c, '/admin', `已刪除 ${game.name}。`);
});

app.post('/admin/game/add', async (c) => {
  const db = c.env.DB;
  const game = await requireOpen(c);
  if (!game) return c.redirect('/admin', 303);
  const f = await c.req.parseBody();
  const name = String(f.name ?? '').trim().slice(0, 60);
  if (!name) return go(c, '/admin/game', '請輸入玩家名。');

  let player = await db
    .prepare('SELECT * FROM players WHERE id <> 0 AND (lower(name) = lower(?) OR nickname = ?) LIMIT 1')
    .bind(name, name)
    .first<Player>();
  if (!player) {
    if (f.confirm !== '1') return c.redirect(`/admin/game?newname=${encodeURIComponent(name)}`, 303);
    const max = await db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM players').first<{ m: number }>();
    const nick = String(f.nickname ?? '').trim().slice(0, 60) || null;
    const id = (max?.m ?? 0) + 1;
    await db.prepare('INSERT INTO players (id, name, nickname) VALUES (?, ?, ?)').bind(id, name, nick).run();
    player = { id, name, nickname: nick, rep_hand: null };
  }
  const exists = await db.prepare('SELECT 1 FROM game_players WHERE game_id = ? AND player_id = ?').bind(game.id, player.id).first();
  if (exists) return go(c, '/admin/game', `${player.name} 已經喺呢場。`);
  const order = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS o FROM game_players WHERE game_id = ?').bind(game.id).first<{ o: number }>();
  await db
    .prepare('INSERT INTO game_players (game_id, player_id, buyin, sort_order) VALUES (?, ?, ?, ?)')
    .bind(game.id, player.id, game.base_buyin, order?.o ?? 1)
    .run();
  return c.redirect('/admin/game', 303);
});

app.post('/admin/game/buyin', async (c) => {
  const game = await requireOpen(c);
  if (!game) return c.redirect('/admin', 303);
  const f = await c.req.parseBody();
  const pid = Math.trunc(num(f.player_id, -1));
  if (f.set !== undefined) {
    const v = intOrNull(f.set);
    if (v === null) return go(c, '/admin/game', '籌碼數目唔啱。');
    await c.env.DB.prepare('UPDATE game_players SET buyin = ? WHERE game_id = ? AND player_id = ?').bind(v, game.id, pid).run();
  } else {
    const delta = num(f.delta) > 0 ? game.base_buyin : -game.base_buyin;
    await c.env.DB.prepare('UPDATE game_players SET buyin = MAX(0, buyin + ?) WHERE game_id = ? AND player_id = ?')
      .bind(delta, game.id, pid)
      .run();
  }
  return c.redirect('/admin/game', 303);
});

app.post('/admin/game/remove', async (c) => {
  const game = await requireOpen(c);
  if (!game) return c.redirect('/admin', 303);
  const f = await c.req.parseBody();
  await c.env.DB.prepare('DELETE FROM game_players WHERE game_id = ? AND player_id = ?')
    .bind(game.id, Math.trunc(num(f.player_id, -1)))
    .run();
  return c.redirect('/admin/game', 303);
});

app.post('/admin/game/chips', async (c) => {
  const db = c.env.DB;
  const game = await requireOpen(c);
  if (!game) return c.redirect('/admin', 303);
  const f = await c.req.parseBody();
  const rows = await getRows(db, game.id);
  const stmts = rows.map((r) => {
    const counts: ChipCounts = {};
    for (const d of DENOMS) {
      const n = intOrNull(f[`${d.key}_${r.player_id}`]);
      if (n !== null) counts[String(d.value)] = n;
    }
    const json = Object.keys(counts).length ? JSON.stringify(counts) : null;
    return db
      .prepare('UPDATE game_players SET chips = ?, end_chips = ? WHERE game_id = ? AND player_id = ?')
      .bind(json, chipTotal(counts), game.id, r.player_id);
  });
  if (stmts.length) await db.batch(stmts);
  return c.redirect('/admin/game#close', 303);
});

app.post('/admin/game/close', async (c) => {
  const db = c.env.DB;
  const game = await requireOpen(c);
  if (!game) return c.redirect('/admin', 303);
  const f = await c.req.parseBody();
  const rows = await getRows(db, game.id);
  if (!rows.length || rows.some((r) => r.end_chips === null)) return go(c, '/admin/game', '仲有玩家未點數。');
  const host = Math.trunc(num(f.host, -1));
  if (!rows.some((r) => r.player_id === host)) return go(c, '/admin/game', '請揀 host。');
  const mode = f.mode === 'host' ? 'host' : 'ratio';
  const res = allocateDiff(rows.map((r) => ({ player_id: r.player_id, buyin: r.buyin, end_chips: r.end_chips! })), mode, host);
  await db.batch([
    ...rows.map((r) => db.prepare('UPDATE game_players SET adj = ? WHERE game_id = ? AND player_id = ?').bind(res.adj.get(r.player_id) ?? 0, game.id, r.player_id)),
    db
      .prepare("UPDATE games SET status = 'closed', host_player_id = ?, diff_mode = ?, diff_chips = ?, closed_by = ?, closed_at = datetime('now') WHERE id = ? AND status = 'open'")
      .bind(host, res.usedMode, res.diff, c.get('email'), game.id),
  ]);
  return c.redirect(`/games/${game.id}`, 303);
});

app.get('/admin/players', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM players WHERE id <> 0 ORDER BY name').all<Player>();
  return render(
    c,
    <Layout title="玩家管理" admin={c.get('email')}>
      <div class="row" style="justify-content:space-between">
        <h1>玩家管理</h1>
        <a class="btn" href="/admin">返回</a>
      </div>
      <Msg c={c} />
      <form class="card row" method="post" action="/admin/players">
        <input name="name" placeholder="本名" required />
        <input name="nickname" placeholder="綽號（可選）" />
        <button class="btn primary">新增玩家</button>
      </form>
      <div class="card">
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>本名</th><th style="text-align:left">綽號</th><th style="text-align:left">代表手牌</th><th></th></tr></thead>
            <tbody>
              {results.map((p) => (
                <tr>
                  <td colspan={4} style="text-align:left">
                    <form method="post" action={`/admin/players/${p.id}`} class="row">
                      <input name="name" value={p.name} required style="width:120px" />
                      <input name="nickname" value={p.nickname ?? ''} placeholder="綽號" style="flex:1;min-width:140px" />
                      <input name="rep_hand" value={p.rep_hand ?? ''} placeholder="手牌" style="width:70px" />
                      <button class="btn sm">儲存</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>,
  );
});

app.post('/admin/players', async (c) => {
  const f = await c.req.parseBody();
  const name = String(f.name ?? '').trim().slice(0, 60);
  if (!name) return go(c, '/admin/players', '請輸入本名。');
  const max = await c.env.DB.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM players').first<{ m: number }>();
  try {
    await c.env.DB.prepare('INSERT INTO players (id, name, nickname) VALUES (?, ?, ?)')
      .bind((max?.m ?? 0) + 1, name, String(f.nickname ?? '').trim().slice(0, 60) || null)
      .run();
  } catch {
    return go(c, '/admin/players', `已經有玩家叫「${name}」。`);
  }
  return go(c, '/admin/players', `已新增 ${name}。`);
});

app.post('/admin/players/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'));
  if (id === 0) return go(c, '/admin/players');
  const f = await c.req.parseBody();
  const name = String(f.name ?? '').trim().slice(0, 60);
  if (!name) return go(c, '/admin/players', '本名唔可以留空。');
  try {
    await c.env.DB.prepare('UPDATE players SET name = ?, nickname = ?, rep_hand = ? WHERE id = ?')
      .bind(name, String(f.nickname ?? '').trim().slice(0, 60) || null, String(f.rep_hand ?? '').trim().slice(0, 10) || null, id)
      .run();
  } catch {
    return go(c, '/admin/players', `已經有玩家叫「${name}」。`);
  }
  return go(c, '/admin/players', `已更新 ${name}。`);
});

app.notFound((c) => render(c, <Layout title="搵唔到"><div class="card">搵唔到呢個頁面。<a href="/">返主頁</a></div></Layout>, 404));

export default app;
