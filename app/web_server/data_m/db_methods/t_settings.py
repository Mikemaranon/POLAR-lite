class SettingsTable:
    def __init__(self, db):
        self.db = db

    def set(self, key, value):
        self.db.execute(
            """
            INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP
            """,
            (key, value)
        )

    def get(self, key, default=None):
        _, row = self.db.execute(
            """
            SELECT key, value, updated_at
            FROM settings
            WHERE key = ?
            """,
            (key,),
            fetchone=True
        )
        if not row:
            return default

        return {
            "key": row[0],
            "value": row[1],
            "updated_at": row[2],
        }

    def all(self):
        _, rows = self.db.execute(
            """
            SELECT key, value, updated_at
            FROM settings
            ORDER BY key ASC
            """,
            fetchall=True
        )
        return [
            {
                "key": row[0],
                "value": row[1],
                "updated_at": row[2],
            }
            for row in rows
        ]

    def delete(self, key):
        self.db.execute(
            "DELETE FROM settings WHERE key = ?",
            (key,)
        )
