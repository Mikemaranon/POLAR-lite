class ModelsCacheTable:
    def __init__(self, db):
        self.db = db

    def upsert(self, provider, model_id, display_name=None, source=None):
        self.db.execute(
            """
            INSERT INTO models_cache (
                provider, model_id, display_name, source, updated_at
            )
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(provider, model_id) DO UPDATE SET
                display_name = excluded.display_name,
                source = excluded.source,
                updated_at = CURRENT_TIMESTAMP
            """,
            (provider, model_id, display_name, source)
        )

    def list_models(self, provider=None):
        query = """
            SELECT id, provider, model_id, display_name, source, updated_at
            FROM models_cache
        """
        params = ()

        if provider:
            query += " WHERE provider = ?"
            params = (provider,)

        query += " ORDER BY provider ASC, model_id ASC"
        _, rows = self.db.execute(query, params, fetchall=True)
        return [
            {
                "id": row[0],
                "provider": row[1],
                "model_id": row[2],
                "display_name": row[3],
                "source": row[4],
                "updated_at": row[5],
            }
            for row in rows
        ]

    def clear_provider(self, provider):
        self.db.execute(
            "DELETE FROM models_cache WHERE provider = ?",
            (provider,)
        )
