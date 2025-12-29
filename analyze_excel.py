import pandas as pd
import zipfile
import os

filename = "estudio escaner.xlsx"


output_file = "analysis_result_utf8.txt"
with open(output_file, "w", encoding="utf-8") as f:
    f.write(f"Analyzing {filename}...\n\n")

    # Check for Macros
    try:
        with zipfile.ZipFile(filename, 'r') as z:
            if 'xl/vbaProject.bin' in z.namelist():
                f.write("[INFO] Macros found (xl/vbaProject.bin exists).\n")
            else:
                f.write("[INFO] No Macros found.\n")
    except Exception as e:
        f.write(f"[ERROR] Could not check zip structure: {e}\n")

    f.write("-" * 30 + "\n")

    # Read Data
    try:
        xl = pd.ExcelFile(filename, engine='openpyxl')
        f.write(f"Sheets found: {xl.sheet_names}\n")
        
        for sheet in xl.sheet_names:
            f.write(f"\n--- Sheet: {sheet} ---\n")
            df = xl.parse(sheet, nrows=50)
            f.write(df.to_string() + "\n")
    except Exception as e:
        f.write(f"[ERROR] Could not read excel data: {e}\n")
print(f"Analysis written to {output_file}")

