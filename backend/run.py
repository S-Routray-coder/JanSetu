#!/usr/bin/env python3
import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import uvicorn
from app.core.database import Base, engine
from app.db.seed import seed_database

if __name__ == "__main__":
    print("Initializing JanSetu Backend...")
    Base.metadata.create_all(bind=engine)
    seed_database()
    print("\nStarting JanSetu API Server on http://127.0.0.1:8000")
    print("Interactive Swagger Documentation: http://127.0.0.1:8000/docs\n")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
