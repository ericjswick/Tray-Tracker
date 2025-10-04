// Simple script to fetch trays from MyRepData using client SDK
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// MyRepData Firebase configuration (using client SDK - read-only access)
const myRepDataConfig = {
  apiKey: "AIzaSyAHXQkFnuDsS93bDVPvGnMLGqSiHoMB1JM",
  authDomain: "myrepdata-db2f8.firebaseapp.com",
  databaseURL: "https://myrepdata-db2f8.firebaseio.com",
  projectId: "myrepdata-db2f8",
  storageBucket: "myrepdata-db2f8.appspot.com",
  messagingSenderId: "285824943768",
  appId: "1:285824943768:web:8c3e3e3e3e3e3e3e3e3e3e"
};

const app = initializeApp(myRepDataConfig);
const db = getFirestore(app);

async function getMyRepDataTrays() {
  try {
    console.log('📦 Fetching trays from MyRepData...\n');

    const traysRef = collection(db, 'trays');
    const snapshot = await getDocs(traysRef);

    console.log(`Found ${snapshot.size} trays\n`);

    const trays = [];
    snapshot.forEach((doc) => {
      const trayData = { id: doc.id, ...doc.data() };
      trays.push(trayData);

      console.log(`Tray: ${doc.id}`);
      console.log(`  Name: ${trayData.name || 'N/A'}`);
      console.log(`  Serial: ${trayData.serial_number || 'N/A'}`);
      console.log(`  Type: ${trayData.type || 'N/A'}`);
      console.log(`  Status: ${trayData.status || 'N/A'}`);
      console.log(`  Implant Type ID: ${trayData.implant_type_id || 'N/A'}`);
      console.log(`  All fields: ${Object.keys(trayData).join(', ')}`);
      console.log('');
    });

    // Output as JSON for migration script
    console.log('\n📄 JSON output:');
    console.log(JSON.stringify(trays, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

getMyRepDataTrays();
