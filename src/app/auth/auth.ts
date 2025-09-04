import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
  private router = inject(Router);

  currentMode = signal<'login' | 'signup' | 'verify' | 'reset'>('login');
  processing = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  pendingEmail = signal('');
  resetCodeSent = signal(false);


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

  verifyForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    confirmationCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  resetForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    confirmationCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmNewPassword: ['', [Validators.required]]
  }, {
    validators: this.resetPasswordMatchValidator
  });

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

  private resetPasswordMatchValidator(form: FormGroup) {
    const password = form.get('newPassword');
    const confirmPassword = form.get('confirmNewPassword');
    
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
    this.currentMode.set('login');
    this.clearMessages();
    this.loginForm.reset();
  }

  switchToSignup() {
    this.currentMode.set('signup');
    this.clearMessages();
    this.signupForm.reset();
  }

  switchToVerify() {
    this.currentMode.set('verify');
    this.clearMessages();
    this.verifyForm.reset();
    
    if (this.pendingEmail()) {
      this.verifyForm.patchValue({
        email: this.pendingEmail()
      });
    }
  }

  switchToReset() {
    this.currentMode.set('reset');
    this.clearMessages();
    this.resetForm.reset();
    this.resetCodeSent.set(false);
  }

  navigateToSignup() {
    this.router.navigate(['/signup']);
  }

  navigateToVerify() {
    this.router.navigate(['/verify']);
  }

  navigateToResetPassword() {
    this.router.navigate(['/reset-password']);
  }

  private clearMessages() {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  async onLogin() {
    if (!this.loginForm.valid) return;

    this.processing.set(true);
    this.clearMessages();

    const { email, password } = this.loginForm.value;
    console.log('Attempting login with:', { email, password: password ? '***' : 'empty' });
    
    const result = await this.authService.signIn({ email, password });
    console.log('Login result:', result);

    if (result.success) {
      this.successMessage.set('Login successful!');
      this.loginForm.reset();
      this.router.navigate(['/dashboard']);
    } else {
      const errorMsg = result.error || 'Login failed';
      console.log('Setting error message:', errorMsg);
      this.errorMessage.set(errorMsg);
      console.log('Error message signal value:', this.errorMessage());
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
        this.switchToVerify();
        this.successMessage.set('Account created! We have sent a verification code to your email.');
      } else {
        this.successMessage.set('Account created! You can now log in.');
        this.switchToLogin();
      }
      this.signupForm.reset();
    } else {
      if (result.error?.includes('already exists')) {
        this.errorMessage.set('This email is already registered. Please sign in instead.');
      } else {
        this.errorMessage.set(result.error || 'Sign up failed');
      }
    }

    this.processing.set(false);
  }

  async onVerify() {
    if (!this.verifyForm.valid) return;

    this.processing.set(true);
    this.clearMessages();

    const { email, confirmationCode } = this.verifyForm.value;
    const result = await this.authService.confirmSignUp(email, confirmationCode);

    if (result.success) {
      this.successMessage.set('Email verified! Please log in to continue.');
      this.pendingEmail.set('');
      this.verifyForm.reset();
      setTimeout(() => {
        this.switchToLogin();
      }, 2000);
    } else {
      this.errorMessage.set(result.error || 'Verification failed');
      this.verifyForm.patchValue({ confirmationCode: '' });
    }

    this.processing.set(false);
  }

  async resendVerificationCode() {
    const email = this.verifyForm.get('email')?.value;
    if (!email) {
      this.errorMessage.set('Please enter your email address first');
      return;
    }

    this.processing.set(true);
    this.clearMessages();

    const result = await this.authService.resendConfirmationCode(email);

    if (result.success) {
      this.successMessage.set('We have sent a code if you are registered.');
    } else {
      this.successMessage.set('We have sent a code if you are registered.');
    }

    this.processing.set(false);
    
    // Ensure we stay in verify mode
    console.log('🔐 Resend verification completed, staying in verify mode');
  }

  async onResetRequest() {
    const email = this.resetForm.get('email')?.value;
    if (!email) {
      this.errorMessage.set('Please enter your email address');
      return;
    }

    this.processing.set(true);
    this.clearMessages();

    const result = await this.authService.resetPassword(email);

    if (result.success) {
      this.resetCodeSent.set(true);
      this.successMessage.set('Reset code sent to your email. Please check your email and enter the code below.');
    } else {
      this.errorMessage.set(result.error || 'Failed to send reset code');
    }

    this.processing.set(false);
    
    // Ensure we stay in reset mode
    console.log('🔐 Reset password request completed, staying in reset mode');
  }

  onResetFormSubmit() {
    if (this.resetCodeSent()) {
      this.onResetConfirm();
    }
  }

  async onResetConfirm() {
    if (!this.resetForm.valid) return;

    this.processing.set(true);
    this.clearMessages();

    const { email, confirmationCode, newPassword } = this.resetForm.value;
    const result = await this.authService.confirmResetPassword(email, confirmationCode, newPassword);

    if (result.success) {
      this.successMessage.set('Password reset successful! You can now log in with your new password.');
      this.resetForm.reset();
      this.resetCodeSent.set(false);
      setTimeout(() => {
        this.switchToLogin();
      }, 2000);
    } else {
      this.errorMessage.set(result.error || 'Password reset failed');
      this.resetForm.patchValue({ 
        confirmationCode: '',
        newPassword: '',
        confirmNewPassword: ''
      });
    }

    this.processing.set(false);
  }
}