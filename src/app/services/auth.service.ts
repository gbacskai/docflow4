import { Injectable, signal, inject } from '@angular/core';
import { 
  signUp, 
  signIn, 
  signOut, 
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
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
  private _isLoading = signal<boolean>(false);
  private _isAuthenticated = signal<boolean>(false);
  private _testMode = signal<boolean>(false);
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
        
        // Validate session is still active and not expired
        if (!session.tokens.accessToken || this.isTokenExpired(session.tokens.accessToken.toString())) {
          console.log('🔐 Session expired, clearing authentication state');
          await this.signOut();
          return;
        }
        
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

  private isTokenExpired(tokenString: string): boolean {
    try {
      const tokenPayload = JSON.parse(atob(tokenString.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return tokenPayload.exp < currentTime;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true; // Assume expired if we can't parse
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

      console.log('🔐 Resend confirmation code sent successfully for:', email);
      return { success: true };
    } catch (error: any) {
      console.error('Resend code error:', error);
      
      // Handle specific AWS Amplify errors that might cause redirects
      if (error.name === 'UserNotFoundException') {
        // Return success even for non-existent users (security best practice)
        console.log('🔐 User not found, but returning success for security');
        return { success: true };
      }
      
      if (error.name === 'LimitExceededException') {
        return { 
          success: false, 
          error: 'Too many requests. Please wait before trying again.' 
        };
      }
      
      if (error.name === 'InvalidParameterException') {
        return { 
          success: false, 
          error: 'Please enter a valid email address.' 
        };
      }
      
      // For any other error, return success (security best practice)
      console.log('🔐 Unknown error, but returning success for security:', error.name);
      return { success: true };
    } finally {
      this._isLoading.set(false);
    }
  }

  async signIn(userData: SignInData): Promise<{ success: boolean; error?: string }> {
    try {
      this._isLoading.set(true);

      // Check if there's already an active session and sign out first
      try {
        const existingUser = await getCurrentUser();
        if (existingUser) {
          console.log('🔐 Existing session found, signing out first');
          await signOut();
          this._currentUser.set(null);
          this._isAuthenticated.set(false);
        }
      } catch (error) {
        // No existing user, proceed with sign in
        console.log('🔐 No existing session found');
      }

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
      
      // Handle specific "already signed in" error
      if (error.message?.includes('already') && error.message?.includes('signed')) {
        try {
          console.log('🔐 Handling already signed in error, clearing session');
          await signOut();
          this._currentUser.set(null);
          this._isAuthenticated.set(false);
          return { 
            success: false, 
            error: 'Session conflict detected. Please try signing in again.' 
          };
        } catch (signOutError) {
          console.error('Error during cleanup:', signOutError);
        }
      }
      
      return { 
        success: false, 
        error: error.message || 'Sign in failed' 
      };
    } finally {
      this._isLoading.set(false);
    }
  }

  async signOut(global: boolean = false): Promise<void> {
    try {
      this._isLoading.set(true);
      
      if (global) {
        // Sign out from all devices/sessions
        await signOut({ global: true });
        console.log('🔐 Global sign out completed - all sessions terminated');
      } else {
        await signOut();
        console.log('🔐 Local sign out completed');
      }
      
      this._currentUser.set(null);
      this._isAuthenticated.set(false);
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if signOut fails, clear local state
      this._currentUser.set(null);
      this._isAuthenticated.set(false);
    } finally {
      this._isLoading.set(false);
    }
  }

  async refreshUser(): Promise<void> {
    await this.initializeAuth();
  }

  async forceGlobalSignOut(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.signOut(true);
      return { success: true };
    } catch (error: any) {
      console.error('Force global sign out error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to sign out globally' 
      };
    }
  }

  async checkSessionValidity(): Promise<boolean> {
    try {
      const session = await fetchAuthSession();
      if (!session.tokens?.accessToken) {
        return false;
      }
      
      return !this.isTokenExpired(session.tokens.accessToken.toString());
    } catch (error) {
      console.log('Session validation failed:', error);
      return false;
    }
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


  // Test mode methods (only for testing)
  enableTestMode(mockUser?: AuthUser): void {
    if (typeof window !== 'undefined' && (window as any).playwright) {
      this._testMode.set(true);
      this._isAuthenticated.set(true);
      this._currentUser.set(mockUser || {
        userId: 'test-user-123',
        username: 'testuser',
        email: 'test@example.com',
        emailVerified: true
      });
      console.log('🧪 Test mode enabled with mock authentication');
    }
  }

  disableTestMode(): void {
    if (typeof window !== 'undefined' && (window as any).playwright) {
      this._testMode.set(false);
      this._isAuthenticated.set(false);
      this._currentUser.set(null);
      console.log('🧪 Test mode disabled');
    }
  }

  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      this._isLoading.set(true);
      
      await resetPassword({
        username: email
      });

      console.log('🔐 Reset password code sent successfully for:', email);
      return { success: true };
    } catch (error: any) {
      console.error('Reset password error:', error);
      
      // Handle specific AWS Amplify errors that might cause redirects
      if (error.name === 'UserNotFoundException') {
        // Return success even for non-existent users (security best practice)
        console.log('🔐 User not found, but returning success for security');
        return { success: true };
      }
      
      if (error.name === 'LimitExceededException') {
        return { 
          success: false, 
          error: 'Too many requests. Please wait before trying again.' 
        };
      }
      
      if (error.name === 'InvalidParameterException') {
        return { 
          success: false, 
          error: 'Please enter a valid email address.' 
        };
      }
      
      // For any other error, return success (security best practice)
      console.log('🔐 Unknown error, but returning success for security:', error.name);
      return { success: true };
    } finally {
      this._isLoading.set(false);
    }
  }

  async confirmResetPassword(email: string, confirmationCode: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      this._isLoading.set(true);
      
      await confirmResetPassword({
        username: email,
        confirmationCode,
        newPassword
      });

      return { success: true };
    } catch (error: any) {
      console.error('Confirm reset password error:', error);
      
      let errorMessage = error.message || 'Password reset failed';
      
      if (error.name === 'ExpiredCodeException' || errorMessage.includes('Invalid code provided')) {
        errorMessage = 'Reset code has expired. Please request a new code.';
      } else if (error.name === 'CodeMismatchException' || 
                 errorMessage.includes('Invalid verification code') || 
                 errorMessage.includes('please try again') ||
                 errorMessage.includes('CodeMismatchException')) {
        errorMessage = 'Invalid reset code. Please check your code and try again.';
      }
      
      return { 
        success: false, 
        error: errorMessage 
      };
    } finally {
      this._isLoading.set(false);
    }
  }
}