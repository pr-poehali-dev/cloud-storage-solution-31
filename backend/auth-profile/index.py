"""
Профиль пользователя + Admin API + Exchange P2P.
GET  /                         — профиль текущего пользователя
GET  /exchange                 — список открытых заявок (публично)
GET  /exchange/my              — мои заявки
GET  /exchange/balances        — мои крипто-балансы
POST /exchange                 — создать заявку
POST /exchange/take            — принять заявку
POST /exchange/cancel          — отменить заявку
POST /exchange/admin-deposit   — зачислить крипту пользователю (только админ)
GET  /admin/users              — список всех пользователей (только админ)
GET  /admin/deposits           — все депозиты (только админ)
GET  /admin/withdrawals        — все заявки на вывод (только админ)
POST /admin/withdrawals/approve
POST /admin/withdrawals/reject
POST /admin/deposits/confirm
POST /admin/users/toggle-admin
"""
import json
import os
import random
import string
import hashlib
import time as _time
from decimal import Decimal, InvalidOperation
import psycopg2
from psycopg2.extras import RealDictCursor

# ── Bot data ───────────────────────────────────────────────────────────────────
BOT_NAMES = [
    '0x3f8a','0x7c2d','0xb19e','0x4fa1','0x92c3','0xe85b','0x1d74','0x6a0f',
    '0xc53e','0x2891','0xd47a','0x0b6c','0x5f32','0x8e9d','0xa145','0x3c7b',
]
BOT_RATES = {
    ('RUB','USDT'): 92.5, ('USDT','RUB'): 91.8, ('RUB','BTC'): 8_200_000,
    ('BTC','RUB'): 8_150_000, ('RUB','ETH'): 340_000, ('ETH','RUB'): 338_000,
    ('USDT','BTC'): 88_500, ('BTC','USDT'): 88_200, ('USDT','ETH'): 3_650,
    ('ETH','USDT'): 3_630, ('BNB','USDT'): 605, ('USDT','BNB'): 0.00165,
    ('USDT','USDC'): 0.9998, ('USDC','USDT'): 1.0002,
}

def _gen_hash():
    raw = str(random.random()) + str(_time.time())
    return '0x' + hashlib.sha256(raw.encode()).hexdigest()[:62]

def _bot_addr():
    return random.choice(BOT_NAMES) + ''.join(random.choices(string.hexdigits[:16], k=4))

def _rand_amount(cur: str) -> float:
    ranges = {
        'RUB':  (1_000, 150_000), 'USDT': (10, 1_500), 'BTC': (0.0005, 0.05),
        'ETH':  (0.01, 2.0),      'BNB':  (0.1, 20),   'USDC': (10, 1_500),
    }
    lo, hi = ranges.get(cur, (1, 100))
    return round(random.uniform(lo, hi), 6)

def _ensure_bot_txs(conn, min_count: int = 30):
    """Генерирует бот-транзакции если лента пуста или устарела."""
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT COUNT(*) FROM {SCHEMA}.tx_feed WHERE created_at > NOW() - INTERVAL '2 hours'"
        )
        cnt = cur.fetchone()[0]
    if cnt >= min_count:
        return
    # Генерируем пачку транзакций с разбросом по времени
    pairs = list(BOT_RATES.keys())
    rows = []
    for i in range(40):
        fc, tc = random.choice(pairs)
        fa = _rand_amount(fc)
        rate = BOT_RATES[(fc, tc)] * random.uniform(0.995, 1.005)
        ta = round(fa * rate, 6) if tc != 'BTC' else round(fa / BOT_RATES.get((tc, fc), 1), 6)
        if tc == 'BTC' and fc == 'USDT':
            ta = round(fa / rate, 6)
        secs_ago = random.randint(0, 7000)
        rows.append((
            _gen_hash(), _bot_addr(), _bot_addr(),
            fc, tc, fa, ta,
            f"NOW() - INTERVAL '{secs_ago} seconds'"
        ))
    with conn.cursor() as cur:
        for r in rows:
            cur.execute(
                f"INSERT INTO {SCHEMA}.tx_feed (tx_hash,from_addr,to_addr,from_cur,to_cur,from_amount,to_amount,created_at) "
                f"VALUES (%s,%s,%s,%s,%s,%s,%s,{r[7]})",
                r[:7]
            )
    conn.commit()

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}


SCHEMA = 't_p27527697_cloud_storage_soluti'
COINS = ['USDT', 'BTC', 'ETH', 'BNB', 'USDC']
CURRENCIES = ['RUB'] + COINS


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


# ── Exchange helpers ───────────────────────────────────────────────────────────

def get_rub_balance_ex(conn, user_id: int) -> Decimal:
    with conn.cursor() as cur:
        cur.execute(f"SELECT COALESCE(SUM(amount),0) FROM {SCHEMA}.dividends WHERE user_id=%s", (user_id,))
        divs = Decimal(str(cur.fetchone()[0]))
        cur.execute(f"SELECT COALESCE(SUM(amount),0) FROM {SCHEMA}.referral_payouts WHERE referrer_id=%s", (user_id,))
        refs = Decimal(str(cur.fetchone()[0]))
        cur.execute(
            f"SELECT COALESCE(SUM(amount),0) FROM {SCHEMA}.withdrawals WHERE user_id=%s AND status IN ('pending','completed')",
            (user_id,)
        )
        withdrawn = Decimal(str(cur.fetchone()[0]))
        cur.execute(
            f"SELECT COALESCE(SUM(from_amount),0) FROM {SCHEMA}.exchange_orders "
            "WHERE user_id=%s AND from_currency='RUB' AND status='open'",
            (user_id,)
        )
        locked = Decimal(str(cur.fetchone()[0]))
        return divs + refs - withdrawn - locked


