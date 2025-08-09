// js/DataManager.js
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, orderBy, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class DataManager {
    constructor(db) {
        this.db = db;
        this.traysUnsubscribe = null;
        this.usersUnsubscribe = null;
        this.facilities = [
            'Aurora Medical Center - Grafton',
            'Aurora Medical Center - Summit',
            'Children\'s Hospital of Wisconsin',
            'Columbia St. Mary\'s Hospital',
            'Froedtert Hospital',
            'Medical College of Wisconsin',
            'Milwaukee Regional Medical Center',
            'ProHealth Waukesha Memorial Hospital',
            'St. Joseph\'s Hospital',
            'University of Wisconsin Hospital'
        ];
        this.surgeons = [
            'Dr. Max Ots',
            'Dr. Branko Prpa',
            'Dr. Syed Mehdi',
            'Dr. Jennifer Smith',
            'Dr. Michael Johnson',
            'Dr. Sarah Williams'
        ];
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
        const usersQuery = query(collection(this.db, 'users'));
        this.usersUnsubscribe = onSnapshot(usersQuery, (snapshot) => {
            const users = new Map();
            snapshot.forEach((doc) => {
                users.set(doc.id, { id: doc.id, ...doc.data() });
            });

            this.users = users;
            if (window.app && window.app.viewManager) {
                window.app.viewManager.handleUsersUpdate(users);
            }
            if (window.app && window.app.userManager) {
                window.app.userManager.handleUsersUpdate(users);
            }
        });
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
        return this.surgeons;
    }

    getUsers() {
        return this.users || new Map();
    }

    cleanup() {
        if (this.traysUnsubscribe) {
            this.traysUnsubscribe();
        }
        if (this.usersUnsubscribe) {
            this.usersUnsubscribe();
        }
    }
}