class ProjectDocumentsTable:
    def __init__(self, db):
        self.db = db

    def create(
        self,
        project_id,
        filename,
        content_type,
        size_bytes,
        text_content,
    ):
        _, document_id = self.db.execute(
            """
            INSERT INTO project_documents (
                project_id,
                filename,
                content_type,
                size_bytes,
                text_content
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (project_id, filename, content_type, size_bytes, text_content),
            lastrowid=True,
        )
        return document_id

    def get(self, document_id):
        _, row = self.db.execute(
            """
            SELECT id, project_id, filename, content_type, size_bytes, text_content,
                   created_at, updated_at
            FROM project_documents
            WHERE id = ?
            """,
            (document_id,),
            fetchone=True,
        )
        return self._serialize(row)

    def for_project(self, project_id):
        _, rows = self.db.execute(
            """
            SELECT id, project_id, filename, content_type, size_bytes, text_content,
                   created_at, updated_at
            FROM project_documents
            WHERE project_id = ?
            ORDER BY created_at ASC, id ASC
            """,
            (project_id,),
            fetchall=True,
        )
        return [self._serialize(row) for row in rows]

    def delete(self, document_id):
        self.db.execute(
            "DELETE FROM project_documents WHERE id = ?",
            (document_id,),
        )

    def delete_for_project(self, project_id):
        self.db.execute(
            "DELETE FROM project_documents WHERE project_id = ?",
            (project_id,),
        )

    def _serialize(self, row):
        if not row:
            return None

        return {
            "id": row[0],
            "project_id": row[1],
            "filename": row[2],
            "content_type": row[3],
            "size_bytes": row[4],
            "text_content": row[5],
            "created_at": row[6],
            "updated_at": row[7],
        }
