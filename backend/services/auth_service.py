import sys
import bcrypt

# Mock bcrypt.__about__ for passlib version check compatibility
class MockAbout:
    __version__ = bcrypt.__version__

bcrypt.__about__ = MockAbout()

# Monkey-patch bcrypt.hashpw to truncate password if longer than 72 bytes (compatibility with bcrypt >= 4.0.0)
_original_hashpw = bcrypt.hashpw
def patched_hashpw(password, salt):
    if isinstance(password, bytes) and len(password) > 72:
        password = password[:72]
    elif isinstance(password, str) and len(password.encode('utf-8')) > 72:
        password = password.encode('utf-8')[:72]
    return _original_hashpw(password, salt)

bcrypt.hashpw = patched_hashpw

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.hash import bcrypt as passlib_bcrypt
from config import settings
from typing import Dict, Any

class AuthService:
    def __init__(self):
        self.secret_key = settings.SECRET_KEY
        self.algorithm = settings.ALGORITHM
        self.access_token_expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        try:
            return passlib_bcrypt.verify(plain_password, hashed_password)
        except Exception:
            # Invalid hashes or backend issues should fail closed.
            return False

    def get_password_hash(self, password: str) -> str:
        return passlib_bcrypt.hash(password)

    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=15)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt

    def decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError:
            return None

auth_service = AuthService()