def get_crypto_bal(conn, user_id: int, coin: str) -> Decimal:
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT COALESCE(amount,0) FROM {SCHEMA}.crypto_balances WHERE user_id=%s AND coin=%s",
            (user_id, coin)
        )
        row = cur.fetchone()
        return Decimal(str(row[0])) if row else Decimal('0')


def adjust_crypto(conn, user_id: int, coin: str, delta: Decimal):
    with conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO {SCHEMA}.crypto_balances (user_id, coin, amount, updated_at) "
            "VALUES (%s,%s,%s,NOW()) ON CONFLICT (user_id,coin) "
            "DO UPDATE SET amount=crypto_balances.amount+EXCLUDED.amount, updated_at=NOW()",
            (user_id, coin, float(delta))
        )


def deduct_rub(conn, user_id: int, amount: Decimal):
    with conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO {SCHEMA}.withdrawals (user_id,amount,method,details,status) "
            "VALUES (%s,%s,'internal_exchange','{}','completed')",
            (user_id, float(amount))
        )


def credit_rub(conn, user_id: int, amount: Decimal):
    with conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO {SCHEMA}.dividends (user_id,amount,week_start) "
            "VALUES (%s,%s,DATE_TRUNC('week',NOW()))",
            (user_id, float(amount))
        )


def refund_rub(conn, user_id: int, amount: Decimal):
    with conn.cursor() as cur:
        cur.execute(
            f"DELETE FROM {SCHEMA}.withdrawals WHERE id=("
            f"SELECT id FROM {SCHEMA}.withdrawals WHERE user_id=%s "
            "AND method='internal_exchange' AND status='completed' AND amount=%s "
            "ORDER BY id DESC LIMIT 1)",
            (user_id, float(amount))
        )


