import axios from 'axios';
import { parseString } from 'xml2js';

const tallyUrl = 'http://localhost:9000';

export const pushToTally = async (salesData) => {
  const tallyXML = `
    <ENVELOPE>
      <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
      </HEADER>
      <BODY>
        <IMPORTDATA>
          <REQUESTDESC>
            <REPORTNAME>Vouchers</REPORTNAME>
          </REQUESTDESC>
          <REQUESTDATA>
            <TALLYMESSAGE xmlns:UDF="TallyUDF">
              <VOUCHER>
                <DATE>${salesData.date}</DATE>
                <AMOUNT>${salesData.totalAmount}</AMOUNT>
                <PARTYNAME>${salesData.customer}</PARTYNAME>
              </VOUCHER>
            </TALLYMESSAGE>
          </REQUESTDATA>
        </IMPORTDATA>
      </BODY>
    </ENVELOPE>
  `;

  try {
    await axios.post(tallyUrl, tallyXML, {
      headers: { 'Content-Type': 'application/xml' }
    });
    console.log('Data pushed to Tally successfully');
  } catch (error) {
    console.error('Error pushing to Tally:', error);
  }
};
