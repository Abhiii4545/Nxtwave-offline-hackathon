"""Database engine and session management for Vanguard AI."""

import os
from sqlmodel import SQLModel, Session, create_engine

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./vanguard.db")

# Managed Postgres providers (Render, Heroku, …) hand out a "postgres://" URL,
# but SQLAlchemy requires the "postgresql://" scheme.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

is_sqlite = DATABASE_URL.startswith("sqlite")
# SQLite needs check_same_thread; Postgres benefits from pre-ping to survive
# connections dropped while the instance was idle.
connect_args = {"check_same_thread": False} if is_sqlite else {}
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
    pool_pre_ping=not is_sqlite,
)


def create_db_and_tables():
    """Create all database tables from SQLModel metadata, then apply migrations."""
    SQLModel.metadata.create_all(engine)
    run_migrations()


def run_migrations():
    """Lightweight additive migrations for SQLite (no Alembic needed).

    Adds newly introduced columns to existing tables so old databases keep
    working without losing scan history.
    """
    from sqlalchemy import inspect, text

    additions = {
        "vulnerability": {
            "verified": "BOOLEAN DEFAULT 0",
            "repro_command": "TEXT",
        },
    }

    try:
        inspector = inspect(engine)
        table_names = set(inspector.get_table_names())
        with engine.begin() as conn:
            for table, columns in additions.items():
                if table not in table_names:
                    continue
                existing = {c["name"] for c in inspector.get_columns(table)}
                for col, ddl in columns.items():
                    if col not in existing:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}"))
    except Exception as e:
        print(f"[!] Migration check skipped: {e}")


def get_session():
    """Yield a database session for dependency injection."""
    with Session(engine) as session:
        yield session
