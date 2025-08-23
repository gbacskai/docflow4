import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'docflow4-storage',
  access: (allow) => ({
    'documents/*': [
      allow.authenticated.to(['read', 'write', 'delete'])
    ],
    'public/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write', 'delete'])
    ]
  })
});