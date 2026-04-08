"""Seed the SafeRide database with operators that match mock-identity-system users.

Run from the backend directory:
    uv run python scripts/seed.py

Each operator's individual_id matches an identity registered in the
mock-identity-system, so Inji Certify's postgres-dataprovider-plugin can
look them up by that ID when issuing credentials.
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

# Make sure app/ is importable when running as a script.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, select

from app.core.config import get_settings
from app.db.models.corporate_body import CorporateBody
from app.db.models.operator import Operator
from app.db.models.operator_vehicle_binding import OperatorVehicleBinding
from app.db.models.vehicle import Vehicle
from app.db.session import get_engine, init_db


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---------------------------------------------------------------------------
# Seed data — individual_id values must exist in mock-identity-system
# ---------------------------------------------------------------------------

CORPORATE_BODIES = [
    {"name": "SafeRide Kigali SACCO", "code": "SR-KGL-001", "description": "Main Kigali operator SACCO"},
]

# Each operator's individual_id must match a row in
# mockidentitysystem.mock_identity (individual_id column).
OPERATORS = [
    {
        "individual_id": "0000111122",
        "external_subject_id": "0000111122",   # used as OIDC sub before login
        "full_name": "Joseph Joe",
        "email": "joejoe@gmail.com",
        "phone": "+250788111000",
        "gender": "Male",
        "birthdate": "1999/01/01",
        "status": "ACTIVE",
        "role": "driver",
        "verify_short_code": "SR001",
        "registration_type": "individual",
        "esignet_verified_at": _utcnow() - timedelta(days=1),
    },
]

VEHICLES = [
    {
        "external_ref": "RAA 001 A",
        "display_name": "Toyota Hiace – RAA 001 A",
        "vehicle_type": "Minibus",
        "make_model": "Toyota Hiace",
        "color": "White",
    },
]

# operator external_subject_id → list of vehicle external_refs
BINDINGS = {
    "0000111122": ["RAA 001 A"],
}


def seed(session: Session) -> None:
    print("Seeding corporate bodies...")
    corp_map: dict[str, CorporateBody] = {}
    for cb_data in CORPORATE_BODIES:
        existing = session.exec(
            select(CorporateBody).where(CorporateBody.code == cb_data["code"])
        ).first()
        if existing:
            print(f"  skip corporate_body '{cb_data['code']}' (already exists)")
            corp_map[cb_data["code"]] = existing
        else:
            cb = CorporateBody(**cb_data)
            session.add(cb)
            session.flush()
            corp_map[cb_data["code"]] = cb
            print(f"  created corporate_body '{cb_data['code']}'")

    print("\nSeeding vehicles...")
    vehicle_map: dict[str, Vehicle] = {}
    first_corp = list(corp_map.values())[0]
    for v_data in VEHICLES:
        existing = session.exec(
            select(Vehicle).where(Vehicle.external_ref == v_data["external_ref"])
        ).first()
        if existing:
            print(f"  skip vehicle '{v_data['external_ref']}' (already exists)")
            vehicle_map[v_data["external_ref"]] = existing
        else:
            v = Vehicle(**v_data, corporate_body_id=first_corp.id)
            session.add(v)
            session.flush()
            vehicle_map[v_data["external_ref"]] = v
            print(f"  created vehicle '{v_data['external_ref']}'")

    print("\nSeeding operators...")
    operator_map: dict[str, Operator] = {}
    for op_data in OPERATORS:
        existing = session.exec(
            select(Operator).where(Operator.individual_id == op_data["individual_id"])
        ).first()
        if existing:
            print(f"  skip operator individual_id='{op_data['individual_id']}' (already exists)")
            operator_map[op_data["external_subject_id"]] = existing
        else:
            op = Operator(
                **op_data,
                corporate_body_id=first_corp.id,
            )
            session.add(op)
            session.flush()
            operator_map[op_data["external_subject_id"]] = op
            print(f"  created operator '{op_data['full_name']}' (individual_id={op_data['individual_id']})")

    print("\nSeeding operator-vehicle bindings...")
    now = _utcnow()
    for subject_id, vehicle_refs in BINDINGS.items():
        op = operator_map.get(subject_id)
        if not op:
            print(f"  skip binding for unknown operator '{subject_id}'")
            continue
        for ref in vehicle_refs:
            v = vehicle_map.get(ref)
            if not v:
                print(f"  skip binding for unknown vehicle '{ref}'")
                continue
            existing = session.exec(
                select(OperatorVehicleBinding).where(
                    OperatorVehicleBinding.operator_id == op.id,
                    OperatorVehicleBinding.vehicle_id == v.id,
                )
            ).first()
            if existing:
                print(f"  skip binding {subject_id} → {ref} (already exists)")
            else:
                binding = OperatorVehicleBinding(
                    operator_id=op.id,
                    vehicle_id=v.id,
                    valid_from=now,
                    valid_until=now + timedelta(days=365),
                    is_active=True,
                )
                session.add(binding)
                print(f"  created binding {subject_id} → {ref}")

    session.commit()
    print("\nDone.")


def main() -> None:
    settings = get_settings()
    print(f"Database: {settings.database_url}\n")
    init_db()
    engine = get_engine()
    with Session(engine) as session:
        seed(session)


if __name__ == "__main__":
    main()
