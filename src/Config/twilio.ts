import twilio from "twilio"

const AccountSID = process.env.TWILIO_ACCOUNT_SID as string;
const AuthToken = process.env.TWILIO_AUTH_TOKEN as string;
const ServiceSID = process.env.TWILIO_VERIFY_SERVICE_SID as string;

// Validate Twilio credentials
if (!AccountSID || !AuthToken || !ServiceSID) {
  console.error('❌ Missing Twilio credentials:');
  console.error('TWILIO_ACCOUNT_SID:', AccountSID ? '✅ Set' : '❌ Missing');
  console.error('TWILIO_AUTH_TOKEN:', AuthToken ? '✅ Set' : '❌ Missing');
  console.error('TWILIO_VERIFY_SERVICE_SID:', ServiceSID ? '✅ Set' : '❌ Missing');
  throw new Error('Twilio credentials are not properly configured');
}

// Validate Service SID format
if (!ServiceSID.startsWith('VA')) {
  console.error('❌ Invalid TWILIO_VERIFY_SERVICE_SID format:', ServiceSID);
  console.error('Service SID should start with "VA"');
  throw new Error('Invalid Twilio Verify Service SID format');
}

console.log('✅ Twilio configured with Service SID:', ServiceSID);

const twilioClient = twilio(AccountSID , AuthToken)

const twilioVerification = twilioClient.verify.v2.services(ServiceSID);

export default twilioVerification