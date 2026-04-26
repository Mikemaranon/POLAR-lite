# db_connector.py
import sqlite3
from pathlib import Path

DB_FILENAME = "flask.db"

class DBConnector:
    def __init__(self):
        self.db_path = Path(__file__).parent / DB_FILENAME

    def connect(self):
        # Establish and return a new database connection
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def close(self, conn):
        if conn:
            conn.close()
