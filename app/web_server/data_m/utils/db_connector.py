# db_connector.py
import os
import sqlite3
from pathlib import Path

DB_FILENAME = "flask.db"
DB_PATH_ENV = "APP_DB_PATH"

class DBConnector:
    def __init__(self):
        configured_path = os.environ.get(DB_PATH_ENV)
        if configured_path:
            self.db_path = Path(configured_path).expanduser().resolve()
        else:
            self.db_path = Path(__file__).parent / DB_FILENAME

        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    def connect(self):
        # Establish and return a new database connection
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def close(self, conn):
        if conn:
            conn.close()
