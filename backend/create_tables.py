#!/usr/bin/env python3
"""
Script to create database tables in remote PostgreSQL test environment
"""

import os
from sqlalchemy import create_engine, text
from app.database import Base

# Set the correct database URL
os.environ['DATABASE_URL'] = 'postgresql://test:test@116.62.176.216:6001/meblog_test'

# Import after setting environment variable
from app.database import engine

def create_tables():
    """Create all tables in the database"""
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")
    
    # Verify tables were created
    with engine.connect() as conn:
        result = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"))
        tables = [row[0] for row in result]
        print(f"Created tables: {tables}")

if __name__ == "__main__":
    create_tables()