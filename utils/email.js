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

const axios = require("axios");

const sendEmail = async (options) => {
  try {
    const response = await axios.post(
      "https://api.sendinblue.com/v3/smtp/email",
      {
        sender: { name: "PhotoFlow", email: process.env.EMAIL_FROM },
        to: [{ email: options.email }],
        subject: options.subject,
        htmlContent: options.html,
      },
      {
        headers: {
          "api-key": process.env.SENDINBLUE_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    );

    console.log("Email sent:", response.data);
    return response.data;
  } catch (err) {
    console.error("Error sending email:", err.response?.data || err.message);
    throw new Error("There was an error sending the email. Try again later!");
  }
};

module.exports = sendEmail;
