from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from config import settings
from typing import Dict, Any

class AuthService:
    def __init__(self):
        self.secret_key = settings.SECRET_KEY
        self.algorithm = settings.ALGORITHM
        self.access_token_expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        # bcrypt.checkpw requires bytes
        if isinstance(hashed_password, str):
            hashed_password = hashed_password.encode('utf-8')
        if isinstance(plain_password, str):
            plain_password = plain_password.encode('utf-8')
            
        try:
            return bcrypt.checkpw(plain_password, hashed_password)
        except ValueError:
            # Handle cases where hash might be invalid or other bcrypt errors
            return False

    def get_password_hash(self, password: str) -> str:
        # bcrypt.hashpw requires bytes and returns bytes
        if isinstance(password, str):
            password = password.encode('utf-8')
        
        # Generate salt and hash
        hashed = bcrypt.hashpw(password, bcrypt.gensalt())
        return hashed.decode('utf-8')

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
