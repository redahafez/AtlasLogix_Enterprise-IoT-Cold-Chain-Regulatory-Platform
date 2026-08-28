import jwt
from datetime import datetime, timedelta, timezone
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from core.models import User

SECRET_KEY = getattr(settings, 'SECRET_KEY', 'atlaslogix-default-secret')
ALGORITHM = 'HS256'


def generate_jwt_token(user, tenant_id=None, expires_in_hours=24):
    payload = {
        'user_id': user.user_id,
        'email': user.email,
        'tenant_id': tenant_id,
        'exp': datetime.now(timezone.utc) + timedelta(hours=expires_in_hours),
        'iat': datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_jwt_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationFailed({'error': 'UNAUTHORIZED', 'message': 'Token has expired'})
    except jwt.InvalidTokenError:
        raise AuthenticationFailed({'error': 'UNAUTHORIZED', 'message': 'Invalid authentication token'})


class JWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return None

        token = parts[1]
        payload = decode_jwt_token(token)

        try:
            user = User.objects.get(user_id=payload['user_id'])
        except User.DoesNotExist:
            raise AuthenticationFailed({'error': 'UNAUTHORIZED', 'message': 'User no longer exists'})

        # Store token-provided tenant context if present
        request.active_tenant_id = payload.get('tenant_id')
        return (user, token)
