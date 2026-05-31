const nodemailer = require('nodemailer');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');

const ALERT_EMAIL_USER = process.env.EMAIL_USER || 'g.undilashvili1993@gmail.com';
const ALERT_EMAIL_PASS = process.env.EMAIL_PASS || '';
const ALERT_EMAIL_HOST = process.env.EMAIL_HOST || '142.251.127.108';
const ALERT_EMAIL_PORT = Number(process.env.EMAIL_PORT || 587);

const transporter = nodemailer.createTransport({
  host: ALERT_EMAIL_HOST,
  port: ALERT_EMAIL_PORT,
  secure: ALERT_EMAIL_PORT === 465,
  requireTLS: ALERT_EMAIL_PORT !== 465,
  family: 4,
  tls: {
    servername: 'smtp.gmail.com'
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
  auth: {
    user: ALERT_EMAIL_USER,
    pass: ALERT_EMAIL_PASS
  }
});

function buildAlertEmail({ alert, currentRate }) {
  const directionText = alert.operator === 'gt' ? 'აღემატება' : 'ნაკლებია';
  if (alert.alertType === 'forex') {
    return {
      from: ALERT_EMAIL_USER,
      subject: 'AllRates.ge Alert',
      text: `FOREX წყვილის ${alert.pair} მიმდინარე კურსი ${directionText} სამიზნე მაჩვენებელს.\nსამიზნე კურსი: ${alert.targetRate}\nმიმდინარე კურსი ${currentRate}`
    };
  }
  if (alert.alertType === 'crypto') {
    return {
      from: ALERT_EMAIL_USER,
      subject: 'AllRates.ge Alert',
      text: `კრიპტოვალუტის ${alert.pair} მიმდინარე ფასი ${directionText} სამიზნე მაჩვენებელს.\nსამიზნე ფასი: ${alert.targetRate}\nმიმდინარე ფასი ${currentRate}`
    };
  }
  if (alert.alertType === 'asset') {
    return {
      from: ALERT_EMAIL_USER,
      subject: 'AllRates.ge Alert',
      text: `აქტივის ${alert.pair} მიმდინარე ფასი ${directionText} სამიზნე მაჩვენებელს.\nსამიზნე ფასი: ${alert.targetRate}\nმიმდინარე ფასი ${currentRate}`
    };
  }

  return {
    from: ALERT_EMAIL_USER,
    subject: 'AllRates.ge Alert',
    text: `კომპანია ${alert.companyName}-ს მიმდინარე კურსი ${directionText} სამიზნე მაჩვენებელს.\nსამიზნე კურსი: ${alert.targetRate}\nმიმდინარე კურსი ${currentRate}`
  };
}

async function sendRateAlertEmail({ to, alert, currentRate }) {
  if (!ALERT_EMAIL_PASS) {
    throw new Error('EMAIL_PASS არ არის მითითებული');
  }

  const mail = buildAlertEmail({ alert, currentRate });
  await transporter.sendMail({
    ...mail,
    to
  });
}

module.exports = {
  sendRateAlertEmail
};
