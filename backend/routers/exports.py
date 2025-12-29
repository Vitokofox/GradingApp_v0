from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import database, models
from routers.auth import get_current_active_user
import csv
import io
from datetime import datetime, date

router = APIRouter(
    prefix="/api/exports",
    tags=["Exports"],
)

def generate_csv(data, headers, row_mapper):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    for item in data:
        writer.writerow(row_mapper(item))
    output.seek(0)
    return output

@router.get("/inspections/csv")
def export_inspections_csv(
    start_date: str = None, 
    end_date: str = None, 
    type: str = None, 
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Inspection)
    
    if start_date:
        query = query.filter(models.Inspection.date >= start_date)
    if end_date:
        query = query.filter(models.Inspection.date <= end_date)
    if type and type != 'all':
        query = query.filter(models.Inspection.type == type)
        
    inspections = query.all()
    
    headers = ["ID", "Fecha", "Tipo", "Turno", "Supervisor", "Producto", "Lote", "Piezas", "Estado", "Responsable"]
    
    def mapper(i):
        # Traducir tipos
        t_map = {
            "finished_product": "Producto Terminado",
            "line_grading": "Clasificación en Linea",
            "rejection_typing": "Tipificación Rechazo"
        }
        t_nice = t_map.get(i.type, i.type)
        return [i.id, i.date, t_nice, i.shift, i.supervisor, i.product_name, i.lot, i.pieces_inspected, i.state, i.responsible]

    # Generador para respuesta en streaming
    def iter_csv():
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        
        for i in inspections:
            writer.writerow(mapper(i))
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    filename = f"inspecciones_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        iter_csv(), 
        media_type="text/csv", 
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/template/csv")
def get_bulk_template():
    # Plantilla de ejemplo para Productos/Grados
    headers = ["category", "name", "active"]
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerow(["area", "Ejemplo Area", "true"])
    writer.writerow(["machine", "Ejemplo Maquina", "true"])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=plantilla_carga_masiva.csv"}
    )
