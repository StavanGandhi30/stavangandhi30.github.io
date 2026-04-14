import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDBjvTCSMDbkjwAzhHP7Df_ApOF-l6rtRo',
  authDomain: 'shivgandhi30.firebaseapp.com',
  projectId: 'shivgandhi30',
  storageBucket: 'shivgandhi30.firebasestorage.app',
  messagingSenderId: '711360318828',
  appId: '1:711360318828:web:ef6d6e68fa17041d713749',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, auth, storage };
