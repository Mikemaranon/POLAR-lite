class ProfilesTable:
    MAX_TAGS = 10

    def __init__(self, db):
        self.db = db

    def create(
        self,
        name,
        personality="",
        tags=None,
        system_prompt="",
        temperature=0.7,
        top_p=1.0,
        max_tokens=2048,
        is_default=False,
    ):
        stored_tags = self._serialize_tags(tags)
        _, profile_id = self.db.execute(
            """
            INSERT INTO profiles (
                name, personality, tags, system_prompt, temperature, top_p, max_tokens, is_default
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                personality,
                stored_tags,
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
            SELECT id, name, personality, tags, system_prompt, temperature, top_p, max_tokens,
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
            SELECT id, name, personality, tags, system_prompt, temperature, top_p, max_tokens,
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
            SELECT id, name, personality, tags, system_prompt, temperature, top_p, max_tokens,
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
        personality="",
        tags=None,
        system_prompt="",
        temperature=0.7,
        top_p=1.0,
        max_tokens=2048,
        is_default=False,
    ):
        stored_tags = self._serialize_tags(tags)
        self.db.execute(
            """
            UPDATE profiles
            SET name = ?,
                personality = ?,
                tags = ?,
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
                personality,
                stored_tags,
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

    def count(self):
        _, row = self.db.execute(
            "SELECT COUNT(*) FROM profiles",
            fetchone=True
        )
        return row[0] if row else 0

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
        _, row = self.db.execute(
            """
            SELECT id
            FROM profiles
            WHERE id != ?
            ORDER BY is_default DESC, updated_at DESC, id DESC
            LIMIT 1
            """,
            (profile_id,),
            fetchone=True
        )
        fallback_profile_id = row[0] if row else None

        self.db.execute(
            "DELETE FROM profiles WHERE id = ?",
            (profile_id,)
        )

        if fallback_profile_id and not self.get_default():
            self.set_default(fallback_profile_id)

    def _serialize(self, row):
        if not row:
            return None

        return {
            "id": row[0],
            "name": row[1],
            "personality": row[2],
            "tags": self._parse_tags(row[3]),
            "system_prompt": row[4],
            "temperature": row[5],
            "top_p": row[6],
            "max_tokens": row[7],
            "is_default": bool(row[8]),
            "created_at": row[9],
            "updated_at": row[10],
        }

    def _serialize_tags(self, tags):
        normalized_tags = []
        seen = set()

        for tag in self._coerce_tags(tags):
            normalized = tag.strip()
            normalized_key = normalized.lower()

            if not normalized or normalized_key in seen:
                continue

            normalized_tags.append(normalized)
            seen.add(normalized_key)

            if len(normalized_tags) == self.MAX_TAGS:
                break

        return ",".join(normalized_tags)

    def _parse_tags(self, stored_tags):
        if not stored_tags:
            return []

        return [tag.strip() for tag in str(stored_tags).split(",") if tag.strip()]

    def _coerce_tags(self, tags):
        if tags is None:
            return []

        if isinstance(tags, str):
            return tags.split(",")

        return [str(tag) for tag in tags]
