from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class HealthResponse(BaseModel):
    status: str


class MessageResponse(BaseModel):
    message: str


class UserResponse(BaseModel):
    username: str


class PrivateResponse(BaseModel):
    message: str
    user: str


class ErrorResponse(BaseModel):
    detail: str