def handle_exchange(conn, http_method, path, session_id, event, user):
    """Роутер P2P-обменника через ?action=exchange-*"""
    qs = event.get('queryStringParameters') or {}
    action = qs.get('action', '')
    # Маппинг action → sub
    ACTION_MAP = {
        'exchange-list': '/', 'exchange-balances': '/balances',
        'exchange-my': '/my', 'exchange-create': '/',
        'exchange-take': '/take', 'exchange-cancel': '/cancel',
        'exchange-admin-deposit': '/admin-deposit',
        'exchange-admin-balances': '/admin-balances',
        'exchange-txfeed': '/txfeed',
        'exchange-stats': '/stats',
    }
    if action in ACTION_MAP:
        sub = ACTION_MAP[action]
        if action == 'exchange-create':
            http_method = 'POST'
    elif '/exchange' in path:
        sub = path[len('/exchange'):] or '/'
    else:
        sub = '/'

    # ── GET /exchange/txfeed — живая лента транзакций ─────────────
    if http_method == 'GET' and sub == '/txfeed':
        _ensure_bot_txs(conn)
        qs2 = event.get('queryStringParameters') or {}
        limit = min(int(qs2.get('limit', 40)), 100)
        after_id = qs2.get('after_id')  # для polling новых
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if after_id:
                cur.execute(
                    f"SELECT id,tx_hash,from_addr,to_addr,from_cur,to_cur,from_amount,to_amount,status,is_bot,created_at "
                    f"FROM {SCHEMA}.tx_feed WHERE id > %s ORDER BY id DESC LIMIT %s",
                    (int(after_id), limit)
                )
            else:
                cur.execute(
                    f"SELECT id,tx_hash,from_addr,to_addr,from_cur,to_cur,from_amount,to_amount,status,is_bot,created_at "
                    f"FROM {SCHEMA}.tx_feed ORDER BY id DESC LIMIT %s",
                    (limit,)
                )
            rows = cur.fetchall()
        txs = [{
            'id': r['id'], 'tx_hash': r['tx_hash'],
            'from_addr': r['from_addr'], 'to_addr': r['to_addr'],
            'from_cur': r['from_cur'], 'to_cur': r['to_cur'],
            'from_amount': float(r['from_amount']), 'to_amount': float(r['to_amount']),
            'status': r['status'], 'is_bot': r['is_bot'],
            'created_at': str(r['created_at'])
        } for r in rows]
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'txs': txs})}

    # ── GET /exchange/stats — общая статистика ────────────────────
    if http_method == 'GET' and sub == '/stats':
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.tx_feed")
            total_tx = int(cur.fetchone()[0])
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.exchange_orders WHERE status='completed'")
            p2p_done = int(cur.fetchone()[0])
            cur.execute(
                f"SELECT SUM(from_amount) FROM {SCHEMA}.tx_feed WHERE from_cur='USDT'"
            )
            vol = cur.fetchone()[0]
            volume_usdt = float(vol) if vol else 0.0
            cur.execute(f"SELECT COUNT(DISTINCT from_addr) FROM {SCHEMA}.tx_feed")
            wallets = int(cur.fetchone()[0])
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
            'total_tx': total_tx, 'p2p_done': p2p_done,
            'volume_usdt': volume_usdt, 'active_wallets': wallets
        })}

    # ── GET /exchange — публичный список заявок ───────────────────
    if http_method == 'GET' and sub == '/':
        qs = event.get('queryStringParameters') or {}
        fc = qs.get('from_currency', '')
        tc = qs.get('to_currency', '')
        conds = ["o.status='open'"]
        params = []
        if fc:
            conds.append("o.from_currency=%s"); params.append(fc.upper())
        if tc:
            conds.append("o.to_currency=%s"); params.append(tc.upper())
        where = ' AND '.join(conds)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f"SELECT o.*, u.name AS creator_name FROM {SCHEMA}.exchange_orders o "
                f"JOIN {SCHEMA}.users u ON u.id=o.user_id WHERE {where} ORDER BY o.created_at DESC LIMIT 100",
                params
            )
            orders = [dict(r) for r in cur.fetchall()]
        uid = user['id'] if user else None
        for o in orders:
            o['is_mine'] = (o['user_id'] == uid)
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'orders': orders}, default=str)}

    # Остальные маршруты требуют авторизации
    if not user:
        return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

    # ── GET /exchange/balances ────────────────────────────────────
    if http_method == 'GET' and sub == '/balances':
        bals = {'RUB': float(get_rub_balance_ex(conn, user['id']))}
        for coin in COINS:
            bals[coin] = float(get_crypto_bal(conn, user['id'], coin))
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'balances': bals})}

    # ── GET /exchange/admin-balances?user_id=X (только админ) ────
    if http_method == 'GET' and sub == '/admin-balances':
        if not user.get('is_admin'):
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Только для администраторов'})}
        qs = event.get('queryStringParameters') or {}
        target_uid = int(qs.get('user_id', 0))
        if not target_uid:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Не указан user_id'})}
        bals = {'RUB': float(get_rub_balance_ex(conn, target_uid))}
        for coin in COINS:
            bals[coin] = float(get_crypto_bal(conn, target_uid, coin))
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'balances': bals})}

    # ── GET /exchange/my ─────────────────────────────────────────
    if http_method == 'GET' and sub == '/my':
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f"SELECT o.*, u.name AS taker_name FROM {SCHEMA}.exchange_orders o "
                f"LEFT JOIN {SCHEMA}.users u ON u.id=o.taker_user_id "
                "WHERE o.user_id=%s ORDER BY o.created_at DESC LIMIT 50",
                (user['id'],)
            )
            orders = [dict(r) for r in cur.fetchall()]
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'orders': orders}, default=str)}

    # ── POST /exchange — создать заявку ──────────────────────────
    if http_method == 'POST' and sub == '/':
        body = json.loads(event.get('body') or '{}')
        fc = (body.get('from_currency') or '').upper()
        tc = (body.get('to_currency') or '').upper()
        comment = (body.get('comment') or '')[:200]
        if fc not in CURRENCIES or tc not in CURRENCIES:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': f'Допустимые валюты: {", ".join(CURRENCIES)}'})}
        if fc == tc:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Нельзя обменять на ту же валюту'})}
        try:
            fa = Decimal(str(body.get('from_amount', 0)))
            ta = Decimal(str(body.get('to_amount', 0)))
        except InvalidOperation:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неверные суммы'})}
        if fa <= 0 or ta <= 0:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Суммы должны быть > 0'})}
        avail = get_rub_balance_ex(conn, user['id']) if fc == 'RUB' else get_crypto_bal(conn, user['id'], fc)
        if avail < fa:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': f'Недостаточно {fc}. Доступно: {float(avail):.8g}'})}
        if fc == 'RUB':
            deduct_rub(conn, user['id'], fa)
        else:
            adjust_crypto(conn, user['id'], fc, -fa)
        rate = ta / fa
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {SCHEMA}.exchange_orders (user_id,from_currency,from_amount,to_currency,to_amount,rate,comment) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (user['id'], fc, float(fa), tc, float(ta), float(rate), comment)
            )
            order_id = cur.fetchone()[0]
        # Записываем в live-ленту
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {SCHEMA}.tx_feed (tx_hash,from_addr,to_addr,from_cur,to_cur,from_amount,to_amount,is_bot,user_id,status) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,false,%s,'pending')",
                (_gen_hash(), f"0x{user['id']:06x}user", _bot_addr(), fc, tc, float(fa), float(ta), user['id'])
            )
        conn.commit()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'order_id': order_id})}

    # ── POST /exchange/take ───────────────────────────────────────
    if http_method == 'POST' and sub == '/take':
        body = json.loads(event.get('body') or '{}')
        oid = int(body.get('order_id', 0))
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f"SELECT * FROM {SCHEMA}.exchange_orders WHERE id=%s FOR UPDATE", (oid,))
            order = cur.fetchone()
        if not order:
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Заявка не найдена'})}
        order = dict(order)
        if order['status'] != 'open':
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Заявка уже закрыта'})}
        if order['user_id'] == user['id']:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Нельзя принять свою заявку'})}
        tc = order['to_currency']
        ta = Decimal(str(order['to_amount']))
        avail = get_rub_balance_ex(conn, user['id']) if tc == 'RUB' else get_crypto_bal(conn, user['id'], tc)
        if avail < ta:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': f'Недостаточно {tc}. Доступно: {float(avail):.8g}'})}
        fc = order['from_currency']
        fa = Decimal(str(order['from_amount']))
        # Списываем у taker
        if tc == 'RUB':
            deduct_rub(conn, user['id'], ta)
        else:
            adjust_crypto(conn, user['id'], tc, -ta)
        # Зачисляем creator-у (он получает to_currency)
        if tc == 'RUB':
            credit_rub(conn, order['user_id'], ta)
        else:
            adjust_crypto(conn, order['user_id'], tc, ta)
        # Зачисляем taker-у (он получает from_currency)
        if fc == 'RUB':
            credit_rub(conn, user['id'], fa)
        else:
            adjust_crypto(conn, user['id'], fc, fa)
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {SCHEMA}.exchange_orders SET status='completed',taker_user_id=%s,completed_at=NOW() WHERE id=%s",
                (user['id'], oid)
            )
        conn.commit()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    # ── POST /exchange/cancel ─────────────────────────────────────
    if http_method == 'POST' and sub == '/cancel':
        body = json.loads(event.get('body') or '{}')
        oid = int(body.get('order_id', 0))
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f"SELECT * FROM {SCHEMA}.exchange_orders WHERE id=%s FOR UPDATE", (oid,))
            order = cur.fetchone()
        if not order:
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Заявка не найдена'})}
        order = dict(order)
        if order['status'] != 'open':
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Заявка уже закрыта'})}
        if order['user_id'] != user['id'] and not user.get('is_admin'):
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Нет доступа'})}
        fc = order['from_currency']
        fa = Decimal(str(order['from_amount']))
        if fc == 'RUB':
            refund_rub(conn, order['user_id'], fa)
        else:
            adjust_crypto(conn, order['user_id'], fc, fa)
        with conn.cursor() as cur:
            cur.execute(f"UPDATE {SCHEMA}.exchange_orders SET status='cancelled' WHERE id=%s", (oid,))
        conn.commit()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    # ── POST /exchange/admin-deposit ──────────────────────────────
    if http_method == 'POST' and sub == '/admin-deposit':
        if not user.get('is_admin'):
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Только для администраторов'})}
        body = json.loads(event.get('body') or '{}')
        target_uid = int(body.get('user_id', 0))
        coin = (body.get('coin') or '').upper()
        amount = Decimal(str(body.get('amount', 0)))
        if coin not in COINS:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': f'Допустимые монеты: {", ".join(COINS)}'})}
        if amount <= 0:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Сумма > 0'})}
        adjust_crypto(conn, target_uid, coin, amount)
        conn.commit()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Маршрут не найден'})}


