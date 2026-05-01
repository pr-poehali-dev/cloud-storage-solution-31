"""
Вебхук от ЮKassa: подтверждение платежа и зачисление депозита.
"""
import json
import os
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    event_type = body.get('event', '')
    obj = body.get('object', {})

    if event_type != 'payment.succeeded':
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    payment_id = obj.get('id')
    amount = float(obj.get('amount', {}).get('value', 0))

    if not payment_id or amount <= 0:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Bad payload'})}

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, user_id, amount, status FROM deposits WHERE external_id = %s",
                (payment_id,)
            )
            row = cur.fetchone()
            if not row:
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

            deposit_id, user_id, deposit_amount, status = row

            if status == 'confirmed':
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

            cur.execute(
                "UPDATE deposits SET status = 'confirmed', confirmed_at = NOW() WHERE id = %s",
                (deposit_id,)
            )

            cur.execute(
                "INSERT INTO dividends (user_id, amount, type, description) VALUES (%s, %s, 'deposit', %s)",
                (user_id, 0, f'Депозит {float(deposit_amount):.2f} ₽ подтверждён')
            )

            conn.commit()

        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}
    finally:
        conn.close()
