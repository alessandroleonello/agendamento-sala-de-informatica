import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDGoFC1kncfLymg7ioHTNTM88mTeTV-2zA",
  authDomain: "site-institucional-e-blog.firebaseapp.com",
  databaseURL: "https://site-institucional-e-blog-default-rtdb.firebaseio.com",
  projectId: "site-institucional-e-blog",
  storageBucket: "site-institucional-e-blog.firebasestorage.app",
  messagingSenderId: "359592005429",
  appId: "1:359592005429:web:35fc6c2e299c8790a8067c"
};

// Inicializando instâncias do Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();

// Força o Firebase a salvar a sessão no armazenamento local do navegador
setPersistence(auth, browserLocalPersistence).catch((error) => console.error(error));