def get_session_user(conn, session_id: str):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT u.id, u.name, u.email, u.referral_code, u.referred_by, u.is_admin, u.created_at "
            "FROM sessions s JOIN users u ON u.id = s.user_id "
            "WHERE s.id = %s AND s.expires_at > NOW()",
            (session_id,)
        )
        row = cur.fetchone()
        if not row:
            return None
        return {'id': row[0], 'name': row[1], 'email': row[2],
                'referral_code': row[3], 'referred_by': row[4],
                'is_admin': row[5], 'created_at': str(row[6])}


def require_admin(user):
    if not user or not user.get('is_admin'):
        return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Доступ запрещён'})}
    return None


def handler(event: dict, context) -> dict:
    """Профиль, P2P-обменник и Admin API."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    http_method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    headers = event.get('headers') or {}
    session_id = headers.get('X-Session-Id', '')

    conn = get_conn()
    try:
        # ── EXCHANGE ROUTES (публичный GET доступен без сессии) ───
        qs_check = event.get('queryStringParameters') or {}
        action_val = qs_check.get('action', '')
        is_exchange = '/exchange' in path or action_val.startswith('exchange-')
        if is_exchange:
            user = None
            if session_id:
                user = get_session_user(conn, session_id)
            return handle_exchange(conn, http_method, path, session_id, event, user)

        if not session_id:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

        user = get_session_user(conn, session_id)
        if not user:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Сессия истекла'})}

        # ── ADMIN ROUTES ──────────────────────────────────────────
        if '/admin/' in path or path.endswith('/admin'):
            err = require_admin(user)
            if err:
                return err

            # GET /admin/users
            if http_method == 'GET' and 'users' in path:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT u.id, u.name, u.email, u.referral_code, u.is_admin, u.created_at,
                            COALESCE((SELECT SUM(d.amount) FROM deposits d WHERE d.user_id=u.id AND d.status='confirmed'),0) AS deposit,
                            COALESCE((SELECT SUM(dv.amount) FROM dividends dv WHERE dv.user_id=u.id),0) AS dividends,
                            COALESCE((SELECT SUM(rp.amount) FROM referral_payouts rp WHERE rp.referrer_id=u.id),0) AS ref_total,
                            (SELECT COUNT(*) FROM users r WHERE r.referred_by=u.id) AS ref_count
                        FROM users u
                        ORDER BY u.created_at DESC
                        LIMIT 200
                    """)
                    rows = cur.fetchall()
                users_list = [
                    {'id': r[0], 'name': r[1], 'email': r[2], 'referral_code': r[3],
                     'is_admin': r[4], 'created_at': str(r[5]),
                     'deposit': float(r[6]), 'dividends': float(r[7]),
                     'ref_total': float(r[8]), 'ref_count': int(r[9]),
                     'balance': float(r[7]) + float(r[8])}
                    for r in rows
                ]
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'users': users_list, 'total': len(users_list)})}

            # GET /admin/deposits
            if http_method == 'GET' and 'deposits' in path:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT d.id, d.user_id, u.name, u.email, d.amount, d.method,
                               d.status, d.external_id, d.created_at, d.confirmed_at
                        FROM deposits d JOIN users u ON u.id = d.user_id
                        ORDER BY d.created_at DESC LIMIT 200
                    """)
                    rows = cur.fetchall()
                items = [
                    {'id': r[0], 'user_id': r[1], 'user_name': r[2], 'user_email': r[3],
                     'amount': float(r[4]), 'method': r[5], 'status': r[6],
                     'external_id': r[7], 'created_at': str(r[8]),
                     'confirmed_at': str(r[9]) if r[9] else None}
                    for r in rows
                ]
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'items': items, 'total': len(items)})}

            # GET /admin/withdrawals
            if http_method == 'GET' and 'withdrawals' in path:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT w.id, w.user_id, u.name, u.email, w.amount, w.method,
                               w.details, w.status, w.external_id, w.created_at, w.processed_at
                        FROM withdrawals w JOIN users u ON u.id = w.user_id
                        ORDER BY w.created_at DESC LIMIT 200
                    """)
                    rows = cur.fetchall()
                items = [
                    {'id': r[0], 'user_id': r[1], 'user_name': r[2], 'user_email': r[3],
                     'amount': float(r[4]), 'method': r[5],
                     'details': r[6] if isinstance(r[6], dict) else json.loads(r[6] or '{}'),
                     'status': r[7], 'external_id': r[8],
                     'created_at': str(r[9]), 'processed_at': str(r[10]) if r[10] else None}
                    for r in rows
                ]
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'items': items, 'total': len(items)})}

            # POST /admin/withdrawals/approve
            if http_method == 'POST' and 'approve' in path:
                body = json.loads(event.get('body') or '{}')
                wid = int(body.get('id', 0))
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE withdrawals SET status='completed', processed_at=NOW() WHERE id=%s AND status='pending' RETURNING id",
                        (wid,)
                    )
                    updated = cur.fetchone()
                    conn.commit()
                if not updated:
                    return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Заявка не найдена или уже обработана'})}
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

            # POST /admin/withdrawals/reject
            if http_method == 'POST' and 'reject' in path:
                body = json.loads(event.get('body') or '{}')
                wid = int(body.get('id', 0))
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE withdrawals SET status='failed', processed_at=NOW() WHERE id=%s AND status='pending' RETURNING id",
                        (wid,)
                    )
                    updated = cur.fetchone()
                    conn.commit()
                if not updated:
                    return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Заявка не найдена или уже обработана'})}
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

            # POST /admin/deposits/confirm
            if http_method == 'POST' and 'confirm' in path:
                body = json.loads(event.get('body') or '{}')
                did = int(body.get('id', 0))
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE deposits SET status='confirmed', confirmed_at=NOW() WHERE id=%s AND status='pending' RETURNING id, user_id, amount",
                        (did,)
                    )
                    row = cur.fetchone()
                    if row:
                        cur.execute(
                            "INSERT INTO dividends (user_id, amount, type, description) VALUES (%s, 0, 'deposit', %s)",
                            (row[1], f'Депозит {float(row[2]):.2f} ₽ подтверждён администратором')
                        )
                    conn.commit()
                if not row:
                    return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Депозит не найден или уже подтверждён'})}
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

            # POST /admin/users/toggle-admin
            if http_method == 'POST' and 'toggle-admin' in path:
                body = json.loads(event.get('body') or '{}')
                uid = int(body.get('id', 0))
                if uid == user['id']:
                    return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Нельзя изменить свои права'})}
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE users SET is_admin = NOT is_admin WHERE id=%s RETURNING is_admin",
                        (uid,)
                    )
                    row = cur.fetchone()
                    conn.commit()
                if not row:
                    return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Пользователь не найден'})}
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'is_admin': row[0]})}

            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Not found'})}

        # ── BOOST ROUTES ──────────────────────────────────────────
        if '/boost' in path or action_val.startswith('boost-'):
            if action_val == 'boost-create':
                http_method = 'POST'
            # GET /boost — история бустов пользователя
            if http_method == 'GET':
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT id, amount, bonus_pct, created_at FROM boosts "
                        "WHERE user_id=%s ORDER BY created_at DESC LIMIT 20",
                        (user['id'],)
                    )
                    rows = cur.fetchall()
                    cur.execute("SELECT boost_percent FROM users WHERE id=%s", (user['id'],))
                    bp = cur.fetchone()
                boosts = [{'id': r[0], 'amount': float(r[1]), 'bonus_pct': float(r[2]), 'created_at': str(r[3])} for r in rows]
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                    'boosts': boosts, 'boost_percent': float(bp[0]) if bp else 0
                })}

            # POST /boost — создать буст
            if http_method == 'POST':
                import json as _json
                body = _json.loads(event.get('body') or '{}')
                amount = float(body.get('amount', 0))
                if amount < 5000:
                    return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Минимальная сумма буста — 5 000 ₽'})}
                bonus_pct = 10.0 if amount >= 100000 else 5.0
                with conn.cursor() as cur:
                    # Проверяем баланс
                    cur.execute(
                        "SELECT COALESCE(SUM(d.amount),0) FROM deposits d WHERE d.user_id=%s AND d.status='confirmed'",
                        (user['id'],)
                    )
                    dep = float(cur.fetchone()[0])
                    cur.execute("SELECT COALESCE(SUM(dv.amount),0) FROM dividends dv WHERE dv.user_id=%s", (user['id'],))
                    divs = float(cur.fetchone()[0])
                    cur.execute("SELECT COALESCE(SUM(rp.amount),0) FROM referral_payouts rp WHERE rp.referrer_id=%s", (user['id'],))
                    refs = float(cur.fetchone()[0])
                    cur.execute("SELECT COALESCE(SUM(w.amount),0) FROM withdrawals w WHERE w.user_id=%s AND w.status IN ('pending','completed')", (user['id'],))
                    withdrawn = float(cur.fetchone()[0])
                    available = divs + refs - withdrawn
                    if available < amount:
                        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': f'Недостаточно средств. Доступно: {available:.2f} ₽'})}
                    # Списываем через вывод-запись
                    cur.execute(
                        "INSERT INTO withdrawals (user_id, amount, method, status) VALUES (%s, %s, 'boost', 'completed')",
                        (user['id'], amount)
                    )
                    # Записываем буст
                    cur.execute(
                        "INSERT INTO boosts (user_id, amount, bonus_pct) VALUES (%s, %s, %s) RETURNING id",
                        (user['id'], amount, bonus_pct)
                    )
                    boost_id = cur.fetchone()[0]
                    # Обновляем boost_percent (берём максимум всех бустов)
                    cur.execute(
                        "UPDATE users SET boost_percent = (SELECT COALESCE(SUM(b.bonus_pct),0) FROM boosts b WHERE b.user_id=%s) WHERE id=%s",
                        (user['id'], user['id'])
                    )
                    conn.commit()
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'boost_id': boost_id, 'bonus_pct': bonus_pct})}

        # ── WHEEL ROUTES ──────────────────────────────────────────
        if '/wheel' in path or action_val.startswith('wheel-'):
            import json as _json
            import random as _random

            # 16 секций: 4×x2, 2×x5, 1×x10, 9×lose (вероятность выигрыша ~7/16 = 43.75%, но
            # по заданию 20% — реализуем через random с весами)
            # Сегменты колеса (для анимации на фронте, фиксированный порядок)
            WHEEL_SEGMENTS = [
                {'label': 'x2',   'mult': 2.0,  'color': '#22c55e'},
                {'label': '💀',   'mult': 0.0,  'color': '#374151'},
                {'label': 'x5',   'mult': 5.0,  'color': '#f59e0b'},
                {'label': '💀',   'mult': 0.0,  'color': '#374151'},
                {'label': 'x2',   'mult': 2.0,  'color': '#22c55e'},
                {'label': '💀',   'mult': 0.0,  'color': '#374151'},
                {'label': 'x10',  'mult': 10.0, 'color': '#ef4444'},
                {'label': '💀',   'mult': 0.0,  'color': '#374151'},
                {'label': 'x2',   'mult': 2.0,  'color': '#22c55e'},
                {'label': '💀',   'mult': 0.0,  'color': '#374151'},
                {'label': 'x5',   'mult': 5.0,  'color': '#f59e0b'},
                {'label': '💀',   'mult': 0.0,  'color': '#374151'},
                {'label': 'x2',   'mult': 2.0,  'color': '#22c55e'},
                {'label': '💀',   'mult': 0.0,  'color': '#374151'},
                {'label': '💀',   'mult': 0.0,  'color': '#374151'},
                {'label': '💀',   'mult': 0.0,  'color': '#374151'},
            ]

            if action_val == 'wheel-spin':
                http_method = 'POST'
            # GET /wheel — история последних спинов
            if http_method == 'GET':
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT id, bet, multiplier, win_amount, segment, created_at "
                        "FROM wheel_spins WHERE user_id=%s ORDER BY created_at DESC LIMIT 10",
                        (user['id'],)
                    )
                    rows = cur.fetchall()
                spins = [{'id': r[0], 'bet': float(r[1]), 'multiplier': float(r[2]),
                          'win_amount': float(r[3]), 'segment': r[4],
                          'created_at': str(r[5])} for r in rows]
                return {'statusCode': 200, 'headers': CORS,
                        'body': _json.dumps({'spins': spins, 'segments': WHEEL_SEGMENTS})}

            # POST /wheel — сделать спин
            if http_method == 'POST':
                body = _json.loads(event.get('body') or '{}')
                bet = float(body.get('bet', 0))
                if bet < 100:
                    return {'statusCode': 400, 'headers': CORS,
                            'body': _json.dumps({'error': 'Минимальная ставка — 100 ₽'})}

                # Проверяем баланс
                with conn.cursor() as cur:
                    cur.execute("SELECT COALESCE(SUM(dv.amount),0) FROM dividends dv WHERE dv.user_id=%s", (user['id'],))
                    divs = float(cur.fetchone()[0])
                    cur.execute("SELECT COALESCE(SUM(rp.amount),0) FROM referral_payouts rp WHERE rp.referrer_id=%s", (user['id'],))
                    refs = float(cur.fetchone()[0])
                    cur.execute("SELECT COALESCE(SUM(w.amount),0) FROM withdrawals w WHERE w.user_id=%s AND w.status IN ('pending','completed')", (user['id'],))
                    withdrawn = float(cur.fetchone()[0])
                available = divs + refs - withdrawn
                if available < bet:
                    return {'statusCode': 400, 'headers': CORS,
                            'body': _json.dumps({'error': f'Недостаточно средств. Доступно: {available:.2f} ₽'})}

                # Определяем результат (вероятность выигрыша 20%)
                win = _random.random() < 0.20
                if win:
                    win_segs = [i for i, s in enumerate(WHEEL_SEGMENTS) if s['mult'] > 0]
                    seg_idx = _random.choice(win_segs)
                else:
                    lose_segs = [i for i, s in enumerate(WHEEL_SEGMENTS) if s['mult'] == 0]
                    seg_idx = _random.choice(lose_segs)

                seg = WHEEL_SEGMENTS[seg_idx]
                multiplier = seg['mult']
                win_amount = round(bet * multiplier - bet, 2)  # чистый выигрыш (или 0 при проигрыше)

                with conn.cursor() as cur:
                    # Списываем ставку
                    cur.execute(
                        "INSERT INTO withdrawals (user_id, amount, method, status) VALUES (%s, %s, 'wheel_bet', 'completed')",
                        (user['id'], bet)
                    )
                    # Если выиграл — зачисляем выигрыш как дивиденды
                    if multiplier > 0:
                        payout = round(bet * multiplier, 2)
                        cur.execute(
                            "INSERT INTO dividends (user_id, amount) VALUES (%s, %s)",
                            (user['id'], payout)
                        )
                    # Записываем в историю
                    cur.execute(
                        "INSERT INTO wheel_spins (user_id, bet, multiplier, win_amount, segment) "
                        "VALUES (%s, %s, %s, %s, %s) RETURNING id",
                        (user['id'], bet, multiplier, win_amount, seg['label'])
                    )
                    spin_id = cur.fetchone()[0]
                    conn.commit()

                return {'statusCode': 200, 'headers': CORS, 'body': _json.dumps({
                    'ok': True, 'spin_id': spin_id,
                    'seg_idx': seg_idx, 'segment': seg['label'],
                    'multiplier': multiplier, 'win_amount': win_amount,
                    'bet': bet, 'win': multiplier > 0
                })}

        # ── CHAT ROUTES ───────────────────────────────────────────
        if action_val.startswith('chat-') or '/chat' in path:
            import json as _cj
            import random as _cr

            BOT_USERS = [
                ('Алексей К.','ak'), ('Марина В.','mv'), ('Дмитрий Л.','dl'),
                ('Ольга Т.','ot'), ('Сергей Р.','sr'), ('Наталья М.','nm'),
                ('Иван Ф.','if'), ('Екатерина Б.','eb'), ('Артём Ж.','aj'),
                ('Светлана П.','sp'), ('Роман Ч.','rc'), ('Юлия Н.','yn'),
                ('Андрей О.','ao'), ('Вика Д.','vd'), ('Никита С.','ns'),
            ]
            REVIEW_MSGS = [
                'Уже 3 месяца на платформе — дивиденды капают каждую неделю 🔥',
                'Вывел вчера 15 000 ₽, всё пришло за 10 минут. Доволен!',
                'P2P обменник удобный, сделал 3 обмена без проблем',
                'Реферальная программа реально работает, получил бонус от друга',
                'Буст на 5% поставил — разница ощутимая, советую',
                'Колесо фортуны выиграл ×2 с первого раза 😁',
                'Платформа развивается, видно что команда работает',
                'Поддержка ответила быстро, спасибо!',
                'Уже полгода здесь, никаких проблем с выводом',
                'Депозит подтвердили за час, всё честно',
                'Хорошая доходность для пассивного дохода',
                'Рекомендую всем своим знакомым 👍',
                'Интерфейс стал намного лучше после обновления',
                'Дивиденды начисляются автоматически, удобно',
                'Зарегистрировался по реферальной ссылке — уже в плюсе',
            ]
            COMPLAINT_MSGS = [
                'Хотелось бы мобильное приложение для iOS',
                'Добавьте больше криптовалют в обменник',
                'Верификация документов немного затянулась, жду',
                'Хотелось бы больше способов пополнения',
                'Кнопка "история транзакций" была бы удобнее',
                'Иногда страница загружается медленно',
            ]

            def _seed_bots(conn):
                with conn.cursor() as cur:
                    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.chat_messages WHERE created_at > NOW() - INTERVAL '6 hours'")
                    cnt = cur.fetchone()[0]
                if cnt >= 25:
                    return
                msgs = []
                for i in range(35):
                    is_complaint = _cr.random() < 0.12
                    bot = _cr.choice(BOT_USERS)
                    text = _cr.choice(COMPLAINT_MSGS if is_complaint else REVIEW_MSGS)
                    secs = _cr.randint(0, 21000)
                    msgs.append((bot[0], bot[1], text, True, 'complaint' if is_complaint else 'review', secs))
                with conn.cursor() as cur:
                    for m in msgs:
                        cur.execute(
                            f"INSERT INTO {SCHEMA}.chat_messages (username,avatar_seed,message,is_bot,msg_type,created_at) "
                            f"VALUES (%s,%s,%s,%s,%s, NOW() - INTERVAL '{m[5]} seconds')",
                            m[:5]
                        )
                conn.commit()

            _seed_bots(conn)

            # GET chat-list — последние сообщения
            if action_val == 'chat-list' or (http_method == 'GET' and '/chat' in path and 'support' not in path):
                qs2 = event.get('queryStringParameters') or {}
                after_id = qs2.get('after_id')
                with conn.cursor() as cur:
                    if after_id:
                        cur.execute(
                            f"SELECT id,username,avatar_seed,message,is_bot,msg_type,created_at "
                            f"FROM {SCHEMA}.chat_messages WHERE id > %s ORDER BY id DESC LIMIT 50",
                            (int(after_id),)
                        )
                    else:
                        cur.execute(
                            f"SELECT id,username,avatar_seed,message,is_bot,msg_type,created_at "
                            f"FROM {SCHEMA}.chat_messages ORDER BY id DESC LIMIT 50"
                        )
                    rows = cur.fetchall()
                msgs_out = [{'id': r[0],'username': r[1],'avatar_seed': r[2],'message': r[3],
                             'is_bot': r[4],'msg_type': r[5],'created_at': str(r[6])} for r in rows]
                return {'statusCode': 200, 'headers': CORS, 'body': _cj.dumps({'messages': msgs_out})}

            # POST chat-send — отправить сообщение (только авторизованные)
            if action_val == 'chat-send' or http_method == 'POST':
                body = _cj.loads(event.get('body') or '{}')
                text = (body.get('message') or '').strip()[:500]
                if not text:
                    return {'statusCode': 400, 'headers': CORS, 'body': _cj.dumps({'error': 'Пустое сообщение'})}
                name = user.get('name') or user.get('email', '').split('@')[0]
                with conn.cursor() as cur:
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.chat_messages (user_id,username,avatar_seed,message,is_bot,msg_type) "
                        "VALUES (%s,%s,%s,%s,false,'user') RETURNING id,created_at",
                        (user['id'], name[:64], str(user['id']), text)
                    )
                    row = cur.fetchone()
                    conn.commit()
                return {'statusCode': 200, 'headers': CORS, 'body': _cj.dumps({
                    'ok': True, 'id': row[0], 'created_at': str(row[1])
                })}

        # ── SUPPORT ROUTES ────────────────────────────────────────
        if action_val.startswith('support-') or '/support' in path:
            import json as _sj
            import hashlib as _sh

            SUPPORT_ANSWERS = {
                'вывод': 'Вывод средств обрабатывается в течение 1–24 часов в рабочие дни. Если прошло больше — напишите в тикет-систему на poehali.dev/help',
                'депозит': 'Пополнение подтверждается автоматически после 1 подтверждения в сети. Обычно занимает 10–30 минут.',
                'буст': 'Буст увеличивает вашу недельную ставку дивидендов. От 5 000 ₽ — +5%, от 100 000 ₽ — +10%. Эффект суммируется!',
                'реферал': 'За каждого приглашённого друга вы получаете 5% от его депозита еженедельно. Делитесь реферальной ссылкой из личного кабинета.',
                'колесо': 'Колесо Фортуны доступно от 100 ₽ с баланса. Шанс выигрыша — 20%. Призы: ×2, ×5, ×10 к ставке.',
                'обменник': 'P2P Обменник позволяет обменивать RUB, USDT, BTC, ETH, BNB, USDC напрямую с другими пользователями без посредников.',
                'верификация': 'Верификация аккаунта требует загрузки паспорта и селфи. Срок проверки — до 48 часов.',
                'дивиденды': 'Дивиденды начисляются каждую секунду и отображаются в реальном времени в личном кабинете. Выплата происходит еженедельно.',
                'пароль': 'Для смены пароля перейдите в настройки профиля или обратитесь в поддержку на poehali.dev/help',
                'помощь': 'Я могу помочь по темам: вывод, депозит, дивиденды, буст, реферал, колесо, обменник. Напишите свой вопрос!',
            }
            DEFAULT_ANSWER = 'Понял ваш вопрос! Для детальной помощи обратитесь в нашу тикет-систему: https://poehali.dev/help — операторы ответят в течение часа в рабочее время.'

            session_key = headers.get('X-Session-Id', '') + '_support'

            # GET — история диалога
            if action_val == 'support-history' or http_method == 'GET':
                with conn.cursor() as cur:
                    cur.execute(
                        f"SELECT id,role,message,created_at FROM {SCHEMA}.support_messages "
                        "WHERE session_key=%s ORDER BY created_at ASC LIMIT 50",
                        (session_key,)
                    )
                    rows = cur.fetchall()
                if not rows:
                    # Приветствие
                    welcome = 'Привет! 👋 Я бот поддержки ADFUND. Чем могу помочь? Спросите про: вывод, депозит, дивиденды, буст, реферал, колесо фортуны или обменник.'
                    with conn.cursor() as cur:
                        cur.execute(
                            f"INSERT INTO {SCHEMA}.support_messages (session_key,user_id,role,message) VALUES (%s,%s,'bot',%s)",
                            (session_key, user['id'], welcome)
                        )
                        conn.commit()
                    rows = [(1, 'bot', welcome, 'now')]
                msgs_out = [{'id': r[0],'role': r[1],'message': r[2],'created_at': str(r[3])} for r in rows]
                return {'statusCode': 200, 'headers': CORS, 'body': _sj.dumps({'messages': msgs_out})}

            # POST — отправить сообщение и получить ответ бота
            if action_val == 'support-send' or http_method == 'POST':
                body = _sj.loads(event.get('body') or '{}')
                text = (body.get('message') or '').strip()[:500]
                if not text:
                    return {'statusCode': 400, 'headers': CORS, 'body': _sj.dumps({'error': 'Пустое сообщение'})}
                with conn.cursor() as cur:
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.support_messages (session_key,user_id,role,message) VALUES (%s,%s,'user',%s) RETURNING id,created_at",
                        (session_key, user['id'], text)
                    )
                    user_row = cur.fetchone()
                    # Подбираем ответ
                    tl = text.lower()
                    answer = DEFAULT_ANSWER
                    for kw, ans in SUPPORT_ANSWERS.items():
                        if kw in tl:
                            answer = ans
                            break
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.support_messages (session_key,user_id,role,message) VALUES (%s,%s,'bot',%s) RETURNING id,created_at",
                        (session_key, user['id'], answer)
                    )
                    bot_row = cur.fetchone()
                    conn.commit()
                return {'statusCode': 200, 'headers': CORS, 'body': _sj.dumps({
                    'ok': True,
                    'user_msg': {'id': user_row[0], 'role': 'user', 'message': text, 'created_at': str(user_row[1])},
                    'bot_msg':  {'id': bot_row[0],  'role': 'bot',  'message': answer, 'created_at': str(bot_row[1])},
                })}

        # ── PROFILE ROUTE ─────────────────────────────────────────
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE user_id = %s AND status = 'confirmed'",
                (user['id'],)
            )
            deposit = float(cur.fetchone()[0])

            cur.execute("SELECT COALESCE(SUM(amount), 0) FROM dividends WHERE user_id = %s", (user['id'],))
            dividends_total = float(cur.fetchone()[0])

            cur.execute("SELECT COALESCE(SUM(amount), 0) FROM referral_payouts WHERE referrer_id = %s", (user['id'],))
            referral_total = float(cur.fetchone()[0])

            cur.execute("SELECT COUNT(*) FROM users WHERE referred_by = %s", (user['id'],))
            referral_count = int(cur.fetchone()[0])

            cur.execute(
                "SELECT COALESCE(SUM(amount),0) FROM withdrawals WHERE user_id=%s AND status IN ('pending','completed')",
                (user['id'],)
            )
            withdrawn = float(cur.fetchone()[0])

            cur.execute("SELECT boost_percent FROM users WHERE id=%s", (user['id'],))
            bp_row = cur.fetchone()
            boost_percent = float(bp_row[0]) if bp_row else 0.0

        base_rate = 15 if deposit > 100000 else 10
        rate = base_rate + boost_percent
        balance = dividends_total + referral_total - withdrawn

        user.update({
            'deposit': deposit, 'dividends_total': dividends_total,
            'referral_total': referral_total, 'referral_count': referral_count,
            'balance': balance, 'rate': rate, 'boost_percent': boost_percent
        })
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(user)}
    finally:
        conn.close()