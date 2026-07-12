# Mobile App "Offline File" Walkthrough

## 1. Installation
The application has been successfully compiled. You can find the APK at:
`e:\GradingWepApp\GradingMobile\frontend\android\app\build\outputs\apk\debug\app-debug.apk`

1.  Transfer this file to your Android device via USB or download.
2.  Install the APK (Allow installation from unknown sources if prompted).

## 2. Setting Up Data (Offline)
This version does **not** sync with the server automatically. It requires a manual database file.

1.  **Export on PC**: Locate your PC's `grading.db` file (usually in `backend/database/grading.db`).
2.  **Transfer to Mobile**: Copy this file to your mobile device.
    - Recommended location: `Downloads` or `Documents` folder.
3.  **Import in App**:
    - Open the App.
    - On the Login or Setup screen, tap **"Cargar grading.db"** (Load database).
    - Select the file you copied.
    - Wait for the "Import Successful" message.

## 3. Usage
- **Login**: Use the same username/password as on the PC (e.g. `admin` / `admin`).
- **Inspection**: The app will load Products, Grades, and Defects from the file you imported.
- **Saving**: Inspections are saved locally on the device.
    - *Note*: Currently, there is no automated way to get data *back* to the PC in this mode without implementing a "Export JSON" feature on the mobile side (future enhancement).

## Troubleshooting
- **Import Failed**: Ensure the file is a valid SQLite `grading.db` and not empty.
- **Login Error**: Verify you imported the DB *before* trying to log in.
