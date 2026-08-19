import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Adjust path to include the current directory so we can import backend
sys.path.append(os.getcwd())

try:
    from backend.database.models import Inspection
    from backend.database.database import Base
    
    # Create an in-memory DB to test mapping
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    
    print("Models imported and tables created successfully.")
    
    # Check if 'rejection_typing' is in the polymorphic map
    poly_map = Inspection.__mapper__.polymorphic_map
    if 'rejection_typing' in poly_map:
        print("SUCCESS: 'rejection_typing' is correctly registered in polymorphic_map.")
    else:
        print("FAILURE: 'rejection_typing' NOT found in polymorphic_map.")
        print(f"Available keys: {list(poly_map.keys())}")

except Exception as e:
    print(f"An error occurred: {e}")
    import traceback
    traceback.print_exc()
