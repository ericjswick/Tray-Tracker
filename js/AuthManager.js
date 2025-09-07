// js/AuthManager.js - Updated for Tray Tracker
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { signInWithPopup, GoogleAuthProvider, signInWithRedirect, getRedirectResult } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";

export class AuthManager {
    constructor(auth, db) {
        this.auth = auth;
        this.db = db;
        this.currentUser = null;
        this.unsubscribeAuth = null;
        
        try {
            this.googleProvider = new GoogleAuthProvider();
            window.frontendLogger?.info('AuthManager constructor completed', {
                hasAuth: !!this.auth,
                hasDb: !!this.db,
                hasGoogleProvider: !!this.googleProvider,
                authAppName: this.auth?.app?.name || 'unknown'
            }, 'auth');
        } catch (error) {
            window.frontendLogger?.error('Failed to create Google Auth Provider', {
                message: error.message,
                stack: error.stack
            }, 'auth');
            throw error;
        }
        
        this.setupAuthListener();
        this.setupFormListeners();
    }

    setupAuthListener() {
        if (!this.auth) return;
        
        // Log authentication setup
        window.frontendLogger?.info('Setting up authentication listener', {
            hasAuth: !!this.auth,
            hasDb: !!this.db,
            hasGoogleProvider: !!this.googleProvider
        }, 'auth');
        
        this.checkRedirectResult();

        this.unsubscribeAuth = onAuthStateChanged(this.auth, async (user) => {
            if (user) {
                // User is signed in
                window.frontendLogger?.info('Authentication state: user signed in', {
                    email: user.email,
                    uid: user.uid,
                    providerId: user.providerId
                }, 'auth');
                
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
                window.frontendLogger?.info('Authentication state: user signed out', null, 'auth');
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
                    console.log('🚀 Starting post-login data initialization...');
                    const dataInitialized = await window.app.demoManager.checkAndInitializeData();
                    if (dataInitialized) {
                        console.log('Initial demo data was created for new Firebase database');
                        this.showDataInitializedNotification();
                    }
                    console.log('✅ Post-login data initialization completed');
                }
            }, 2500); // Slightly longer delay to ensure duplicateRemover is available
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

            // Wait for ViewManager routing to be initialized, then navigate appropriately
            this.waitForRoutingAndNavigate();
        } else {
            console.error('DataManager not available');
        }
    }

    async waitForRoutingAndNavigate() {
        console.log('🔄 Waiting for routing to be initialized...');
        
        // Wait for ViewManager to be available and routing initialized
        const maxWait = 50; // 5 seconds max
        let attempts = 0;
        
        while (attempts < maxWait) {
            if (window.app.viewManager && window.app.viewManager.routingStrategy) {
                console.log('✅ Routing is ready, determining navigation...');
                
                // Check what view the routing system determined
                const currentView = window.app.viewManager.currentView;
                console.log('Current view after routing init:', currentView);
                
                // If routing detected a specific view from URL, preserve it
                if (currentView && currentView !== 'dashboard' && currentView !== 'login') {
                    console.log('✅ Preserving URL-determined view:', currentView);
                    return; // ViewManager already set the correct view
                }
                
                // Otherwise check URL manually and navigate
                const urlBasedView = this.getViewFromCurrentUrl();
                if (urlBasedView && urlBasedView !== 'dashboard') {
                    console.log('🎯 Navigating to URL-based view:', urlBasedView);
                    window.app.viewManager.showView(urlBasedView, false);
                } else {
                    console.log('📍 Navigating to dashboard (default)');
                    window.app.viewManager.showView('dashboard');
                }
                return;
            }
            
            // Wait 100ms before checking again
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        console.warn('⚠️ Routing initialization timeout, using fallback navigation');
        // Fallback navigation if routing doesn't initialize
        if (window.app.viewManager) {
            window.app.viewManager.showView('dashboard');
        }
    }

    getViewFromCurrentUrl() {
        // Helper method to extract view from current URL
        const currentPath = window.location.pathname;
        const currentHash = window.location.hash;
        
        // Check for clean URLs first
        if (currentPath !== '/' && currentPath !== '') {
            const pathView = currentPath.substring(1); // Remove leading slash
            if (this.isValidViewName(pathView)) {
                return pathView;
            }
        }
        
        // Check for hash URLs
        if (currentHash && currentHash.length > 1) {
            const hashView = currentHash.substring(1); // Remove leading #
            if (this.isValidViewName(hashView)) {
                return hashView;
            }
        }
        
        return null;
    }
    
    isValidViewName(viewName) {
        const validViews = [
            'dashboard', 'team', 'locations', 'trays', 'users', 
            'locationadmin', 'surgeons', 'map', 'casetypes', 'cases'
        ];
        return validViews.includes(viewName);
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
            // Log authentication attempt start
            window.frontendLogger?.info('Google sign-in initiated', {
                provider: 'Google',
                method: 'popup/redirect',
                timestamp: new Date().toISOString()
            }, 'auth');
            
            this.showLoadingState('Signing in with Google...');

            // Try popup first, fallback to redirect if needed
            let result;
            try {
                window.frontendLogger?.debug('Attempting Google popup sign-in', null, 'auth');
                result = await signInWithPopup(this.auth, this.googleProvider);
                window.frontendLogger?.info('Google popup sign-in successful', {
                    uid: result.user.uid,
                    email: result.user.email,
                    displayName: result.user.displayName
                }, 'auth');
            } catch (popupError) {
                window.frontendLogger?.warn('Google popup sign-in failed', {
                    code: popupError.code,
                    message: popupError.message,
                    stack: popupError.stack
                }, 'auth');
                
                if (popupError.code === 'auth/popup-blocked' ||
                    popupError.code === 'auth/popup-closed-by-user') {
                    window.frontendLogger?.info('Popup blocked, switching to redirect method', {
                        originalError: popupError.code
                    }, 'auth');
                    console.log('Popup blocked, trying redirect...');
                    await signInWithRedirect(this.auth, this.googleProvider);
                    return; // Don't hide loading state, will be handled after redirect
                }
                throw popupError;
            }

            // Check if Gmail address exists in users collection BEFORE completing sign-in
            const user = result.user;
            console.log('Checking authorization for Gmail:', user.email);
            window.frontendLogger?.info('Checking Gmail authorization', {
                email: user.email,
                uid: user.uid,
                providerId: user.providerId
            }, 'auth');
            
            const userQuery = query(
                collection(this.db, 'users'), 
                where('email', '==', user.email)
            );
            const querySnapshot = await getDocs(userQuery);
            
            window.frontendLogger?.debug('Firestore user query completed', {
                email: user.email,
                queryEmpty: querySnapshot.empty,
                docCount: querySnapshot.size
            }, 'auth');
            
            if (querySnapshot.empty) {
                // Special case: Auto-create dino.bartolome@gmail.com as administrator
                if (user.email === 'dino.bartolome@gmail.com') {
                    console.log('Auto-creating administrator account for:', user.email);
                    window.frontendLogger?.info('Auto-creating administrator account', {
                        email: user.email,
                        uid: user.uid,
                        action: 'admin-account-creation'
                    }, 'auth');
                    
                    // Create admin user profile
                    await setDoc(doc(this.db, 'users', user.uid), {
                        email: user.email,
                        firstName: 'Dino',
                        lastName: 'Bartolome',
                        role: 'Administrator',
                        department: 'IT',
                        phone: '',
                        isActive: true,
                        isAdmin: true,  // Administrator flag
                        googleAuth: true,
                        googleUID: user.uid,
                        createdAt: serverTimestamp(),
                        lastLogin: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                    
                    console.log('Administrator account created successfully');
                    window.frontendLogger?.info('Administrator account created successfully', {
                        email: user.email,
                        uid: user.uid,
                        role: 'Administrator'
                    }, 'auth');
                } else {
                    // User doesn't exist - sign them out and show error
                    console.log('Gmail address not authorized:', user.email);
                    window.frontendLogger?.error('Gmail address not authorized', {
                        email: user.email,
                        uid: user.uid,
                        action: 'access-denied'
                    }, 'auth');
                    
                    await signOut(this.auth);
                    window.frontendLogger?.info('User signed out due to unauthorized email', {
                        email: user.email
                    }, 'auth');
                    
                    throw new Error(`Access denied. Your Gmail address (${user.email}) is not authorized for this system. Please contact your administrator to request access.`);
                }
            } else {
                // User exists - handle UID linking for existing profile
                console.log('Gmail address authorized, handling UID linking:', user.email);
                window.frontendLogger?.info('Gmail address authorized - handling UID linking', {
                    email: user.email,
                    uid: user.uid,
                    action: 'uid-linking'
                }, 'auth');
                
                const existingUserDoc = querySnapshot.docs[0];
                const existingUserId = existingUserDoc.id;
                const existingUserData = existingUserDoc.data();
                
                console.log('Existing user found:', existingUserId, 'New Google UID:', user.uid);
                window.frontendLogger?.debug('Existing user profile found', {
                    existingUserId,
                    newGoogleUID: user.uid,
                    needsUIDTransfer: existingUserId !== user.uid
                }, 'auth');
                
                if (existingUserId !== user.uid) {
                    // Transfer existing profile to new Google Auth UID
                    console.log('Transferring user profile from', existingUserId, 'to', user.uid);
                    window.frontendLogger?.info('Transferring user profile to Google UID', {
                        fromUID: existingUserId,
                        toUID: user.uid,
                        email: user.email
                    }, 'auth');
                    
                    await setDoc(doc(this.db, 'users', user.uid), {
                        ...existingUserData,
                        googleAuth: true,
                        googleUID: user.uid,
                        lastLogin: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                    
                    // Remove old document with different UID
                    console.log('Cleaning up old user document:', existingUserId);
                    await deleteDoc(doc(this.db, 'users', existingUserId));
                    
                    console.log('User profile successfully transferred to new Google UID');
                    window.frontendLogger?.info('User profile transfer completed successfully', {
                        email: user.email,
                        newUID: user.uid
                    }, 'auth');
                } else {
                    // Same UID - just update last login
                    window.frontendLogger?.debug('Same UID detected - updating last login', {
                        uid: user.uid,
                        email: user.email
                    }, 'auth');
                    
                    await setDoc(doc(this.db, 'users', user.uid), {
                        ...existingUserData,
                        googleAuth: true,
                        lastLogin: serverTimestamp()
                    }, { merge: true });
                }
            }
            
            // Proceed with normal Google sign-in flow
            window.frontendLogger?.info('Proceeding with Google sign-in flow completion', {
                email: user.email,
                uid: user.uid
            }, 'auth');
            await this.handleGoogleSignInResult(result);

        } catch (error) {
            console.error('Google sign in error:', error);
            window.frontendLogger?.error('Google sign-in failed', {
                code: error.code || 'unknown',
                message: error.message,
                stack: error.stack,
                isAccessDenied: error.message.includes('Access denied')
            }, 'auth');
            
            // Show user-friendly error message for unauthorized access
            if (error.message.includes('Access denied')) {
                this.showErrorNotification(error.message);
            } else {
                this.showErrorNotification('Google sign in failed: ' + this.getErrorMessage(error));
            }
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
            window.frontendLogger?.debug('Checking for Google redirect result', null, 'auth');
            const result = await getRedirectResult(this.auth);
            if (result) {
                // Apply same authorization check for redirect results
                const user = result.user;
                console.log('Checking authorization for Gmail redirect:', user.email);
                window.frontendLogger?.info('Google redirect authentication received', {
                    email: user.email,
                    uid: user.uid,
                    method: 'redirect'
                }, 'auth');
                
                const userQuery = query(
                    collection(this.db, 'users'), 
                    where('email', '==', user.email)
                );
                const querySnapshot = await getDocs(userQuery);
                
                if (querySnapshot.empty) {
                    // User doesn't exist - sign them out and show error
                    console.log('Gmail address not authorized (redirect):', user.email);
                    await signOut(this.auth);
                    throw new Error(`Access denied. Your Gmail address (${user.email}) is not authorized for this system. Please contact your administrator to request access.`);
                }
                
                // User exists - handle UID linking for existing profile (redirect)
                console.log('Gmail address authorized (redirect), handling UID linking:', user.email);
                const existingUserDoc = querySnapshot.docs[0];
                const existingUserId = existingUserDoc.id;
                const existingUserData = existingUserDoc.data();
                
                console.log('Existing user found (redirect):', existingUserId, 'New Google UID:', user.uid);
                
                if (existingUserId !== user.uid) {
                    // Transfer existing profile to new Google Auth UID
                    console.log('Transferring user profile (redirect) from', existingUserId, 'to', user.uid);
                    
                    await setDoc(doc(this.db, 'users', user.uid), {
                        ...existingUserData,
                        googleAuth: true,
                        googleUID: user.uid,
                        lastLogin: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                    
                    // Remove old document with different UID
                    console.log('Cleaning up old user document (redirect):', existingUserId);
                    await deleteDoc(doc(this.db, 'users', existingUserId));
                    
                    console.log('User profile successfully transferred to new Google UID (redirect)');
                } else {
                    // Same UID - just update last login
                    await setDoc(doc(this.db, 'users', user.uid), {
                        ...existingUserData,
                        googleAuth: true,
                        lastLogin: serverTimestamp()
                    }, { merge: true });
                }
                
                // Proceed with normal Google sign-in flow
                await this.handleGoogleSignInResult(result);
            }
        } catch (error) {
            console.error('Redirect result error:', error);
            
            // Show user-friendly error message for unauthorized access
            if (error.message.includes('Access denied')) {
                this.showErrorNotification(error.message);
            } else {
                this.showErrorNotification('Authentication failed: ' + this.getErrorMessage(error));
            }
        }
    }

    cleanup() {
        if (this.unsubscribeAuth) {
            this.unsubscribeAuth();
        }
    }
}