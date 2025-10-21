import twilio from "twilio"

const AccountSID = process.env.TWILIO_ACCOUNT_SID as string;
const AuthToken = process.env.TWILIO_AUTH_TOKEN as string;
const ServiceSID = process.env.TWILIO_VERIFY_SERVICE_SID as string;

const twilioClient = twilio(AccountSID , AuthToken)

const twilioVerification = twilioClient.verify.v2.services(ServiceSID);

export default twilioVerification