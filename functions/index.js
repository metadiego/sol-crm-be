const functions = require("firebase-functions");

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
const sqlServer = require("./sqlServerConnection");

admin.initializeApp();

// Take the text parameter passed to this HTTP endpoint and insert it into 
// Firestore under the path /messages/:documentId/original
exports.addMessage = functions.https.onCall(async (data, context) => {
  // Push the new message into Firestore using the Firebase Admin SDK.
  const writeResult = await admin.firestore().collection('messages').add({original: data.message});
  sqlServer.testConnection();
  // Send back a message that we've successfully written the message
  return {
    result: `Message with ID: ${writeResult.id} added.`,
  };
});

// Fetch Cloud SQL data for a community.
exports.fetchCommunityData = functions.https.onCall(async (data, context) => {

  // Send back a message that we've successfully read the data.
  return {
    result: `No data fetched`,
  };
});