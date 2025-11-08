import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, GoogleAuthProvider, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase/config';
import { db } from '../firebase/config';
import { googleProvider } from '../firebase/config';
import { UserData, UserPermissions, UserRole, Activity, DEFAULT_PERMISSIONS } from '../types/user';

class UserService {
  private usersCollection = collection(db, 'users');
  private activitiesCollection = collection(db, 'activities');

  // Sign in with Google
  async signInWithGoogle(): Promise<UserData> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      
      if (!firebaseUser.email) {
        throw new Error('Email is required');
      }

      // Check if user exists
      const userDoc = await getDoc(doc(this.usersCollection, firebaseUser.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserData;
        
        // Update last login
        await updateDoc(doc(this.usersCollection, firebaseUser.uid), {
          lastLogin: serverTimestamp()
        });

        // Log activity
        await this.logActivity({
          user: firebaseUser.uid,
          userDisplayName: userData.displayName,
          action: 'Přihlášení přes Google',
          device: 'gate',
          status: 'success'
        });

        return {
          ...userData,
          id: firebaseUser.uid,
          lastLogin: new Date()
        };
      } else {
        // Create new user (pending approval)
        const newUser: UserData = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email!,
          role: 'viewer', // Default role for new users
          permissions: DEFAULT_PERMISSIONS.viewer,
          approved: false, // Requires admin approval
          createdAt: new Date(),
          lastLogin: new Date()
        };

        await setDoc(doc(this.usersCollection, firebaseUser.uid), {
          ...newUser,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        });

        // Log registration activity
        await this.logActivity({
          user: firebaseUser.uid,
          userDisplayName: newUser.displayName,
          action: 'Registrace nového uživatele (čeká na schválení)',
          device: 'gate',
          status: 'success'
        });

        return newUser;
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  }

  // Sign in with email and password
  async signInWithEmail(email: string, password: string): Promise<UserData> {
    try {
      // Use real Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(this.usersCollection, firebaseUser.uid));
      
      if (!userDoc.exists()) {
        // Create user in Firestore if not exists
        const isFirstAdmin = await this.isFirstAdmin(email);
        const newUser: UserData = {
          id: firebaseUser.uid,
          email: firebaseUser.email || email,
          displayName: firebaseUser.displayName || email.split('@')[0],
          role: isFirstAdmin ? 'admin' : 'viewer',
          permissions: isFirstAdmin ? DEFAULT_PERMISSIONS.admin : DEFAULT_PERMISSIONS.viewer,
          approved: isFirstAdmin, // Auto-approve first admin
          createdAt: new Date(),
          lastLogin: new Date()
        };

        await setDoc(doc(this.usersCollection, firebaseUser.uid), {
          ...newUser,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        });

        // Log activity
        await this.logActivity({
          user: newUser.id,
          userDisplayName: newUser.displayName,
          action: 'Registrace a přihlášení',
          device: 'gate',
          status: 'success'
        });

        return newUser;
      }

      let userData = userDoc.data() as UserData;

      // Auto-approve first admin if not approved
      const isFirstAdmin = await this.isFirstAdmin(email);
      if (isFirstAdmin && !userData.approved) {
        await this.approveUser(userData.id, 'system', 'admin');
        userData.approved = true;
        userData.role = 'admin';
        userData.permissions = DEFAULT_PERMISSIONS.admin;
      }

      if (!userData.approved) {
        throw new Error('Váš účet čeká na schválení administrátorem');
      }

      // Update last login
      await updateDoc(doc(this.usersCollection, firebaseUser.uid), {
        lastLogin: serverTimestamp()
      });

      // Log activity
      await this.logActivity({
        user: userData.id,
        userDisplayName: userData.displayName,
        action: 'Přihlášení',
        device: 'gate',
        status: 'success'
      });

      return {
        ...userData,
        id: firebaseUser.uid,
        lastLogin: new Date()
      };
    } catch (error: any) {
      console.error('Email sign in error:', error);
      
      // Handle Firebase auth errors
      if (error.code === 'auth/user-not-found') {
        throw new Error('Uživatel nenalezen');
      } else if (error.code === 'auth/wrong-password') {
        throw new Error('Špatné heslo');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Neplatný email');
      } else if (error.code === 'auth/user-disabled') {
        throw new Error('Účet je zakázán');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Příliš mnoho pokusů. Zkuste to později.');
      }
      
      throw error;
    }
  }

