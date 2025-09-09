import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.less'
})
export class ResetPassword {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  processing = signal(false);
  resetCodeSent = signal(true); // Default to true to show all fields
  
  // Use service-based error and success messages (persistent across component recreations)
  errorMessage = this.authService.authError;
  successMessage = this.authService.authSuccess;

  resetForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    confirmationCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmNewPassword: ['', [Validators.required]]
  }, {
    validators: this.resetPasswordMatchValidator
  });

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

  private clearMessages() {
    this.authService.clearAuthMessages();
  }

  async onResetRequest() {
    const email = this.resetForm.get('email')?.value;
    if (!email) {
      this.authService.setAuthError('Please enter your email address');
      return;
    }

    this.processing.set(true);
    this.clearMessages();

    const result = await this.authService.resetPassword(email);

    if (result.success) {
      this.resetCodeSent.set(true);
      this.authService.setAuthSuccess('Reset code sent to your email. Please check your email and enter the code below.');
    } else {
      this.authService.setAuthError(result.error || 'Failed to send reset code');
    }

    this.processing.set(false);
  }

  async onResetConfirm() {
    if (!this.resetForm.valid) return;

    this.processing.set(true);
    this.clearMessages();

    const { email, confirmationCode, newPassword } = this.resetForm.value;
    const result = await this.authService.confirmResetPassword(email, confirmationCode, newPassword);

    if (result.success) {
      this.authService.setAuthSuccess('Password reset successful! Redirecting to sign in...');
      this.resetForm.reset();
      this.resetCodeSent.set(false);
      setTimeout(() => {
        this.router.navigate(['/auth'], {
          queryParams: { email: email, reset: 'success' }
        });
      }, 3000);
    } else {
      this.authService.setAuthError(result.error || 'Password reset failed');
      this.resetForm.patchValue({ 
        confirmationCode: '',
        newPassword: '',
        confirmNewPassword: ''
      });
    }

    this.processing.set(false);
  }

  onResetFormSubmit() {
    if (this.resetCodeSent()) {
      this.onResetConfirm();
    } else {
      this.onResetRequest();
    }
  }

  navigateToLogin() {
    this.router.navigate(['/auth']);
  }

  navigateToSignup() {
    this.router.navigate(['/signup']);
  }
}