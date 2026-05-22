"""
Авторизация, выход, восстановление пароля.
POST / — вход по email/паролю
POST /logout — выход
POST /reset-request — запрос ссылки для сброса пароля
POST /reset-confirm — установить новый пароль по токену
"""
import json
import os
import hashlib
import secrets
import smtplib
import psycopg2
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def send_email(to: str, subject: str, html: str):
    smtp_host = os.environ['SMTP_HOST']
    smtp_user = os.environ['SMTP_USER']
    smtp_pass = os.environ['SMTP_PASSWORD']

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = smtp_user
    msg['To'] = to
    msg.attach(MIMEText(html, 'html', 'utf-8'))

    with smtplib.SMTP_SSL(smtp_host, 465) as server:
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, to, msg.as_string())


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    headers = event.get('headers') or {}
    path = event.get('path', '/')

    # POST /logout
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

    # POST /reset-request — отправить письмо со ссылкой
    if method == 'POST' and path.endswith('/reset-request'):
        email = (body.get('email') or '').strip().lower()
        if not email:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите email'})}

        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id, name FROM users WHERE email = %s", (email,))
                row = cur.fetchone()
                if not row:
                    # Не раскрываем существование аккаунта
                    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

                user_id, name = row
                token = secrets.token_hex(32)
                cur.execute(
                    "INSERT INTO password_reset_tokens (user_id, token) VALUES (%s, %s)",
                    (user_id, token)
                )
                conn.commit()

            # Определяем базовый URL сайта из заголовков
            origin = headers.get('Origin') or headers.get('Referer', '').rstrip('/')
            if not origin:
                origin = 'https://' + (headers.get('Host') or 'localhost')
            reset_url = f"{origin}/reset-password?token={token}"

            html = f"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#111;color:#fff;border-radius:16px;">
              <h2 style="color:#FF4D00;margin-bottom:8px;">Сброс пароля</h2>
              <p style="color:#aaa;">Привет, {name}! Мы получили запрос на сброс пароля.</p>
              <a href="{reset_url}" style="display:inline-block;margin:24px 0;padding:14px 32px;background:#FF4D00;color:#fff;text-decoration:none;border-radius:10px;font-weight:bold;">
                Установить новый пароль
              </a>
              <p style="color:#666;font-size:13px;">Ссылка действует 1 час. Если вы не запрашивали сброс — просто проигнорируйте письмо.</p>
            </div>
            """
            send_email(email, 'Сброс пароля', html)

        finally:
            conn.close()

        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    # POST /reset-confirm — установить новый пароль
    if method == 'POST' and path.endswith('/reset-confirm'):
        token = (body.get('token') or '').strip()
        new_password = body.get('password') or ''

        if not token or len(new_password) < 6:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неверные данные'})}

        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, user_id FROM password_reset_tokens WHERE token = %s AND expires_at > NOW() AND used_at IS NULL",
                    (token,)
                )
                row = cur.fetchone()
                if not row:
                    return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Ссылка недействительна или истекла'})}

                token_id, user_id = row
                cur.execute(
                    "UPDATE users SET password_hash = %s WHERE id = %s",
                    (hash_password(new_password), user_id)
                )
                cur.execute(
                    "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = %s",
                    (token_id,)
                )
                # Инвалидируем все сессии
                cur.execute("UPDATE sessions SET expires_at = NOW() WHERE user_id = %s", (user_id,))
                conn.commit()

        finally:
            conn.close()

        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    # POST / — вход
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
