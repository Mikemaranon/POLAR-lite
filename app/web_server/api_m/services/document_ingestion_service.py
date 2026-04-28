from pathlib import Path

from werkzeug.utils import secure_filename


class DocumentIngestionError(ValueError):
    pass


class DocumentIngestionService:
    MAX_DOCUMENT_BYTES = 1024 * 1024
    MAX_DOCUMENT_TEXT_CHARS = 20_000
    SUPPORTED_TEXT_EXTENSIONS = {
        ".txt",
        ".md",
        ".markdown",
        ".rst",
        ".log",
        ".json",
        ".csv",
        ".tsv",
        ".toml",
        ".ini",
        ".cfg",
        ".yaml",
        ".yml",
        ".xml",
        ".html",
        ".css",
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".py",
        ".java",
        ".rb",
        ".go",
        ".php",
        ".c",
        ".cc",
        ".cpp",
        ".h",
        ".hpp",
        ".sql",
        ".sh",
    }

    def extract_payload(self, uploaded_file):
        original_filename = secure_filename((uploaded_file.filename or "").strip())
        if not original_filename:
            raise DocumentIngestionError("Each document needs a valid filename.")

        content_type = (uploaded_file.mimetype or "text/plain").strip() or "text/plain"
        if not self._is_supported_document(original_filename, content_type):
            raise DocumentIngestionError(
                f'The document "{original_filename}" is not a supported text format yet.'
            )

        content_bytes = uploaded_file.read()
        if not content_bytes:
            raise DocumentIngestionError(f'The document "{original_filename}" is empty.')

        if len(content_bytes) > self.MAX_DOCUMENT_BYTES:
            raise DocumentIngestionError(
                f'The document "{original_filename}" exceeds the limit of 1 MB.'
            )

        text_content = self._decode_document_bytes(content_bytes, original_filename)
        normalized_text = self._normalize_document_text(text_content)
        if not normalized_text:
            raise DocumentIngestionError(
                f'The document "{original_filename}" has no readable text.'
            )

        return {
            "filename": original_filename,
            "content_type": content_type,
            "size_bytes": len(content_bytes),
            "text_content": normalized_text,
        }

    def _is_supported_document(self, filename, content_type):
        suffix = Path(filename).suffix.lower()
        if suffix in self.SUPPORTED_TEXT_EXTENSIONS:
            return True

        return content_type.startswith("text/")

    def _decode_document_bytes(self, content_bytes, filename):
        for encoding in ("utf-8", "utf-8-sig", "latin-1"):
            try:
                return content_bytes.decode(encoding)
            except UnicodeDecodeError:
                continue

        raise DocumentIngestionError(
            f'The document "{filename}" could not be decoded as text.'
        )

    def _normalize_document_text(self, text_content):
        normalized = (
            str(text_content or "")
            .replace("\r\n", "\n")
            .replace("\r", "\n")
            .strip()
        )
        if len(normalized) <= self.MAX_DOCUMENT_TEXT_CHARS:
            return normalized

        truncated = normalized[: self.MAX_DOCUMENT_TEXT_CHARS].rstrip()
        return (
            f"{truncated}\n\n"
            "[Document truncated automatically because it exceeded the local context limit.]"
        )
