# Implementation Plan: Manual SQLite DB Import

## Goal
Replace the online sync mechanism with a manual "File Import" workflow. The app will read a `grading.db` (SQLite) file copied by the user to the device, extract its data, and populate the local IndexedDB.

## User Review Required
> [!IMPORTANT]
> **Compilation Required**: After these changes, you must run `npm install` (to add `sql.js`) and then `npx cap sync` and build the APK in Android Studio. I cannot perform the compilation step for you.
> **File Access**: Reading directly from the "root" of Android (`/sdcard`) is restricted in modern Android. I will implement logic to look in `Documents/grading.db` and `Download/grading.db`. If that fails, I will add a "Select File" button so the user can pick it manually.

## Proposed Changes

### Frontend (Mobile)

#### [NEW] [sqliteImporter.js](file:///e:/GradingWepApp/GradingMobile/frontend/src/services/sqliteImporter.js)
- Implement a service that:
    - Uses `sql.js` (wasm) to open a SQLite database from a binary ArrayBuffer.
    - Queries all master data tables (`products`, `users`, `grades`, `defects`, `catalog_items`).
    - Formats the data into the JSON structure expected by `db.js`.
    - Calls `seedMasterData` to populate IndexedDB.

#### [MODIFY] [package.json](file:///e:/GradingWepApp/GradingMobile/frontend/package.json)
- Add `sql.js` dependency.

#### [MODIFY] [Login.jsx](file:///e:/GradingWepApp/GradingMobile/frontend/src/pages/Login.jsx)
- Remove "Offline Mode" toggle (checking credentials against API).
- Add "Import Database" button/logic.
- Change Login logic to *always* check local `idb` (`STORE_USERS`) for credentials (since we now import users from `.db`).

#### [MODIFY] [Setup.jsx](file:///e:/GradingWepApp/GradingMobile/frontend/src/pages/Setup.jsx)
- Add a step to "Load Database File" if `setup_completed` is false.

#### [MODIFY] [api.js](file:///e:/GradingWepApp/GradingMobile/frontend/src/api.js)
- Ensure API calls fallback to local DB or are disabled/mocked where appropriate, or verify the app uses `db.js` for offline work already.

## Verification Plan

### Manual Verification
1.  **Build**: Run `npm install`, then `npx cap sync`. Open `android` folder in Android Studio and Run 'app'.
2.  **Prepare**: Copy a valid `grading.db` from PC to the Android device's `Documents` folder.
3.  **Test Import**:
    - Open App.
    - If on Login/Setup screen, look for "Import DB" or "Load from File".
    - Select the file.
    - Verify "Import Successful" message.
4.  **Test Login**:
    - Try logging in with a user that exists in `grading.db`.
    - Should succeed without internet.
5.  **Test Usage**:
    - Start inspection.
    - Verify Products and Grades are loaded from the imported file.
