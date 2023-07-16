const express = require("express");
const { google } = require("googleapis");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
const port = 3000;

app.use(express.static("public"));

app.use(async (req, res, next) => {
  // authentication & set up
  const auth = new google.auth.GoogleAuth({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  try {
    const sheetId = process.env.SHEET_ID;
    const sheetName = req.originalUrl; // get resource name - this becomes sheet name
    console.log(sheetName);
    const countCell = `${sheetName}!B1`;

    // Check if the sheet exists
    const sheetResponse = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });
    const sheetExists = sheetResponse.data.sheets.some(
      (sheet) => sheet.properties.title === sheetName
    );

    if (!sheetExists) {
      // Create a new sheet
      const createSheetResponse = await sheets.spreadsheets.batchUpdate({
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

      // fill in fields
      sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SHEET_ID,
        range: `${sheetName}!A1:B1`,
        valueInputOption: "USER_ENTERED", // how input data should be interpreted
        resource: {
          values: [["View Count:", "0"]], // the new incremented value
        },
      });
    }

    // read view count
    const countResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: countCell,
    });

    // update view count
    const viewCount = Number(countResponse.data.values[0][0]) + 1; // log sheet data

    // write new view count
    response = await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range: countCell,
      valueInputOption: "USER_ENTERED", // how input data should be interpreted
      resource: {
        values: [[viewCount.toString()]], // the new incremented value
      },
    });
  } catch (err) {
    console.log("The API returned an error: " + err);
  }

  next();
});

app.get("/test", (req, res) => {
  res.send('<img src="/image"/>');
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
