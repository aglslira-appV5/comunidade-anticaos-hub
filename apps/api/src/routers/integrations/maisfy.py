"""
Maisfy integration router for LearnHouse / anticaos OS.

Receives inbound webhook notifications from Maisfy checkout
(e.g., approved/paid orders) and automatically provisions or updates
the student account, enrolling them into the organization and courses.
"""

import hashlib
import json
import logging
import os
import secrets
import string
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.kit_entitlements import KitEntitlement
from src.db.organizations import Organization
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.security.security import security_hash_password

logger = logging.getLogger(__name__)

router = APIRouter()

# Default organization ID for Comunidade Anticaos
DEFAULT_ORG_ID = 1
# Role ID 4 is "User" (Learner) in LearnHouse
LEARNER_ROLE_ID = 4

# Events/statuses indicating a paid order
PAID_STATUSES = {
    "order.paid",
}

# Events/statuses indicating access revocation (refund, chargeback, returned, canceled)
REVOKE_STATUSES = {
    "order.canceled",
    "order.refunded",
    "order.returned",
    "order.chargeback",
}

# Product-to-kit validation mapping (Planilha Mestre / ENT-1)
PRODUTOS_JSON_PATH = Path(__file__).parent / "maisfy_produtos.json"


def _load_maisfy_produtos() -> Dict[str, list]:
    try:
        with open(PRODUTOS_JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("kits", {})
    except Exception as e:
        logger.error(f"[Maisfy Webhook] Could not load maisfy_produtos.json: {e}")
        return {}


MAISFY_KITS_MAP: Dict[str, list] = _load_maisfy_produtos()


def _normalize_product_name(name: str) -> str:
    """
    Normalizes product name for matching:
    - lowercased
    - unaccented (unicodedata NFKD)
    - collapsed whitespace
    - stripped ends
    """
    if not name:
        return ""
    nfkd = unicodedata.normalize("NFKD", name)
    no_accents = "".join(c for c in nfkd if not unicodedata.combining(c))
    return " ".join(no_accents.lower().split())


def _find_kit_by_product_name(product_name: str) -> Optional[str]:
    """
    Finds exactly one kit matching the normalized product name in MAISFY_KITS_MAP.
    Returns the kit slug if exactly one kit matches, otherwise None.
    """
    norm_target = _normalize_product_name(product_name)
    if not norm_target:
        return None
    matched_kits = []
    for kit_slug, names in MAISFY_KITS_MAP.items():
        if any(_normalize_product_name(n) == norm_target for n in names):
            matched_kits.append(kit_slug)
    if len(matched_kits) == 1:
        return matched_kits[0]
    return None


def _verify_webhook_secret(request: Request) -> None:
    """
    Validates the shared secret between Maisfy and LearnHouse.
    SECURITY (Zero-Trust):
    - Fails closed if MAISFY_WEBHOOK_SECRET is not configured.
    - Uses constant-time comparison (secrets.compare_digest) to prevent timing attacks.
    - Checks standard headers ONLY (X-Maisfy-Token, X-Webhook-Secret, Authorization Bearer).
    - Query parameters are strictly forbidden to prevent secret leakage in server access logs.
    """
    expected_secret = os.environ.get("MAISFY_WEBHOOK_SECRET", "").strip()
    if not expected_secret:
        logger.error("[Maisfy Webhook] MAISFY_WEBHOOK_SECRET is not configured on server (fail-closed)")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Webhook secret not configured on server",
        )

    auth_header = request.headers.get("Authorization", "").strip()
    if auth_header.startswith("Basic "):
        import base64
        try:
            decoded = base64.b64decode(auth_header[6:]).decode("utf-8")
            if ":" in decoded:
                _, provided_pass = decoded.split(":", 1)
                if secrets.compare_digest(provided_pass.strip(), expected_secret):
                    return
        except Exception:
            pass

    provided_secret = (
        request.headers.get("X-Maisfy-Token")
        or request.headers.get("X-Webhook-Secret")
        or auth_header.replace("Bearer ", "").strip()
    )

    if not provided_secret or not secrets.compare_digest(provided_secret, expected_secret):
        logger.warning("[Maisfy Webhook] Rejected request: missing or invalid authentication token in headers")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook token",
        )


