const functions = require("firebase-functions");

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
const sqlServer = require("./sqlServerAdapter");
const dataEngine = require("./dataEngineSimple");

admin.initializeApp({ credential: admin.credential.applicationDefault() });

// // Take the text parameter passed to this HTTP endpoint and insert it into 
// // Firestore under the path /messages/:documentId/original
exports.initializeCommunity = functions.https.onCall(async (data, context) => {
  // Push the new message into Firestore using the Firebase Admin SDK.
  const result = await admin.firestore().collection("communities").add({name: data.name, tokens: data.tokens});
  // Send back a message that we've successfully written the message
  return {
    result
  };
});

// Fetch Cloud SQL data for a community.
exports.getCommunityData = functions.https.onCall(async (data, context) => {
  let queryResult = await sqlServer.getRows(Object.entries(data.tokens).map(([, tokens]) => tokens));
  // Send back a message that we've successfully read the data.
  return {
    result: JSON.stringify(queryResult),
  };
});

// Add data about a community to DB.
exports.createCommunity = functions.https.onCall(async (data, context) => {
  let result = await dataEngine.GetHolderData(Object.entries(data.tokens).map(([, tokens]) => tokens));
  const rows = [];
  Object.entries(result).forEach(([publicKey, mintData]) => {
    Object.entries(mintData).forEach(([mintId, data]) => {
      rows.push([publicKey, mintId, data.amount, JSON.stringify(data.mintAcquisitionDate)])
    });
  });

  const queryResult = await sqlServer.writeRows(rows);

  // Send back a message that we've successfully read the data.
  return {
    rows,
    queryResult: JSON.stringify(queryResult)
  };
});
