const nodemailer = require('nodemailer');
const dns = require('dns');
const { promisify } = require('util');

dns.setDefaultResultOrder('ipv4first');

const ALERT_EMAIL_USER = process.env.EMAIL_USER || 'g.undilashvili1993@gmail.com';
const ALERT_EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_CONNECTION_TIMEOUT = Number(process.env.EMAIL_CONNECTION_TIMEOUT || 30000);
const lookup4 = promisify(dns.lookup);

async function gmailTransportConfigs() {
  const configs = [];
  const add = (host, port = 587, servername = 'smtp.gmail.com') => {
    if (!host || configs.some(item => item.host === host && item.port === port)) return;
    configs.push({ host, port, servername });
  };

  add(process.env.EMAIL_HOST, Number(process.env.EMAIL_PORT || 587));
  add('smtp.gmail.com', 587);
  add('gmail-smtp-msa.l.google.com', 587);

  for (const host of ['smtp.gmail.com', 'gmail-smtp-msa.l.google.com']) {
    try {
      const resolved = await lookup4(host, { family: 4 });
      add(resolved.address, 587, host === 'smtp.gmail.com' ? 'smtp.gmail.com' : 'gmail-smtp-msa.l.google.com');
    } catch (error) {
      console.warn(`Gmail SMTP IPv4 resolve failed (${host}):`, error.message);
    }
  }

  return configs;
}

function createTransporter({ host, port, servername }) {
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    family: 4,
    tls: {
      servername
    },
    connectionTimeout: EMAIL_CONNECTION_TIMEOUT,
    greetingTimeout: EMAIL_CONNECTION_TIMEOUT,
    socketTimeout: EMAIL_CONNECTION_TIMEOUT,
    auth: {
      user: ALERT_EMAIL_USER,
      pass: ALERT_EMAIL_PASS
    }
  });
}

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
  const configs = await gmailTransportConfigs();
  let lastError;

  for (const config of configs) {
    try {
      await createTransporter(config).sendMail({
        ...mail,
        to
      });
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Alert email transport failed (${config.host}:${config.port}):`, error.message);
    }
  }

  throw lastError || new Error('Alert email transport unavailable');
}

module.exports = {
  sendRateAlertEmail
};
