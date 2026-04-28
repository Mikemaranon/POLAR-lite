# database.py
from .db_connector import DBConnector
from .schema import DatabaseSchemaInitializer

class Database:
    def __init__(self):
        self.connector = DBConnector()
        self.schema_initializer = DatabaseSchemaInitializer()
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

    def _init_db(self):
        self.schema_initializer.initialize(self)
