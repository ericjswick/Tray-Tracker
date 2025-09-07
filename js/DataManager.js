// js/DataManager.js
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, orderBy, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class DataManager {
    constructor(db) {
        this.db = db;
        this.traysUnsubscribe = null;
        this.usersUnsubscribe = null;
        this.facilityUnsubscribe = null;
        this.surgeonsUnsubscribe = null; // NEW: Add surgeons unsubscribe
        this.caseTypesUnsubscribe = null;
        this.facilities = [];
        this.surgeons = [];
        this.caseTypes = [];
    }

    initializeData() {
        this.setupRealtimeListeners();
    }

    setupRealtimeListeners() {
        if (!this.db) return;

        // Listen to trays collection
        const traysQuery = query(collection(this.db, 'trays'), orderBy('createdAt', 'desc'));
        this.traysUnsubscribe = onSnapshot(traysQuery, (snapshot) => {
            const trays = [];
            snapshot.forEach((doc) => {
                trays.push({ id: doc.id, ...doc.data() });
            });

            if (window.app && window.app.trayManager) {
                window.app.trayManager.handleTraysUpdate(trays);
            }
        }, (error) => {
            console.error('Error listening to trays:', error);
        });

        // Listen to users collection
        console.log('Setting up users listener...');
        const usersQuery = query(collection(this.db, 'users'));
        this.usersUnsubscribe = onSnapshot(usersQuery, (snapshot) => {
            console.log('Users snapshot received, size:', snapshot.size);

            const users = new Map();
            let userCount = 0;

            snapshot.forEach((doc) => {
                const userData = { id: doc.id, ...doc.data() };
                users.set(doc.id, userData);
                userCount++;
                console.log(`User ${userCount}:`, doc.id, userData.name || userData.email || 'No name');
            });

            const previousUserCount = this.users ? this.users.size : 0;
            this.users = users;
            console.log('DataManager: Users map updated with', users.size, 'users');

            // Notify all components that need user data
            if (window.app && window.app.viewManager) {
                window.app.viewManager.handleUsersUpdate(users);
            }
            if (window.app && window.app.userManager) {
                window.app.userManager.handleUsersUpdate(users);
            }

            // If users were just loaded (went from 0 to some), trigger re-renders
            if (previousUserCount === 0 && users.size > 0) {
                console.log('Users loaded for first time, triggering re-renders...');
                this.triggerUserNameUpdates();
            }
        }, (error) => {
            console.error('Error listening to users:', error);
        });

        // Listen to Location collection
        const facilityQuery = query(collection(this.db, 'locations'));
        this.facilityUnsubscribe = onSnapshot(facilityQuery, (snapshot) => {
            const facilities = [];
            snapshot.forEach((doc) => {
                const facilityData = doc.data();
                if (facilityData.active !== false) { // Only include active facilities
                    facilities.push({ id: doc.id, ...facilityData });
                }
            });
            this.facilities = facilities;
            console.log('Facilities updated from Firebase:', this.facilities.length);
        }, (error) => {
            console.error('Error listening to facilities:', error);
        });

        // Listen to surgeons collection
        const surgeonsQuery = query(collection(this.db, 'surgeons'), orderBy('name', 'asc'));
        this.surgeonsUnsubscribe = onSnapshot(surgeonsQuery, (snapshot) => {
            const surgeons = [];
            snapshot.forEach((doc) => {
                const surgeonData = doc.data();
                if (surgeonData.active !== false) { // Only include active surgeons
                    surgeons.push({ id: doc.id, ...surgeonData });
                }
            });

            this.surgeons = surgeons;
            console.log('Surgeons updated from Firebase:', this.surgeons.length);
        }, (error) => {
            console.error('Error listening to surgeons:', error);
        });

        console.log('Setting up case types listener...');
        if (window.frontendLogger) {
            window.frontendLogger.logFirebaseEvent('Setting up case types listener', { collection: 'casetypes' });
        }
        
        const caseTypesQuery = query(collection(this.db, 'casetypes'), orderBy('name', 'asc'));
        this.caseTypesUnsubscribe = onSnapshot(caseTypesQuery, (snapshot) => {
            console.log('Case types snapshot received, size:', snapshot.size);
            
            if (window.frontendLogger) {
                window.frontendLogger.logFirebaseEvent('Case types snapshot received', { 
                    snapshotSize: snapshot.size,
                    isEmpty: snapshot.empty
                });
            }
            
            const caseTypes = [];
            snapshot.forEach((doc) => {
                const caseTypeData = doc.data();
                console.log(`Case type found: ${caseTypeData.name || 'Unknown'}, active: ${caseTypeData.active}`);
                
                if (window.frontendLogger) {
                    window.frontendLogger.debug('Processing case type document', {
                        id: doc.id,
                        name: caseTypeData.name,
                        active: caseTypeData.active,
                        hasData: !!caseTypeData
                    }, 'case-types');
                }
                
                if (caseTypeData.active !== false) { // Only include active case types
                    caseTypes.push({ id: doc.id, ...caseTypeData });
                }
            });

            this.caseTypes = caseTypes;
            console.log('✅ Case types updated from Firebase:', this.caseTypes.length);
            
            if (window.frontendLogger) {
                window.frontendLogger.logDataManagerEvent('Case types updated', {
                    totalCount: this.caseTypes.length,
                    caseTypeNames: this.caseTypes.map(ct => ct.name),
                    snapshotSize: snapshot.size
                });
            }

            // Trigger re-render of surgeons if they're already loaded
            if (window.app.surgeonManager && window.app.surgeonManager.currentSurgeons && window.app.surgeonManager.currentSurgeons.length > 0) {
                console.log('Triggering surgeon re-render after case types loaded');
                setTimeout(() => {
                    window.app.surgeonManager.renderSurgeons(window.app.surgeonManager.currentSurgeons);
                }, 100);
            }

        }, (error) => {
            console.error('❌ Error listening to case types:', error);
            console.error('Error details:', error.code, error.message);
        });
    }

    triggerUserNameUpdates() {
        // Wait a moment for all components to be ready, then trigger updates
        setTimeout(() => {
            // Update trays view if it has data
            if (window.app.trayManager && window.app.trayManager.currentTrays && window.app.trayManager.currentTrays.length > 0) {
                console.log('Re-rendering trays with updated user names');
                window.app.trayManager.renderTrays(window.app.trayManager.currentTrays);
            }

            // Update dashboard if it's the current view
            if (window.app.viewManager && window.app.viewManager.currentView === 'dashboard') {
                console.log('Re-rendering dashboard with updated user names');
                if (window.app.trayManager && window.app.trayManager.currentTrays) {
                    window.app.viewManager.renderDashboardTrays(window.app.trayManager.currentTrays);
                }
            }

            // Update team view if it's the current view
            if (window.app.viewManager && window.app.viewManager.currentView === 'team') {
                console.log('Re-rendering team view with updated user names');
                window.app.viewManager.renderTeamMembers(this.users);
            }
        }, 500);
    }

    async saveTray(tray) {
        try {
            const trayData = {
                ...tray,
                lastModified: serverTimestamp(),
                modifiedBy: window.app.authManager.getCurrentUser()?.uid
            };

            if (tray.id) {
                await updateDoc(doc(this.db, 'trays', tray.id), trayData);
            } else {
                trayData.createdAt = serverTimestamp();
                trayData.createdBy = window.app.authManager.getCurrentUser()?.uid;
                const docRef = await addDoc(collection(this.db, 'trays'), trayData);
                tray.id = docRef.id;
            }

            return tray;
        } catch (error) {
            console.error('Error saving tray:', error);
            throw error;
        }
    }

    async getTray(id) {
        try {
            const trayDoc = await getDoc(doc(this.db, 'trays', id));
            return trayDoc.exists() ? { id: trayDoc.id, ...trayDoc.data() } : null;
        } catch (error) {
            console.error('Error getting tray:', error);
            return null;
        }
    }

    async getAllTrays() {
        try {
            const traysSnapshot = await getDocs(collection(this.db, 'trays'));
            const trays = [];
            traysSnapshot.forEach((doc) => {
                trays.push({ id: doc.id, ...doc.data() });
            });
            return trays;
        } catch (error) {
            console.error('Error getting all trays:', error);
            return [];
        }
    }

    async updateTray(id, updates) {
        try {
            const updateData = {
                ...updates,
                lastModified: serverTimestamp(),
                modifiedBy: window.app.authManager.getCurrentUser()?.uid
            };

            await updateDoc(doc(this.db, 'trays', id), updateData);
            return true;
        } catch (error) {
            console.error('Error updating tray:', error);
            throw error;
        }
    }

    async deleteTray(id) {
        try {
            await deleteDoc(doc(this.db, 'trays', id));
            return true;
        } catch (error) {
            console.error('Error deleting tray:', error);
            throw error;
        }
    }

    async addHistoryEntry(trayId, action, details, photoUrl = null) {
        try {
            const historyEntry = {
                timestamp: serverTimestamp(),
                action,
                details,
                user: window.app.authManager.getCurrentUser()?.name || 'Unknown',
                userId: window.app.authManager.getCurrentUser()?.uid,
                photoUrl
            };

            await addDoc(collection(this.db, 'trays', trayId, 'history'), historyEntry);
        } catch (error) {
            console.error('Error adding history entry:', error);
        }
    }

    async getTrayHistory(trayId) {
        try {
            const historyQuery = query(
                collection(this.db, 'trays', trayId, 'history'),
                orderBy('timestamp', 'desc')
            );
            const snapshot = await getDocs(historyQuery);
            const history = [];
            snapshot.forEach((doc) => {
                history.push({ id: doc.id, ...doc.data() });
            });
            return history;
        } catch (error) {
            console.error('Error getting tray history:', error);
            return [];
        }
    }

    getFacilities() {
        return this.facilities || [];
    }

    getSurgeons() {
        // Return surgeons from Firebase instead of hardcoded array
        return this.surgeons || [];
    }

    getCaseTypes() {
        const caseTypes = this.caseTypes || [];
        
        if (window.frontendLogger) {
            window.frontendLogger.debug('getCaseTypes() called', {
                count: caseTypes.length,
                isArray: Array.isArray(caseTypes),
                caseTypeNames: caseTypes.map(ct => ct.name || 'Unnamed')
            }, 'case-types');
            
            // Test log to confirm updated JS is loaded
            window.frontendLogger.info('Updated JavaScript loaded with tray requirements debugging', {
                timestamp: new Date().toISOString(),
                testMessage: 'This confirms the updated JS files are being served'
            }, 'js-update-test');
        }
        
        return caseTypes;
    }

    // ==================== CASES CRUD OPERATIONS ====================
    
    async saveCase(caseData) {
        try {
            // Log detailed Firebase operation info
            if (window.frontendLogger) {
                window.frontendLogger.debug('Starting saveCase operation', {
                    hasData: !!caseData,
                    isUpdate: !!caseData.id,
                    userId: window.app.authManager.getCurrentUser()?.uid,
                    userEmail: window.app.authManager.getCurrentUser()?.email,
                    dataKeys: Object.keys(caseData || {}),
                    firebaseConnected: !!this.db
                }, 'firebase-case-save');
            }

            const currentUser = window.app.authManager.getCurrentUser();
            if (!currentUser) {
                const error = new Error('User not authenticated');
                if (window.frontendLogger) {
                    window.frontendLogger.error('saveCase failed - no user', { error: error.message }, 'firebase-case-save');
                }
                throw error;
            }

            const caseDataWithTimestamp = {
                ...caseData,
                lastModified: serverTimestamp(),
                modifiedBy: currentUser.uid
            };

            if (window.frontendLogger) {
                window.frontendLogger.debug('Prepared case data for Firebase', {
                    hasTimestamp: !!caseDataWithTimestamp.lastModified,
                    modifiedBy: caseDataWithTimestamp.modifiedBy,
                    dataSize: JSON.stringify(caseDataWithTimestamp).length
                }, 'firebase-case-save');
            }

            if (caseData.id) {
                if (window.frontendLogger) {
                    window.frontendLogger.debug('Updating existing case', { caseId: caseData.id }, 'firebase-case-save');
                }
                await updateDoc(doc(this.db, 'cases', caseData.id), caseDataWithTimestamp);
            } else {
                if (window.frontendLogger) {
                    window.frontendLogger.debug('Creating new case document', {}, 'firebase-case-save');
                }
                caseDataWithTimestamp.createdAt = serverTimestamp();
                caseDataWithTimestamp.createdBy = currentUser.uid;
                
                try {
                    const docRef = await addDoc(collection(this.db, 'cases'), caseDataWithTimestamp);
                    caseData.id = docRef.id;
                    
                    if (window.frontendLogger) {
                        window.frontendLogger.info('Successfully created case', {
                            caseId: docRef.id,
                            collection: 'cases'
                        }, 'firebase-case-save');
                    }
                } catch (addDocError) {
                    if (window.frontendLogger) {
                        window.frontendLogger.error('addDoc failed for cases collection', {
                            error: addDocError.message,
                            code: addDocError.code,
                            stack: addDocError.stack,
                            collectionPath: 'cases'
                        }, 'firebase-case-save');
                    }
                    throw addDocError;
                }
            }

            if (window.frontendLogger) {
                window.frontendLogger.info('saveCase completed successfully', {
                    caseId: caseData.id,
                    wasUpdate: !!caseData.id
                }, 'firebase-case-save');
            }

            return caseData;
        } catch (error) {
            console.error('Error saving case:', error);
            if (window.frontendLogger) {
                window.frontendLogger.error('saveCase operation failed', {
                    error: error.message,
                    code: error.code,
                    stack: error.stack,
                    userId: window.app.authManager.getCurrentUser()?.uid
                }, 'firebase-case-save');
            }
            throw error;
        }
    }

    async getCase(id) {
        try {
            if (window.frontendLogger) {
                window.frontendLogger.info('DataManager.getCase() called', { caseId: id }, 'case-retrieval');
            }
            
            const caseDoc = await getDoc(doc(this.db, 'cases', id));
            
            if (caseDoc.exists()) {
                const caseData = { id: caseDoc.id, ...caseDoc.data() };
                
                if (window.frontendLogger) {
                    window.frontendLogger.info('Case data retrieved from Firestore', {
                        caseId: id,
                        patientName: caseData.patientName,
                        hasData: !!caseData
                    }, 'case-retrieval');
                    
                    // Log tray requirements specifically
                    window.frontendLogger.info('Tray requirements analysis', {
                        caseId: id,
                        tray_requirements: caseData.tray_requirements,
                        trayRequirements: caseData.trayRequirements,
                        tray_requirements_type: typeof caseData.tray_requirements,
                        tray_requirements_length: caseData.tray_requirements?.length,
                        trayRequirements_type: typeof caseData.trayRequirements,
                        trayRequirements_length: caseData.trayRequirements?.length,
                        hasEitherField: !!(caseData.tray_requirements || caseData.trayRequirements)
                    }, 'tray-requirements-debug');
                }
                
                return caseData;
            } else {
                if (window.frontendLogger) {
                    window.frontendLogger.warn('No case found', { caseId: id }, 'case-retrieval');
                }
                return null;
            }
        } catch (error) {
            console.error('Error getting case:', error);
            if (window.frontendLogger) {
                window.frontendLogger.error('Error getting case', { 
                    caseId: id, 
                    error: error.message 
                }, 'case-retrieval');
            }
            return null;
        }
    }

    async getAllCases() {
        try {
            const casesSnapshot = await getDocs(collection(this.db, 'cases'));
            const cases = [];
            casesSnapshot.forEach((doc) => {
                cases.push({ id: doc.id, ...doc.data() });
            });
            return cases;
        } catch (error) {
            console.error('Error getting all cases:', error);
            return [];
        }
    }

    async updateCase(id, updates) {
        try {
            const updateData = {
                ...updates,
                lastModified: serverTimestamp(),
                modifiedBy: window.app.authManager.getCurrentUser()?.uid
            };

            await updateDoc(doc(this.db, 'cases', id), updateData);
            return true;
        } catch (error) {
            console.error('Error updating case:', error);
            throw error;
        }
    }

    async deleteCase(id) {
        try {
            await deleteDoc(doc(this.db, 'cases', id));
            return true;
        } catch (error) {
            console.error('Error deleting case:', error);
            throw error;
        }
    }

    async getCasesByDateRange(startDate, endDate) {
        try {
            const casesQuery = query(
                collection(this.db, 'cases'),
                orderBy('scheduledDate', 'asc')
            );
            const snapshot = await getDocs(casesQuery);
            const cases = [];
            
            snapshot.forEach((doc) => {
                const caseData = { id: doc.id, ...doc.data() };
                const caseDate = new Date(caseData.scheduledDate);
                if (caseDate >= startDate && caseDate <= endDate) {
                    cases.push(caseData);
                }
            });
            
            return cases;
        } catch (error) {
            console.error('Error getting cases by date range:', error);
            return [];
        }
    }

    async getCasesBySurgeon(surgeonId) {
        try {
            const casesQuery = query(
                collection(this.db, 'cases'),
                orderBy('scheduledDate', 'desc')
            );
            const snapshot = await getDocs(casesQuery);
            const cases = [];
            
            snapshot.forEach((doc) => {
                const caseData = { id: doc.id, ...doc.data() };
                if (caseData.surgeonId === surgeonId) {
                    cases.push(caseData);
                }
            });
            
            return cases;
        } catch (error) {
            console.error('Error getting cases by surgeon:', error);
            return [];
        }
    }

    async getCasesByFacility(facilityId) {
        try {
            const casesQuery = query(
                collection(this.db, 'cases'),
                orderBy('scheduledDate', 'desc')
            );
            const snapshot = await getDocs(casesQuery);
            const cases = [];
            
            snapshot.forEach((doc) => {
                const caseData = { id: doc.id, ...doc.data() };
                if (caseData.facilityId === facilityId) {
                    cases.push(caseData);
                }
            });
            
            return cases;
        } catch (error) {
            console.error('Error getting cases by facility:', error);
            return [];
        }
    }


    getUsers() {
        console.log('DataManager.getUsers() called');
        console.log('this.users exists:', !!this.users);
        console.log('this.users size:', this.users ? this.users.size : 'N/A');

        if (!this.users) {
            console.log('Creating new empty users Map');
            this.users = new Map();
        }

        return this.users;
    }

    cleanup() {
        if (this.traysUnsubscribe) {
            this.traysUnsubscribe();
        }
        if (this.usersUnsubscribe) {
            this.usersUnsubscribe();
        }
        if (this.facilityUnsubscribe) {
            this.facilityUnsubscribe();
        }
        if (this.surgeonsUnsubscribe) {
            this.surgeonsUnsubscribe();
        }
        if (this.caseTypesUnsubscribe) {
            this.caseTypesUnsubscribe();
        }
    }
}