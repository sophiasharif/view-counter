const express = require("express");
const { google } = require("googleapis");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
const port = 3000;

app.use(express.static("public"));

// authentication & set up
const auth = new google.auth.GoogleAuth({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// set up connection with sheet api
let sheets;
(async function initializeGoogleSheets() {
  const client = await auth.getClient();
  sheets = google.sheets({ version: "v4", auth: client });
})();

// MAIN MIDDLEWARE
app.use("/:sheetName", async (req, res, next) => {
  const { sheetName } = req.params;
  console.log(sheetName);

  try {
    const sheetId = process.env.SHEET_ID;
    const countCell = `${sheetName}!B1`;

    // create sheet if it doesn't exit
    const sheetExists = await checkIfSheetExists(sheetId, sheetName);
    if (!sheetExists) {
      await createSheet(sheetId, sheetName);
    }

    // read & update view count
    const viewCount = await getViewCount(sheetId, countCell);
    await updateViewCount(sheetId, countCell, viewCount + 1);

    // add timestamp
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    console.log(req.headers["x-forwarded-for"]);
    await addInfo(sheetId, sheetName, req.ip);
    console.log(ip);
  } catch (err) {
    console.log("The API returned an error: " + err);
  }

  next();
});

app.get("/:all", (req, res) => {
  res.sendFile(__dirname + "/public/pixel.png");
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});

async function checkIfSheetExists(sheetId, sheetName) {
  const sheetResponse = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
  });

  return sheetResponse.data.sheets.some(
    (sheet) => sheet.properties.title === sheetName
  );
}

async function createSheet(sheetId, sheetName) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
            },
          },
        },
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${sheetName}!A1:B2`,
    valueInputOption: "USER_ENTERED",
    resource: {
      values: [["View Count:", "0"]],
    },
  });
}

async function getViewCount(sheetId, countCell) {
  const countResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: countCell,
  });

  return Number(countResponse.data.values[0][0]);
}

async function updateViewCount(sheetId, countCell, newCount) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: countCell,
    valueInputOption: "USER_ENTERED",
    resource: {
      values: [[newCount.toString()]],
    },
  });
}

async function addInfo(sheetId, sheetName, ip) {
  const readResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${sheetName}`,
  });
  const rowCount = readResponse.data.values
    ? readResponse.data.values.length
    : 0;
  const nextRow = rowCount + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${sheetName}!A${nextRow}`,
    valueInputOption: "USER_ENTERED",
    resource: {
      values: [[new Date().toLocaleString("en-US"), ip]],
    },
  });
}
