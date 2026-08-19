# Task: Switch Mobile to File-Based Database

- [ ] **Explore & Analyze** <!-- id: 0 -->
    - [ ] Locate Capacitor configuration and Android project folder <!-- id: 1 -->
    - [ ] Identify existing "Offline Mode" logic to remove <!-- id: 2 -->
    - [ ] Check installed Capacitor plugins (need filesystem/sqlite) <!-- id: 3 -->
- [ ] **Implementation Planning** <!-- id: 4 -->
    - [ ] Create implementation plan for DB import logic <!-- id: 5 -->
- [ ] **Code Changes** <!-- id: 6 -->
    - [ ] Remove "Offline Mode" toggle from Login/Setup <!-- id: 7 -->
    - [ ] Implement `importDatabaseFromFile` logic in `db.js` or context <!-- id: 8 -->
    - [ ] Update App initialization to check/load `grading.db` <!-- id: 9 -->
- [ ] **Verification** <!-- id: 10 -->
    - [ ] Attempt build/sync (if environment allows) <!-- id: 11 -->
