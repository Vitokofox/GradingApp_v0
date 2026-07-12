from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from database import database, models
from routers.auth import get_current_active_user
import csv
import io
from datetime import datetime, date

router = APIRouter(
    prefix="/api/exports",
    tags=["Exports"],
)

def sanitize_string(s) -> str:
    if s is None:
        return ""
    s_str = str(s)
    replacements = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'ñ': 'n', 'Ñ': 'N',
        'ü': 'u', 'Ü': 'U'
    }
    for orig, rep in replacements.items():
        s_str = s_str.replace(orig, rep)
    return s_str

class SanitizedCSVWriter:
    def __init__(self, output_file):
        self.writer = csv.writer(output_file)
        
    def writerow(self, row):
        sanitized = [sanitize_string(cell) for cell in row]
        self.writer.writerow(sanitized)
        
    def writerows(self, rows):
        for row in rows:
            self.writerow(row)

def generate_csv(data, headers, row_mapper):
    output = io.StringIO()
    writer = SanitizedCSVWriter(output)
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
    inspection_type: str = None,
    market_id: int = None,
    product_name: str = None,
    origin: str = None,
    thickness: str = None,
    process: str = None,
    area: str = None,
    machine: str = None,
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Inspection).options(joinedload(models.Inspection.market))
    
    if start_date:
        query = query.filter(models.Inspection.date >= start_date)
    if end_date:
        query = query.filter(models.Inspection.date <= end_date)
    
    req_type = type or inspection_type
    if req_type and req_type != 'all':
        query = query.filter(models.Inspection.type == req_type)
    if market_id:
        query = query.filter(models.Inspection.market_id == market_id)
    if product_name and product_name != 'all':
        query = query.filter(models.Inspection.product_name == product_name)
    if origin and origin != 'all':
        query = query.filter(models.Inspection.origin == origin)
    if thickness and thickness != 'all':
        query = query.filter(models.Inspection.thickness == thickness)
    if process and process != 'all':
        query = query.filter(models.Inspection.process == process)
    if area and area != 'all':
        query = query.filter(models.Inspection.area == area)
    if machine and machine != 'all':
        query = query.filter(models.Inspection.machine == machine)
        
    inspections = query.all()
    
    headers = ["ID", "Fecha", "Tipo", "Turno", "Supervisor", "Producto", "Lote", "Mercado", "Origen", "Espesor", "Proceso", "Area", "Maquina", "Piezas", "Estado", "Responsable"]
    
    def mapper(i):
        # Traducir tipos
        t_map = {
            "finished_product": "Producto Terminado",
            "line_grading": "Clasificación en Linea",
            "rejection_typing": "Tipificación Rechazo"
        }
        t_nice = t_map.get(i.type, i.type)
        market_name = i.market.name if i.market else "N/A"
        return [
            i.id, i.date, t_nice, i.shift, i.supervisor, 
            i.product_name, i.lot, market_name, i.origin, i.thickness, i.process or "N/A",
            i.area or "N/A", i.machine or "N/A",
            i.pieces_inspected, i.state, i.responsible
        ]

    # Generador para respuesta en streaming
    def iter_csv():
        output = io.StringIO()
        writer = SanitizedCSVWriter(output)
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

