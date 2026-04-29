from dataclasses import dataclass


@dataclass(frozen=True)
class ColumnMigration:
    table_name: str
    column_name: str
    column_definition: str


SCHEMA_MIGRATIONS = [
    ColumnMigration("projects", "system_prompt", "TEXT DEFAULT ''"),
    ColumnMigration("profiles", "personality", "TEXT DEFAULT ''"),
    ColumnMigration("profiles", "tags", "TEXT DEFAULT ''"),
    ColumnMigration("conversations", "model_config_id", "INTEGER"),
    ColumnMigration("models", "provider_config_id", "INTEGER"),
    ColumnMigration("models", "display_name", "TEXT DEFAULT ''"),
    ColumnMigration("models", "icon_image", "TEXT DEFAULT ''"),
    ColumnMigration("messages", "model_config_id", "INTEGER"),
    ColumnMigration("messages", "model_name", "TEXT DEFAULT ''"),
    ColumnMigration("messages", "profile_id", "INTEGER"),
    ColumnMigration("messages", "profile_name", "TEXT DEFAULT ''"),
]
