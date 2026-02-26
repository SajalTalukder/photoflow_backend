// // 582NSPQLLUJJJUX4WABZHXNG
// const nodemailer = require("nodemailer");

// const sendEmail = async (options) => {
//   // 1) Create a transporter
//   // const transporter = nodemailer.createTransport({
//   //   host: process.env.EMAIL_HOST,
//   //   port: process.env.EMAIL_PORT,
//   //   auth: {
//   //     user: process.env.EMAIL_USERNAME,
//   //     pass: process.env.EMAIL_PASSWORD,
//   //   },
//   // });

//   const transporter = nodemailer.createTransport({
//     host: "smtp.gmail.com",
//     port: 587,
//     secure: false, // false for TLS
//     auth: {
//       user: process.env.EMAIL,
//       pass: process.env.EMAIL_PASS,
//     },
//     tls: {
//       rejectUnauthorized: false,
//     },
//   });

//   // 2) Define the email options
//   const mailOptions = {
//     from: `"PhotoFlow" <bigganodvut@gmail.com>`,
//     to: options.email,
//     subject: options.subject,
//     // text: options.message,
//     html: options.html,
//   };

//   // 3) Actually send the email
//   await transporter.sendMail(mailOptions);
// };

// module.exports = sendEmail;

const nodemailer = require("nodemailer");
const Sib = require("nodemailer-sendinblue-transport");

const transporter = nodemailer.createTransport(
  Sib({
    apiKey: process.env.SENDINBLUE_API_KEY,
  }),
);

const sendEmail = async (options) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info);
    return info;
  } catch (err) {
    console.error("Error sending email:", err);
    throw new Error("There was an error sending the email. Try again later!");
  }
};

module.exports = sendEmail;
