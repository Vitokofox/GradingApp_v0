from sqlalchemy.orm import Session
from database import database, models

db = database.SessionLocal()
items = db.query(models.CatalogItem).all()
print(f"Total Items: {len(items)}")
for i in items:
    print(f"ID: {i.id}, Name: {i.name}, Category: {i.category}, Active: {i.active}")

print("\n--- Categories Found ---")
cats = set([i.category for i in items])
print(cats)
