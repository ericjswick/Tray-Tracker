// js/AuthManager.js
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class AuthManager {
    constructor(auth, db) {
        this.auth = auth;
        this.db = db;
        this.currentUser = null;
        this.unsubscribeAuth = null;
        this.setupAuthListener();
        this.setupFormListeners();
    }

    setupAuthListener() {
        if (!this.auth) return;

        this.unsubscribeAuth = onAuthStateChanged(this.auth, async (user) => {
            if (user) {
                // User is signed in
                const userData = await this.getUserData(user.uid);
                this.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    ...userData
                };

                document.getElementById('currentUserName').textContent = this.currentUser.name || user.email;
                this.showMainApp();

                // Check and initialize demo data if needed
                this.checkInitialData();
            } else {
                // User is signed out
                this.currentUser = null;
                this.showLogin();
            }
        });
    }

    async checkInitialData() {
        try {
            // Small delay to ensure dataManager is ready
            setTimeout(async () => {
                if (window.app && window.app.demoManager) {
                    const dataInitialized = await window.app.demoManager.checkAndInitializeData();
                    if (dataInitialized) {
                        console.log('Initial demo data was created for new Firebase database');

                        // Show a subtle notification
                        this.showDataInitializedNotification();
                    }
                }
            }, 2000);
        } catch (error) {
            console.error('Error checking initial data:', error);
        }
    }

    showDataInitializedNotification() {
        // Create a subtle notification that data was initialized
        const notification = document.createElement('div');
        notification.className = 'alert alert-info alert-dismissible fade show position-fixed';
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 350px;';
        notification.innerHTML = `
            <i class="fas fa-info-circle"></i>
            <strong>Welcome!</strong> Demo data has been initialized for your new database.
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    setupFormListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            await this.signIn(email, password);
        });

        // Register form
        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const role = document.getElementById('registerRole').value;
            const phone = document.getElementById('registerPhone').value;

            await this.register(name, email, password, role, phone);
        });
    }

    async signIn(email, password) {
        try {
            await signInWithEmailAndPassword(this.auth, email, password);
        } catch (error) {
            console.error('Sign in error:', error);
            alert('Sign in failed: ' + error.message);
        }
    }

    async register(name, email, password, role, phone) {
        try {
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            const user = userCredential.user;

            // Save user profile to Firestore
            await setDoc(doc(this.db, 'users', user.uid), {
                name,
                email,
                role,
                phone,
                createdAt: serverTimestamp()
            });

            alert('Account created successfully!');
        } catch (error) {
            console.error('Registration error:', error);
            alert('Registration failed: ' + error.message);
        }
    }

    async demoLogin(email, password) {
        await this.signIn(email, password);
    }

    async logout() {
        try {
            await signOut(this.auth);
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    async getUserData(uid) {
        try {
            const userDoc = await getDoc(doc(this.db, 'users', uid));
            return userDoc.exists() ? userDoc.data() : {};
        } catch (error) {
            console.error('Error fetching user data:', error);
            return {};
        }
    }

    showLogin() {
        document.getElementById('loginScreen').classList.remove('d-none');
        document.getElementById('registerScreen').classList.add('d-none');
        document.getElementById('mainApp').classList.add('d-none');
    }

    showRegister() {
        document.getElementById('loginScreen').classList.add('d-none');
        document.getElementById('registerScreen').classList.remove('d-none');
        document.getElementById('mainApp').classList.add('d-none');
    }

    showMainApp() {
        document.getElementById('loginScreen').classList.add('d-none');
        document.getElementById('registerScreen').classList.add('d-none');
        document.getElementById('mainApp').classList.remove('d-none');

        // Initialize data when user logs in
        if (window.app && window.app.dataManager) {
            window.app.dataManager.initializeData();
            window.app.viewManager.showView('dashboard');
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    cleanup() {
        if (this.unsubscribeAuth) {
            this.unsubscribeAuth();
        }
    }
}