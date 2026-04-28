import sqlite3

from tests.test_support import IsolatedDatabaseTestCase

from data_m.utils.database import Database


class DatabaseSchemaTests(IsolatedDatabaseTestCase):
    def test_legacy_tables_receive_expected_columns_on_boot(self):
        connection = sqlite3.connect(self.db_path)
        try:
            connection.execute(
                """
                CREATE TABLE projects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE profiles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    system_prompt TEXT DEFAULT '',
                    temperature REAL DEFAULT 0.7,
                    top_p REAL DEFAULT 1.0,
                    max_tokens INTEGER DEFAULT 2048,
                    is_default INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.commit()
        finally:
            connection.close()

        database = Database()

        _, project_columns = database.execute("PRAGMA table_info(projects)", fetchall=True)
        _, profile_columns = database.execute("PRAGMA table_info(profiles)", fetchall=True)

        project_column_names = {column[1] for column in project_columns}
        profile_column_names = {column[1] for column in profile_columns}

        self.assertIn("system_prompt", project_column_names)
        self.assertIn("personality", profile_column_names)
        self.assertIn("tags", profile_column_names)