def _generate_temp_password(length: int = 12) -> str:
    """Generate a clean, strong temporary password for the learner."""
    chars = string.ascii_letters + string.digits
    rand_suffix = "".join(secrets.choice(chars) for _ in range(length - 8))
    return f"Anticaos#{rand_suffix}"


def _clean_username(email: str, base_name: str = "") -> str:
    """Generate a valid username slug from name or email."""
    seed = base_name.strip() if base_name else email.split("@")[0]
    cleaned = "".join(c for c in seed.lower() if c.isalnum() or c in "._-")
    cleaned = cleaned.strip("._-")
    return cleaned if len(cleaned) >= 3 else f"aluno_{secrets.token_hex(3)}"


async def _get_unique_username(base: str, db_session: AsyncSession) -> str:
    """Ensure username is unique by appending random numbers if needed."""
    candidate = base
    attempts = 0
    while attempts < 10:
        stmt = select(User).where(User.username == candidate)
        existing = (await db_session.execute(stmt)).scalars().first()
        if not existing:
            return candidate
        attempts += 1
        candidate = f"{base[:15]}_{secrets.randbelow(9999):04d}"
    return f"user_{uuid4().hex[:8]}"


def _extract_webhook_data(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extracts customer, event, and product info from Maisfy webhook payloads.
    Maisfy payloads are structured under 'data' envelope with 'event' at root level.
    Fallback fields at root level are maintained for backward compatibility.
    """
    if not isinstance(payload, dict):
        payload = {}

    data_envelope = payload.get("data")
    if not isinstance(data_envelope, dict):
        data_envelope = {}

    raw_status = (
        payload.get("event")
        or payload.get("status")
        or payload.get("current_status")
        or payload.get("order_status")
        or payload.get("transaction_status")
        or data_envelope.get("status")
        or ""
    )
    if isinstance(raw_status, str):
        status_norm = raw_status.strip().lower()
    else:
        status_norm = str(raw_status)

    customer = (
        data_envelope.get("customer")
        if isinstance(data_envelope.get("customer"), dict)
        else {}
    )
    if not customer and isinstance(payload.get("customer"), dict):
        customer = payload.get("customer")
    elif not customer and isinstance(payload.get("buyer"), dict):
        customer = payload.get("buyer")
    elif not customer and isinstance(payload.get("client"), dict):
        customer = payload.get("client")
    elif not customer and isinstance(payload.get("user"), dict):
        customer = payload.get("user")

    email = (
        data_envelope.get("email")
        or customer.get("email")
        or payload.get("customer_email")
        or payload.get("buyer_email")
        or payload.get("email")
        or ""
    )

    full_name = (
        customer.get("name")
        or customer.get("full_name")
        or data_envelope.get("name")
        or payload.get("customer_name")
        or payload.get("buyer_name")
        or payload.get("name")
        or ""
    )

    phone = (
        customer.get("cellphone")
        or customer.get("phone")
        or customer.get("mobile")
        or data_envelope.get("phone")
        or payload.get("customer_phone")
        or payload.get("phone")
        or ""
    )

    first_name = ""
    last_name = ""
    if full_name:
        parts = str(full_name).strip().split()
        first_name = parts[0]
        last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
    else:
        first_name = customer.get("first_name") or payload.get("first_name") or ""
        last_name = customer.get("last_name") or payload.get("last_name") or ""

    product = (
        data_envelope.get("product")
        if isinstance(data_envelope.get("product"), dict)
        else {}
    )
    if not product and isinstance(payload.get("product"), dict):
        product = payload.get("product")
    elif not product and isinstance(payload.get("order"), dict):
        product = payload.get("order")
    elif not product and isinstance(payload.get("offer"), dict):
        product = payload.get("offer")

    product_name = (
        product.get("name")
        or (data_envelope.get("product") if isinstance(data_envelope.get("product"), str) else None)
        or payload.get("product_name")
        or payload.get("item_name")
        or "Kit anticaos"
    )
    product_id = (
        product.get("id")
        or payload.get("product_id")
        or payload.get("checkout_id")
        or ""
    )

    financial_status = (
        data_envelope.get("financial_status")
        or payload.get("financial_status")
        or ""
    )

    # Extract order / transaction ID for transaction-level idempotency
    # Spec: order_id = data.order. Never payload.id (payload.id is evt_...)
    order_id = ""
    if data_envelope.get("order"):
        order_id = str(data_envelope.get("order")).strip()
    elif payload.get("order_id"):
        order_id = str(payload.get("order_id")).strip()
    elif payload.get("transaction_id"):
        order_id = str(payload.get("transaction_id")).strip()
    elif isinstance(payload.get("order"), dict) and payload.get("order", {}).get("id"):
        order_id = str(payload.get("order", {}).get("id")).strip()
    elif isinstance(payload.get("transaction"), dict) and payload.get("transaction", {}).get("id"):
        order_id = str(payload.get("transaction", {}).get("id")).strip()

    return {
        "status": status_norm,
        "email": str(email).strip().lower() if email else "",
        "full_name": str(full_name).strip(),
        "first_name": str(first_name).strip(),
        "last_name": str(last_name).strip(),
        "phone": str(phone).strip(),
        "product_name": str(product_name).strip(),
        "product_id": str(product_id).strip(),
        "order_id": order_id,
        "financial_status": str(financial_status).strip(),
    }


@router.get("/status", summary="Maisfy integration health check")
async def maisfy_status():
    """Verify that the Maisfy webhook endpoint is mounted and active."""
    return {
        "status": "online",
        "provider": "maisfy",
        "org_id": DEFAULT_ORG_ID,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _format_iso(dt: Optional[datetime]) -> Optional[str]:
    """Ensures consistent ISO-8601 formatting with UTC timezone across DB drivers."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _get_kit_access_days() -> int:
    """Reads KIT_ACCESS_DAYS environment variable. Defaults to 365.

    Emits warning and falls back to 365 if missing, non-integer, or <= 0.
    """
    raw = os.environ.get("KIT_ACCESS_DAYS", "").strip()
    if not raw:
        return 365
    try:
        val = int(raw)
        if val <= 0:
            logger.warning(f"[Maisfy Webhook] KIT_ACCESS_DAYS non-positive ({val}), defaulting to 365")
            return 365
        return val
    except ValueError:
        logger.warning(f"[Maisfy Webhook] Invalid KIT_ACCESS_DAYS='{raw}', defaulting to 365")
        return 365


async def _process_maisfy_webhook(
    request: Request,
    db_session: AsyncSession,
    kit_slug: Optional[str] = None,
) -> Dict[str, Any]:
    # 2. Parse request body
    try:
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            payload = await request.json()
        elif "application/x-www-form-urlencoded" in content_type:
            form_data = await request.form()
            payload = dict(form_data)
        else:
            try:
                payload = await request.json()
            except Exception:
                form_data = await request.form()
                payload = dict(form_data)
    except Exception as e:
        logger.error(f"[Maisfy Webhook] Malformed payload received: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed webhook payload",
        )

    data = _extract_webhook_data(payload)
    order_status = data["status"]
    email = data["email"]
    order_id = data.get("order_id", "")
    product_name = data["product_name"]
    financial_status = data.get("financial_status", "")

    # Redact email to a deterministic short hash for logs (Zero PII in logs)
    email_hash = hashlib.sha256(email.encode("utf-8")).hexdigest()[:8] if email else "none"

    logger.info(
        f"[Maisfy Webhook] Event received: status='{order_status}', "
        f"product_id='{data.get('product_id')}', order_id='{order_id}', "
        f"kit_slug='{kit_slug}', email_hash={email_hash}"
    )

    # 1. Ignore pending events
    if order_status == "order.pending":
        logger.info(
            f"[Maisfy Webhook] Ignoring pending order event '{order_status}' for email_hash={email_hash}"
        )
        return {
            "status": "ignored",
            "reason": f"Status '{order_status}' is not an approved payment",
        }

    # 2. Unknown event -> 200 ignored and log event name
    if order_status not in PAID_STATUSES and order_status not in REVOKE_STATUSES:
        logger.info(
            f"[Maisfy Webhook] Unknown event '{order_status}' received for email_hash={email_hash}"
        )
        return {
            "status": "ignored",
            "reason": "unknown event",
        }

    # 3. Diagnostic 422 if order.paid has missing customer email (keys only, zero payload values)
    if order_status in PAID_STATUSES and not email:
        root_keys = sorted(list(payload.keys())) if isinstance(payload, dict) else []
        data_env = payload.get("data") if isinstance(payload, dict) else None
        data_keys = sorted(list(data_env.keys())) if isinstance(data_env, dict) else []
        logger.warning(
            f"[Maisfy Webhook] Missing customer email in payload: root_keys={root_keys} data_keys={data_keys}"
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Missing customer email in webhook payload",
        )

    # 4. If webhook is unrouted (unified /webhook or /webhook/todos), discover kit by product name
    if kit_slug is None:
        matched_kit = _find_kit_by_product_name(product_name)
        if not matched_kit:
            logger.info(
                f"[Maisfy Webhook] Product not mapped: product='{product_name}', "
                f"event='{order_status}', order_id='{order_id}', email_hash={email_hash}"
            )
            return {
                "status": "ignored",
                "granted": False,
                "reason": "product not mapped",
                "event": order_status,
            }
        kit_slug = matched_kit
    elif order_status in PAID_STATUSES:
        # Kit-routed webhook (/webhook/<kit>): check product name against kit map
        kit_allowed_names = MAISFY_KITS_MAP.get(kit_slug, [])
        if not kit_allowed_names:
            logger.warning(
                f"[Maisfy Webhook] Product map empty for kit='{kit_slug}', "
                f"order_id='{order_id}', product='{product_name}', email_hash={email_hash}"
            )
            return {
                "status": "rejected",
                "granted": False,
                "reason": "product map empty",
                "event": "order.paid",
                "kit": kit_slug,
            }

        norm_product = _normalize_product_name(product_name)
        norm_allowed = {_normalize_product_name(n) for n in kit_allowed_names}
        if norm_product not in norm_allowed:
            logger.warning(
                f"[Maisfy Webhook] Product mismatch for kit='{kit_slug}': "
                f"received='{product_name}', order_id='{order_id}', email_hash={email_hash}"
            )
            return {
                "status": "rejected",
                "granted": False,
                "reason": "product mismatch",
                "event": "order.paid",
                "kit": kit_slug,
            }

    # 5. Check MAISFY_GRANT_ENABLED gate
    grant_enabled = os.environ.get("MAISFY_GRANT_ENABLED") == "true"
    if not grant_enabled:
        logger.info(
            f"[Maisfy Webhook] Grant disabled (MAISFY_GRANT_ENABLED != true): "
            f"event='{order_status}', order_id='{order_id}', financial_status='{financial_status}', "
            f"product='{product_name}', email_hash={email_hash}"
        )
        resp: Dict[str, Any] = {
            "status": "accepted",
            "granted": False,
            "reason": "grant disabled (MAISFY_GRANT_ENABLED)",
            "event": order_status,
        }
        if kit_slug is not None:
            resp["kit"] = kit_slug
        return resp

    # Furo 1: order.paid on kit route requires order_id to prevent unbounded renewals on retries
    if order_status in PAID_STATUSES and not order_id:
        logger.warning(
            f"[Maisfy Webhook] order.paid missing order_id for kit='{kit_slug}', email_hash={email_hash}"
        )
        return {
            "status": "rejected",
            "granted": False,
            "reason": "missing order",
            "event": "order.paid",
            "kit": kit_slug,
        }

    # 7. Access Revocation on kit-routed webhook with grant enabled
    if order_status in REVOKE_STATUSES:
        if not order_id:
            logger.warning(
                f"[Maisfy Webhook] Revocation missing order_id for kit='{kit_slug}', email_hash={email_hash}"
            )
            return {
                "status": "ignored",
                "reason": "order not found for kit",
            }

        stmt = select(KitEntitlement).where(
            KitEntitlement.order_code == order_id,
            KitEntitlement.kit == kit_slug,
        )
        entitlement = (await db_session.execute(stmt)).scalars().first()

        if not entitlement:
            logger.warning(
                f"[Maisfy Webhook] Revocation ignored: order not found for kit. "
                f"order_id='{order_id}', kit='{kit_slug}', email_hash={email_hash}"
            )
            return {
                "status": "ignored",
                "reason": "order not found for kit",
            }

        if entitlement.revoked_at is not None:
            logger.info(
                f"[Maisfy Webhook] Order '{order_id}' already revoked for kit='{kit_slug}', user id={entitlement.user_id}"
            )
            return {
                "status": "already_revoked",
                "kit": kit_slug,
                "user_id": entitlement.user_id,
                "reason": entitlement.revoked_reason or order_status,
            }

        agora = datetime.now(timezone.utc)
        entitlement.revoked_at = agora
        entitlement.revoked_reason = order_status
        entitlement.updated_at = agora
        db_session.add(entitlement)
        await db_session.commit()

        logger.info(
            f"[Maisfy Webhook] REVOKED entitlement id={entitlement.id} for user id={entitlement.user_id}, "
            f"kit='{kit_slug}', order_id='{order_id}' due to event='{order_status}'"
        )
        return {
            "status": "access_revoked",
            "kit": kit_slug,
            "user_id": entitlement.user_id,
            "reason": order_status,
        }

    # 8. Order Paid: Idempotency check via kit_entitlement table (not processed_orders)
    if order_id:
        stmt_order = select(KitEntitlement).where(
            KitEntitlement.order_code == order_id,
            KitEntitlement.kit == kit_slug,
        )
        existing_order_ent = (await db_session.execute(stmt_order)).scalars().first()
        if existing_order_ent:
            logger.info(
                f"[Maisfy Webhook] Order '{order_id}' already processed in kit_entitlement for user id={existing_order_ent.user_id}"
            )
            return {
                "status": "success",
                "action": "already_processed",
                "user_id": existing_order_ent.user_id,
                "kit": kit_slug,
                "expires_at": _format_iso(existing_order_ent.expires_at),
                "org_id": DEFAULT_ORG_ID,
            }

    # Ensure Organization exists
    org_stmt = select(Organization).where(Organization.id == DEFAULT_ORG_ID)
    org = (await db_session.execute(org_stmt)).scalars().first()
    if not org:
        logger.error(f"[Maisfy Webhook] Default organization id={DEFAULT_ORG_ID} not found!")
        raise HTTPException(
            status_code=500,
            detail="Default platform organization not found",
        )

    # 9. Find or create learner
    user_stmt = select(User).where(User.email == email)
    user = (await db_session.execute(user_stmt)).scalars().first()

    now_str = str(datetime.now())
    agora = datetime.now(timezone.utc)
    prazo = timedelta(days=_get_kit_access_days())

    if not user:
        base_user = _clean_username(email, data["full_name"])
        username = await _get_unique_username(base_user, db_session)
        temp_pwd = _generate_temp_password()
        hashed_pwd = security_hash_password(temp_pwd)

        initial_metadata: Dict[str, Any] = {
            "phone": data["phone"],
            "initial_product": product_name,
            "provider": "maisfy",
        }
        if order_id:
            initial_metadata["processed_orders"] = [order_id]

        new_user = User(
            user_uuid=f"user_{uuid4()}",
            username=username,
            email=email,
            first_name=data["first_name"] or "Aluno",
            last_name=data["last_name"] or "",
            password=hashed_pwd,
            email_verified=True,
            email_verified_at=agora.isoformat(),
            signup_method="maisfy",
            creation_date=now_str,
            update_date=now_str,
            extra_metadata=initial_metadata,
        )
        db_session.add(new_user)
        await db_session.flush()
        user = new_user

        user_org = UserOrganization(
            user_id=user.id,
            org_id=DEFAULT_ORG_ID,
            role_id=LEARNER_ROLE_ID,
            creation_date=now_str,
            update_date=now_str,
        )
        db_session.add(user_org)
        logger.info(f"[Maisfy Webhook] Created new user id={user.id}, email_hash={email_hash}")
    else:
        # Existing user: ensure membership in DEFAULT_ORG_ID
        user_org_stmt = select(UserOrganization).where(
            UserOrganization.user_id == user.id,
            UserOrganization.org_id == DEFAULT_ORG_ID,
        )
        user_org = (await db_session.execute(user_org_stmt)).scalars().first()
        if not user_org:
            user_org = UserOrganization(
                user_id=user.id,
                org_id=DEFAULT_ORG_ID,
                role_id=LEARNER_ROLE_ID,
                creation_date=now_str,
                update_date=now_str,
            )
            db_session.add(user_org)
            logger.info(f"[Maisfy Webhook] Enrolled existing user id={user.id} into org {DEFAULT_ORG_ID}")

    # 10. Record or update kit entitlement for (user.id, kit_slug)
    stmt_user_kit = select(KitEntitlement).where(
        KitEntitlement.user_id == user.id,
        KitEntitlement.kit == kit_slug,
    )
    entitlement = (await db_session.execute(stmt_user_kit)).scalars().first()

    # Furo 2: Delayed retry of an older order after a renewal replaced order_code
    # If user already exists, already has an entitlement for this kit, and order_id is in processed_orders:
    if user and entitlement:
        user_metadata = user.extra_metadata or {}
        processed_orders = user_metadata.get("processed_orders", [])
        if isinstance(processed_orders, list) and order_id and order_id in processed_orders:
            logger.info(
                f"[Maisfy Webhook] Order '{order_id}' was previously processed for user id={user.id} and kit='{kit_slug}'"
            )
            return {
                "status": "success",
                "action": "already_processed",
                "user_id": user.id,
                "kit": kit_slug,
                "expires_at": _format_iso(entitlement.expires_at),
                "org_id": DEFAULT_ORG_ID,
            }

    # Record order_id into user metadata for new orders
    if order_id:
        user_metadata = user.extra_metadata or {}
        processed_orders = user_metadata.get("processed_orders", [])
        if not isinstance(processed_orders, list):
            processed_orders = []
        if order_id not in processed_orders:
            processed_orders.append(order_id)
            user_metadata["processed_orders"] = processed_orders
            user.extra_metadata = dict(user_metadata)
            db_session.add(user)

    action = "granted"
    expires_at: Optional[datetime] = None

    if entitlement is None:
        action = "granted"
        expires_at = agora + prazo
        entitlement = KitEntitlement(
            user_id=user.id,
            org_id=DEFAULT_ORG_ID,
            kit=kit_slug,
            source="maisfy",
            order_code=order_id or None,
            granted_at=agora,
            expires_at=expires_at,
            created_at=agora,
            updated_at=agora,
        )
        db_session.add(entitlement)
    elif entitlement.revoked_at is not None:
        action = "reactivated"
        expires_at = agora + prazo
        entitlement.revoked_at = None
        entitlement.revoked_reason = None
        entitlement.granted_at = agora
        entitlement.expires_at = expires_at
        entitlement.order_code = order_id or entitlement.order_code
        entitlement.updated_at = agora
        db_session.add(entitlement)
    elif entitlement.expires_at is None:
        action = "renewed"
        expires_at = None
        entitlement.order_code = order_id or entitlement.order_code
        entitlement.updated_at = agora
        db_session.add(entitlement)
    else:
        action = "renewed"
        cur_exp = entitlement.expires_at
        if cur_exp.tzinfo is None:
            cur_exp = cur_exp.replace(tzinfo=timezone.utc)
        base_dt = max(cur_exp, agora)
        expires_at = base_dt + prazo
        entitlement.expires_at = expires_at
        entitlement.order_code = order_id or entitlement.order_code
        entitlement.updated_at = agora
        db_session.add(entitlement)

    try:
        await db_session.commit()
    except IntegrityError:
        await db_session.rollback()
        stmt_retry = select(KitEntitlement).where(
            KitEntitlement.user_id == user.id,
            KitEntitlement.kit == kit_slug,
        )
        reread = (await db_session.execute(stmt_retry)).scalars().first()
        return {
            "status": "success",
            "action": "already_processed",
            "user_id": user.id,
            "kit": kit_slug,
            "expires_at": _format_iso(reread.expires_at) if reread else None,
            "org_id": DEFAULT_ORG_ID,
        }

    # Access Delivery: dispatch password reset email to student
    try:
        from src.db.users import AnonymousUser
        from src.services.users.password_reset import send_reset_password_code
        await send_reset_password_code(
            request=request,
            db_session=db_session,
            current_user=AnonymousUser(),
            org_id=DEFAULT_ORG_ID,
            email=email,
            tipo="access_granted",
        )
        logger.info(f"[Maisfy Webhook] Access reset email dispatched to learner: email_hash={email_hash}")
    except Exception as email_err:
        logger.error(f"[MAISFY_ACESSO_EMAIL_FALHOU] email_hash={email_hash}: {email_err}")
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(email_err)
        except Exception:
            pass

    # Return clean response with ZERO PII (no email, no username)
    return {
        "status": "success",
        "action": action,
        "user_id": user.id,
        "kit": kit_slug,
        "expires_at": _format_iso(expires_at),
        "org_id": DEFAULT_ORG_ID,
    }


@router.post(
    "/webhook",
    status_code=status.HTTP_200_OK,
    summary="Receive Maisfy checkout webhook",
    description="Processes Maisfy sales notifications, identifying kit by product name.",
)
async def maisfy_webhook(
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
):
    """
    Receives JSON or Form payload from Maisfy on unified endpoint.
    Requires authentication via MAISFY_WEBHOOK_SECRET in request headers.
    Identifies kit automatically by product name.
    """
    _verify_webhook_secret(request)
    return await _process_maisfy_webhook(request=request, db_session=db_session, kit_slug=None)


@router.post(
    "/webhook/todos",
    status_code=status.HTTP_200_OK,
    summary="Receive Maisfy checkout webhook for all products",
    description="Processes Maisfy sales notifications for all products, identifying kit by product name.",
)
async def maisfy_webhook_todos(
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
):
    """
    Official unified webhook endpoint for Maisfy ('Todos os produtos').
    Requires authentication via MAISFY_WEBHOOK_SECRET in request headers.
    Identifies kit automatically by product name.
    """
    _verify_webhook_secret(request)
    return await _process_maisfy_webhook(request=request, db_session=db_session, kit_slug=None)


@router.post(
    "/webhook/{kit_slug}",
    status_code=status.HTTP_200_OK,
    summary="Receive Maisfy checkout webhook for specific kit",
    description="Processes Maisfy sales notifications for a specific kit slug with product name verification.",
)
async def maisfy_webhook_kit(
    kit_slug: str,
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
):
    """
    Receives JSON or Form payload from Maisfy routed to a specific kit slug.
    Requires authentication via MAISFY_WEBHOOK_SECRET in request headers.
    Validates kit_slug against MAISFY_KITS_MAP and verifies product name on order.paid.
    """
    # 1. SECURITY: Verify shared secret FIRST before looking at kit_slug
    _verify_webhook_secret(request)

    slug_norm = kit_slug.strip().lower()
    if slug_norm == "todos" or slug_norm not in MAISFY_KITS_MAP:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="unknown kit",
        )

    return await _process_maisfy_webhook(request=request, db_session=db_session, kit_slug=slug_norm)
