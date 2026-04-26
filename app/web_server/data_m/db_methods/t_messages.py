class MessagesTable:
    def __init__(self, db):
        self.db = db

    def create(
        self,
        conversation_id,
        role,
        content,
        position=None,
        provider_message_id=None,
    ):
        if position is None:
            position = self._next_position(conversation_id)

        _, message_id = self.db.execute(
            """
            INSERT INTO messages (
                conversation_id, role, content, position, provider_message_id
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (conversation_id, role, content, position, provider_message_id),
            lastrowid=True
        )
        return message_id

    def get(self, message_id):
        _, row = self.db.execute(
            """
            SELECT id, conversation_id, role, content, position,
                   provider_message_id, created_at
            FROM messages
            WHERE id = ?
            """,
            (message_id,),
            fetchone=True
        )
        return self._serialize(row)

    def for_conversation(self, conversation_id):
        _, rows = self.db.execute(
            """
            SELECT id, conversation_id, role, content, position,
                   provider_message_id, created_at
            FROM messages
            WHERE conversation_id = ?
            ORDER BY position ASC, id ASC
            """,
            (conversation_id,),
            fetchall=True
        )
        return [self._serialize(row) for row in rows]

    def delete(self, message_id):
        self.db.execute(
            "DELETE FROM messages WHERE id = ?",
            (message_id,)
        )

    def delete_for_conversation(self, conversation_id):
        self.db.execute(
            "DELETE FROM messages WHERE conversation_id = ?",
            (conversation_id,)
        )

    def _next_position(self, conversation_id):
        _, row = self.db.execute(
            """
            SELECT COALESCE(MAX(position), -1) + 1
            FROM messages
            WHERE conversation_id = ?
            """,
            (conversation_id,),
            fetchone=True
        )
        return row[0] if row else 0

    def _serialize(self, row):
        if not row:
            return None

        return {
            "id": row[0],
            "conversation_id": row[1],
            "role": row[2],
            "content": row[3],
            "position": row[4],
            "provider_message_id": row[5],
            "created_at": row[6],
        }
