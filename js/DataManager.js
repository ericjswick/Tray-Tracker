// js/DataManager.js
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, orderBy, addDoc, serverTimestamp, limit, where } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

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
        // Note: Remove orderBy for now since MyRepData uses created_at and system expects createdAt
        const traysQuery = query(collection(this.db, 'tray_tracking'));
        this.traysUnsubscribe = onSnapshot(traysQuery, (snapshot) => {
            const trays = [];
            snapshot.forEach((doc) => {
                trays.push({ id: doc.id, ...doc.data() });
            });

            if (window.app && window.app.trayManager) {
                window.app.trayManager.handleTraysUpdate(trays);
            }

            // Since activities come from tray history, refresh activities when trays update
            if (window.app && window.app.viewManager && window.app.viewManager.currentView === 'dashboard') {
                if (window.app.viewManager.loadRecentActivity) {
                    window.app.viewManager.loadRecentActivity();
                }
            }
        }, (error) => {
            console.error('Error listening to trays:', error);
        });

        // Listen to users collection
        console.log('Setting up users listener...');
        const usersQuery = query(collection(this.db, 'users'));
        this.usersUnsubscribe = onSnapshot(usersQuery, (snapshot) => {

            const users = new Map();
            let userCount = 0;

            snapshot.forEach((doc) => {
                const userData = { id: doc.id, ...doc.data() };
                users.set(doc.id, userData);
                userCount++;
            });

            const previousUserCount = this.users ? this.users.size : 0;
            this.users = users;

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

        // Listen to Facilities collection
        const facilityQuery = query(collection(this.db, 'facilities'), orderBy('account_name', 'asc'));
        this.facilityUnsubscribe = onSnapshot(facilityQuery, (snapshot) => {
            const facilities = [];
            let activeCount = 0;

            snapshot.forEach((doc) => {
                const facilityData = doc.data();
                if (facilityData.active !== false) { // Only include active facilities
                    // Ensure document ID overrides any id field in the data
                    const facility = { ...facilityData, id: doc.id };
                    facilities.push(facility);
                    activeCount++;
                }
            });

            this.facilities = facilities;

            // Trigger tray re-render when facilities are loaded/updated
            if (window.app.trayManager && facilities.length > 0) {
                window.app.trayManager.onFacilitiesLoaded();
            } else if (window.app.trayManager) {
                console.warn('DataManager: No facilities to trigger tray re-render with');
            }
        }, (error) => {
            console.error('Error listening to facilities:', error);
            console.error('Facility query error details:', error.message, error.code);
        });

        // Listen to surgeons collection
        const surgeonsQuery = query(collection(this.db, 'physicians'), orderBy('full_name', 'asc'));
        this.surgeonsUnsubscribe = onSnapshot(surgeonsQuery, (snapshot) => {
            const surgeons = [];
            snapshot.forEach((doc) => {
                const surgeonData = doc.data();
                if (surgeonData.active !== false) { // Only include active surgeons
                    surgeons.push({ id: doc.id, ...surgeonData });
                }
            });

            this.surgeons = surgeons;

            // Refresh physician dropdowns in case modals if they exist and are empty
            if (window.app?.modalManager && surgeons.length > 0) {
                setTimeout(() => {
                    const addPhysicianSelect = document.getElementById('addCasePhysician');
                    const editPhysicianSelect = document.getElementById('editCasePhysician');

                    if ((addPhysicianSelect && addPhysicianSelect.children.length <= 1) ||
                        (editPhysicianSelect && editPhysicianSelect.children.length <= 1)) {
                        window.app.modalManager.refreshPhysicianDropdowns();
                    }
                }, 100); // Small delay to ensure DOM is ready
            }
        }, (error) => {
            console.error('Error listening to surgeons:', error);
        });

        console.log('Setting up case types listener...');
        if (window.is_enable_api_logging && window.frontendLogger) {
            window.frontendLogger.logFirebaseEvent('Setting up case types listener', { collection: 'casetypes' });
        }
        
        const caseTypesQuery = query(collection(this.db, 'casetypes'), orderBy('name', 'asc'));
        this.caseTypesUnsubscribe = onSnapshot(caseTypesQuery, (snapshot) => {
            const caseTypes = [];
            snapshot.forEach((doc) => {
                const caseTypeData = doc.data();
                
                if (window.is_enable_api_logging && window.frontendLogger) {
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
            
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.logDataManagerEvent('Case types updated', {
                    totalCount: this.caseTypes.length,
                    caseTypeNames: this.caseTypes.map(ct => ct.name),
                    snapshotSize: snapshot.size
                });
            }

            // Trigger re-render of surgeons if they're already loaded
            if (window.app.surgeonManager && window.app.surgeonManager.currentSurgeons && window.app.surgeonManager.currentSurgeons.length > 0) {
                setTimeout(() => {
                    window.app.surgeonManager.renderSurgeons(window.app.surgeonManager.currentSurgeons);
                }, 100);
            }

        }, (error) => {
            console.error('❌ Error listening to case types:', error);
            console.error('Error details:', error.code, error.message);
        });

        // Listen to surgical cases collection
        const casesQuery = query(collection(this.db, 'surgical_cases'), orderBy('scheduledDate', 'desc'));
        this.casesUnsubscribe = onSnapshot(casesQuery, (snapshot) => {
            const cases = [];
            snapshot.forEach((doc) => {
                cases.push({ id: doc.id, ...doc.data() });
            });

            this.cases = cases;

            // Notify components that need case data
            if (window.app && window.app.dashboardManager && window.app.dashboardManager.handleCasesUpdate) {
                window.app.dashboardManager.handleCasesUpdate(cases);
            }
            
            if (window.app && window.app.casesManager && window.app.casesManager.handleCasesUpdate) {
                window.app.casesManager.handleCasesUpdate(cases);
            }
        }, (error) => {
            console.error('❌ Error listening to cases:', error);
        });

        // Note: Activities come from tray history subcollections, not a central collection.
        // Activities refresh is triggered by tray updates above and manual refresh in TrayManager.
    }

    triggerUserNameUpdates() {
        // Wait a moment for all components to be ready, then trigger updates
        setTimeout(() => {
            // Update trays view if it has data
            if (window.app.trayManager && window.app.trayManager.currentTrays && window.app.trayManager.currentTrays.length > 0) {
                window.app.trayManager.renderTrays(window.app.trayManager.currentTrays);
            }

            // Update dashboard if it's the current view
            if (window.app.viewManager && window.app.viewManager.currentView === 'dashboard') {
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
                // For updates, ensure tray_id matches document id for MyRepData compatibility
                trayData.tray_id = tray.id;
                trayData.updated_at = serverTimestamp();
                await updateDoc(doc(this.db, 'tray_tracking', tray.id), trayData);
            } else {
                trayData.created_at = serverTimestamp();
                trayData.createdBy = window.app.authManager.getCurrentUser()?.uid;
                const docRef = await addDoc(collection(this.db, 'tray_tracking'), trayData);
                tray.id = docRef.id;
                // Set tray_id to match document id for MyRepData compatibility
                trayData.tray_id = docRef.id;
                // Update the document with the tray_id field
                await updateDoc(docRef, { tray_id: docRef.id });
            }

            return tray;
        } catch (error) {
            console.error('Error saving tray:', error);
            throw error;
        }
    }

    async getTray(id) {
        try {
            const trayDoc = await getDoc(doc(this.db, 'tray_tracking', id));
            return trayDoc.exists() ? { id: trayDoc.id, ...trayDoc.data() } : null;
        } catch (error) {
            console.error('Error getting tray:', error);
            return null;
        }
    }

    async getAllTrays() {
        try {
            const traysSnapshot = await getDocs(collection(this.db, 'tray_tracking'));
            const trays = [];
            traysSnapshot.forEach((doc) => {
                const trayData = { id: doc.id, ...doc.data() };
                trays.push(trayData);
            });


            // Deduplicate trays based on tray_id (primary identifier)
            const uniqueTrays = [];
            const seenTrayIds = new Set();
            const seenTrayNames = new Set();

            trays.forEach(tray => {
                const trayId = tray.tray_id || tray.id;
                const trayName = tray.tray_name || tray.name;

                // Primary deduplication by tray_id
                if (trayId && !seenTrayIds.has(trayId)) {
                    seenTrayIds.add(trayId);
                    if (trayName) seenTrayNames.add(trayName);
                    uniqueTrays.push(tray);
                }
                // Secondary deduplication by tray_name if no tray_id match
                else if (!trayId && trayName && !seenTrayNames.has(trayName)) {
                    seenTrayNames.add(trayName);
                    uniqueTrays.push(tray);
                }
                // Log skipped duplicates
                else {
                    console.log('🔍 DEBUG: Skipping duplicate tray:', {
                        duplicateId: trayId,
                        duplicateName: trayName,
                        documentId: tray.id,
                        reason: trayId ? 'duplicate tray_id' : 'duplicate tray_name'
                    });
                }
            });

            if (uniqueTrays.length !== trays.length) {
                console.log(`🔍 DEBUG: Deduplicated ${trays.length} raw trays to ${uniqueTrays.length} unique trays`);
            }

            return uniqueTrays;
        } catch (error) {
            console.error('Error getting all trays:', error);
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.error('DataManager.getAllTrays() failed', { error: error.message }, 'database-trays');
            }
            return [];
        }
    }

    // Filter trays by case type compatibility
    filterForTrayCompatibilityType(caseType, trays) {
        if (!caseType || !Array.isArray(trays)) {
            console.log('🚨 DEBUG: Invalid parameters for compatibility filter:', {
                caseType,
                caseTypeType: typeof caseType,
                traysCount: trays?.length,
                traysIsArray: Array.isArray(trays)
            });
            return trays || [];
        }

        console.log(`🎯 FILTERING: Starting compatibility filter for case type "${caseType}" with ${trays.length} trays`);

        // TEMPORARY DEBUG: Show if we should bypass filtering for testing
        if (window.BYPASS_TRAY_FILTERING) {
            console.log('🚨 BYPASSING FILTERING for debugging - returning all trays');
            return trays;
        }

        // Sample a few trays to show their compatibility arrays
        const sampleTrays = trays.slice(0, 3);
        sampleTrays.forEach(tray => {
        });

        const compatibleTrays = trays.filter(tray => {
            // If tray has no compatibility array, it's compatible with all case types (legacy behavior)
            if (!tray.case_type_compatibility || !Array.isArray(tray.case_type_compatibility)) {
                console.log(`🔍 DEBUG: Tray "${tray.tray_name || tray.name}" has no compatibility restrictions - including`);
                return true;
            }

            // If compatibility array is empty, it's compatible with all case types
            if (tray.case_type_compatibility.length === 0) {
                console.log(`🔍 DEBUG: Tray "${tray.tray_name || tray.name}" has empty compatibility array - including`);
                return true;
            }

            // Check if the case type ID is in the compatibility array
            const isCompatible = tray.case_type_compatibility.includes(caseType);

            if (isCompatible) {
            } else {
            }

            return isCompatible;
        });

        console.log(`🎯 FILTERING RESULT: ${compatibleTrays.length}/${trays.length} trays are compatible with case type "${caseType}"`);

        // Show first few compatible trays
        const firstCompatible = compatibleTrays.slice(0, 3);
        firstCompatible.forEach(tray => {
            console.log(`✅ Compatible: "${tray.tray_name || tray.name}"`);
        });

        if (compatibleTrays.length === 0) {
            console.warn(`⚠️ NO COMPATIBLE TRAYS FOUND for case type "${caseType}"! This might indicate a data issue.`);
        }

        return compatibleTrays;
    }

    analyzeDuplicates(trays) {
        const idCounts = {};
        const trayIdCounts = {};
        const nameCounts = {};
        
        trays.forEach(tray => {
            // Count Firebase IDs
            idCounts[tray.id] = (idCounts[tray.id] || 0) + 1;
            
            // Count tray_id fields
            if (tray.tray_id) {
                trayIdCounts[tray.tray_id] = (trayIdCounts[tray.tray_id] || 0) + 1;
            }
            
            // Count names
            if (tray.name) {
                nameCounts[tray.name] = (nameCounts[tray.name] || 0) + 1;
            }
        });
        
        return {
            duplicateFirebaseIds: Object.entries(idCounts).filter(([id, count]) => count > 1),
            duplicateTrayIds: Object.entries(trayIdCounts).filter(([id, count]) => count > 1),
            duplicateNames: Object.entries(nameCounts).filter(([name, count]) => count > 1),
            traysWithoutTrayId: trays.filter(t => !t.tray_id).length,
            traysWithoutName: trays.filter(t => !t.name).length
        };
    }

    async updateTray(id, updates) {
        try {
            // Get current tray data to check for status changes
            let previousTrayData = null;
            let shouldSendSMS = false;
            
            if (updates.status) {
                try {
                    const currentTrayDoc = await getDoc(doc(this.db, 'tray_tracking', id));
                    if (currentTrayDoc.exists()) {
                        previousTrayData = currentTrayDoc.data();
                        // Check if status is actually changing
                        shouldSendSMS = previousTrayData.status !== updates.status;
                        console.log('📊 Tray status change detected:', {
                            trayId: id,
                            previousStatus: previousTrayData.status,
                            newStatus: updates.status,
                            willSendSMS: shouldSendSMS
                        });
                    }
                } catch (error) {
                    console.warn('Could not fetch previous tray data for SMS check:', error.message);
                }
            }
            
            const updateData = {
                ...updates,
                lastModified: serverTimestamp(),
                modifiedBy: window.app.authManager.getCurrentUser()?.uid
            };

            await updateDoc(doc(this.db, 'tray_tracking', id), updateData);
            
            // Send SMS notification if status changed
            if (shouldSendSMS && previousTrayData) {
                this.sendTrayStatusSMSNotification(id, updates, previousTrayData);
            }
            
            return true;
        } catch (error) {
            console.error('Error updating tray:', error);
            throw error;
        }
    }

    async deleteTray(id) {
        try {
            await deleteDoc(doc(this.db, 'tray_tracking', id));
            return true;
        } catch (error) {
            console.error('Error deleting tray:', error);
            throw error;
        }
    }

    async sendTrayStatusSMSNotification(trayId, updates, previousTrayData) {
        try {
            console.log('📱 Preparing SMS notification for tray status change...');
            
            // Get current user info
            const currentUser = window.app.authManager.getCurrentUser();
            const changedBy = currentUser?.name || currentUser?.email || 'Unknown User';
            
            // Get all users with phone numbers
            const users = Array.from(this.users.values())
                .filter(user => user.active !== false && user.phone) // Only active users with phone numbers
                .map(user => ({
                    id: user.id,
                    name: user.name,
                    phone: user.phone
                }));
                
            if (users.length === 0) {
                console.log('📱 No users with phone numbers found, skipping SMS notifications');
                return;
            }
            
            // Prepare SMS notification data
            const notificationData = {
                trayId,
                trayName: updates.tray_name || previousTrayData.tray_name || `Tray ${trayId.substring(0, 8)}...`,
                previousStatus: previousTrayData.status,
                newStatus: updates.status,
                changedBy,
                timestamp: new Date().toISOString(),
                users
            };
            
            console.log('📱 Sending SMS notification request:', {
                trayId,
                statusChange: `${previousTrayData.status} → ${updates.status}`,
                userCount: users.length
            });
            
            // Send SMS notification request to API (don't await to avoid blocking tray update)
            fetch('/api/notifications/tray-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(notificationData)
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    console.log('✅ SMS notification request sent successfully:', result.message);
                    if (result.details?.isLiveSendingDisabled) {
                        console.log('ℹ️ Live SMS sending is disabled - notifications were simulated');
                    }
                } else {
                    console.error('❌ SMS notification request failed:', result.error);
                }
            })
            .catch(error => {
                console.error('❌ Error sending SMS notification request:', error);
            });
            
        } catch (error) {
            console.error('❌ Error preparing SMS notification:', error);
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

            await addDoc(collection(this.db, 'tray_tracking', trayId, 'history'), historyEntry);
        } catch (error) {
            console.error('Error adding history entry:', error);
        }
    }

    async getTrayHistory(trayId) {
        try {
            const historyQuery = query(
                collection(this.db, 'tray_tracking', trayId, 'history'),
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

    async getAllRecentActivity(maxItems = 20) {
        try {
            console.log('🚀 Starting getAllRecentActivity...');
            
            // Test basic database connectivity
            try {
                    const testQuery = query(collection(this.db, 'tray_tracking'), limit(1));
                const testSnapshot = await getDocs(testQuery);
            } catch (dbError) {
                console.error('❌ Database connection test failed:', dbError);
                return [];
            }
            
            const allActivities = [];
            
            // Get system activities (case creation, status changes, etc.)
            const systemActivities = await this.getAllSystemActivities(maxItems);
            if (systemActivities.length > 0) {
            }
            systemActivities.forEach(activity => {
                allActivities.push({
                    ...activity,
                    source: 'system'
                });
            });
            
            // Get tray activities
            const allTrays = await this.getAllTrays();
            
            if (allTrays.length === 0) {
                console.error('❌ No trays found in database! Check getAllTrays() method.');
                return allActivities.slice(0, limit);
            }
            
            // Show sample tray data
            if (allTrays.length > 0) {
                // Sample tray data available for debugging if needed
            }
            
            
            let trayActivitiesFound = 0;
            for (const tray of allTrays.slice(0, 30)) { // Limit to 30 trays to avoid too many queries
                try {
                    const historyQuery = query(
                        collection(this.db, 'tray_tracking', tray.id, 'history'),
                        orderBy('timestamp', 'desc'),
                        limit(3) // Get 3 most recent for each tray
                    );
                    const snapshot = await getDocs(historyQuery);
                    
                    if (!snapshot.empty) {
                        trayActivitiesFound += snapshot.size;
                        
                        snapshot.forEach((doc) => {
                            const activity = { 
                                id: doc.id, 
                                trayId: tray.id,
                                trayName: tray.name,
                                source: 'tray',
                                ...doc.data() 
                            };
                            allActivities.push(activity);
                        });
                    } else {
                        // No history entries - create a synthetic "created" activity from tray creation date
                        if (tray.created_at || tray.createdAt) {
                            const createdActivity = {
                                id: `created-${tray.id}`,
                                trayId: tray.id,
                                trayName: tray.name,
                                source: 'tray',
                                action: 'created',
                                details: `Tray created`,
                                timestamp: tray.created_at || tray.createdAt,
                                user: tray.createdBy || tray.created_by || 'System'
                            };
                            allActivities.push(createdActivity);
                            trayActivitiesFound += 1;
                        }
                    }
                } catch (trayError) {
                    console.warn(`Error getting history for tray ${tray.id}:`, trayError);
                }
            }
            
            
            // Sort all activities by timestamp and return the most recent
            allActivities.sort((a, b) => {
                if (!a.timestamp || !b.timestamp) return 0;
                return b.timestamp.toMillis() - a.timestamp.toMillis();
            });
            
            const result = allActivities.slice(0, maxItems);
            return result;
        } catch (error) {
            console.error('Error getting recent activity:', error);
            return [];
        }
    }

    async addSystemActivity(action, details, relatedId = null, relatedType = null) {
        try {
            const activityEntry = {
                timestamp: serverTimestamp(),
                action,
                details,
                user: window.app.authManager.getCurrentUser()?.name || 'Unknown',
                userId: window.app.authManager.getCurrentUser()?.uid,
                relatedId, // Case ID, Tray ID, etc.
                relatedType // 'case', 'tray', 'user', etc.
            };

            await addDoc(collection(this.db, 'system_activities'), activityEntry);
            console.log('System activity logged:', action, details);
        } catch (error) {
            console.error('Error adding system activity:', error);
        }
    }

    async getAllSystemActivities(maxItems = 20) {
        try {
            const activitiesQuery = query(
                collection(this.db, 'system_activities'),
                orderBy('timestamp', 'desc'),
                limit(maxItems)
            );
            const snapshot = await getDocs(activitiesQuery);
            const activities = [];
            
            
            snapshot.forEach((doc) => {
                const data = { id: doc.id, ...doc.data() };
                activities.push(data);
            });
            
            return activities;
        } catch (error) {
            console.error('❌ Error getting system activities:', error);
            console.error('❌ Full error details:', error.code, error.message);
            return [];
        }
    }

    async backfillTrayHistory() {
        try {
            const allTrays = await this.getAllTrays();
            let backfilledCount = 0;
            
            for (const tray of allTrays) {
                try {
                    // Check if tray already has history
                    const historyQuery = query(
                        collection(this.db, 'tray_tracking', tray.id, 'history'),
                        limit(1)
                    );
                    const snapshot = await getDocs(historyQuery);
                    
                    if (snapshot.empty) {
                        // No history exists, add a creation entry
                        const creationTime = tray.created_at || tray.createdAt || new Date();
                        const createdBy = tray.createdBy || tray.created_by || 'System';
                        
                        await this.addHistoryEntry(
                            tray.id,
                            'created',
                            `Tray created${tray.location ? ` at ${tray.location}` : ''}`,
                            null
                        );
                        
                        backfilledCount++;
                        console.log(`Backfilled history for tray: ${tray.name}`);
                    }
                } catch (trayError) {
                    console.warn(`Error backfilling history for tray ${tray.id}:`, trayError);
                }
            }
            
            return backfilledCount;
        } catch (error) {
            console.error('Error during tray history backfill:', error);
            return 0;
        }
    }

    getFacilities() {
        return this.facilities || [];
    }

    getSurgeons() {
        // Return surgeons from Firebase instead of hardcoded array
        return this.surgeons || [];
    }

    // Force refresh surgeon data when needed (for SPA navigation issues)
    async ensureSurgeonsLoaded() {
        try {

            // If we already have surgeons, return them
            if (this.surgeons && this.surgeons.length > 0) {
                return this.surgeons;
            }

            // Force fetch surgeons directly from Firestore
            console.log('📡 Force fetching surgeons from Firestore...');
            const surgeonsQuery = query(collection(this.db, 'physicians'), orderBy('full_name', 'asc'));
            const snapshot = await getDocs(surgeonsQuery);

            const surgeons = [];
            snapshot.forEach((doc) => {
                const surgeonData = doc.data();
                if (surgeonData.active !== false) { // Only include active surgeons
                    surgeons.push({ id: doc.id, ...surgeonData });
                }
            });

            this.surgeons = surgeons;
            console.log(`✅ Force loaded ${surgeons.length} surgeons`);

            // Trigger dropdown refresh if surgeon data was loaded
            if (surgeons.length > 0 && window.app?.modalManager) {
                setTimeout(() => {
                    window.app.modalManager.refreshPhysicianDropdowns();
                }, 100);
            }

            return surgeons;
        } catch (error) {
            console.error('Error ensuring surgeons loaded:', error);
            return [];
        }
    }

    getCaseTypes() {
        const caseTypes = this.caseTypes || [];
        
        
        return caseTypes;
    }

    // Alias method for modal manager compatibility
    getAllCaseTypes() {
        return this.getCaseTypes();
    }

    // ==================== CASES CRUD OPERATIONS ====================
    
    async saveCase(caseData) {
        try {
            // Log detailed Firebase operation info
            if (window.is_enable_api_logging && window.frontendLogger) {
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
                if (window.is_enable_api_logging && window.frontendLogger) {
                    window.frontendLogger.error('saveCase failed - no user', { error: error.message }, 'firebase-case-save');
                }
                throw error;
            }

            const caseDataWithTimestamp = {
                ...caseData,
                lastModified: serverTimestamp(),
                modifiedBy: currentUser.uid
            };

            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.debug('Prepared case data for Firebase', {
                    hasTimestamp: !!caseDataWithTimestamp.lastModified,
                    modifiedBy: caseDataWithTimestamp.modifiedBy,
                    dataSize: JSON.stringify(caseDataWithTimestamp).length
                }, 'firebase-case-save');
            }

            if (caseData.id) {
                if (window.is_enable_api_logging && window.frontendLogger) {
                    window.frontendLogger.debug('Updating existing case', { caseId: caseData.id }, 'firebase-case-save');
                }
                await updateDoc(doc(this.db, 'surgical_cases', caseData.id), caseDataWithTimestamp);
            } else {
                if (window.is_enable_api_logging && window.frontendLogger) {
                    window.frontendLogger.debug('Creating new case document', {}, 'firebase-case-save');
                }
                caseDataWithTimestamp.createdAt = serverTimestamp();
                caseDataWithTimestamp.createdBy = currentUser.uid;
                
                try {
                    const docRef = await addDoc(collection(this.db, 'surgical_cases'), caseDataWithTimestamp);
                    caseData.id = docRef.id;
                    
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.info('Successfully created case', {
                            caseId: docRef.id,
                            collection: 'surgical_cases'
                        }, 'firebase-case-save');
                    }
                } catch (addDocError) {
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.error('addDoc failed for cases collection', {
                            error: addDocError.message,
                            code: addDocError.code,
                            stack: addDocError.stack,
                            collectionPath: 'surgical_cases'
                        }, 'firebase-case-save');
                    }
                    throw addDocError;
                }
            }

            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.info('saveCase completed successfully', {
                    caseId: caseData.id,
                    wasUpdate: !!caseData.id
                }, 'firebase-case-save');
            }

            return caseData;
        } catch (error) {
            console.error('Error saving case:', error);
            if (window.is_enable_api_logging && window.frontendLogger) {
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
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.info('DataManager.getCase() called', { caseId: id }, 'case-retrieval');
            }
            
            const caseDoc = await getDoc(doc(this.db, 'surgical_cases', id));
            
            if (caseDoc.exists()) {
                const caseData = { id: caseDoc.id, ...caseDoc.data() };
                
                if (window.is_enable_api_logging && window.frontendLogger) {
                    window.frontendLogger.info('Case data retrieved from Firestore', {
                        caseId: id,
                        patientName: caseData.patientName,
                        hasData: !!caseData
                    }, 'case-retrieval');
                    
                    // Log tray requirements specifically
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.info('Tray requirements analysis', {
                        caseId: id,
                        tray_requirements: caseData.tray_requirements,
                        tray_requirements_type: typeof caseData.tray_requirements,
                        tray_requirements_length: caseData.tray_requirements?.length
                    }, 'tray-requirements-debug');
                    }
                }
                
                return caseData;
            } else {
                if (window.is_enable_api_logging && window.frontendLogger) {
                    window.frontendLogger.warn('No case found', { caseId: id }, 'case-retrieval');
                }
                return null;
            }
        } catch (error) {
            console.error('Error getting case:', error);
            if (window.is_enable_api_logging && window.frontendLogger) {
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
            const casesSnapshot = await getDocs(collection(this.db, 'surgical_cases'));
            const cases = [];
            casesSnapshot.forEach((doc) => {
                cases.push({ id: doc.id, ...doc.data() });
            });
            
            // Enhanced logging for surgical_cases data structure
            const casesWithTrayReqs = cases.filter(c => c.tray_requirements && Array.isArray(c.tray_requirements));
            const casesWithAAInName = cases.filter(c => c.patientName && c.patientName.toLowerCase().includes('aa'));
            
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.info(`🏥 SURGICAL_CASES DEBUG: Collection analysis`, {
                    totalCases: cases.length,
                    casesWithTrayRequirements: casesWithTrayReqs.length,
                    casesWithAAInName: casesWithAAInName.length,
                    sampleCaseWithTrayReqs: casesWithTrayReqs[0] ? {
                        id: casesWithTrayReqs[0].id,
                        patientName: casesWithTrayReqs[0].patientName,
                        trayRequirementsCount: casesWithTrayReqs[0].tray_requirements?.length || 0,
                        trayRequirements: casesWithTrayReqs[0].tray_requirements,
                        allFields: Object.keys(casesWithTrayReqs[0])
                    } : null,
                    aaPatientCases: casesWithAAInName.map(c => ({
                        id: c.id,
                        patientName: c.patientName,
                        hasTrayRequirements: !!c.tray_requirements,
                        trayRequirementsCount: c.tray_requirements?.length || 0,
                        trayRequirements: c.tray_requirements
                    }))
                }, 'surgical-cases-analysis');
            }
            
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

            await updateDoc(doc(this.db, 'surgical_cases', id), updateData);
            return true;
        } catch (error) {
            console.error('Error updating case:', error);
            throw error;
        }
    }

    async deleteCase(id) {
        try {
            await deleteDoc(doc(this.db, 'surgical_cases', id));
            return true;
        } catch (error) {
            console.error('Error deleting case:', error);
            throw error;
        }
    }

    async getCasesByDateRange(startDate, endDate) {
        try {
            const casesQuery = query(
                collection(this.db, 'surgical_cases'),
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

    async getCasesBySurgeon(physician_id) {
        try {
            const casesQuery = query(
                collection(this.db, 'surgical_cases'),
                orderBy('scheduledDate', 'desc')
            );
            const snapshot = await getDocs(casesQuery);
            const cases = [];
            
            snapshot.forEach((doc) => {
                const caseData = { id: doc.id, ...doc.data() };
                if (caseData.physician_id === physician_id) {
                    cases.push(caseData);
                }
            });
            
            return cases;
        } catch (error) {
            console.error('Error getting cases by surgeon:', error);
            return [];
        }
    }

    async updatePhysician(physicianId, updates) {
        try {
            const physicianRef = doc(this.db, 'physicians', physicianId);
            await updateDoc(physicianRef, updates);
            console.log(`Physician ${physicianId} updated successfully`);
            return true;
        } catch (error) {
            console.error('Error updating physician:', error);
            throw error;
        }
    }

    async getCasesByFacility(facility_id) {
        try {
            const casesQuery = query(
                collection(this.db, 'surgical_cases'),
                orderBy('scheduledDate', 'desc')
            );
            const snapshot = await getDocs(casesQuery);
            const cases = [];
            
            snapshot.forEach((doc) => {
                const caseData = { id: doc.id, ...doc.data() };
                if (caseData.facility_id === facility_id) {
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

        if (!this.users) {
            console.log('Creating new empty users Map');
            this.users = new Map();
        }

        return this.users;
    }

    // Central function to get tray requirements by case type ID or name (using OR logic)
    async getTrayRequirementsByCaseType(caseTypeId, caseTypeName) {
        try {
            console.log('🔍 Loading tray requirements for case type:', { caseTypeId, caseTypeName });

            if (!caseTypeId && !caseTypeName) {
                console.warn('No case type ID or name provided to getTrayRequirementsByCaseType');
                return [];
            }

            // Create queries for both ID and name (OR logic using separate queries)
            const promises = [];

            if (caseTypeId) {
                const requirementsById = query(
                    collection(this.db, 'tray_requirements'),
                    where('case_type_id', '==', caseTypeId)
                );
                promises.push(getDocs(requirementsById));
            }

            if (caseTypeName) {
                const requirementsByName = query(
                    collection(this.db, 'tray_requirements'),
                    where('case_type_name', '==', caseTypeName)
                );
                promises.push(getDocs(requirementsByName));
            }

            // Execute queries in parallel
            const snapshots = await Promise.all(promises);

            // Combine results and deduplicate using Map
            const requirementsDocs = new Map();
            snapshots.forEach(snapshot => {
                snapshot.forEach(doc => {
                    requirementsDocs.set(doc.id, { id: doc.id, ...doc.data() });
                });
            });

            const requirements = Array.from(requirementsDocs.values());

            console.log(`🔍 Found ${requirements.length} unique tray requirements for case type:`, { caseTypeId, caseTypeName });

            return requirements;

        } catch (error) {
            console.error('Error loading tray requirements by case type:', error);
            return [];
        }
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
        if (this.casesUnsubscribe) {
            this.casesUnsubscribe();
        }
    }
}