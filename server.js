const express = require('express');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/send-email', async (req, res) => {
  const { email, turnus, metadata } = req.body;

  try {
    const pdfBuffer = await generatePDF(turnus, metadata);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Turnus – ${metadata.avdeling || 'Avdeling'} – Drøftingsnotat`,
      text: 'Se vedlagt drøftingsnotat for turnus.',
      attachments: [
        {
          filename: 'drofting_turnus.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/generate-pdf', async (req, res) => {
  const { turnus, metadata } = req.body;
  try {
    const pdfBuffer = await generatePDF(turnus, metadata);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="drofting_turnus.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

function generatePDF(turnus, metadata) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
    const fullHours = 37.5;
    const today = new Date().toLocaleDateString('nb-NO');

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('DRØFTINGSNOTAT – TURNUS', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Dato: ${today}`, { align: 'right' });
    doc.moveDown();

    // Metadata
    if (metadata.avdeling) {
      doc.fontSize(12).font('Helvetica-Bold').text('Avdeling:');
      doc.font('Helvetica').text(metadata.avdeling);
      doc.moveDown(0.5);
    }
    if (metadata.leder) {
      doc.fontSize(12).font('Helvetica-Bold').text('Avdelingsleder:');
      doc.font('Helvetica').text(metadata.leder);
      doc.moveDown(0.5);
    }
    if (metadata.ansatt) {
      doc.fontSize(12).font('Helvetica-Bold').text('Ansatt:');
      doc.font('Helvetica').text(metadata.ansatt);
      doc.moveDown(0.5);
    }

    doc.moveDown();
    doc.fontSize(12).font('Helvetica-Bold').text(`Antall uker i turnusen: ${turnus.weeks.length}`);

    const avgHours = turnus.averageHours;
    const pct = ((avgHours / fullHours) * 100).toFixed(1);
    doc.text(`Gjennomsnittlig arbeidstid per uke: ${avgHours.toFixed(2)} timer`);
    doc.text(`Stillingsprosent: ${pct}%`);

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke();
    doc.moveDown();

    turnus.weeks.forEach((week, wi) => {
      doc.fontSize(13).font('Helvetica-Bold').text(`Uke ${wi + 1}`);
      doc.moveDown(0.3);

      let weekTotal = 0;
      DAYS.forEach((day, di) => {
        const shifts = week[di] || [];
        if (shifts.length === 0) {
          doc.fontSize(10).font('Helvetica').text(`${day}: Fri`);
        } else {
          shifts.forEach((shift) => {
            const net = shift.netHours || 0;
            weekTotal += net;
            const lunchStr = shift.lunchMinutes > 0 ? ` (lunch: ${shift.lunchMinutes} min)` : '';
            doc.fontSize(10).font('Helvetica').text(
              `${day}: ${shift.start} – ${shift.end}${lunchStr}  →  ${net.toFixed(2)} t`
            );
          });
        }
      });

      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica-Bold').text(`Sum uke ${wi + 1}: ${weekTotal.toFixed(2)} timer`);
      doc.moveDown(0.5);
    });

    doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').text('Beregning');
    doc.font('Helvetica').fontSize(10);
    doc.text(`Gjennomsnitt per uke: ${avgHours.toFixed(2)} timer`);
    doc.text(`100% stilling = ${fullHours} timer/uke`);
    doc.text(`Stillingsprosent: ${pct}%`);

    doc.moveDown(2);
    doc.fontSize(11).font('Helvetica-Bold').text('Underskrifter');
    doc.moveDown();
    doc.font('Helvetica').fontSize(10);
    doc.text('Avdelingsleder: _______________________________   Dato: ____________');
    doc.moveDown();
    doc.text('Tillitsvalgt/Fagforbundet: ____________________   Dato: ____________');
    doc.moveDown();
    doc.text('Ansatt: ______________________________________   Dato: ____________');

    doc.end();
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server kjører på http://localhost:${PORT}`));
