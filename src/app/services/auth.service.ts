import { Injectable, signal, inject } from '@angular/core';
import { 
  signUp, 
  signIn, 
  signOut, 
  confirmSignUp,
  resendSignUpCode,
  getCurrentUser, 
  fetchAuthSession,
  autoSignIn,
  type SignUpOutput 
} from 'aws-amplify/auth';
import { UserManagementService } from './user-management.service';

export interface AuthUser {
  userId: string;
  username: string;
  email?: string;
  emailVerified?: boolean;
}

export interface SignUpData {
  email: string;
  password: string;
  confirmPassword?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _currentUser = signal<AuthUser | null>(null);
  private _isLoading = signal(false);
  private _isAuthenticated = signal(false);
  private userManagementService = inject(UserManagementService);

  // Public readonly signals
  currentUser = this._currentUser.asReadonly();
  isLoading = this._isLoading.asReadonly();
  isAuthenticated = this._isAuthenticated.asReadonly();

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      this._isLoading.set(true);
      const user = await getCurrentUser();
      const session = await fetchAuthSession();
      
      if (user && session.tokens) {
        const email = user.signInDetails?.loginId;
        
        if (email) {
          // Ensure user entry exists in User table and handle invitation merging
          await this.userManagementService.ensureUserEntry(
            user.userId, 
            email, 
            user.username
          );
          
          // Update last login time
          await this.userManagementService.updateLastLogin(user.userId);
        }
        
        this._currentUser.set({
          userId: user.userId,
          username: user.username,
          email: email
        });
        this._isAuthenticated.set(true);
        
        console.log('🔐 User authenticated successfully:', {
          userId: user.userId,
          username: user.username,
          email: email
        });
      }
    } catch (error) {
      console.log('No authenticated user found:', error);
      this._currentUser.set(null);
      this._isAuthenticated.set(false);
    } finally {
      this._isLoading.set(false);
    }
  }

  async signUp(userData: SignUpData): Promise<{ success: boolean; confirmationRequired: boolean; error?: string }> {
    try {
      this._isLoading.set(true);
      
      const { isSignUpComplete, userId, nextStep }: SignUpOutput = await signUp({
        username: userData.email,
        password: userData.password,
        options: {
          userAttributes: {
            email: userData.email,
          }
        }
      });

      if (isSignUpComplete) {
        return { success: true, confirmationRequired: false };
      } else {
        return { 
          success: true, 
          confirmationRequired: nextStep.signUpStep === 'CONFIRM_SIGN_UP' 
        };
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      // Handle specific error cases
      let errorMessage = error.message || 'Sign up failed';
      
      if (error.name === 'UsernameExistsException' || errorMessage.includes('already exists')) {
        errorMessage = 'An account with this email already exists. Please sign in instead.';
      }
      
      return { 
        success: false, 
        confirmationRequired: false, 
        error: errorMessage 
      };
    } finally {
      this._isLoading.set(false);
    }
  }

  async confirmSignUp(email: string, confirmationCode: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Auth service: Starting confirmSignUp, current auth state:', this._isAuthenticated());
      this._isLoading.set(true);
      
      await confirmSignUp({
        username: email,
        confirmationCode
      });

      console.log('Auth service: confirmSignUp successful');
      return { success: true };
    } catch (error: any) {
      console.error('Confirmation error:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.log('Auth service: confirmSignUp failed, current auth state:', this._isAuthenticated());
      
      // Handle specific error cases
      let errorMessage = error.message || 'Confirmation failed';
      
      if (error.name === 'ExpiredCodeException' || errorMessage.includes('Invalid code provided')) {
        errorMessage = 'Verification code has expired. Please request a new code.';
      } else if (error.name === 'CodeMismatchException' || 
                 errorMessage.includes('Invalid verification code') || 
                 errorMessage.includes('please try again') ||
                 errorMessage.includes('CodeMismatchException')) {
        errorMessage = 'Invalid verification code. Please check your code and try again.';
      }
      
      return { 
        success: false, 
        error: errorMessage 
      };
    } finally {
      this._isLoading.set(false);
      console.log('Auth service: confirmSignUp finished, final auth state:', this._isAuthenticated(), 'loading:', this._isLoading());
    }
  }

  async resendConfirmationCode(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      this._isLoading.set(true);
      
      await resendSignUpCode({
        username: email
      });

      return { success: true };
    } catch (error: any) {
      console.error('Resend code error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to resend confirmation code' 
      };
    } finally {
      this._isLoading.set(false);
    }
  }

  async signIn(userData: SignInData): Promise<{ success: boolean; error?: string }> {
    try {
      this._isLoading.set(true);

      const { isSignedIn, nextStep } = await signIn({
        username: userData.email,
        password: userData.password
      });

      if (isSignedIn) {
        await this.initializeAuth(); // This will handle user entry management
        return { success: true };
      } else {
        return { 
          success: false, 
          error: 'Sign in incomplete - additional steps required' 
        };
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      return { 
        success: false, 
        error: error.message || 'Sign in failed' 
      };
    } finally {
      this._isLoading.set(false);
    }
  }

  async signOut(): Promise<void> {
    try {
      this._isLoading.set(true);
      await signOut();
      this._currentUser.set(null);
      this._isAuthenticated.set(false);
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      this._isLoading.set(false);
    }
  }

  async refreshUser(): Promise<void> {
    await this.initializeAuth();
  }

  // Utility methods
  getUserEmail(): string | undefined {
    return this._currentUser()?.email;
  }

  getUserId(): string | undefined {
    return this._currentUser()?.userId;
  }

  getUsername(): string | undefined {
    return this._currentUser()?.username;
  }
}