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
from decimal import Decimal, InvalidOperation
import psycopg2
from psycopg2.extras import RealDictCursor

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
    }
    if action in ACTION_MAP:
        sub = ACTION_MAP[action]
        if action == 'exchange-create':
            http_method = 'POST'
    elif '/exchange' in path:
        sub = path[len('/exchange'):] or '/'
    else:
        sub = '/'

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
        if '/exchange' in path or 'action' in qs_check:
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
        if '/boost' in path:
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
        if '/wheel' in path:
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