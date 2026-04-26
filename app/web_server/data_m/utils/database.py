# database.py
from .db_connector import DBConnector

class Database:
    def __init__(self):
        self.connector = DBConnector()
        self._init_db()

    def execute(
        self,
        query,
        params=(),
        *,
        fetchone=False,
        fetchall=False,
        lastrowid=False,
    ):
        conn = self.connector.connect()
        cursor = conn.cursor()

        try:
            cursor.execute(query, params)
            conn.commit()

            op = query.strip().split()[0].upper()

            if fetchone:
                data = cursor.fetchone()
            elif fetchall:
                data = cursor.fetchall()
            elif lastrowid:
                data = cursor.lastrowid
            else:
                data = None

            return op, data

        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            self.connector.close(conn)

    # Inicialización de tablas
    def _init_db(self):
        tables = [
            # users
            """
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1,
                last_login TEXT
            )
            """,

            # sessions
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                expires_at TEXT
            )
            """,
            
            # data_logs
            """
            CREATE TABLE IF NOT EXISTS data_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                source TEXT,
                level TEXT,
                message TEXT,
                payload TEXT
            )
            """,

            # agent_logs
            """
            CREATE TABLE IF NOT EXISTS agent_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                details TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """,

            # projects
            """
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """,

            # profiles
            """
            CREATE TABLE IF NOT EXISTS profiles (
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
            """,

            # conversations
            """
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL DEFAULT 'New Chat',
                project_id INTEGER,
                profile_id INTEGER,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
                FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL
            )
            """,

            # messages
            """
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                position INTEGER NOT NULL,
                provider_message_id TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            )
            """,

            # settings
            """
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """,

            # models_cache
            """
            CREATE TABLE IF NOT EXISTS models_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider TEXT NOT NULL,
                model_id TEXT NOT NULL,
                display_name TEXT,
                source TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(provider, model_id)
            )
            """
        ]

        for t in tables:
            self.execute(t)
