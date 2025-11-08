// Mock Firebase Auth for testing
export interface MockUser {
  uid: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
}

class MockFirebaseAuth {
  private currentUser: MockUser | null = null;
  private listeners: ((user: MockUser | null) => void)[] = [];

  constructor() {
    console.log('🔥 Using Mock Firebase Auth for testing');
  }

  // Mock sign in with email and password
  async signInWithEmailAndPassword(email: string, password: string): Promise<MockUser> {
    console.log(`🔐 Mock sign in attempt: ${email}`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock authentication logic
    if (email === 'brana@test.cz' && password === 'admin123') {
      const user: MockUser = {
        uid: 'mock-user-123',
        email: 'brana@test.cz',
        displayName: 'Gate Admin',
        emailVerified: true
      };
      
      this.currentUser = user;
      this.notifyListeners();
      
      console.log('✅ Mock authentication successful');
      return user;
    } else {
      throw new Error('auth/invalid-credential');
    }
  }

  // Mock sign up
  async createUserWithEmailAndPassword(email: string, password: string): Promise<MockUser> {
    console.log(`🔐 Mock sign up attempt: ${email}`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const user: MockUser = {
      uid: `mock-user-${Date.now()}`,
      email: email,
      displayName: email.split('@')[0],
      emailVerified: false
    };
    
    this.currentUser = user;
    this.notifyListeners();
    
    console.log('✅ Mock registration successful');
    return user;
  }

  // Mock sign out
  async signOut(): Promise<void> {
    console.log('🔐 Mock sign out');
    this.currentUser = null;
    this.notifyListeners();
  }

  // Get current user
  getCurrentUser(): MockUser | null {
    return this.currentUser;
  }

  // Listen to auth state changes
  onAuthStateChanged(callback: (user: MockUser | null) => void): () => void {
    this.listeners.push(callback);
    
    // Immediately call with current user
    callback(this.currentUser);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback(this.currentUser);
      } catch (error) {
        console.error('Error in auth state callback:', error);
      }
    });
  }
}

export const mockAuth = new MockFirebaseAuth();

// Mock Firebase auth functions that match the real API
export const signInWithEmailAndPassword = (auth: any, email: string, password: string) => 
  mockAuth.signInWithEmailAndPassword(email, password);

export const createUserWithEmailAndPassword = (auth: any, email: string, password: string) => 
  mockAuth.createUserWithEmailAndPassword(email, password);

export const signOut = (auth: any) => 
  mockAuth.signOut();

export const onAuthStateChanged = (auth: any, callback: (user: any) => void) => 
  mockAuth.onAuthStateChanged(callback);
