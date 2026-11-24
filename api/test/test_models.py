from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column

from db.models import NAMING_CONVENTION, Base, TimestampMixin


def test_metadata_uses_naming_convention():
    assert Base.metadata.naming_convention == {"ix": "ix_%(column_0_label)s", **NAMING_CONVENTION}


def test_timestamp_mixin_columns_are_timestamptz():
    class Example(TimestampMixin, Base):
        __tablename__ = "example"
        id: Mapped[int] = mapped_column(Integer, primary_key=True)

    try:
        for name in ("created_at", "updated_at"):
            column = Example.__table__.c[name]
            assert column.type.timezone is True
            assert column.nullable is False
            assert column.server_default is not None
        assert Example.__table__.c.updated_at.onupdate is not None
    finally:
        Base.metadata.remove(Example.__table__)
