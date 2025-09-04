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
            const locations = new Map();
            snapshot.forEach((doc) => {
                locations.set(doc.id, { id: doc.id, ...doc.data() });
            });
            this.facilities = locations;
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

        const caseTypesQuery = query(collection(this.db, 'casetypes'), orderBy('name', 'asc'));
        this.caseTypesUnsubscribe = onSnapshot(caseTypesQuery, (snapshot) => {
            const caseTypes = [];
            snapshot.forEach((doc) => {
                const caseTypeData = doc.data();
                if (caseTypeData.active !== false) { // Only include active case types
                    caseTypes.push({ id: doc.id, ...caseTypeData });
                }
            });

            this.caseTypes = caseTypes;

            // Trigger re-render of surgeons if they're already loaded
            if (window.app.surgeonManager && window.app.surgeonManager.currentSurgeons && window.app.surgeonManager.currentSurgeons.length > 0) {
                console.log('Triggering surgeon re-render after case types loaded');
                setTimeout(() => {
                    window.app.surgeonManager.renderSurgeons(window.app.surgeonManager.currentSurgeons);
                }, 100);
            }

            console.log('Case types updated from Firebase:', this.caseTypes.length);
        }, (error) => {
            console.error('Error listening to case types:', error);
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
        return this.facilities;
    }

    getSurgeons() {
        // Return surgeons from Firebase instead of hardcoded array
        return this.surgeons || [];
    }

    getCaseTypes() {
        return this.caseTypes || [];
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