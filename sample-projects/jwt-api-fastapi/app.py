from contextlib import asynccontextmanager

import uvicorn
from fastapi import Depends, FastAPI, HTTPException, status

from auth import ACCESS_TOKEN_EXPIRE_SECONDS, authenticate_user, create_access_token, get_current_user
from models import (
    HealthResponse,
    LoginRequest,
    MessageResponse,
    PrivateResponse,
    TokenResponse,
    UserResponse,
)
from typing import Any

PORT = 8000


@asynccontextmanager
async def lifespan(_app: FastAPI):
    print(f"JWT API started on port {PORT}")
    yield


app = FastAPI(title="JWT API", lifespan=lifespan)


@app.middleware("http")
async def log_requests(request, call_next):
    print(f"[{request.method}] {request.url.path}")
    return await call_next(request)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="UP")

@app.post("/echo", response_model=dict[str, Any])
def echo_endpoint(payload: dict[str, Any]):
    return payload

@app.get("/public", response_model=MessageResponse)
def public_endpoint() -> MessageResponse:
    return MessageResponse(message="public endpoint")


@app.post("/auth/login", response_model=TokenResponse)
def login(body: LoginRequest) -> TokenResponse:
    username = authenticate_user(body.username, body.password)
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    return TokenResponse(
        access_token=create_access_token(username),
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_SECONDS,
    )


@app.get("/auth/me", response_model=UserResponse)
def current_user(username: str = Depends(get_current_user)) -> UserResponse:
    return UserResponse(username=username)


@app.get("/private", response_model=PrivateResponse)
def private_endpoint(username: str = Depends(get_current_user)) -> PrivateResponse:
    return PrivateResponse(message="private endpoint", user=username)


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=PORT, reload=False)
