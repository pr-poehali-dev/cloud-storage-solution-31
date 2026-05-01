"""
Профиль пользователя: баланс, депозит, дивиденды, рефералы.
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


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    headers = event.get('headers') or {}
    session_id = headers.get('X-Session-Id', '')

    if not session_id:
        return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT u.id, u.name, u.email, u.referral_code, u.referred_by, u.is_admin, u.created_at "
                "FROM sessions s JOIN users u ON u.id = s.user_id "
                "WHERE s.id = %s AND s.expires_at > NOW()",
                (session_id,)
            )
            row = cur.fetchone()
            if not row:
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Сессия истекла'})}

            user = {
                'id': row[0], 'name': row[1], 'email': row[2],
                'referral_code': row[3], 'referred_by': row[4],
                'is_admin': row[5], 'created_at': str(row[6])
            }

            cur.execute(
                "SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE user_id = %s AND status = 'confirmed'",
                (user['id'],)
            )
            deposit = float(cur.fetchone()[0])

            cur.execute(
                "SELECT COALESCE(SUM(amount), 0) FROM dividends WHERE user_id = %s",
                (user['id'],)
            )
            dividends_total = float(cur.fetchone()[0])

            cur.execute(
                "SELECT COALESCE(SUM(amount), 0) FROM referral_payouts WHERE referrer_id = %s",
                (user['id'],)
            )
            referral_total = float(cur.fetchone()[0])

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
    finally:
        conn.close()
