"""
Регистрация нового пользователя.
"""
import json
import os
import hashlib
import secrets
import string
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


def generate_referral_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(8))


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    name = (body.get('name') or '').strip()
    email = (body.get('email') or '').strip().lower()
    password = body.get('password') or ''
    ref_code = (body.get('referral_code') or '').strip().upper()

    if not name or not email or not password:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Заполните все поля'})}
    if len(password) < 6:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Пароль минимум 6 символов'})}

    conn = get_conn()
    try:
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

            sid = secrets.token_hex(32)
            cur.execute("INSERT INTO sessions (id, user_id) VALUES (%s, %s)", (sid, user_id))
            conn.commit()

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({'session_id': sid, 'user_id': user_id, 'referral_code': my_code})
        }
    finally:
        conn.close()
