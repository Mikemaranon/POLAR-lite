import platform


class ModelsTable:
    def __init__(self, db):
        self.db = db

    def create(
        self,
        name,
        provider_config_id,
        is_default=False,
        is_builtin=False,
    ):
        provider = self._require_provider(provider_config_id)
        _, model_id = self.db.execute(
            """
            INSERT INTO models (
                name, provider_config_id, provider, endpoint, api_key, is_default, is_builtin
            )
            VALUES (?, ?, ?, '', '', ?, ?)
            """,
            (
                name,
                provider_config_id,
                provider["provider_type"],
                int(is_default),
                int(is_builtin),
            ),
            lastrowid=True,
        )

        if is_default:
            self.set_default(model_id)

        return model_id

    def get(self, model_id):
        _, row = self.db.execute(
            """
            SELECT m.id, m.name, m.provider_config_id, m.provider, m.is_default, m.is_builtin,
                   m.created_at, m.updated_at,
                   p.name, p.provider_type, p.is_builtin
            FROM models AS m
            LEFT JOIN providers AS p
                ON p.id = m.provider_config_id
            WHERE m.id = ?
            """,
            (model_id,),
            fetchone=True,
        )
        return self._serialize(row)

    def get_default(self):
        _, row = self.db.execute(
            """
            SELECT m.id, m.name, m.provider_config_id, m.provider, m.is_default, m.is_builtin,
                   m.created_at, m.updated_at,
                   p.name, p.provider_type, p.is_builtin
            FROM models AS m
            LEFT JOIN providers AS p
                ON p.id = m.provider_config_id
            WHERE m.is_default = 1
            ORDER BY m.id ASC
            LIMIT 1
            """,
            fetchone=True,
        )
        return self._serialize(row)

    def get_by_provider_and_name(self, provider, name):
        _, row = self.db.execute(
            """
            SELECT m.id, m.name, m.provider_config_id, m.provider, m.is_default, m.is_builtin,
                   m.created_at, m.updated_at,
                   p.name, p.provider_type, p.is_builtin
            FROM models AS m
            LEFT JOIN providers AS p
                ON p.id = m.provider_config_id
            WHERE m.provider = ? AND m.name = ?
            ORDER BY m.id ASC
            LIMIT 1
            """,
            (provider, name),
            fetchone=True,
        )
        return self._serialize(row)

    def get_by_id_and_provider_type(self, model_id, provider_type):
        _, row = self.db.execute(
            """
            SELECT m.id, m.name, m.provider_config_id, m.provider, m.is_default, m.is_builtin,
                   m.created_at, m.updated_at,
                   p.name, p.provider_type, p.is_builtin
            FROM models AS m
            LEFT JOIN providers AS p
                ON p.id = m.provider_config_id
            WHERE m.id = ? AND m.provider = ?
            LIMIT 1
            """,
            (model_id, provider_type),
            fetchone=True,
        )
        return self._serialize(row)

    def all(self):
        _, rows = self.db.execute(
            """
            SELECT m.id, m.name, m.provider_config_id, m.provider, m.is_default, m.is_builtin,
                   m.created_at, m.updated_at,
                   p.name, p.provider_type, p.is_builtin
            FROM models AS m
            LEFT JOIN providers AS p
                ON p.id = m.provider_config_id
            ORDER BY m.is_default DESC, m.is_builtin DESC, m.updated_at DESC, m.id DESC
            """,
            fetchall=True,
        )
        return [self._serialize(row) for row in rows]

    def update(
        self,
        model_id,
        name,
        provider_config_id,
        is_default=False,
        is_builtin=False,
    ):
        provider = self._require_provider(provider_config_id)
        self.db.execute(
            """
            UPDATE models
            SET name = ?,
                provider_config_id = ?,
                provider = ?,
                is_default = ?,
                is_builtin = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                name,
                provider_config_id,
                provider["provider_type"],
                int(is_default),
                int(is_builtin),
                model_id,
            ),
        )

        if is_default:
            self.set_default(model_id)

    def set_default(self, model_id):
        self.db.execute("UPDATE models SET is_default = 0")
        self.db.execute(
            """
            UPDATE models
            SET is_default = 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (model_id,),
        )

    def count(self):
        _, row = self.db.execute(
            "SELECT COUNT(*) FROM models",
            fetchone=True,
        )
        return row[0] if row else 0

    def count_for_provider(self, provider_config_id):
        _, row = self.db.execute(
            "SELECT COUNT(*) FROM models WHERE provider_config_id = ?",
            (provider_config_id,),
            fetchone=True,
        )
        return row[0] if row else 0

    def delete(self, model_id):
        _, row = self.db.execute(
            """
            SELECT m.id, m.name, m.provider
            FROM models AS m
            WHERE m.id != ?
            ORDER BY m.is_default DESC, m.is_builtin DESC, m.updated_at DESC, m.id DESC
            LIMIT 1
            """,
            (model_id,),
            fetchone=True,
        )
        fallback = row if row else None

        if fallback:
            self.db.execute(
                """
                UPDATE conversations
                SET model_config_id = ?,
                    provider = ?,
                    model = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE model_config_id = ?
                """,
                (fallback[0], fallback[2], fallback[1], model_id),
            )

        self.db.execute(
            "DELETE FROM models WHERE id = ?",
            (model_id,),
        )

        if fallback and not self.get_default():
            self.set_default(fallback[0])

    def sync_provider_snapshot(self, provider_config_id):
        provider = self._require_provider(provider_config_id)
        self.db.execute(
            """
            UPDATE models
            SET provider = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE provider_config_id = ?
            """,
            (provider["provider_type"], provider_config_id),
        )
        self.db.execute(
            """
            UPDATE conversations
            SET provider = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE model_config_id IN (
                SELECT id
                FROM models
                WHERE provider_config_id = ?
            )
            """,
            (provider["provider_type"], provider_config_id),
        )

    def ensure_seed_models(self):
        existing_models = self.all()
        if existing_models:
            if not self.get_default():
                self.set_default(existing_models[0]["id"])
            return

        is_apple = platform.system().lower() == "darwin"
        created_ids = []
        mlx_provider = self._get_provider_by_builtin_key("mlx")
        ollama_provider = self._get_provider_by_builtin_key("ollama")

        if is_apple and mlx_provider:
            created_ids.append(
                self.create(
                    name="gemma-3-4b-it-4bit",
                    provider_config_id=mlx_provider["id"],
                    is_default=True,
                    is_builtin=True,
                )
            )

        if ollama_provider:
            created_ids.append(
                self.create(
                    name="llama3.2",
                    provider_config_id=ollama_provider["id"],
                    is_default=not is_apple,
                    is_builtin=True,
                )
            )

        if not self.get_default() and created_ids:
            self.set_default(created_ids[0])

    def _require_provider(self, provider_config_id):
        _, row = self.db.execute(
            """
            SELECT id, name, provider_type, endpoint, api_key, is_builtin, builtin_key,
                   created_at, updated_at
            FROM providers
            WHERE id = ?
            """,
            (provider_config_id,),
            fetchone=True,
        )
        provider = self._serialize_provider(row)
        if not provider:
            raise ValueError("Provider not found")
        return provider

    def _get_provider_by_builtin_key(self, builtin_key):
        _, row = self.db.execute(
            """
            SELECT id, name, provider_type, endpoint, api_key, is_builtin, builtin_key,
                   created_at, updated_at
            FROM providers
            WHERE builtin_key = ?
            LIMIT 1
            """,
            (builtin_key,),
            fetchone=True,
        )
        return self._serialize_provider(row)

    def _serialize(self, row):
        if not row:
            return None

        provider_name = row[8] or row[3]
        provider_type = row[9] or row[3]
        return {
            "id": row[0],
            "name": row[1],
            "provider_id": row[2],
            "provider": provider_type,
            "provider_name": provider_name,
            "provider_type": provider_type,
            "is_default": bool(row[4]),
            "is_builtin": bool(row[5]),
            "created_at": row[6],
            "updated_at": row[7],
        }

    def _serialize_provider(self, row):
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
