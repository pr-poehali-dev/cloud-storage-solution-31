"""
Аутентификация: регистрация, логин, логаут, получение профиля.
"""
import json
import os
import hashlib
import secrets
import string
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def generate_referral_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(8))


def generate_session_id() -> str:
    return secrets.token_hex(32)


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
        return {
            'id': row[0], 'name': row[1], 'email': row[2],
            'referral_code': row[3], 'referred_by': row[4],
            'is_admin': row[5], 'created_at': str(row[6])
        }


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    headers = event.get('headers') or {}
    session_id = headers.get('X-Session-Id', '')

    conn = get_conn()
    try:
        # POST /register
        if method == 'POST' and path.endswith('/register'):
            body = json.loads(event.get('body') or '{}')
            name = (body.get('name') or '').strip()
            email = (body.get('email') or '').strip().lower()
            password = body.get('password') or ''
            ref_code = (body.get('referral_code') or '').strip().upper()

            if not name or not email or not password:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Заполните все поля'})}
            if len(password) < 6:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Пароль минимум 6 символов'})}

            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE email = %s", (email,))
                if cur.fetchone():
                    return {'statusCode': 409, 'headers': CORS, 'body': json.dumps({'error': 'Email уже зарегистрирован'})}

                referred_by = None
                if ref_code:
                    cur.execute("SELECT id FROM users WHERE referral_code = %s", (ref_code,))
                    row = cur.fetchone()
                    if row:
                        referred_by = row[0]

                my_code = generate_referral_code()
                cur.execute(
                    "INSERT INTO users (name, email, password_hash, referral_code, referred_by) "
                    "VALUES (%s, %s, %s, %s, %s) RETURNING id",
                    (name, email, hash_password(password), my_code, referred_by)
                )
                user_id = cur.fetchone()[0]

                sid = generate_session_id()
                cur.execute(
                    "INSERT INTO sessions (id, user_id) VALUES (%s, %s)",
                    (sid, user_id)
                )
                conn.commit()

            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({'session_id': sid, 'user_id': user_id, 'referral_code': my_code})
            }

        # POST /login
        if method == 'POST' and path.endswith('/login'):
            body = json.loads(event.get('body') or '{}')
            email = (body.get('email') or '').strip().lower()
            password = body.get('password') or ''

            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, name, referral_code, is_admin FROM users WHERE email = %s AND password_hash = %s",
                    (email, hash_password(password))
                )
                row = cur.fetchone()
                if not row:
                    return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Неверный email или пароль'})}

                user_id, name, ref_code, is_admin = row
                sid = generate_session_id()
                cur.execute("INSERT INTO sessions (id, user_id) VALUES (%s, %s)", (sid, user_id))
                conn.commit()

            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({'session_id': sid, 'user_id': user_id, 'name': name, 'referral_code': ref_code, 'is_admin': is_admin})
            }

        # POST /logout
        if method == 'POST' and path.endswith('/logout'):
            if session_id:
                with conn.cursor() as cur:
                    cur.execute("UPDATE sessions SET expires_at = NOW() WHERE id = %s", (session_id,))
                    conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        # GET /profile
        if method == 'GET' and path.endswith('/profile'):
            user = get_session_user(conn, session_id)
            if not user:
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

            with conn.cursor() as cur:
                # Активный депозит (confirmed)
                cur.execute(
                    "SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE user_id = %s AND status = 'confirmed'",
                    (user['id'],)
                )
                deposit = float(cur.fetchone()[0])

                # Всего дивидендов
                cur.execute(
                    "SELECT COALESCE(SUM(amount), 0) FROM dividends WHERE user_id = %s",
                    (user['id'],)
                )
                dividends_total = float(cur.fetchone()[0])

                # Реферальные выплаты
                cur.execute(
                    "SELECT COALESCE(SUM(amount), 0) FROM referral_payouts WHERE referrer_id = %s",
                    (user['id'],)
                )
                referral_total = float(cur.fetchone()[0])

                # Количество рефералов
                cur.execute(
                    "SELECT COUNT(*) FROM users WHERE referred_by = %s",
                    (user['id'],)
                )
                referral_count = int(cur.fetchone()[0])

            rate = 15 if deposit > 100000 else 10
            balance = dividends_total + referral_total

            user.update({
                'deposit': deposit,
                'dividends_total': dividends_total,
                'referral_total': referral_total,
                'referral_count': referral_count,
                'balance': balance,
                'rate': rate
            })
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(user)}

        return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Not found'})}

    finally:
        conn.close()
