// Authentication state management
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }
    
    init() {
        auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            this.onAuthStateChange(user);
        });
    }
    
    onAuthStateChange(user) {
        // Override this in specific pages
        console.log('Auth state changed:', user ? user.email : 'Logged out');
    }
    
    async login(email, password) {
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async register(email, password, userData) {
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await db.collection('users').doc(userCredential.user.uid).set({
                ...userData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async logout() {
        try {
            await auth.signOut();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Initialize auth manager
const authManager = new AuthManager();