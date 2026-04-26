class ProfilesTable:
    def __init__(self, db):
        self.db = db

    def create(
        self,
        name,
        system_prompt="",
        temperature=0.7,
        top_p=1.0,
        max_tokens=2048,
        is_default=False,
    ):
        _, profile_id = self.db.execute(
            """
            INSERT INTO profiles (
                name, system_prompt, temperature, top_p, max_tokens, is_default
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                system_prompt,
                temperature,
                top_p,
                max_tokens,
                int(is_default),
            ),
            lastrowid=True
        )

        if is_default:
            self.set_default(profile_id)

        return profile_id

    def get(self, profile_id):
        _, row = self.db.execute(
            """
            SELECT id, name, system_prompt, temperature, top_p, max_tokens,
                   is_default, created_at, updated_at
            FROM profiles
            WHERE id = ?
            """,
            (profile_id,),
            fetchone=True
        )
        return self._serialize(row)

    def get_default(self):
        _, row = self.db.execute(
            """
            SELECT id, name, system_prompt, temperature, top_p, max_tokens,
                   is_default, created_at, updated_at
            FROM profiles
            WHERE is_default = 1
            ORDER BY id ASC
            LIMIT 1
            """,
            fetchone=True
        )
        return self._serialize(row)

    def all(self):
        _, rows = self.db.execute(
            """
            SELECT id, name, system_prompt, temperature, top_p, max_tokens,
                   is_default, created_at, updated_at
            FROM profiles
            ORDER BY is_default DESC, updated_at DESC, id DESC
            """,
            fetchall=True
        )
        return [self._serialize(row) for row in rows]

    def update(
        self,
        profile_id,
        name,
        system_prompt="",
        temperature=0.7,
        top_p=1.0,
        max_tokens=2048,
        is_default=False,
    ):
        self.db.execute(
            """
            UPDATE profiles
            SET name = ?,
                system_prompt = ?,
                temperature = ?,
                top_p = ?,
                max_tokens = ?,
                is_default = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                name,
                system_prompt,
                temperature,
                top_p,
                max_tokens,
                int(is_default),
                profile_id,
            )
        )

        if is_default:
            self.set_default(profile_id)

    def set_default(self, profile_id):
        self.db.execute("UPDATE profiles SET is_default = 0")
        self.db.execute(
            """
            UPDATE profiles
            SET is_default = 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (profile_id,)
        )

    def delete(self, profile_id):
        self.db.execute(
            "DELETE FROM profiles WHERE id = ?",
            (profile_id,)
        )

    def _serialize(self, row):
        if not row:
            return None

        return {
            "id": row[0],
            "name": row[1],
            "system_prompt": row[2],
            "temperature": row[3],
            "top_p": row[4],
            "max_tokens": row[5],
            "is_default": bool(row[6]),
            "created_at": row[7],
            "updated_at": row[8],
        }
