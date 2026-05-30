const nodemailer = require('nodemailer');

const ALERT_EMAIL_USER = process.env.EMAIL_USER || 'g.undilashvili1993@gmail.com';
const ALERT_EMAIL_PASS = process.env.EMAIL_PASS || '';

const transporter = nodemailer.createTransport({
  service: 'gmail',
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
