from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from config import settings

SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def migrate_sqlite_schema():
    """Add columns that SQLAlchemy's create_all cannot add to existing SQLite tables."""
    if engine.dialect.name != 'sqlite':
        return
    with engine.begin() as connection:
        inspector = inspect(connection)
        if 'inspections' not in inspector.get_table_names():
            return
        columns = {column['name'] for column in inspector.get_columns('inspections')}
        if 'inspection_subtype' not in columns:
            connection.execute(text('ALTER TABLE inspections ADD COLUMN inspection_subtype VARCHAR'))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
