// js/AuthManager.js - Updated for Tray Tracker
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { signInWithPopup, GoogleAuthProvider, signInWithRedirect, getRedirectResult } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";

export class AuthManager {
    constructor(auth, db) {
        this.auth = auth;
        this.db = db;
        this.currentUser = null;
        this.unsubscribeAuth = null;
        this.googleProvider = new GoogleAuthProvider();
        this.setupAuthListener();
        this.setupFormListeners();
    }

    setupAuthListener() {
        if (!this.auth) return;
        this.checkRedirectResult();

        this.unsubscribeAuth = onAuthStateChanged(this.auth, async (user) => {
            if (user) {
                // User is signed in
                const userData = await this.getUserData(user.uid);
                this.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    ...userData
                };

                this.updateUserDisplay();
                this.showMainApp();
                this.checkInitialData();
            } else {
                // User is signed out
                this.currentUser = null;
                this.showLogin();
            }
        });
    }

    updateUserDisplay() {
        const userNameElement = document.getElementById('currentUserName');
        const userAvatarElement = document.getElementById('userAvatar');

        if (userNameElement) {
            userNameElement.textContent = this.currentUser.name || this.currentUser.email;
        }

        if (userAvatarElement) {
            if (this.currentUser.photoURL) {
                // Show Google profile photo
                userAvatarElement.innerHTML = `<img src="${this.currentUser.photoURL}" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            } else {
                // Show initials as fallback
                const initials = this.getInitials(this.currentUser.name || this.currentUser.email);
                userAvatarElement.textContent = initials;
            }
        }
    }


    getInitials(name) {
        if (!name) return '??';
        return name.split(' ')
            .map(word => word.charAt(0))
            .join('')
            .substring(0, 2)
            .toUpperCase();
    }

    async checkInitialData() {
        try {
            setTimeout(async () => {
                if (window.app && window.app.demoManager) {
                    const dataInitialized = await window.app.demoManager.checkAndInitializeData();
                    if (dataInitialized) {
                        console.log('Initial demo data was created for new Firebase database');
                        this.showDataInitializedNotification();
                    }
                }
            }, 2000);
        } catch (error) {
            console.error('Error checking initial data:', error);
        }
    }

    showDataInitializedNotification() {
        const notification = document.createElement('div');
        notification.className = 'notification notification-success';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            padding: 1.5rem;
            border-radius: 0.75rem;
            color: white;
            font-weight: 500;
            background: var(--success-green);
            box-shadow: var(--shadow-xl);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        notification.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 1rem;">
                <div style="background: rgba(255,255,255,0.2); border-radius: 50%; padding: 0.5rem; margin-top: 0.25rem;">
                    <i class="fas fa-rocket" style="font-size: 1.25rem;"></i>
                </div>
                <div style="flex: 1;">
                    <h6 style="margin: 0 0 0.5rem 0; color: white;">Welcome to Tray Tracker!</h6>
                    <p style="margin: 0; font-size: 0.875rem; opacity: 0.9;">Demo data has been initialized for your new database. You're ready to explore all features.</p>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; font-size: 1.25rem; opacity: 0.7;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 500);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 8000);
    }

    setupFormListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('loginEmail').value;
                const password = document.getElementById('loginPassword').value;
                await this.signIn(email, password);
            });
        }

        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('registerName').value;
                const email = document.getElementById('registerEmail').value;
                const password = document.getElementById('registerPassword').value;
                const role = document.getElementById('registerRole').value;
                const phone = document.getElementById('registerPhone').value;

                await this.register(name, email, password, role, phone);
            });
        }
    }

    async signIn(email, password) {
        try {
            this.showLoadingState('Signing in...');
            await signInWithEmailAndPassword(this.auth, email, password);
        } catch (error) {
            console.error('Sign in error:', error);
            this.showErrorNotification('Sign in failed: ' + this.getErrorMessage(error));
            this.hideLoadingState();
        }
    }

    async register(name, email, password, role, phone) {
        try {
            this.showLoadingState('Creating account...');
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            const user = userCredential.user;

            // Save user profile to Firestore
            await setDoc(doc(this.db, 'users', user.uid), {
                name,
                email,
                role,
                phone,
                createdAt: serverTimestamp(),
                active: true,
                isDemoUser: false
            });

            this.showSuccessNotification('Account created successfully!');
        } catch (error) {
            console.error('Registration error:', error);
            this.showErrorNotification('Registration failed: ' + this.getErrorMessage(error));
            this.hideLoadingState();
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
            this.showErrorNotification('Logout failed: ' + error.message);
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
        this.hideLoadingState();
        document.getElementById('loginScreen').classList.remove('d-none');
        document.getElementById('registerScreen').classList.add('d-none');
        document.getElementById('mainApp').classList.add('d-none');
    }

    showRegister() {
        this.hideLoadingState();
        document.getElementById('loginScreen').classList.add('d-none');
        document.getElementById('registerScreen').classList.remove('d-none');
        document.getElementById('mainApp').classList.add('d-none');
    }

    showMainApp() {
        this.hideLoadingState();
        document.getElementById('loginScreen').classList.add('d-none');
        document.getElementById('registerScreen').classList.add('d-none');
        document.getElementById('mainApp').classList.remove('d-none');

        // Initialize data when user logs in
        if (window.app && window.app.dataManager) {
            console.log('Initializing DataManager...');
            window.app.dataManager.initializeData();

            // Wait a moment then show dashboard
            setTimeout(() => {
                if (window.app.viewManager) {
                    window.app.viewManager.showView('dashboard');
                }
            }, 500);
        } else {
            console.error('DataManager not available');
        }
    }

    showLoadingState(message = 'Loading...') {
        const loadingScreen = document.getElementById('loadingScreen');
        const loadingText = document.querySelector('.loading-text');

        if (loadingScreen) {
            loadingScreen.classList.remove('d-none');
        }

        if (loadingText) {
            loadingText.textContent = message;
        }
    }

    hideLoadingState() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('d-none');
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getErrorMessage(error) {
        const errorMessages = {
            'auth/user-not-found': 'No account found with this email address.',
            'auth/wrong-password': 'Incorrect password.',
            'auth/email-already-in-use': 'An account with this email already exists.',
            'auth/weak-password': 'Password should be at least 6 characters.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
            'auth/network-request-failed': 'Network error. Please check your connection.',
        };

        return errorMessages[error.code] || error.message || 'An error occurred. Please try again.';
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

    async signInWithGoogle() {
        try {
            this.showLoadingState('Signing in with Google...');

            // Try popup first, fallback to redirect if needed
            try {
                const result = await signInWithPopup(this.auth, this.googleProvider);
                await this.handleGoogleSignInResult(result);
            } catch (popupError) {
                if (popupError.code === 'auth/popup-blocked' ||
                    popupError.code === 'auth/popup-closed-by-user') {
                    console.log('Popup blocked, trying redirect...');
                    await signInWithRedirect(this.auth, this.googleProvider);
                    return; // Don't hide loading state, will be handled after redirect
                }
                throw popupError;
            }

        } catch (error) {
            console.error('Google sign in error:', error);
            this.showErrorNotification('Google sign in failed: ' + this.getErrorMessage(error));
            this.hideLoadingState();
        }
    }

    async handleGoogleSignInResult(result) {
        try {
            const user = result.user;
            const credential = GoogleAuthProvider.credentialFromResult(result);

            // Check if user profile exists in Firestore
            const existingProfile = await this.getUserData(user.uid);

            // Create or update user profile
            const userProfile = {
                name: user.displayName || '',
                email: user.email || '',
                photoURL: user.photoURL || '',
                lastLogin: serverTimestamp(),
                isDemoUser: false,
                ...existingProfile // Keep existing data if profile already exists
            };

            // Only set these fields for new users
            if (!existingProfile || Object.keys(existingProfile).length === 0) {
                userProfile.createdAt = serverTimestamp();
                userProfile.role = ''; // No role assigned initially
                userProfile.phone = '';
                userProfile.region = '';
                userProfile.active = true;
            }

            await setDoc(doc(this.db, 'users', user.uid), userProfile, { merge: true });

            this.showSuccessNotification(`Welcome ${user.displayName || user.email}!`);

        } catch (error) {
            console.error('Error handling Google sign in result:', error);
            this.showErrorNotification('Error saving user profile: ' + error.message);
            throw error;
        }
    }

    async checkRedirectResult() {
        try {
            const result = await getRedirectResult(this.auth);
            if (result) {
                await this.handleGoogleSignInResult(result);
            }
        } catch (error) {
            console.error('Redirect result error:', error);
            this.showErrorNotification('Authentication failed: ' + this.getErrorMessage(error));
        }
    }

    cleanup() {
        if (this.unsubscribeAuth) {
            this.unsubscribeAuth();
        }
    }
}