  // Get current user data
  async getCurrentUser(): Promise<UserData | null> {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return null;

    try {
      const userDoc = await getDoc(doc(this.usersCollection, firebaseUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserData;
        return {
          ...userData,
          id: firebaseUser.uid
        };
      }
      return null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  // Create first admin (for setup)
  async createFirstAdmin(email: string, displayName: string): Promise<UserData> {
    try {
      const tempUserId = `temp-${Date.now()}`;
      const adminUser: UserData = {
        id: tempUserId,
        email: email,
        displayName: displayName,
        role: 'admin',
        permissions: DEFAULT_PERMISSIONS.admin,
        approved: true,
        createdAt: new Date(),
        lastLogin: new Date()
      };

      // This will be replaced with real Firebase user ID when they sign in
      await setDoc(doc(this.usersCollection, tempUserId), {
        ...adminUser,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });

      return adminUser;
    } catch (error) {
      console.error('Create first admin error:', error);
      throw error;
    }
  }

  // Check if user is first admin (by email)
  async isFirstAdmin(email: string): Promise<boolean> {
    try {
      const adminEmail = process.env.REACT_APP_ADMIN_EMAIL || 'brana@test.cz';
      return email === adminEmail;
    } catch (error) {
      console.error('Check first admin error:', error);
      return false;
    }
  }

  // Get all users (admin only)
  async getAllUsers(): Promise<UserData[]> {
    try {
      const querySnapshot = await getDocs(this.usersCollection);
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as UserData[];
    } catch (error) {
      console.error('Get all users error:', error);
      throw error;
    }
  }

  // Get pending users (admin only)
  async getPendingUsers(): Promise<UserData[]> {
    try {
      const q = query(this.usersCollection, where('approved', '==', false));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as UserData[];
    } catch (error) {
      console.error('Get pending users error:', error);
      throw error;
    }
  }

  // Approve user (admin only)
  async approveUser(userId: string, approvedBy: string, role: UserRole = 'user'): Promise<void> {
    try {
      await updateDoc(doc(this.usersCollection, userId), {
        approved: true,
        role: role,
        permissions: DEFAULT_PERMISSIONS[role],
        approvedBy: approvedBy,
        approvedAt: serverTimestamp()
      });

      // Get user data for logging
      const userDoc = await getDoc(doc(this.usersCollection, userId));
      const userData = userDoc.data() as UserData;

      // Log approval activity
      await this.logActivity({
        user: userId,
        userDisplayName: userData.displayName,
        action: `Uživatel schválen (role: ${role})`,
        device: 'gate',
        status: 'success'
      });
    } catch (error) {
      console.error('Approve user error:', error);
      throw error;
    }
  }

  // Update user role and permissions
  async updateUserRole(userId: string, role: UserRole, updatedBy: string): Promise<void> {
    try {
      await updateDoc(doc(this.usersCollection, userId), {
        role: role,
        permissions: DEFAULT_PERMISSIONS[role],
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy
      });

      // Get user data for logging
      const userDoc = await getDoc(doc(this.usersCollection, userId));
      const userData = userDoc.data() as UserData;

      // Log role change activity
      await this.logActivity({
        user: userId,
        userDisplayName: userData.displayName,
        action: `Změna role na: ${role}`,
        device: 'gate',
        status: 'success'
      });
    } catch (error) {
      console.error('Update user role error:', error);
      throw error;
    }
  }

  // Update user permissions
  async updateUserPermissions(userId: string, permissions: Partial<UserPermissions>, updatedBy: string): Promise<void> {
    try {
      await updateDoc(doc(this.usersCollection, userId), {
        permissions: permissions,
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy
      });
    } catch (error) {
      console.error('Update user permissions error:', error);
      throw error;
    }
  }

  // Delete user (admin only)
  async deleteUser(userId: string, deletedBy: string): Promise<void> {
    try {
      // Get user data for logging
      const userDoc = await getDoc(doc(this.usersCollection, userId));
      const userData = userDoc.data() as UserData;

      await deleteDoc(doc(this.usersCollection, userId));

      // Log deletion activity
      await this.logActivity({
        user: userId,
        userDisplayName: userData.displayName,
        action: 'Uživatel smazán',
        device: 'gate',
        status: 'success'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      throw error;
    }
  }

  // Update user location
  async updateUserLocation(userId: string, location: { latitude: number; longitude: number; accuracy: number }): Promise<void> {
    try {
      await updateDoc(doc(this.usersCollection, userId), {
        lastLocation: {
          ...location,
          timestamp: serverTimestamp()
        }
      });
    } catch (error) {
      console.error('Update user location error:', error);
      throw error;
    }
  }

  // Get recent activities
  async getRecentActivities(limitCount: number = 50): Promise<Activity[]> {
    try {
      const q = query(
        this.activitiesCollection,
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        timestamp: doc.data().timestamp?.toDate() || new Date()
      })) as Activity[];
    } catch (error) {
      console.error('Get recent activities error:', error);
      throw error;
    }
  }

  // Log activity
  private async logActivity(activity: Omit<Activity, 'id' | 'timestamp'>): Promise<void> {
    try {
      const activityData = {
        ...activity,
        timestamp: serverTimestamp()
      };
      
      await setDoc(doc(this.activitiesCollection), activityData);
    } catch (error) {
      console.error('Log activity error:', error);
      // Don't throw error for activity logging
    }
  }

  // Update user nick
  async updateUserNick(userId: string, nick: string): Promise<void> {
    try {
      await updateDoc(doc(this.usersCollection, userId), {
        nick: nick,
        updatedAt: serverTimestamp()
      });

      // Get user data for logging
      const userDoc = await getDoc(doc(this.usersCollection, userId));
      const userData = userDoc.data() as UserData;

      // Log nick update activity
      await this.logActivity({
        user: userId,
        userDisplayName: userData.displayName,
        action: `NICK změněn na: ${nick}`,
        device: 'gate',
        status: 'success'
      });
    } catch (error) {
      console.error('Update user nick error:', error);
      throw error;
    }
  }

  // Get user activities
  async getUserActivities(userId: string, limitCount: number = 20): Promise<Activity[]> {
    try {
      const q = query(
        this.activitiesCollection,
        where('user', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        timestamp: doc.data().timestamp?.toDate() || new Date()
      })) as Activity[];
    } catch (error) {
      console.error('Get user activities error:', error);
      throw error;
    }
  }

  // Update last login
  async updateLastLogin(userId: string): Promise<void> {
    try {
      const userRef = doc(this.usersCollection, userId);
      await updateDoc(userRef, {
        lastLogin: new Date()
      });
    } catch (error) {
      console.error('Update last login error:', error);
      throw error;
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        // Log sign out activity
        const userData = await this.getCurrentUser();
        if (userData) {
          await this.logActivity({
            user: currentUser.uid,
            userDisplayName: userData.displayName,
            action: 'Odhlášení',
            device: 'gate',
            status: 'success'
          });
        }
      }
      
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }
}

export const userService = new UserService();
