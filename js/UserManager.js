// js/UserManager.js - Updated for Tray Tracker
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

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
            const name = document.getElementById('userName').value;
            const email = document.getElementById('userEmail').value;
            const password = document.getElementById('userPassword').value;
            const role = document.getElementById('userRole').value;
            const phone = document.getElementById('userPhone').value;
            const region = document.getElementById('userRegion').value;
            const active = document.getElementById('userActive').checked;

            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(this.db, 'users', user.uid), {
                name,
                email,
                role,
                phone,
                region,
                active,
                createdAt: serverTimestamp(),
                createdBy: window.app.authManager.getCurrentUser()?.uid,
                isDemoUser: false
            });

            bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
            document.getElementById('addUserForm').reset();

            this.showSuccessNotification('User created successfully!');
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
            const region = document.getElementById('editUserRegion').value;
            const active = document.getElementById('editUserActive').checked;

            await updateDoc(doc(this.db, 'users', userId), {
                name,
                role,
                phone,
                region,
                active,
                lastModified: serverTimestamp(),
                modifiedBy: window.app.authManager.getCurrentUser()?.uid
            });

            bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();
            this.showSuccessNotification('User updated successfully!');
        } catch (error) {
            console.error('Error updating user:', error);
            this.showErrorNotification('Error updating user: ' + error.message);
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
        console.log('UserManager received users update:', users);

        if (users instanceof Map) {
            this.currentUsers = Array.from(users.values());
        } else if (Array.isArray(users)) {
            this.currentUsers = users;
        } else {
            console.log('No valid users data received');
            this.currentUsers = [];
        }

        console.log('Processing users:', this.currentUsers.length);
        this.renderUsers(this.currentUsers);
        this.updateStats(this.currentUsers);
    }

    renderUsers(users) {
        console.log('Rendering users in view mode:', this.viewMode, 'Users count:', users.length);

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
            </div>

            <div class="user-actions">
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showEditUserModal('${user.id}')">
                    <i class="fas fa-edit"></i> Edit
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
                    <label>Created</label>
                    <span class="empty-value">${this.formatDate(user.createdAt) || 'Unknown'}</span>
                </div>
            </div>
            
            <div class="user-horizontal-actions">
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showEditUserModal('${user.id}')">
                    <i class="fas fa-edit"></i> Edit
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
        const roleClasses = {
            'Territory Manager': 'role-manager',
            'Sales Rep': 'role-rep',
            'Clinical Specialist': 'role-specialist',
            'Manager': 'role-manager',
            'Admin': 'role-admin'
        };
        return roleClasses[role] || 'role-rep';
    }

    formatDate(timestamp) {
        if (!timestamp) return null;
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString();
    }

    updateStats(users) {
        const stats = {
            total: users.length,
            active: users.filter(u => u.active !== false).length,
            managers: users.filter(u => u.role === 'Territory Manager' || u.role === 'Manager').length,
            reps: users.filter(u => u.role === 'Sales Rep').length
        };

        const totalElement = document.getElementById('totalUsersCount');
        const activeElement = document.getElementById('activeUsersCount');
        const managersElement = document.getElementById('managersCount');
        const repsElement = document.getElementById('repsCount');

        if (totalElement) totalElement.textContent = stats.total;
        if (activeElement) activeElement.textContent = stats.active;
        if (managersElement) managersElement.textContent = stats.managers;
        if (repsElement) repsElement.textContent = stats.reps;
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
}