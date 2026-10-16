"""Generate migrations/0002_seed.sql from the Google Sheet text export.

Usage: python3 -I scripts/make_seed.py <export-file> migrations/0002_seed.sql
"""
import csv
import io
import sys


def sections(text):
    out, name, buf = {}, None, []
    for line in text.splitlines():
        if line.startswith("## Sheet name: "):
            if name:
                out[name] = "\n".join(buf)
            name, buf = line[len("## Sheet name: "):].strip(), []
        else:
            buf.append(line)
    if name:
        out[name] = "\n".join(buf)
    return out


def rows(block):
    lines = [l for l in block.splitlines() if l.strip()]
    r = list(csv.reader(io.StringIO("\n".join(lines))))
    return r[0], r[1:]


def q(v):
    if v is None or v == "":
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def num(v, default=None):
    v = (v or "").replace(",", "").strip()
    if v == "":
        return default
    f = float(v)
    return int(f) if f.is_integer() else f


def main(src, dst):
    sec = sections(open(src, encoding="utf-8").read())
    out = ["-- Generated from Google Sheet export; do not edit by hand.", "PRAGMA defer_foreign_keys = true;"]

    hdr, prow = rows(sec["players"])
    i = {h: k for k, h in enumerate(hdr)}
    for r in prow:
        if not r[i["id"]].strip():
            continue
        # etransfer_detail intentionally NOT migrated
        out.append(
            "INSERT INTO players (id, name, nickname, rep_hand, memo) VALUES "
            f"({int(r[i['id']])}, {q(r[i['name']])}, {q(r[i['nick_name']])}, {q(r[i['rep_hand']])}, {q(r[i['memo']])});"
        )

    hdr, grow = rows(sec["games"])
    i = {h: k for k, h in enumerate(hdr)}
    for r in grow:
        if not r[i["id"]].strip():
            continue
        inc = r[i["include_dashboard"]].strip().upper()
        inc = 0 if inc == "FALSE" else 1  # blank => TRUE (decided)
        out.append(
            "INSERT INTO games (id, name, date, base_buyin, cash, bb_size, memo, include_dashboard, status) VALUES "
            f"({int(r[i['id']])}, {q(r[i['name']])}, {q(r[i['date']])}, {num(r[i['base_buyin']])}, "
            f"{num(r[i['cash']], 0)}, {num(r[i['bb_size']], 2)}, {q(r[i['memo']])}, {inc}, 'closed');"
        )

    hdr, gprow = rows(sec["game_player"])
    i = {h: k for k, h in enumerate(hdr)}
    order = {}
    for r in gprow:
        if not r[i["game.id"]].strip():
            continue
        g = int(r[i["game.id"]])
        order[g] = order.get(g, 0) + 1
        out.append(
            "INSERT INTO game_players (game_id, player_id, buyin, end_chips, memo, sort_order) VALUES "
            f"({g}, {int(r[i['player.id']])}, {num(r[i['buyin_chips']], 0)}, {num(r[i['end_game_chips']], 0)}, "
            f"{q(r[i['memo']])}, {order[g]});"
        )

    # record the historical imbalance per game (sum of [system] rows)
    out.append(
        "UPDATE games SET diff_chips = COALESCE((SELECT SUM(end_chips - buyin) FROM game_players gp "
        "WHERE gp.game_id = games.id AND gp.player_id <> 0), 0);"
    )
    open(dst, "w", encoding="utf-8").write("\n".join(out) + "\n")
    print(f"players={len(prow)} games={len(grow)} game_players={sum(order.values())}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
