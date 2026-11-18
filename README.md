# Poker Tracker

Cloudflare Worker（Hono）+ D1。公開頁任何人可睇；`/admin/*` 經 Cloudflare Access（email OTP）保護。

| 頁面 | 路徑 | 權限 |
|---|---|---|
| 當前遊戲 | `/` | 公開 |
| Dashboard | `/dashboard` | 公開 |
| 歷史遊戲 | `/games`、`/games/:id` | 公開 |
| 玩家 | `/players`、`/players/:id` | 公開 |
| Equity 計算機 | `/equity` | 公開 |
| 開局／買入／點數／結束 | `/admin`、`/admin/game` | Access |
| 玩家管理（綽號） | `/admin/players` | Access |

## 已完成

- D1 數據庫 `poker-tracker`（id `74309e99-2920-4cf3-bcd4-12ae31b1b473`，WNAM）已建立，schema 同 90 場歷史數據已載入。
- `wrangler.toml` 已綁定呢個數據庫。

## 部署（一次性）

```bash
npm install
npx wrangler login          # 開瀏覽器登入 Cloudflare
```

1. **自訂網域**：喺 `wrangler.toml` 取消註解 `routes`，改成你嘅網域，例如
   `routes = [{ pattern = "poker.kitchow.dev", custom_domain = true }]`
   （網域要已經喺你 Cloudflare 帳戶入面）
2. `npx wrangler deploy`
3. **Cloudflare Access**：Zero Trust → Access → Applications → Create → Self-hosted
   - Destinations 加兩條：`poker.kitchow.dev/admin` 同 `poker.kitchow.dev/admin/*`
     （官方文件寫明以路徑保護只會保護該確切 URL，所以子路徑要用 wildcard）
   - Login methods 只揀 One-time PIN
   - Policies 加入現有嘅「Poker Apps」
4. 開返個 application，複製 **Application Audience (AUD) Tag**，貼入 `wrangler.toml` 嘅 `ACCESS_AUD`，再 `npx wrangler deploy` 一次。
   未設定 `ACCESS_AUD` 之前，`/admin` 會回 503，唔會開放。
5. 舊嘅 `hello-world` Worker 同佢嘅 Access application 可以刪除。

## 本地開發

```bash
echo DEV_ALLOW_INSECURE=true > .dev.vars     # 本地跳過 Access 驗證，唔好用喺正式環境
npx wrangler d1 execute poker-tracker --local --file migrations/0001_schema.sql
npx wrangler d1 execute poker-tracker --local --file migrations/0002_seed.sql   # 只存喺本機，見下文
npm run dev
```

## 規則

- 同一時間只有一場進行中（數據庫有 unique index 保證）。
- 買入記每人總數；`+1` 加一次 base buy-in，`⋯` 可以直接設定籌碼數。
- 散局按面額點數：1 白、5 綠、10 藍、50 紅、100 黑。
- 差額 = 總籌碼 − 總買入。結束時揀 host 同處理方法：全數歸 host，或按贏家贏幅比例分配（冇人贏就歸 host）。調整後全場 P/L 總和為 0。
- 已結束嘅遊戲喺 app 入面唔可以改；要改就直接改 D1。
- Dashboard 只計 `status = 'closed'` 同 `include_dashboard = 1` 嘅遊戲；Adj. % = (贏場 + 1) / (場數 + 2)。
- 舊記錄嘅籌碼差額以 `[system]`（id 0）玩家保存，唔會出現喺排名。

## 數據遷移

`scripts/make_seed.py` 由 Google Sheet 匯出檔生成 `migrations/0002_seed.sql`。玩家嘅 e-transfer 資料冇遷移。呢個檔含真實玩家資料，已列入 `.gitignore`，唔會 commit。
