"""Alembic environment: the URL comes from DATABASE_URL, the schema from db.models.

Applied by docker/backend/entrypoint.sh before the API starts (`alembic upgrade head`), so every
container start has an up-to-date schema. Running it again is a no-op.
"""

from logging.config import fileConfig

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import create_engine, pool, text

from db.models import Base
from db.session import database_url

load_dotenv()

if context.config.config_file_name is not None:
    fileConfig(context.config.config_file_name)

target_metadata = Base.metadata

# Arbitrary id identifying this application's migration lock: when several API Pods start at the
# same time, they wait for each other instead of migrating concurrently.
MIGRATION_LOCK_ID = 7315101


def run_migrations_offline() -> None:
    """`alembic upgrade head --sql`: print the SQL instead of running it."""
    context.configure(
        url=database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(database_url(), poolclass=pool.NullPool)
    # Closing the connection ends the session, which releases the advisory lock.
    with engine.connect() as connection:
        connection.execute(text("SELECT pg_advisory_lock(:id)"), {"id": MIGRATION_LOCK_ID})
        connection.commit()
        context.configure(
            connection=connection, target_metadata=target_metadata, compare_type=True
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
