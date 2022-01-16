const nodemailer = require("nodemailer");
const config = require("./config");

async function sendMail(subject, content, recipients, html) {
    let account = await nodemailer.createTestAccount();

    let transporter = nodemailer.createTransport({
        host: config.mailHost,
        port: config.mailPort,
        secure: true, // true for 465, false for other ports
        auth: {
            user: config.mailUser, // generated ethereal user
            pass: config.mailPass // generated ethereal password
        }
    });

    let mailOptions = {
        from: `"${config.mailFrom}" <${config.mailFrom}>`, // sender address
        to: recipients, // list of receivers, comma separate
        subject: subject, // Subject line
        text: content, // plain text body
        html: html // html body
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log("Message sent: %s", info.messageId);
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    } catch(e) {
        console.log(e);
    }
}

module.exports = sendMail;
