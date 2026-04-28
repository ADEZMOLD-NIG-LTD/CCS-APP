import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Email API Endpoint
  app.post("/api/send-onboarding-email", async (req, res) => {
    const { email, name, password, companyName } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // SMTP Configuration
    // These should be set in environment variables
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"CCS Onboarding" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Welcome to ${companyName || 'CCS'} - Your Account Details`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
          <h2 style="color: #4f46e5;">Welcome to ${companyName || 'CCS'}!</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>An account has been created for you on the CCS Commodity Control System.</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Login Email:</strong> ${email}</p>
            <p style="margin: 5px 0 0 0;"><strong>Default Password:</strong> <code style="background: #e2e8f0; padding: 2px 4px; border-radius: 4px;">${password}</code></p>
          </div>
          <p style="color: #ef4444; font-weight: bold;">Important: You will be required to change this password upon your first login for security reasons.</p>
          <p>Please log in at: <a href="${process.env.APP_URL || 'http://localhost:3000'}" style="color: #4f46e5;">${process.env.APP_URL || 'CCS Portal'}</a></p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">If you did not expect this email, please contact your administrator.</p>
        </div>
      `,
    };

    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn("SMTP credentials not configured. Skipping email send.");
        return res.json({ success: true, message: "Email skipped (SMTP not configured)" });
      }
      
      console.log(`Attempting to send email via ${process.env.SMTP_HOST || "smtp.gmail.com"} to ${email}`);
      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to send email:", error);
      let errorMsg = "Failed to send email";
      
      if (error.message?.includes('535') || error.message?.includes('Invalid login')) {
        errorMsg = "SMTP login failed. If using Gmail, please ensure you use an 'App Password' instead of your regular password.";
      }
      
      res.status(500).json({ error: errorMsg, details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
