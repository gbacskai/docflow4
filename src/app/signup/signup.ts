import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-signup',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './signup.html',
  styleUrl: './signup.less'
})
export class SignUp {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  processing = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  signupForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  }, {
    validators: this.passwordMatchValidator
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

  private clearMessages() {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  async onSignup() {
    if (!this.signupForm.valid) return;

    this.processing.set(true);
    this.clearMessages();

    const { email, password } = this.signupForm.value;
    const result = await this.authService.signUp({ email, password });

    if (result.success) {
      if (result.confirmationRequired) {
        this.successMessage.set('Account created! We have sent a verification code to your email.');
        // Navigate to verify page with email
        setTimeout(() => {
          this.router.navigate(['/verify'], { 
            queryParams: { email: email }
          });
        }, 2000);
      } else {
        this.successMessage.set('Account created! You can now log in.');
        setTimeout(() => {
          this.router.navigate(['/auth']);
        }, 2000);
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

  navigateToLogin() {
    this.router.navigate(['/auth']);
  }
}