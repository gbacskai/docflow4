import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-verify',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './verify.html',
  styleUrl: './verify.less'
})
export class Verify implements OnInit {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  processing = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  pendingEmail = signal('');

  verifyForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    confirmationCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  ngOnInit() {
    // Get email from query parameters if available
    this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.pendingEmail.set(params['email']);
        this.verifyForm.patchValue({
          email: params['email']
        });
      }
    });
  }

  private clearMessages() {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  async onVerify() {
    if (!this.verifyForm.valid) return;

    this.processing.set(true);
    this.clearMessages();

    const { email, confirmationCode } = this.verifyForm.value;
    const result = await this.authService.confirmSignUp(email, confirmationCode);

    if (result.success) {
      this.successMessage.set('Email verified successfully! Redirecting to sign in...');
      this.pendingEmail.set('');
      this.verifyForm.reset();
      setTimeout(() => {
        this.router.navigate(['/auth'], {
          queryParams: { email: email, verified: 'true' }
        });
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
      this.successMessage.set('Verification code sent! Please check your email.');
    } else {
      this.successMessage.set('Verification code sent if you are registered.');
    }

    this.processing.set(false);
    
    // Ensure we stay on verify page
    console.log('🔐 Resend verification completed, staying on verify page');
  }

  navigateToLogin() {
    this.router.navigate(['/auth']);
  }

  navigateToSignup() {
    this.router.navigate(['/signup']);
  }
}