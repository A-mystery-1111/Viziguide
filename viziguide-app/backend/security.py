import asyncio
import logging
from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient, PyJWKClientConnectionError, PyJWKClientError, PyJWTError

from config import get_settings

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)
allowed_algorithms = ("ES256", "RS256")


def _log_rejection(reason: str, token: str | None = None) -> None:
    if token:
        reason = reason.replace(token, "[REDACTED]")
    logger.warning("Supabase access token rejected: %s", reason)


@lru_cache(maxsize=4)
def get_jwks_client(url: str) -> PyJWKClient:
    return PyJWKClient(url)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        _log_rejection("missing or non-Bearer authorization credentials")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid bearer token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_jwks_url:
        logger.error("Supabase authentication is unavailable: URL or JWKS URL is not configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase authentication is not configured.",
        )

    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg")
        if algorithm not in allowed_algorithms:
            _log_rejection(f"unsupported signing algorithm: {algorithm!r}", token)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        jwks_client = get_jwks_client(settings.supabase_jwks_url)
        signing_key = await asyncio.to_thread(jwks_client.get_signing_key_from_jwt, token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=list(allowed_algorithms),
            audience="authenticated",
            issuer=f"{settings.supabase_url.rstrip('/')}/auth/v1",
            options={"require": ["exp", "sub"]},
        )
        user_id = str(UUID(claims["sub"]))
    except PyJWKClientConnectionError as error:
        _log_rejection(f"could not fetch Supabase JWKS: {error}", token)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not reach the Supabase signing keys.",
        ) from error
    except HTTPException:
        raise
    except (PyJWKClientError, PyJWTError, KeyError, ValueError) as error:
        _log_rejection(f"{type(error).__name__}: {error}", token)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    return user_id
