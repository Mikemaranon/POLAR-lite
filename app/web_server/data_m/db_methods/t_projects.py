class ProjectsTable:
    def __init__(self, db):
        self.db = db

    def create(self, name, description=None, system_prompt=""):
        _, project_id = self.db.execute(
            """
            INSERT INTO projects (name, description, system_prompt)
            VALUES (?, ?, ?)
            """,
            (name, description, system_prompt),
            lastrowid=True
        )
        return project_id

    def get(self, project_id):
        _, row = self.db.execute(
            """
            SELECT id, name, description, system_prompt, created_at, updated_at
            FROM projects
            WHERE id = ?
            """,
            (project_id,),
            fetchone=True
        )
        if not row:
            return None

        return {
            "id": row[0],
            "name": row[1],
            "description": row[2],
            "system_prompt": row[3] or "",
            "created_at": row[4],
            "updated_at": row[5],
        }

    def all(self):
        _, rows = self.db.execute(
            """
            SELECT id, name, description, system_prompt, created_at, updated_at
            FROM projects
            ORDER BY updated_at DESC, id DESC
            """,
            fetchall=True
        )
        return [
            {
                "id": row[0],
                "name": row[1],
                "description": row[2],
                "system_prompt": row[3] or "",
                "created_at": row[4],
                "updated_at": row[5],
            }
            for row in rows
        ]

    def update(self, project_id, name, description=None, system_prompt=""):
        self.db.execute(
            """
            UPDATE projects
            SET name = ?, description = ?, system_prompt = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (name, description, system_prompt, project_id)
        )

    def delete(self, project_id):
        self.db.execute(
            "DELETE FROM projects WHERE id = ?",
            (project_id,)
        )
