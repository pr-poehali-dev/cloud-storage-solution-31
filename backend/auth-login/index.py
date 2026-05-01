"""
Авторизация пользователя по email и паролю.
"""
import json
import os
import hashlib
import secrets
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')

    # POST /logout
    headers = event.get('headers') or {}
    path = event.get('path', '/')
    if method == 'POST' and path.endswith('/logout'):
        session_id = headers.get('X-Session-Id', '')
        if session_id:
            conn = get_conn()
            try:
                with conn.cursor() as cur:
                    cur.execute("UPDATE sessions SET expires_at = NOW() WHERE id = %s", (session_id,))
                    conn.commit()
            finally:
                conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    body = json.loads(event.get('body') or '{}')
    email = (body.get('email') or '').strip().lower()
    password = body.get('password') or ''

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, referral_code, is_admin FROM users WHERE email = %s AND password_hash = %s",
                (email, hash_password(password))
            )
            row = cur.fetchone()
            if not row:
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Неверный email или пароль'})}

            user_id, name, ref_code, is_admin = row
            sid = secrets.token_hex(32)
            cur.execute("INSERT INTO sessions (id, user_id) VALUES (%s, %s)", (sid, user_id))
            conn.commit()

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({'session_id': sid, 'user_id': user_id, 'name': name, 'referral_code': ref_code, 'is_admin': is_admin})
        }
    finally:
        conn.close()
