# Manual Test: Send Reset Code & Resend Verification Code

## Test Purpose
Verify that clicking "Send Reset Code" and "Resend Code" buttons keeps the user on the same page and displays appropriate error messages.

## Pre-requisites
- Start the development server: `npm start`
- Navigate to: `http://localhost:4200/auth`

## Test Cases

### Test 1: Reset Password Form - Happy Path
1. **Navigate to Reset Password**
   - Click "Reset password" link from the login page
   - ✅ **Expected**: Should display "Reset Password" form with h2 "Reset Password"
   - ✅ **Check**: URL should remain `/auth` (not change)

2. **Send Reset Code with Valid Email**
   - Enter a valid email (e.g., `test@example.com`)
   - Click "Send Reset Code" button
   - ✅ **Expected**: 
     - User stays on the same Reset Password form
     - Button text changes to "Resend Code"
     - Success message appears: "Reset code sent to your email..."
     - Additional fields appear (reset code, new password, confirm password)
     - URL should remain `/auth`

3. **Test Resend Functionality**
   - Click "Resend Code" button
   - ✅ **Expected**:
     - User stays on the same Reset Password form
     - Loading state shows briefly ("Sending...")
     - Success message appears
     - URL should remain `/auth`

### Test 2: Reset Password Form - Error Cases
1. **Empty Email**
   - Clear the email field
   - Click "Send Reset Code" (or "Resend Code")
   - ✅ **Expected**:
     - User stays on Reset Password form
     - Error message appears: "Please enter your email address"
     - URL should remain `/auth`

2. **Invalid Email Format**
   - Enter invalid email (e.g., `invalid-email`)
   - Click "Send Reset Code"
   - ✅ **Expected**:
     - User stays on Reset Password form  
     - Form validation error or service error appears
     - URL should remain `/auth`

### Test 3: Verify Email Form - Happy Path
1. **Navigate to Verify Email**
   - Go back to login page (refresh if needed)
   - Click "Verify email" link
   - ✅ **Expected**: Should display "Verify Your Email" form

2. **Resend Verification Code with Valid Email**
   - Enter a valid email (e.g., `test@example.com`)
   - Click "Resend Code" button
   - ✅ **Expected**:
     - User stays on the same Verify Email form
     - Success message appears: "We have sent a code if you are registered"
     - URL should remain `/auth`

### Test 4: Verify Email Form - Error Cases
1. **Empty Email**
   - Clear the email field
   - Click "Resend Code"
   - ✅ **Expected**:
     - User stays on Verify Email form
     - Error message appears: "Please enter your email address first"
     - URL should remain `/auth`

## Browser Console Debugging
Open Developer Tools and check the Console tab for debug messages:
- `🔐 Auth component constructor called` - Component initialization
- `🔐 onResetRequest called, current mode: reset` - Reset request started
- `🔐 Reset code sent successfully, staying on form` - Success path
- `🔐 switchToLogin called` - Unexpected navigation (should NOT appear during these tests)

## Test Results Template
```
✅ Reset Password Navigation: PASS/FAIL
✅ Send Reset Code Stays on Page: PASS/FAIL  
✅ Button Text Changes to Resend: PASS/FAIL
✅ Additional Fields Appear: PASS/FAIL
✅ Resend Code Stays on Page: PASS/FAIL
✅ Empty Email Error Handling: PASS/FAIL
✅ Verify Email Navigation: PASS/FAIL
✅ Resend Verification Stays on Page: PASS/FAIL
✅ Verify Email Error Handling: PASS/FAIL
```

## Common Issues to Watch For
- ❌ Page redirecting to login form unexpectedly
- ❌ Form fields being cleared after button clicks
- ❌ No error messages displayed for invalid inputs
- ❌ Button text not updating from "Send Reset Code" to "Resend Code"
- ❌ Additional password fields not appearing after successful code send
- ❌ Component re-initialization (check console for repeated constructor calls)

## Notes
- All operations should keep the user on the `/auth` route
- The auth form should show the correct mode (reset/verify) throughout the process
- Error messages should be user-friendly and appear in the appropriate alert boxes
- Loading states should be brief but visible during API calls