#!/usr/bin/env python3
import psycopg2
import os

# 确保使用正确的凭据和正确的数据库名称
DB_CONFIG = {
    'host': '116.62.176.216',
    'port': 6001,
    'database': 'meblog_test',  # 注意：是 meblog_test，不是 memblog_test
    'user': 'test',
    'password': 'test'
}

try:
    print("正在连接到 PostgreSQL...")
    conn = psycopg2.connect(**DB_CONFIG)
    print('✅ 连接成功！')
    cur = conn.cursor()
    cur.execute('SELECT version(), current_user, current_database();')
    result = cur.fetchone()
    print(f'PostgreSQL 版本: {result[0]}')
    print(f'当前用户: {result[1]}')
    print(f'当前数据库: {result[2]}')
    conn.close()
except Exception as e:
    print(f'❌ 连接失败: {e}')
    import traceback
    traceback.print_exc()