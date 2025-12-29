from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import models, database
from routers import registry, auth, users, master_data, scanner

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Grading App Backend")

# CORS setup (Allow all for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(registry.router)
app.include_router(master_data.router)
app.include_router(scanner.router)

@app.get("/")
def read_root():
    return {"message": "Grading App API is running"}