@router.get("/inspections/details/csv")
def export_inspection_details_csv(
    start_date: str = None, 
    end_date: str = None, 
    type: str = None, 
    inspection_type: str = None,
    market_id: int = None,
    product_name: str = None,
    origin: str = None,
    thickness: str = None,
    process: str = None,
    area: str = None,
    machine: str = None,
    db: Session = Depends(database.get_db)
):
    query = db.query(models.InspectionResult).join(models.Inspection).options(
        joinedload(models.InspectionResult.inspection).joinedload(models.Inspection.market),
        joinedload(models.InspectionResult.grade),
        joinedload(models.InspectionResult.defect)
    )
    
    if start_date:
        query = query.filter(models.Inspection.date >= start_date)
    if end_date:
        query = query.filter(models.Inspection.date <= end_date)
        
    req_type = type or inspection_type
    if req_type and req_type != 'all':
        query = query.filter(models.Inspection.type == req_type)
    if market_id:
        query = query.filter(models.Inspection.market_id == market_id)
    if product_name and product_name != 'all':
        query = query.filter(models.Inspection.product_name == product_name)
    if origin and origin != 'all':
        query = query.filter(models.Inspection.origin == origin)
    if thickness and thickness != 'all':
        query = query.filter(models.Inspection.thickness == thickness)
    if process and process != 'all':
        query = query.filter(models.Inspection.process == process)
    if area and area != 'all':
        query = query.filter(models.Inspection.area == area)
    if machine and machine != 'all':
        query = query.filter(models.Inspection.machine == machine)
        
    results = query.all()
    
    headers = ["ID Inspección", "Fecha", "Tipo", "Turno", "Supervisor", "Producto", "Lote", "Mercado", "Origen", "Espesor", "Proceso", "Area", "Maquina", "Grado", "Defecto", "Piezas", "Responsable"]
    
    def mapper(r):
        i = r.inspection
        grade_name = r.grade.name if r.grade else "N/A"
        defect_name = r.defect.name if r.defect else "Sin Defecto"
        
        t_map = {
            "finished_product": "Producto Terminado",
            "line_grading": "Clasificación en Linea",
            "rejection_typing": "Tipificación Rechazo"
        }
        t_nice = t_map.get(i.type, i.type)
        market_name = i.market.name if i.market else "N/A"
        
        return [
            i.id, i.date, t_nice, i.shift, i.supervisor, 
            i.product_name, i.lot, market_name, i.origin, i.thickness, i.process or "N/A",
            i.area or "N/A", i.machine or "N/A",
            grade_name, defect_name, r.pieces_count, 
            i.responsible
        ]

    def iter_csv():
        output = io.StringIO()
        writer = SanitizedCSVWriter(output)
        writer.writerow(headers)
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        
        for r in results:
            writer.writerow(mapper(r))
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    filename = f"detalle_inspecciones_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        iter_csv(), 
        media_type="text/csv", 
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/master-data/{category}/csv")
def export_master_data_csv(category: str, db: Session = Depends(database.get_db)):
    output = io.StringIO()
    writer = SanitizedCSVWriter(output)
    
    filename = f"maestro_{category}_{datetime.now().strftime('%Y%m%d')}.csv"
    
    if category == "products":
        headers = ["ID", "Nombre"]
        writer.writerow(headers)
        items = db.query(models.Product).all()
        for i in items:
            writer.writerow([i.id, i.name])
            
    elif category == "defects":
        headers = ["ID", "Nombre", "Descripción"]
        writer.writerow(headers)
        items = db.query(models.Defect).all()
        for i in items:
            writer.writerow([i.id, i.name, i.description])
            
    elif category == "grades":
        headers = ["ID", "Producto", "Nombre", "Rango"]
        writer.writerow(headers)
        items = db.query(models.Grade).all()
        for i in items:
            p_name = i.product.name if i.product else "N/A"
            writer.writerow([i.id, p_name, i.name, i.grade_rank])
            
    else:
        # Generic CatalogItems
        headers = ["ID", "Categoría", "Nombre", "Activo"]
        writer.writerow(headers)
        items = db.query(models.CatalogItem).filter(models.CatalogItem.category == category).all()
        for i in items:
            writer.writerow([i.id, i.category, i.name, i.active])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/template/csv")
def get_bulk_template():
    # Plantilla de ejemplo para Productos/Grados
    headers = ["category", "name", "active"]
    output = io.StringIO()
    writer = SanitizedCSVWriter(output)
    writer.writerow(headers)
    writer.writerow(["area", "Ejemplo Area", "true"])
    writer.writerow(["machine", "Ejemplo Maquina", "true"])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=plantilla_carga_masiva.csv"}
    )

@router.get("/truck-studies/csv")
def export_truck_studies_csv(
    start_date: date = None, 
    end_date: date = None, 
    db: Session = Depends(database.get_db)
):
    query = db.query(models.TruckStudy)
    
    if start_date:
        query = query.filter(models.TruckStudy.reception_date >= start_date)
    if end_date:
        query = query.filter(models.TruckStudy.reception_date <= end_date)
        
    studies = query.options(joinedload(models.TruckStudy.defects)).all()
    
    headers = [
        "ID Estudio", "Fecha Recepción", "Fecha Corte", "N° Guía", 
        "Predio", "Equipo Maderero", "Total Trozos", 
        "Característica/Defecto", "Cant. Trozos c/ Defecto", 
        "Responsable", "Fecha Registro"
    ]
    
    def iter_csv():
        output = io.StringIO()
        writer = SanitizedCSVWriter(output)
        writer.writerow(headers)
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        
        for s in studies:
            # If a study has no defects (unlikely now with auto-sin-defecto), we still want to show the study info
            if not s.defects:
                writer.writerow([
                    s.id, s.reception_date, s.cutting_date, s.guide_number, 
                    s.estate, s.logging_team, s.total_logs,
                    "N/A", 0, 
                    s.responsible, s.timestamp
                ])
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)
            else:
                for d in s.defects:
                    writer.writerow([
                        s.id, s.reception_date, s.cutting_date, s.guide_number, 
                        s.estate, s.logging_team, s.total_logs,
                        d.defect_name, d.count,
                        s.responsible, s.timestamp
                    ])
                    yield output.getvalue()
                    output.seek(0)
                    output.truncate(0)

    filename = f"estudios_camion_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        iter_csv(), 
        media_type="text/csv", 
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
