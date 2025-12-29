import sys
import os
sys.path.append(os.getcwd())
from database.database import SessionLocal
from database.models import Grade

def check_grades():
    db = SessionLocal()
    try:
        grades = db.query(Grade).all()
        print(f"Total Grades: {len(grades)}")
        for g in grades:
            print(f"ID: {g.id} Name: {g.name} Rank: {g.grade_rank}")
    except Exception as e:
        print(e)
    finally:
        db.close()

if __name__ == "__main__":
    check_grades()
