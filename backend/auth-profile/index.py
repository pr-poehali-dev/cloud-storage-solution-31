"""
Профиль пользователя + Admin API.
GET / — профиль текущего пользователя
GET /admin/users — список всех пользователей (только админ)
GET /admin/deposits — все депозиты (только админ)
GET /admin/withdrawals — все заявки на вывод (только админ)
POST /admin/withdrawals/approve — подтвердить вывод вручную (только админ)
POST /admin/withdrawals/reject — отклонить вывод (только админ)
POST /admin/deposits/confirm — подтвердить депозит вручную (только админ)
POST /admin/users/toggle-admin — выдать/снять права админа
"""
import json
import os
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


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
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    http_method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    headers = event.get('headers') or {}
    session_id = headers.get('X-Session-Id', '')

    if not session_id:
        return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

    conn = get_conn()
    try:
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

        rate = 15 if deposit > 100000 else 10
        balance = dividends_total + referral_total - withdrawn

        user.update({
            'deposit': deposit, 'dividends_total': dividends_total,
            'referral_total': referral_total, 'referral_count': referral_count,
            'balance': balance, 'rate': rate
        })
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(user)}
    finally:
        conn.close()
