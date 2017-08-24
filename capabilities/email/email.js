'use strict';
const nodeMailer = require('nodemailer');
const Promise = require('bluebird');

// NOTES
// Presently it only supports gmail

let mailTransporter = null;

const login = ((service, user, pass) => {
  console.log('logging in');
  mailTransporter = nodeMailer.createTransport({
    service,
    auth: {
      user,
      pass
    }
  });
});

const sendEmail = ((accountProperties, emailProperties) => {
  console.log('sending mail');
  login(accountProperties.service, accountProperties.user, accountProperties.password);
  const options = emailProperties;
  if (Array.isArray(options.to)) {
    options.to = options.to.join(', ');
  }
  console.log(mailTransporter);
  return mailTransporter.sendMail(options, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
});
module.exports = {
  sendEmail
};
