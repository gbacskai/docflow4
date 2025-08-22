import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-auth',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auth.html',
  styleUrl: './auth.less'
})
export class Auth {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  // Use a more persistent way to track mode
  private _currentMode = signal<'login' | 'signup' | 'confirm'>('login');
  currentMode = this._currentMode.asReadonly();
  processing = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  
  // Email for confirmation
  pendingEmail = signal('');

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  signupForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  }, {
    validators: this.passwordMatchValidator
  });

  confirmationForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    confirmationCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  // Custom validator for password confirmation
  private passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    if (confirmPassword?.hasError('passwordMismatch') && password?.value === confirmPassword?.value) {
      confirmPassword.setErrors(null);
    }
    
    return null;
  }

  switchToLogin() {
    console.log('Switching to login mode');
    this._currentMode.set('login');
    this.clearMessages();
    this.loginForm.reset();
    // Don't clear pendingEmail here to allow switching back to confirm mode
  }

  switchToSignup() {
    console.log('Switching to signup mode');
    this._currentMode.set('signup');
    this.clearMessages();
    this.signupForm.reset();
  }

  switchToConfirm() {
    console.log('Switching to confirm mode');
    this._currentMode.set('confirm');
    this.clearMessages();
    this.confirmationForm.reset();
    
    // Pre-fill email if we have a pendingEmail from signup
    if (this.pendingEmail()) {
      this.confirmationForm.patchValue({
        email: this.pendingEmail()
      });
    }
  }

  private clearMessages() {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  isExistingUserError(): boolean {
    return this.errorMessage().includes('already exists');
  }

  async onLogin() {
    if (!this.loginForm.valid) return;

    this.processing.set(true);
    this.clearMessages();

    const { email, password } = this.loginForm.value;
    const result = await this.authService.signIn({ email, password });

    if (result.success) {
      this.successMessage.set('Login successful!');
      this.loginForm.reset();
    } else {
      this.errorMessage.set(result.error || 'Login failed');
    }

    this.processing.set(false);
  }

  async onSignup() {
    if (!this.signupForm.valid) return;

    this.processing.set(true);
    this.clearMessages();

    const { email, password } = this.signupForm.value;
    const result = await this.authService.signUp({ email, password });

    if (result.success) {
      if (result.confirmationRequired) {
        this.pendingEmail.set(email);
        this.successMessage.set('Sign up successful! Please check your email for the confirmation code.');
        this.switchToConfirm();
      } else {
        this.successMessage.set('Sign up successful! You can now log in.');
        this.switchToLogin();
      }
      this.signupForm.reset();
    } else {
      // Check if it's an existing user error
      if (result.error?.includes('already exists')) {
        this.errorMessage.set(result.error + ' Would you like to sign in instead?');
        // Don't switch modes - stay on signup form so user sees the error
        // Don't clear pendingEmail in case they had a previous signup attempt
      } else {
        this.errorMessage.set(result.error || 'Sign up failed');
      }
    }

    this.processing.set(false);
  }

  async onConfirm() {
    if (!this.confirmationForm.valid) return;

    console.log('Starting verification, current mode:', this.currentMode());
    this.processing.set(true);
    this.clearMessages();

    const { email, confirmationCode } = this.confirmationForm.value;
    const result = await this.authService.confirmSignUp(email, confirmationCode);

    console.log('Verification result:', result);
    console.log('Current mode after API call:', this.currentMode());

    if (result.success) {
      console.log('Verification successful, staying on confirm form');
      this.successMessage.set('Email successfully verified! You can now log in.');
      this.pendingEmail.set(''); // Clear only on successful confirmation
      this.confirmationForm.reset(); // Clear the form
      // Stay on verification form to show success message, don't auto-switch to login
      // this.switchToLogin();
    } else {
      console.log('Verification failed, staying on confirm form');
      this.errorMessage.set(result.error || 'Confirmation failed');
      // On error, clear only the verification code field, keep email and stay on form
      this.confirmationForm.patchValue({
        confirmationCode: ''
      });
      // Force stay on the verification form
      this._currentMode.set('confirm');
      console.log('Forced mode back to confirm:', this.currentMode());
    }

    this.processing.set(false);
    console.log('Final mode:', this.currentMode());
  }

  async resendCode() {
    const email = this.confirmationForm.get('email')?.value;
    if (!email) {
      this.errorMessage.set('Please enter your email address first');
      return;
    }

    this.processing.set(true);
    this.clearMessages();

    const result = await this.authService.resendConfirmationCode(email);

    if (result.success) {
      this.successMessage.set('Confirmation code sent! Please check your email.');
      // Clear only the verification code field, keep email
      this.confirmationForm.patchValue({
        confirmationCode: ''
      });
    } else {
      this.errorMessage.set(result.error || 'Failed to resend code');
    }

    this.processing.set(false);
    // Ensure we stay on confirm mode
    if (this.currentMode() !== 'confirm') {
      this._currentMode.set('confirm');
    }
  }
}