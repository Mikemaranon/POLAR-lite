class ProvidersTable:
    BUILTIN_DEFAULTS = {
        "mlx": {
            "name": "MLX",
            "provider_type": "mlx",
            "endpoint": "",
            "api_key": "",
        },
        "ollama": {
            "name": "Ollama",
            "provider_type": "ollama",
            "endpoint": "http://localhost:11434/api",
            "api_key": "",
        },
    }

    def __init__(self, db):
        self.db = db

    def create(
        self,
        name,
        provider_type,
        endpoint="",
        api_key="",
        is_builtin=False,
        builtin_key=None,
    ):
        _, provider_id = self.db.execute(
            """
            INSERT INTO providers (
                name, provider_type, endpoint, api_key, is_builtin, builtin_key
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                provider_type,
                endpoint or "",
                api_key or "",
                int(is_builtin),
                builtin_key or "",
            ),
            lastrowid=True,
        )
        return provider_id

    def get(self, provider_id):
        _, row = self.db.execute(
            """
            SELECT id, name, provider_type, endpoint, api_key, is_builtin, builtin_key,
                   created_at, updated_at
            FROM providers
            WHERE id = ?
            """,
            (provider_id,),
            fetchone=True,
        )
        return self._serialize(row)

    def get_by_builtin_key(self, builtin_key):
        _, row = self.db.execute(
            """
            SELECT id, name, provider_type, endpoint, api_key, is_builtin, builtin_key,
                   created_at, updated_at
            FROM providers
            WHERE builtin_key = ?
            ORDER BY id ASC
            LIMIT 1
            """,
            (builtin_key,),
            fetchone=True,
        )
        return self._serialize(row)

    def get_first_by_type(self, provider_type):
        _, row = self.db.execute(
            """
            SELECT id, name, provider_type, endpoint, api_key, is_builtin, builtin_key,
                   created_at, updated_at
            FROM providers
            WHERE provider_type = ?
            ORDER BY is_builtin DESC, updated_at DESC, id DESC
            LIMIT 1
            """,
            (provider_type,),
            fetchone=True,
        )
        return self._serialize(row)

    def all(self):
        _, rows = self.db.execute(
            """
            SELECT id, name, provider_type, endpoint, api_key, is_builtin, builtin_key,
                   created_at, updated_at
            FROM providers
            ORDER BY is_builtin DESC, updated_at DESC, id DESC
            """,
            fetchall=True,
        )
        return [self._serialize(row) for row in rows]

    def update(
        self,
        provider_id,
        name,
        provider_type,
        endpoint="",
        api_key="",
        is_builtin=False,
        builtin_key=None,
    ):
        self.db.execute(
            """
            UPDATE providers
            SET name = ?,
                provider_type = ?,
                endpoint = ?,
                api_key = ?,
                is_builtin = ?,
                builtin_key = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                name,
                provider_type,
                endpoint or "",
                api_key or "",
                int(is_builtin),
                builtin_key or "",
                provider_id,
            ),
        )

    def delete(self, provider_id):
        self.db.execute(
            "DELETE FROM providers WHERE id = ?",
            (provider_id,),
        )

    def models_count(self, provider_id):
        _, row = self.db.execute(
            "SELECT COUNT(*) FROM models WHERE provider_config_id = ?",
            (provider_id,),
            fetchone=True,
        )
        return row[0] if row else 0

    def restore(self, provider_id):
        provider = self.get(provider_id)
        if not provider or not provider.get("is_builtin"):
            return None

        defaults = self.BUILTIN_DEFAULTS.get(provider["builtin_key"])
        if not defaults:
            return None

        self.update(
            provider_id=provider_id,
            name=defaults["name"],
            provider_type=defaults["provider_type"],
            endpoint=defaults["endpoint"],
            api_key=defaults["api_key"],
            is_builtin=True,
            builtin_key=provider["builtin_key"],
        )
        return self.get(provider_id)

    def ensure_seed_providers(self):
        for builtin_key, defaults in self.BUILTIN_DEFAULTS.items():
            existing_provider = self.get_by_builtin_key(builtin_key)
            if existing_provider:
                continue

            self.create(
                name=defaults["name"],
                provider_type=defaults["provider_type"],
                endpoint=defaults["endpoint"],
                api_key=defaults["api_key"],
                is_builtin=True,
                builtin_key=builtin_key,
            )

    def _serialize(self, row):
        if not row:
            return None

        return {
            "id": row[0],
            "name": row[1],
            "provider_type": row[2],
            "endpoint": row[3] or "",
            "api_key": row[4] or "",
            "is_builtin": bool(row[5]),
            "builtin_key": row[6] or "",
            "created_at": row[7],
            "updated_at": row[8],
        }
