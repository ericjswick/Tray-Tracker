import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import readline from 'readline';

// MyRepData Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDnZS8Fqn30r0NUd3OfgaxvhwBxIrRcYWw",
  authDomain: "myrepdata.firebaseapp.com",
  projectId: "myrepdata",
  storageBucket: "myrepdata.firebasestorage.app",
  messagingSenderId: "885636146139",
  appId: "1:885636146139:web:885864bcbc57b50f7bfdfe",
  measurementId: "G-PT1CLEXX5X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function promptCredentials() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Enter Firebase email: ', (email) => {
      rl.question('Enter Firebase password: ', (password) => {
        rl.close();
        resolve({ email, password });
      });
    });
  });
}

async function getPhysicians() {
  try {
    // Try to authenticate
    console.log('🔐 Authenticating with Firebase...\n');
    const { email, password } = await promptCredentials();

    await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Authentication successful!\n');

    console.log('📋 Fetching physicians from MyRepData Firestore...\n');

    const physiciansRef = collection(db, 'physicians');
    const snapshot = await getDocs(physiciansRef);

    if (snapshot.empty) {
      console.log('No physicians found in the collection.');
      return;
    }

    console.log(`Found ${snapshot.size} physicians:\n`);
    console.log('='.repeat(80));

    const physiciansArray = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const physician = {
        id: doc.id,
        ...data
      };

      physiciansArray.push(physician);

      console.log(`\nID: ${doc.id}`);
      console.log(`Name: ${data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim()}`);
      console.log(`Title: ${data.title || 'N/A'}`);
      console.log(`Specialty: ${data.specialty || 'N/A'}`);
      console.log(`Email: ${data.email || 'N/A'}`);
      console.log(`Phone: ${data.phone || 'N/A'}`);
      console.log(`Active: ${data.active !== undefined ? data.active : 'N/A'}`);
      console.log(`Hospital: ${data.hospital || 'N/A'}`);
      console.log(`Preferred Facilities: ${data.preferred_facilities ? JSON.stringify(data.preferred_facilities) : 'N/A'}`);
      console.log(`Created At: ${data.created_at || data.createdAt || 'N/A'}`);
      console.log('-'.repeat(80));
    });

    console.log('\n\n📊 SUMMARY:');
    console.log(`Total Physicians: ${physiciansArray.length}`);

    // Analyze name formats
    const withFullName = physiciansArray.filter(p => p.full_name).length;
    const withFirstLastName = physiciansArray.filter(p => p.first_name || p.last_name).length;
    console.log(`With full_name: ${withFullName}`);
    console.log(`With first_name/last_name: ${withFirstLastName}`);

    // Output JSON
    console.log('\n\n📄 JSON Format:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(physiciansArray, null, 2));

    return physiciansArray;

  } catch (error) {
    console.error('❌ Error fetching physicians:', error);
    console.error('Error details:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  } finally {
    process.exit(0);
  }
}

getPhysicians();
