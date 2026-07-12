import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.database import database, models
from backend.routers.reports import get_global_stats

def test_query():
    db = next(database.get_db())
    try:
        # Call get_global_stats with no filters first
        res = get_global_stats(db=db)
        print("Success! Return keys:", res.keys())
        print("Total inspections:", res["total_inspections"])
        print("Trend data count:", len(res["trend_data"]))
        if res["trend_data"]:
            print("First trend item:", res["trend_data"][0])
            
        # Try distinct thickness values if any
        thicknesses = [row[0] for row in db.query(models.Inspection.thickness).distinct().all() if row[0]]
        print("Distinct thicknesses in DB:", thicknesses)
        
        if thicknesses:
            # Test with a thickness filter
            t_filter = thicknesses[0]
            res_filtered = get_global_stats(thickness=t_filter, db=db)
            print(f"Filtered by thickness {t_filter} total inspections:", res_filtered["total_inspections"])
            print(f"Filtered by thickness {t_filter} trend count:", len(res_filtered["trend_data"]))

        # Try distinct area values if any
        areas = [row[0] for row in db.query(models.Inspection.area).distinct().all() if row[0]]
        print("Distinct areas in DB:", areas)
        if areas:
            a_filter = areas[0]
            res_filtered_area = get_global_stats(area=a_filter, db=db)
            print(f"Filtered by area {a_filter} total inspections:", res_filtered_area["total_inspections"])

        # Try distinct machine values if any
        machines = [row[0] for row in db.query(models.Inspection.machine).distinct().all() if row[0]]
        print("Distinct machines in DB:", machines)
        if machines:
            m_filter = machines[0]
            res_filtered_machine = get_global_stats(machine=m_filter, db=db)
            print(f"Filtered by machine {m_filter} total inspections:", res_filtered_machine["total_inspections"])
            
    except Exception as e:
        print(f"Query failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_query()
