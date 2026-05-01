"""
Вебхук ЮKassa + крон начисления дивидендов и реферальных выплат.
POST / — вебхук от ЮKassa (payment.succeeded)
GET /cron — ручной или автоматический запуск начисления дивидендов
"""
import json
import os
import psycopg2
from datetime import date, timedelta

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Cron-Secret',
}

RATE_STANDARD = 10   # % в неделю до 100 000 ₽
RATE_PREMIUM = 15    # % в неделю свыше 100 000 ₽
REFERRAL_RATE = 5    # % от дивидендов реферала в неделю


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def accrue_dividends(conn):
    """Начисляем дивиденды всем пользователям с активным депозитом."""
    week_start = date.today() - timedelta(days=date.today().weekday())
    total_users = 0
    total_amount = 0.0

    with conn.cursor() as cur:
        # Все пользователи с подтверждённым депозитом
        cur.execute("""
            SELECT u.id, u.referred_by, SUM(d.amount) as deposit
            FROM users u
            JOIN deposits d ON d.user_id = u.id AND d.status = 'confirmed'
            GROUP BY u.id, u.referred_by
        """)
        users = cur.fetchall()

        for user_id, referred_by, deposit in users:
            deposit = float(deposit)
            rate = RATE_PREMIUM if deposit > 100000 else RATE_STANDARD
            dividend = deposit * rate / 100

            # Проверяем, не начислено ли уже за эту неделю
            cur.execute(
                "SELECT id FROM dividends WHERE user_id = %s AND type = 'weekly' AND DATE_TRUNC('week', created_at) = %s",
                (user_id, week_start)
            )
            if cur.fetchone():
                continue

            # Начисляем дивиденды
            cur.execute(
                "INSERT INTO dividends (user_id, amount, type, description) VALUES (%s, %s, 'weekly', %s)",
                (user_id, dividend, f'Дивиденды {rate}% от депозита {deposit:.2f} ₽')
            )
            total_users += 1
            total_amount += dividend

            # Реферальная выплата рефереру
            if referred_by:
                ref_amount = dividend * REFERRAL_RATE / 100
                cur.execute(
                    "SELECT id FROM referral_payouts WHERE referrer_id = %s AND referred_id = %s AND week_start = %s",
                    (referred_by, user_id, week_start)
                )
                if not cur.fetchone():
                    cur.execute(
                        "INSERT INTO referral_payouts (referrer_id, referred_id, amount, week_start) VALUES (%s, %s, %s, %s)",
                        (referred_by, user_id, ref_amount, week_start)
                    )

        conn.commit()

    return {'users_processed': total_users, 'total_accrued': round(total_amount, 4)}


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')

    # GET / или /cron — начисление дивидендов
    if method == 'GET':
        headers = event.get('headers') or {}
        cron_secret = headers.get('X-Cron-Secret', '')
        expected = os.environ.get('CRON_SECRET', '')
        if expected and cron_secret != expected:
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Forbidden'})}

        conn = get_conn()
        try:
            result = accrue_dividends(conn)
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, **result})}
        finally:
            conn.close()

    # POST / — вебхук ЮKassa
    body = json.loads(event.get('body') or '{}')
    event_type = body.get('event', '')
    obj = body.get('object', {})

    if event_type not in ('payment.succeeded', 'payout.succeeded', 'payout.canceled'):
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    conn = get_conn()
    try:
        with conn.cursor() as cur:

            # Успешный платёж (пополнение)
            if event_type == 'payment.succeeded':
                payment_id = obj.get('id')
                if not payment_id:
                    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

                cur.execute(
                    "SELECT id, user_id, amount, status FROM deposits WHERE external_id = %s",
                    (payment_id,)
                )
                row = cur.fetchone()
                if not row or row[3] == 'confirmed':
                    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

                deposit_id, user_id, deposit_amount = row[0], row[1], float(row[2])
                cur.execute(
                    "UPDATE deposits SET status = 'confirmed', confirmed_at = NOW() WHERE id = %s",
                    (deposit_id,)
                )
                cur.execute(
                    "INSERT INTO dividends (user_id, amount, type, description) VALUES (%s, 0, 'deposit', %s)",
                    (user_id, f'Депозит {deposit_amount:.2f} ₽ подтверждён')
                )
                conn.commit()

            # Успешная выплата
            elif event_type == 'payout.succeeded':
                payout_id = obj.get('id')
                if payout_id:
                    cur.execute(
                        "UPDATE withdrawals SET status = 'completed', processed_at = NOW() WHERE external_id = %s",
                        (payout_id,)
                    )
                    conn.commit()

            # Отменённая выплата
            elif event_type == 'payout.canceled':
                payout_id = obj.get('id')
                if payout_id:
                    cur.execute(
                        "UPDATE withdrawals SET status = 'failed', processed_at = NOW() WHERE external_id = %s",
                        (payout_id,)
                    )
                    conn.commit()

        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}
    finally:
        conn.close()