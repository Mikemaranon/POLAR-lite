from .document_ingestion_service import (
    DocumentIngestionError,
    DocumentIngestionService,
)


class ProjectDocumentService:
    def __init__(self, db_manager, ingestion_service=None):
        self.db = db_manager
        self.ingestion_service = ingestion_service or DocumentIngestionService()

    def list_documents(self, project_id):
        self._ensure_project_exists(project_id)
        return [
            self.serialize_document(item)
            for item in self.db.project_documents.for_project(project_id)
        ]

    def create_documents(self, project_id, files):
        self._ensure_project_exists(project_id)
        if not files:
            raise DocumentIngestionError("Missing files")

        created_documents = []
        for uploaded_file in files:
            document_payload = self.ingestion_service.extract_payload(uploaded_file)
            document_id = self.db.project_documents.create(
                project_id=project_id,
                filename=document_payload["filename"],
                content_type=document_payload["content_type"],
                size_bytes=document_payload["size_bytes"],
                text_content=document_payload["text_content"],
            )
            created_documents.append(
                self.serialize_document(self.db.project_documents.get(document_id))
            )

        return created_documents

    def delete_document(self, document_id):
        document = self.db.project_documents.get(document_id)
        if not document:
            raise LookupError("Document not found")

        self.db.project_documents.delete(document_id)
        return {
            "deleted": True,
            "document_id": document_id,
        }

    def serialize_document(self, document):
        return {
            "id": document["id"],
            "project_id": document["project_id"],
            "filename": document["filename"],
            "content_type": document["content_type"],
            "size_bytes": document["size_bytes"],
            "created_at": document["created_at"],
            "updated_at": document["updated_at"],
            "preview": document["text_content"][:240],
        }

    def _ensure_project_exists(self, project_id):
        if self.db.projects.get(project_id):
            return

        raise LookupError("Project not found")
