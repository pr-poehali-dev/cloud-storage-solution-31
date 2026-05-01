"""
Создание платежа через ЮKassa (карта или СБП).
"""
import json
import os
import uuid
import psycopg2
import urllib.request
import base64

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}

SHOP_ID = os.environ['YOOKASSA_SHOP_ID']
SECRET_KEY = os.environ['YOOKASSA_SECRET_KEY']
YOOKASSA_API = 'https://api.yookassa.ru/v3/payments'


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


def create_yookassa_payment(amount: float, method: str, description: str, return_url: str, idempotency_key: str, email: str):
    payment_method_data = {'type': 'sbp'} if method == 'sbp' else {'type': 'bank_card'}

    payload = {
        'amount': {'value': f'{amount:.2f}', 'currency': 'RUB'},
        'payment_method_data': payment_method_data,
        'confirmation': {'type': 'redirect', 'return_url': return_url},
        'capture': True,
        'description': description,
        'receipt': {
            'customer': {'email': email},
            'items': [{
                'description': description,
                'quantity': '1',
                'amount': {'value': f'{amount:.2f}', 'currency': 'RUB'},
                'vat_code': 1,
                'payment_mode': 'full_payment',
                'payment_subject': 'service'
            }]
        }
    }

    credentials = base64.b64encode(f'{SHOP_ID}:{SECRET_KEY}'.encode()).decode()
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        YOOKASSA_API,
        data=data,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Basic {credentials}',
            'Idempotence-Key': idempotency_key,
        },
        method='POST'
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    headers = event.get('headers') or {}
    session_id = headers.get('X-Session-Id', '')

    conn = get_conn()
    try:
        user = get_session_user(conn, session_id)
        if not user:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

        body = json.loads(event.get('body') or '{}')
        amount = float(body.get('amount', 0))
        method = body.get('method', 'card')

        if amount < 100:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Минимальная сумма пополнения 100 ₽'})}
        if method not in ('card', 'sbp'):
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неверный способ оплаты'})}

        idempotency_key = str(uuid.uuid4())
        return_url = body.get('return_url', 'https://poehali.dev/dashboard')
        description = f'Пополнение депозита на {amount:.0f} ₽'

        yk_resp = create_yookassa_payment(amount, method, description, return_url, idempotency_key, user['email'])

        payment_id = yk_resp['id']
        confirm_url = yk_resp['confirmation']['confirmation_url']

        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO deposits (user_id, amount, method, status, external_id) VALUES (%s, %s, %s, 'pending', %s)",
                (user['id'], amount, method, payment_id)
            )
            conn.commit()

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({'payment_id': payment_id, 'confirmation_url': confirm_url})
        }
    finally:
        conn.close()
