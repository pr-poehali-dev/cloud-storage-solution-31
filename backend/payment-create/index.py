"""
Создание платежа (пополнение) и запрос на вывод средств через ЮKassa.
POST / — создать платёж на пополнение депозита
POST /withdraw — создать запрос на вывод
GET /withdrawals — история выводов пользователя
"""
import json
import os
import uuid
import psycopg2
import urllib.request
import urllib.error
import base64

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}

YOOKASSA_API = 'https://api.yookassa.ru/v3'
MIN_WITHDRAW = 1000


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_session_user(conn, session_id: str):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT u.id, u.name, u.email FROM sessions s JOIN users u ON u.id = s.user_id "
            "WHERE s.id = %s AND s.expires_at > NOW()",
            (session_id,)
        )
        row = cur.fetchone()
        if not row:
            return None
        return {'id': row[0], 'name': row[1], 'email': row[2]}


def yk_request(method: str, path: str, payload: dict = None) -> dict:
    shop_id = os.environ['YOOKASSA_SHOP_ID']
    secret_key = os.environ['YOOKASSA_SECRET_KEY']
    credentials = base64.b64encode(f'{shop_id}:{secret_key}'.encode()).decode()
    data = json.dumps(payload).encode('utf-8') if payload else None
    req = urllib.request.Request(
        f'{YOOKASSA_API}{path}',
        data=data,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Basic {credentials}',
            'Idempotence-Key': str(uuid.uuid4()),
        },
        method=method
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def get_user_balance(conn, user_id: int) -> float:
    with conn.cursor() as cur:
        cur.execute("SELECT COALESCE(SUM(amount),0) FROM dividends WHERE user_id = %s", (user_id,))
        div = float(cur.fetchone()[0])
        cur.execute("SELECT COALESCE(SUM(amount),0) FROM referral_payouts WHERE referrer_id = %s", (user_id,))
        ref = float(cur.fetchone()[0])
        cur.execute("SELECT COALESCE(SUM(amount),0) FROM withdrawals WHERE user_id = %s AND status IN ('pending','completed')", (user_id,))
        withdrawn = float(cur.fetchone()[0])
    return div + ref - withdrawn


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    path = event.get('path', '/')
    method = event.get('httpMethod', 'GET')
    headers = event.get('headers') or {}
    session_id = headers.get('X-Session-Id', '')

    conn = get_conn()
    try:
        user = get_session_user(conn, session_id)
        if not user:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

        # GET /withdrawals — история выводов
        if method == 'GET' and path.endswith('/withdrawals'):
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, amount, method, details, status, created_at, processed_at "
                    "FROM withdrawals WHERE user_id = %s ORDER BY created_at DESC LIMIT 50",
                    (user['id'],)
                )
                rows = cur.fetchall()
            items = [
                {'id': r[0], 'amount': float(r[1]), 'method': r[2],
                 'details': r[3], 'status': r[4],
                 'created_at': str(r[5]), 'processed_at': str(r[6]) if r[6] else None}
                for r in rows
            ]
            balance = get_user_balance(conn, user['id'])
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'items': items, 'balance': balance})}

        # POST /withdraw — запрос на вывод
        if method == 'POST' and path.endswith('/withdraw'):
            body = json.loads(event.get('body') or '{}')
            amount = float(body.get('amount', 0))
            w_method = body.get('method', 'bank_card')  # bank_card | sbp | crypto
            details = body.get('details', {})  # phone для sbp, card_number для card, address для crypto

            if amount < MIN_WITHDRAW:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': f'Минимальная сумма вывода {MIN_WITHDRAW} ₽'})}
            if w_method not in ('bank_card', 'sbp', 'crypto'):
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неверный способ вывода'})}

            balance = get_user_balance(conn, user['id'])
            if balance < amount:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': f'Недостаточно средств. Доступно: {balance:.2f} ₽'})}

            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO withdrawals (user_id, amount, method, details, status) VALUES (%s, %s, %s, %s, 'pending') RETURNING id",
                    (user['id'], amount, w_method, json.dumps(details))
                )
                withdrawal_id = cur.fetchone()[0]
                conn.commit()

            # Автовывод для карты и СБП через ЮKassa Payouts
            if w_method in ('bank_card', 'sbp'):
                try:
                    payout_method = {}
                    if w_method == 'sbp':
                        payout_method = {'type': 'sbp', 'phone': details.get('phone', '')}
                    else:
                        payout_method = {'type': 'bank_card', 'card': {'number': details.get('card_number', '')}}

                    payout = yk_request('POST', '/payouts', {
                        'amount': {'value': f'{amount:.2f}', 'currency': 'RUB'},
                        'payout_destination_data': payout_method,
                        'description': f'Вывод дивидендов — {user["name"]}',
                        'metadata': {'withdrawal_id': str(withdrawal_id)},
                    })

                    payout_id = payout.get('id')
                    payout_status = payout.get('status', 'pending')
                    new_status = 'completed' if payout_status == 'succeeded' else 'pending'

                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE withdrawals SET external_id = %s, status = %s, processed_at = CASE WHEN %s = 'completed' THEN NOW() ELSE NULL END WHERE id = %s",
                            (payout_id, new_status, new_status, withdrawal_id)
                        )
                        conn.commit()

                    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'withdrawal_id': withdrawal_id, 'status': new_status})}

                except urllib.error.HTTPError as e:
                    err_body = e.read().decode()
                    with conn.cursor() as cur:
                        cur.execute("UPDATE withdrawals SET status = 'failed' WHERE id = %s", (withdrawal_id,))
                        conn.commit()
                    return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': f'Ошибка выплаты ЮKassa: {err_body}'})}

            # Крипто — ручная обработка (статус pending)
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                'ok': True, 'withdrawal_id': withdrawal_id, 'status': 'pending',
                'message': 'Запрос принят. Выплата на крипто-кошелёк будет обработана в течение 24 часов.'
            })}

        # POST / — создать платёж на пополнение
        body = json.loads(event.get('body') or '{}')
        amount = float(body.get('amount', 0))
        pay_method = body.get('method', 'card')

        if amount < 100:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Минимальная сумма пополнения 100 ₽'})}
        if pay_method not in ('card', 'sbp'):
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неверный способ оплаты'})}

        return_url = body.get('return_url', 'https://poehali.dev/dashboard')
        description = f'Пополнение депозита на {amount:.0f} ₽'
        payment_method_data = {'type': 'sbp'} if pay_method == 'sbp' else {'type': 'bank_card'}

        yk_resp = yk_request('POST', '/payments', {
            'amount': {'value': f'{amount:.2f}', 'currency': 'RUB'},
            'payment_method_data': payment_method_data,
            'confirmation': {'type': 'redirect', 'return_url': return_url},
            'capture': True,
            'description': description,
            'receipt': {
                'customer': {'email': user['email']},
                'items': [{
                    'description': description,
                    'quantity': '1',
                    'amount': {'value': f'{amount:.2f}', 'currency': 'RUB'},
                    'vat_code': 1,
                    'payment_mode': 'full_payment',
                    'payment_subject': 'service'
                }]
            }
        })

        payment_id = yk_resp['id']
        confirm_url = yk_resp['confirmation']['confirmation_url']

        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO deposits (user_id, amount, method, status, external_id) VALUES (%s, %s, %s, 'pending', %s)",
                (user['id'], amount, pay_method, payment_id)
            )
            conn.commit()

        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'payment_id': payment_id, 'confirmation_url': confirm_url})}

    finally:
        conn.close()
