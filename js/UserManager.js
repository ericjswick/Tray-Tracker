// js/UserManager.js
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
        return localStorage.getItem('userViewMode') || 'list';
    }

    setViewMode(mode) {
        this.viewMode = mode;
        localStorage.setItem('userViewMode', mode);

        const cardBtn = document.getElementById('userCardViewBtn');
        const listBtn = document.getElementById('userListViewBtn');

        if (mode === 'card') {
            cardBtn?.classList.add('active');
            listBtn?.classList.remove('active');
            document.getElementById('userCardView')?.classList.remove('d-none');
            document.getElementById('userListView')?.classList.add('d-none');
        } else {
            listBtn?.classList.add('active');
            cardBtn?.classList.remove('active');
            document.getElementById('userCardView')?.classList.add('d-none');
            document.getElementById('userListView')?.classList.remove('d-none');
        }

        this.renderUsers(this.currentUsers);
    }

    initializeViewMode() {
        this.setViewMode(this.viewMode);

        // Show loading state initially
        this.showLoadingState();

        // Get existing users data from DataManager if available
        if (window.app.dataManager && window.app.dataManager.users) {
            this.handleUsersUpdate(window.app.dataManager.users);
        }
    }

    showLoadingState() {
        const userCardView = document.getElementById('userCardView');
        const userListView = document.getElementById('userListView');

        if (userCardView) {
            userCardView.innerHTML = `
                <div class="col-12 text-center">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading users...</p>
                </div>
            `;
        }

        if (userListView) {
            const userHorizontalCards = document.getElementById('userHorizontalCards');
            if (userHorizontalCards) {
                userHorizontalCards.innerHTML = `
                    <div class="text-center text-muted py-5">
                        <div class="spinner-border" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
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

            // Create user account in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            const user = userCredential.user;

            // Create user profile in Firestore
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

            alert('User created successfully!');
        } catch (error) {
            console.error('Error adding user:', error);
            alert('Error adding user: ' + error.message);
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

            alert('User updated successfully!');
        } catch (error) {
            console.error('Error updating user:', error);
            alert('Error updating user: ' + error.message);
        }
    }

    async deleteUser(userId, userName) {
        if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await deleteDoc(doc(this.db, 'users', userId));
            alert('User deleted successfully!');
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Error deleting user: ' + error.message);
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
        console.log('Rendering users card view with', users.length, 'users');
        const userCardView = document.getElementById('userCardView');
        console.log('userCardView element found:', !!userCardView);

        if (!userCardView) {
            console.error('userCardView element not found!');
            return;
        }

        if (users.length === 0) {
            userCardView.innerHTML = `
                <div class="col-12 text-center">
                    <p class="text-muted">No users found. Add a new user to get started.</p>
                </div>
            `;
            return;
        }

        userCardView.innerHTML = '';
        users.forEach((user, index) => {
            console.log('Creating card for user:', user.name || user.email, 'Index:', index);
            const userCard = this.createUserCard(user);
            userCardView.appendChild(userCard);
        });
        console.log('Card view rendering complete');
    }

    renderListView(users) {
        console.log('Rendering users list view with', users.length, 'users');
        const userHorizontalCards = document.getElementById('userHorizontalCards');
        console.log('userHorizontalCards element found:', !!userHorizontalCards);

        if (!userHorizontalCards) {
            console.error('userHorizontalCards element not found!');
            return;
        }

        if (users.length === 0) {
            userHorizontalCards.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-users fa-3x mb-3 opacity-50"></i>
                    <p class="mb-0">No users found. Add a new user to get started.</p>
                </div>
            `;
            return;
        }

        userHorizontalCards.innerHTML = '';
        users.forEach((user, index) => {
            console.log('Creating horizontal card for user:', user.name || user.email, 'Index:', index);
            const userCard = this.createHorizontalUserCard(user);
            userHorizontalCards.appendChild(userCard);
            console.log('Card appended, container children count:', userHorizontalCards.children.length);
        });
        console.log('List view rendering complete. Final container HTML length:', userHorizontalCards.innerHTML.length);
        console.log('Container visible height:', userHorizontalCards.offsetHeight);
        console.log('Container content preview:', userHorizontalCards.innerHTML.substring(0, 200) + '...');
    }

    createUserCard(user) {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4 mb-3';

        const roleClass = this.getRoleClass(user.role);
        const statusClass = user.active ? 'text-success' : 'text-danger';
        const statusText = user.active ? 'Active' : 'Inactive';

        col.innerHTML = `
            <div class="card user-card h-100">
                <div class="card-body">
                    <div class="d-flex align-items-start mb-3">
                        <div class="user-avatar me-3">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="card-title mb-1">${user.name}</h6>
                            <p class="card-text text-muted mb-1">${user.role}</p>
                            <small class="${statusClass}">
                                <i class="fas fa-circle"></i> ${statusText}
                            </small>
                        </div>
                    </div>
                    <div class="user-details">
                        <p class="mb-1">
                            <small class="text-muted">
                                <i class="fas fa-envelope me-2"></i>${user.email}
                            </small>
                        </p>
                        ${user.phone ? `<p class="mb-1">
                            <small class="text-muted">
                                <i class="fas fa-phone me-2"></i>${user.phone}
                            </small>
                        </p>` : ''}
                        ${user.region ? `<p class="mb-2">
                            <small class="text-muted">
                                <i class="fas fa-map-marker-alt me-2"></i>${user.region}
                            </small>
                        </p>` : ''}
                    </div>
                    <div class="mt-auto">
                        <div class="btn-group w-100" role="group">
                            <button class="btn btn-sm btn-outline-primary" onclick="app.modalManager.showEditUserModal('${user.id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="app.userManager.deleteUser('${user.id}', '${user.name}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return col;
    }

    createHorizontalUserCard(user) {
        const card = document.createElement('div');
        card.className = 'user-horizontal-card';

        const roleClass = this.getRoleClass(user.role);
        const statusClass = user.active !== false ? 'text-success' : 'text-danger';
        const statusText = user.active !== false ? 'Active' : 'Inactive';

        console.log('Creating card HTML for user:', user.name || user.email);

        card.innerHTML = `
            <div class="user-horizontal-header">
                <div class="user-horizontal-title">
                    <div class="user-avatar-horizontal">
                        <i class="fas fa-user"></i>
                    </div>
                    <div>
                        <h6>${user.name || user.email || 'Unknown User'}</h6>
                        <small class="text-muted">${user.role || 'No Role'}</small>
                    </div>
                </div>
                <div class="user-horizontal-status">
                    <span class="badge ${user.active !== false ? 'bg-success' : 'bg-danger'}">${statusText}</span>
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
                    <label>Last Login</label>
                    <span class="empty-value">Not tracked</span>
                </div>
            </div>
            
            <div class="user-horizontal-actions">
                <button class="btn btn-sm btn-outline-primary" onclick="app.modalManager.showEditUserModal('${user.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="app.userManager.deleteUser('${user.id}', '${user.name || user.email}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;

        console.log('Card HTML created, height:', card.offsetHeight);
        return card;
    }

    getRoleClass(role) {
        const roleClasses = {
            'Territory Manager': 'bg-primary',
            'Sales Rep': 'bg-success',
            'Clinical Specialist': 'bg-info',
            'Manager': 'bg-warning',
            'Admin': 'bg-danger'
        };
        return roleClasses[role] || 'bg-secondary';
    }

    updateStats(users) {
        const stats = {
            total: users.length,
            active: users.filter(u => u.active).length,
            managers: users.filter(u => u.role === 'Territory Manager' || u.role === 'Manager').length,
            reps: users.filter(u => u.role === 'Sales Rep').length
        };

        document.getElementById('totalUsersCount').textContent = stats.total;
        document.getElementById('activeUsersCount').textContent = stats.active;
        document.getElementById('managersCount').textContent = stats.managers;
        document.getElementById('repsCount').textContent = stats.reps;
    }
}