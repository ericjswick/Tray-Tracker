// js/UserManager.js - Updated for Tray Tracker
import { createUserWithEmailAndPassword, getAuth } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { doc, setDoc, updateDoc, deleteDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { getRoleClass, getRoleStats, isValidRole, populateRoleSelect } from './constants/UserRoles.js';

export class UserManager {
    constructor(auth, db, dataManager) {
        this.auth = auth;
        this.db = db;
        this.dataManager = dataManager;
        this.currentUsers = [];
        this.viewMode = this.getStoredViewMode();
    }

    getStoredViewMode() {
        return localStorage.getItem('userViewMode') || 'card';
    }

    setViewMode(mode) {
        this.viewMode = mode;
        localStorage.setItem('userViewMode', mode);

        const cardBtn = document.getElementById('userCardViewBtn');
        const listBtn = document.getElementById('userListViewBtn');

        if (cardBtn && listBtn) {
            if (mode === 'card') {
                cardBtn.classList.add('active');
                listBtn.classList.remove('active');
            } else {
                listBtn.classList.add('active');
                cardBtn.classList.remove('active');
            }
        }

        const cardView = document.getElementById('userCardView');
        const listView = document.getElementById('userListView');

        if (cardView && listView) {
            if (mode === 'card') {
                cardView.classList.remove('d-none');
                listView.classList.add('d-none');
            } else {
                cardView.classList.add('d-none');
                listView.classList.remove('d-none');
            }
        }

        this.renderUsers(this.currentUsers);
    }

    initializeViewMode() {
        this.setViewMode(this.viewMode);
        this.showLoadingState();

        // Initialize role dropdowns
        this.initializeRoleDropdowns();

        // Try to get users immediately if available
        if (window.app.dataManager && window.app.dataManager.users) {
            // Wait a moment for DataManager to initialize
            setTimeout(() => {
                const users = window.app.dataManager.getUsers();
                if (users && users.size > 0) {
                    this.handleUsersUpdate(users);
                } else {
                    // If still no users, wait longer and try again
                    setTimeout(() => {
                        const retryUsers = window.app.dataManager.getUsers();
                        if (retryUsers && retryUsers.size > 0) {
                            this.handleUsersUpdate(retryUsers);
                        } else {
                            console.log('No users found after retry');
                            this.showNoUsersState();
                        }
                    }, 2000);
                }
            }, 500);
        } else {
            // Wait for DataManager to initialize
            setTimeout(() => {
                if (window.app.dataManager) {
                    const users = window.app.dataManager.getUsers();
                    if (users && users.size > 0) {
                        this.handleUsersUpdate(users);
                    } else {
                        this.showNoUsersState();
                    }
                }
            }, 2000);
        }
    }

    showNoUsersState() {
        const userCardView = document.getElementById('userCardView');
        const userListView = document.getElementById('userListView');

        if (userCardView) {
            userCardView.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-users fa-3x mb-3" style="color: var(--gray-300);"></i>
                <p>No users found. Add a new user to get started.</p>
                <button class="btn-primary-custom mt-3" onclick="app.modalManager.showAddUserModal()">
                    <i class="fas fa-user-plus"></i> Add First User
                </button>
            </div>
        `;
        }

        if (userListView) {
            const userHorizontalCards = document.getElementById('userHorizontalCards');
            if (userHorizontalCards) {
                userHorizontalCards.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-users fa-3x mb-3" style="color: var(--gray-300);"></i>
                    <p>No users found. Add a new user to get started.</p>
                    <button class="btn-primary-custom mt-3" onclick="app.modalManager.showAddUserModal()">
                        <i class="fas fa-user-plus"></i> Add First User
                    </button>
                </div>
            `;
            }
        }
    }

    showLoadingState() {
        const userCardView = document.getElementById('userCardView');
        const userListView = document.getElementById('userListView');

        if (userCardView) {
            userCardView.innerHTML = `
                <div class="loading-state">
                    <div class="spinner-border" role="status"></div>
                    <p class="mt-2">Loading users...</p>
                </div>
            `;
        }

        if (userListView) {
            const userHorizontalCards = document.getElementById('userHorizontalCards');
            if (userHorizontalCards) {
                userHorizontalCards.innerHTML = `
                    <div class="loading-state">
                        <div class="spinner-border" role="status"></div>
                        <p class="mt-2">Loading users...</p>
                    </div>
                `;
            }
        }
    }

    async addUser() {
        try {
            const currentAdminUser = this.auth.currentUser;
            const currentAdminData = window.app.authManager.getCurrentUser();
            
            console.log('🔍 BEFORE user creation - Current admin user:', {
                firebaseUID: currentAdminUser?.uid,
                firebaseEmail: currentAdminUser?.email,
                authManagerUID: currentAdminData?.uid,
                authManagerName: currentAdminData?.name,
                authManagerEmail: currentAdminData?.email
            });
            
            // Check what's displayed in UI right now
            const currentDisplay = document.getElementById('currentUserName')?.textContent;
            console.log('🔍 BEFORE user creation - UI displays:', currentDisplay);
            
            const name = document.getElementById('userName').value;
            const email = document.getElementById('userEmail').value;
            const password = document.getElementById('userPassword').value;
            const role = document.getElementById('userRole').value;
            const phone = document.getElementById('userPhone').value;

            // Validate role
            if (!isValidRole(role)) {
                alert('Please select a valid user role.');
                return;
            }
            const region = document.getElementById('userRegion').value;
            let location_facility_id = document.getElementById('userLocationFacility').value;
            
            // Convert empty string or 'null' string to actual null
            if (location_facility_id === '' || location_facility_id === 'null') {
                location_facility_id = null;
            }
            const active = document.getElementById('userActive').checked;


            // Check if secondary app exists and delete it first to avoid conflicts
            try {
                const existingApp = window.firebase.app('secondary');
                if (existingApp) {
                    await existingApp.delete();
                    console.log('🗑️ Deleted existing secondary app');
                }
            } catch (e) {
                // App doesn't exist, that's fine
            }

            // Create secondary Firebase app instance for user creation
            // Get config from the existing Firebase app instance
            const mainApp = this.auth.app;
            const secondaryAppConfig = {
                apiKey: mainApp.options.apiKey,
                authDomain: mainApp.options.authDomain,
                projectId: mainApp.options.projectId,
                storageBucket: mainApp.options.storageBucket,
                messagingSenderId: mainApp.options.messagingSenderId,
                appId: mainApp.options.appId
            };
            
            console.log('🔄 Initializing secondary Firebase app...');
            
            // Initialize secondary app
            const secondaryApp = initializeApp(secondaryAppConfig, 'secondary-' + Date.now());
            const secondaryAuth = getAuth(secondaryApp);

            console.log('🔄 Secondary app created:', secondaryApp.name);
            console.log('🔍 Main auth current user before creation:', this.auth.currentUser?.email);
            console.log('🔍 Secondary auth current user before creation:', secondaryAuth.currentUser?.email);

            // Create the new user using secondary auth (should not affect main session)
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const newUser = userCredential.user;

            console.log('✅ New user created with secondary auth:', {
                newUserUID: newUser.uid,
                newUserEmail: newUser.email
            });

            console.log('🔍 AFTER user creation - Main auth user:', this.auth.currentUser?.email);
            console.log('🔍 AFTER user creation - Secondary auth user:', secondaryAuth.currentUser?.email);
            console.log('🔍 AFTER user creation - AuthManager user:', window.app.authManager.getCurrentUser()?.email);

            // Save the new user's profile data using main database connection
            await setDoc(doc(this.db, 'users', newUser.uid), {
                name,
                email,
                role,
                phone,
                region,
                location_facility_id,
                active,
                createdAt: serverTimestamp(),
                createdBy: currentAdminData?.uid,
                isDemoUser: false
            });

            console.log('✅ User profile data saved to Firestore');

            // Sign out the new user from secondary auth and clean up
            await secondaryAuth.signOut();
            await deleteApp(secondaryApp);

            console.log('🧹 Secondary app cleaned up');
            
            // Check state after cleanup
            console.log('🔍 AFTER cleanup - Main auth user:', this.auth.currentUser?.email);
            console.log('🔍 AFTER cleanup - AuthManager user:', window.app.authManager.getCurrentUser()?.email);
            
            const finalDisplay = document.getElementById('currentUserName')?.textContent;
            console.log('🔍 AFTER cleanup - UI displays:', finalDisplay);

            // If the display changed, force refresh it
            if (finalDisplay !== currentDisplay) {
                console.log('⚠️ Display changed from', currentDisplay, 'to', finalDisplay, '- forcing refresh');
                
                // Force restore the admin user display immediately
                setTimeout(() => {
                    if (window.app.authManager && currentAdminData) {
                        console.log('🔧 Force restoring admin user display...');
                        window.app.authManager.currentUser = {
                            uid: currentAdminUser.uid,
                            email: currentAdminUser.email,
                            ...currentAdminData
                        };
                        window.app.authManager.updateUserDisplay();
                    }
                }, 100);
                
                if (window.refreshUserDisplay) {
                    setTimeout(() => window.refreshUserDisplay(), 200);
                }
            }

            // Close modal and reset form
            bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
            document.getElementById('addUserForm').reset();

            // Show success message
            this.showSuccessNotification('User created successfully!');

            // Refresh user list
            if (window.app.dataManager && window.app.dataManager.loadUsers) {
                window.app.dataManager.loadUsers();
            }
            
        } catch (error) {
            console.error('Error adding user:', error);
            this.showErrorNotification('Error adding user: ' + error.message);
        }
    }

    async updateUser() {
        try {
            const userId = document.getElementById('editUserId').value;
            const name = document.getElementById('editUserName').value;
            const role = document.getElementById('editUserRole').value;
            const phone = document.getElementById('editUserPhone').value;

            // Validate role
            if (!isValidRole(role)) {
                alert('Please select a valid user role.');
                return;
            }
            const region = document.getElementById('editUserRegion').value;
            let location_facility_id = document.getElementById('editUserLocationFacility').value;


            // Convert empty string or 'null' string to actual null
            if (location_facility_id === '' || location_facility_id === 'null') {
                location_facility_id = null;
            }
            const active = document.getElementById('editUserActive').checked;

            // Get the current user data to check if location has changed
            const userDocRef = doc(this.db, 'users', userId);
            const userDoc = await getDoc(userDocRef);
            const currentUserData = userDoc.data();
            const oldLocationFacilityId = currentUserData?.location_facility_id;

            // Update user document
            await updateDoc(userDocRef, {
                name,
                role,
                phone,
                region,
                location_facility_id,
                active,
                lastModified: serverTimestamp(),
                modifiedBy: window.app.authManager.getCurrentUser()?.uid
            });

            // If location_facility_id has changed, update all available trays assigned to this user
            if (oldLocationFacilityId !== location_facility_id) {
                await this.updateAssignedTraysLocation(userId, location_facility_id, oldLocationFacilityId);
            }

            bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();
            this.showSuccessNotification('User updated successfully!');
        } catch (error) {
            console.error('Error updating user:', error);
            this.showErrorNotification('Error updating user: ' + error.message);
        }
    }

    async updateAssignedTraysLocation(userId, newLocationFacilityId, oldLocationFacilityId) {
        try {
            console.log(`🔄 Updating tray locations for user ${userId}: ${oldLocationFacilityId} -> ${newLocationFacilityId}`);

            // Get all trays assigned to this user that are in 'available' status
            const traysRef = collection(this.db, 'trays');
            const assignedTraysQuery = query(
                traysRef,
                where('assignedTo', '==', userId),
                where('status', '==', 'available')
            );

            const querySnapshot = await getDocs(assignedTraysQuery);
            const traysToUpdate = [];

            querySnapshot.forEach((doc) => {
                const trayData = doc.data();
                traysToUpdate.push({
                    id: doc.id,
                    name: trayData.tray_name || trayData.name || doc.id,
                    currentLocation: trayData.location || trayData.facility_id
                });
            });

            if (traysToUpdate.length === 0) {
                console.log(`📦 No available trays assigned to user ${userId} to update`);
                return;
            }

            console.log(`📦 Found ${traysToUpdate.length} available trays to update location for user ${userId}`);

            // Update each tray's location
            const updatePromises = traysToUpdate.map(async (tray) => {
                const trayDocRef = doc(this.db, 'trays', tray.id);

                // Update both location and facility_id fields for consistency
                await updateDoc(trayDocRef, {
                    location: newLocationFacilityId,
                    facility_id: newLocationFacilityId,
                    lastModified: serverTimestamp(),
                    modifiedBy: window.app.authManager.getCurrentUser()?.uid
                });

                // Add history entry
                const facilityName = this.getFacilityName(newLocationFacilityId) || newLocationFacilityId || 'Unassigned';
                const oldFacilityName = this.getFacilityName(oldLocationFacilityId) || oldLocationFacilityId || 'Unassigned';
                const currentUser = window.app.authManager.getCurrentUser();
                const userName = currentUser?.name || currentUser?.email || 'System';

                const historyMessage = `Location updated from ${oldFacilityName} to ${facilityName} due to user reptrunk location change by ${userName}`;

                if (window.app?.dataManager?.addHistoryEntry) {
                    await window.app.dataManager.addHistoryEntry(
                        tray.id,
                        'location-update',
                        historyMessage,
                        null
                    );
                }

                console.log(`✅ Updated tray ${tray.name} location: ${oldFacilityName} -> ${facilityName}`);
            });

            // Execute all updates in parallel
            await Promise.all(updatePromises);

            const facilityName = this.getFacilityName(newLocationFacilityId) || 'Unassigned';
            console.log(`✅ Successfully updated ${traysToUpdate.length} trays to location: ${facilityName}`);

            // Show notification about tray updates
            if (traysToUpdate.length > 0) {
                this.showInfoNotification(`Updated location for ${traysToUpdate.length} assigned available trays to match user's reptrunk location`);
            }

        } catch (error) {
            console.error('Error updating assigned trays location:', error);
            this.showWarningNotification('User updated successfully, but failed to update some tray locations: ' + error.message);
        }
    }

    async deleteUser(userId, userName) {
        if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await deleteDoc(doc(this.db, 'users', userId));
            this.showSuccessNotification('User deleted successfully!');
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showErrorNotification('Error deleting user: ' + error.message);
        }
    }

    handleUsersUpdate(users) {

        if (users instanceof Map) {
            this.currentUsers = Array.from(users.values());
        } else if (Array.isArray(users)) {
            this.currentUsers = users;
        } else {
            console.log('No valid users data received');
            this.currentUsers = [];
        }

        this.renderUsers(this.currentUsers);
        this.updateStats(this.currentUsers);
    }

    renderUsers(users) {
        if (this.viewMode === 'card') {
            this.renderCardView(users);
        } else {
            this.renderListView(users);
        }
    }

    renderCardView(users) {
        const userCardView = document.getElementById('userCardView');
        if (!userCardView) return;

        if (users.length === 0) {
            userCardView.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-users fa-3x mb-3" style="color: var(--gray-300);"></i>
                    <p>No users found. Add a new user to get started.</p>
                </div>
            `;
            return;
        }

        userCardView.innerHTML = '';
        users.forEach((user, index) => {
            const userCard = this.createUserCard(user);
            userCardView.appendChild(userCard);
        });
    }

    renderListView(users) {
        const userHorizontalCards = document.getElementById('userHorizontalCards');
        if (!userHorizontalCards) return;

        if (users.length === 0) {
            userHorizontalCards.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-users fa-3x mb-3" style="color: var(--gray-300);"></i>
                    <p>No users found. Add a new user to get started.</p>
                </div>
            `;
            return;
        }

        userHorizontalCards.innerHTML = '';
        users.forEach((user, index) => {
            const userCard = this.createHorizontalUserCard(user);
            userHorizontalCards.appendChild(userCard);
        });
    }

    createUserCard(user) {
        const card = document.createElement('div');
        card.className = 'user-card';

        const initials = this.getInitials(user.name);
        const roleClass = this.getRoleClass(user.role);
        const statusClass = user.active !== false ? 'text-success' : 'text-muted';
        const statusText = user.active !== false ? 'Active' : 'Inactive';

        card.innerHTML = `
            <div class="user-card-header">
                <div class="user-avatar">${initials}</div>
                <div class="user-info">
                    <h5 class="user-name">${user.name || user.email || 'Unknown User'}</h5>
                    <span class="user-role ${roleClass}">${user.role || 'No Role'}</span>
                    <div class="user-status ${statusClass}">
                        <i class="fas fa-circle"></i>
                        <span>${statusText}</span>
                    </div>
                </div>
            </div>
            
            <div class="user-details">
                <div class="user-detail">
                    <i class="fas fa-envelope"></i>
                    <span>${user.email || 'Not provided'}</span>
                </div>
                ${user.phone ? `
                    <div class="user-detail">
                        <i class="fas fa-phone"></i>
                        <span>${user.phone}</span>
                    </div>
                ` : `
                    <div class="user-detail">
                        <i class="fas fa-phone"></i>
                        <span class="empty-value">Not provided</span>
                    </div>
                `}
                ${user.region ? `
                    <div class="user-detail">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${user.region}</span>
                    </div>
                ` : `
                    <div class="user-detail">
                        <i class="fas fa-map-marker-alt"></i>
                        <span class="empty-value">Not assigned</span>
                    </div>
                `}
                ${user.location_facility_id ? `
                    <div class="user-detail">
                        <i class="fas fa-hospital"></i>
                        <span>${this.getFacilityName(user.location_facility_id)}</span>
                    </div>
                ` : `
                    <div class="user-detail">
                        <i class="fas fa-hospital"></i>
                        <span class="empty-value">No RepTrunk location</span>
                    </div>
                `}
            </div>

            <div class="user-actions">
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showEditUserModal('${user.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-warning-custom btn-sm" onclick="app.userManager.showUpdatePasswordModal('${user.id}', '${(user.name || user.email || 'Unknown User').replace(/'/g, '\\\'')}')" title="Send Password Reset Email">
                    <i class="fas fa-envelope"></i> Reset
                </button>
                <button class="btn-danger-custom btn-sm" onclick="app.userManager.deleteUser('${user.id}', '${user.name || user.email}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;

        return card;
    }

    createHorizontalUserCard(user) {
        const card = document.createElement('div');
        card.className = 'user-horizontal-card';

        const initials = this.getInitials(user.name);
        const statusText = user.active !== false ? 'Active' : 'Inactive';
        const statusClass = user.active !== false ? 'status-available' : 'status-in-use';

        card.innerHTML = `
            <div class="user-horizontal-header">
                <div class="user-horizontal-title">
                    <div class="user-avatar">${initials}</div>
                    <div>
                        <h6>${user.name || user.email || 'Unknown User'}</h6>
                        <small class="text-muted">${user.role || 'No Role'}</small>
                    </div>
                </div>
                <div class="user-horizontal-status">
                    <span class="tray-status-badge ${statusClass}">${statusText}</span>
                </div>
            </div>
            
            <div class="user-horizontal-body">
                <div class="user-horizontal-field">
                    <label>Email</label>
                    <span>${user.email || 'Not provided'}</span>
                </div>
                <div class="user-horizontal-field">
                    <label>Phone</label>
                    <span class="${!user.phone ? 'empty-value' : ''}">${user.phone || 'Not provided'}</span>
                </div>
                <div class="user-horizontal-field">
                    <label>Region</label>
                    <span class="${!user.region ? 'empty-value' : ''}">${user.region || 'Not assigned'}</span>
                </div>
                <div class="user-horizontal-field">
                    <label>RepTrunk Location</label>
                    <span class="${!user.location_facility_id ? 'empty-value' : ''}">${user.location_facility_id ? this.getFacilityName(user.location_facility_id) : 'Not assigned'}</span>
                </div>
                <div class="user-horizontal-field">
                    <label>Created</label>
                    <span class="empty-value">${this.formatDate(user.createdAt) || 'Unknown'}</span>
                </div>
            </div>
            
            <div class="user-horizontal-actions">
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showEditUserModal('${user.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-warning-custom btn-sm" onclick="app.userManager.showUpdatePasswordModal('${user.id}', '${(user.name || user.email || 'Unknown User').replace(/'/g, '\\\'')}')" title="Send Password Reset Email">
                    <i class="fas fa-envelope"></i> Reset
                </button>
                <button class="btn-danger-custom btn-sm" onclick="app.userManager.deleteUser('${user.id}', '${user.name || user.email}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;

        return card;
    }

    getInitials(name) {
        if (!name) return '??';
        return name.split(' ')
            .map(word => word.charAt(0))
            .join('')
            .substring(0, 2)
            .toUpperCase();
    }

    getRoleClass(role) {
        // Use centralized role system
        return getRoleClass(role);
    }

    formatDate(timestamp) {
        if (!timestamp) return null;
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString();
    }

    getFacilityName(facilityId) {
        if (!facilityId) return 'Not assigned';
        
        // Try to get facility name from facilityManager
        if (window.app.facilityManager && window.app.facilityManager.currentFacilities) {
            const facility = window.app.facilityManager.currentFacilities.find(f => f.id === facilityId);
            if (facility) {
                return facility.account_name || facility.name || facilityId;
            }
        }
        
        // Try to get from dataManager as fallback
        if (window.app.dataManager) {
            const facilities = window.app.dataManager.getFacilities();
            const facility = facilities.find(f => f.id === facilityId);
            if (facility) {
                return facility.account_name || facility.name || facilityId;
            }
        }
        
        return `Unknown Facility (${facilityId.substring(0, 8)}...)`;
    }

    updateStats(users) {
        // Use centralized role statistics
        const stats = getRoleStats(users);

        const totalElement = document.getElementById('totalUsersCount');
        const activeElement = document.getElementById('activeUsersCount');
        const managersElement = document.getElementById('managersCount');
        const repsElement = document.getElementById('repsCount');

        if (totalElement) totalElement.textContent = stats.total;
        if (activeElement) activeElement.textContent = stats.active;
        if (managersElement) managersElement.textContent = stats.managers;
        if (repsElement) repsElement.textContent = stats.reps;
    }

    showUpdatePasswordModal(userId, userName) {
        // Populate the modal with user information
        document.getElementById('passwordUpdateUserId').value = userId;
        document.getElementById('passwordUpdateUserName').value = userName;
        
        // Clear the form
        document.getElementById('updateUserPasswordForm').reset();
        document.getElementById('passwordUpdateUserId').value = userId;
        document.getElementById('passwordUpdateUserName').value = userName;
        
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('updateUserPasswordModal'));
        modal.show();
    }

    async updateUserPassword() {
        const userId = document.getElementById('passwordUpdateUserId').value;
        
        if (!userId) {
            this.showNotification('User ID not found', 'error');
            return;
        }

        try {
            // Import Firebase Auth functions
            const { sendPasswordResetEmail, getAuth } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js");
            const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");

            const auth = getAuth();
            
            // Get user's email from Firestore
            const userRef = doc(this.db, 'users', userId);
            const userDoc = await getDoc(userRef);
            
            if (!userDoc.exists()) {
                throw new Error('User not found');
            }
            
            const userData = userDoc.data();
            const userEmail = userData.email;
            
            if (!userEmail) {
                throw new Error('User email not found');
            }

            // Send password reset email using Firebase
            await sendPasswordResetEmail(auth, userEmail);

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('updateUserPasswordModal'));
            modal.hide();

            // Show success notification
            this.showNotification(`Password reset email sent to ${userEmail}. User will receive instructions to reset their password.`, 'success');
            
            // Clear form
            document.getElementById('updateUserPasswordForm').reset();

        } catch (error) {
            console.error('Error updating user password:', error);
            this.showNotification('Error updating password: ' + error.message, 'error');
        }
    }

    showSuccessNotification(message) {
        this.showNotification(message, 'success');
    }

    showErrorNotification(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            color: white;
            font-weight: 500;
            box-shadow: var(--shadow-lg);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        switch (type) {
            case 'success':
                notification.style.background = 'var(--success-green)';
                break;
            case 'error':
                notification.style.background = 'var(--danger-red)';
                break;
            default:
                notification.style.background = 'var(--primary-blue)';
        }

        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; margin-left: auto; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    /**
     * Initialize role dropdowns with centralized role options
     */
    initializeRoleDropdowns() {
        try {
            // Populate add user role dropdown
            populateRoleSelect('userRole', '', true);

            // Populate edit user role dropdown
            populateRoleSelect('editUserRole', '', true);

            console.log('✅ Role dropdowns initialized with centralized role system');
        } catch (error) {
            console.error('❌ Error initializing role dropdowns:', error);
        }
    }
}