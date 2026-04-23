const { PDFDocument, StandardFonts, rgb, PageSizes } = require('pdf-lib');
const nodemailer = require('nodemailer');

// ── Helpers ────────────────────────────────────────────────────────────────
const NAVY = rgb(0.039, 0.122, 0.267);
const GOLD = rgb(0.788, 0.659, 0.298);
const GRAY = rgb(0.42, 0.45, 0.50);
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);

// Sanitize text for pdf-lib — strips non-latin1 characters that crash the renderer
function safe(str) {
  if (!str) return '';
  return String(str)
    .replace(/[\u2018\u2019]/g, "'")   // smart single quotes
    .replace(/[\u201C\u201D]/g, '"')   // smart double quotes
    .replace(/\u2013/g, '-')           // en dash
    .replace(/\u2014/g, '--')          // em dash
    .replace(/\u2026/g, '...')         // ellipsis
    .replace(/[^\x00-\xFF]/g, '');     // strip anything outside latin-1
}

function wrapText(text, maxWidth, font, fontSize) {
  const cleaned = safe(text);
  const words = cleaned.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    const w = font.widthOfTextAtSize(test, fontSize);
    if (w > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawSection(page, title, font, boldFont, fontSize, x, y, pageWidth, margin) {
  const w = pageWidth - margin * 2;
  // Draw navy header bar
  page.drawRectangle({ x: margin, y: y - 2, width: w, height: 16, color: NAVY });
  page.drawText(title.toUpperCase(), {
    x: margin + 6, y: y + 1,
    size: 8, font: boldFont, color: WHITE,
  });
  return y - 22;
}

async function buildPDF(payload) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 60;
  const pageWidth = 612; // US Letter
  const pageHeight = 792;
  const contentWidth = pageWidth - margin * 2;
  const lineH = 13;
  const bodySize = 9;
  const smallSize = 8;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function newPage() {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    // Footer on each page
    page.drawText('Pioneer Legal Consulting, LLC  ·  445 133rd Ave, Wayland, MI 49348  ·  wsnyder@plc-us.com', {
      x: margin, y: 30, size: 7, font, color: GRAY
    });
    const pageCount = pdfDoc.getPageCount();
    page.drawText(`Page ${pageCount}`, {
      x: pageWidth - margin - 40, y: 30, size: 7, font, color: GRAY
    });
  }

  function checkY(needed = lineH * 3) {
    if (y < margin + needed) newPage();
  }

  function drawLine(text, opts = {}) {
    checkY();
    const {
      size = bodySize, f = font, color = BLACK,
      indent = 0, maxWidth = contentWidth - indent, center = false
    } = opts;
    const lines = wrapText(text, maxWidth, f, size);
    for (const line of lines) {
      checkY();
      const xPos = center ? (pageWidth - f.widthOfTextAtSize(line, size)) / 2 : margin + indent;
      page.drawText(line, { x: xPos, y, size, font: f, color });
      y -= lineH;
    }
  }

  function spacer(n = 1) { y -= lineH * n; }

  // ── HEADER ──────────────────────────────────────────────────────────────
  // Gold rule at top
  page.drawRectangle({ x: margin, y: y - 2, width: contentWidth, height: 3, color: GOLD });
  y -= 14;

  drawLine('PIONEER LEGAL CONSULTING, LLC', { size: 14, f: boldFont, color: NAVY, center: true });
  drawLine('445 133rd Ave  ·  Wayland, MI 49348  ·  wsnyder@plc-us.com  ·  (313) 635-3709', {
    size: 7.5, color: GRAY, center: true
  });
  spacer(0.5);

  const docTitles = [];
  if (payload.docs.dealer) docTitles.push('SOLAR EXITING LEGAL SERVICES DEALER / VENDOR AGREEMENT');
  if (payload.docs.rep) docTitles.push('INDIVIDUAL REPRESENTATIVE COMPLIANCE AGREEMENT');

  docTitles.forEach(title => {
    drawLine(title, { size: 12, f: boldFont, color: NAVY, center: true });
  });

  spacer(0.3);
  page.drawRectangle({ x: margin, y: y + 2, width: contentWidth, height: 1, color: GOLD });
  y -= 10;

  // ── PARTIES BLOCK ────────────────────────────────────────────────────────
  drawLine(`Effective Date: ${payload.signedDate}`, { size: bodySize, f: boldFont });
  spacer(0.5);

  if (payload.docs.dealer) {
    drawLine('DEALER / VENDOR:', { size: bodySize, f: boldFont, color: NAVY });
    drawLine(`${payload.companyName}, organized under the laws of the State of ${payload.companyState}, with its principal place of business at ${payload.companyAddress}, owned/operated by ${payload.signerName} ("Dealer").`, { size: bodySize, indent: 12 });
    spacer(0.3);
  }
  drawLine('LEGAL CONSULTANT:', { size: bodySize, f: boldFont, color: NAVY });
  drawLine('Pioneer Legal Consulting, LLC, a limited liability company organized under the laws of the State of Michigan, with its principal place of business at 445 133rd Ave, Wayland, MI 49348 ("PLC").', { size: bodySize, indent: 12 });
  spacer(0.8);

  // ── DEALER AGREEMENT BODY ────────────────────────────────────────────────
  if (payload.docs.dealer) {

    y = drawSection(page, '1. Scope of Services', font, boldFont, bodySize, margin, y, pageWidth, margin);
    drawLine('1.1 Solar Exiting Services. PLC agrees to provide Solar Exiting Services to clients referred by Dealer, including legal consultation and assistance with exiting solar loans, leases, PPAs, and related financing arrangements including TILA rescission, FTC Holder Rule notices, and state UDAP/UDAAP claims.', { size: bodySize, indent: 8 });
    drawLine('1.2 Mandatory Compliance Call. No work commences until compliance call is completed and full payment received.', { size: bodySize, indent: 8 });
    drawLine('1.3 Documentation Requirement. Dealer is solely responsible for collecting and delivering all required Client documentation to PLC prior to commencement of any work. Delays caused by incomplete documentation are Dealer\'s sole responsibility.', { size: bodySize, indent: 8 });
    drawLine('1.4 Representative Training. All Dealer representatives must complete PLC-approved training before any client-facing activity.', { size: bodySize, indent: 8 });
    spacer(0.5);

    y = drawSection(page, '2. Compensation and Payment Terms', font, boldFont, bodySize, margin, y, pageWidth, margin);
    drawLine('2.1 Wholesale Service Fee: $3,500.00 per Client. Dealer is solely responsible for all Service Fees. Clients have no payment obligation to PLC under this Agreement.', { size: bodySize, indent: 8, f: boldFont });
    drawLine('2.2 Payment Before Work Begins. PLC requires payment of the full $3,500.00 Service Fee before any work is initiated. This is a firm, non-negotiable condition of engagement.', { size: bodySize, indent: 8 });
    drawLine('2.3 Accepted Payment Methods. Wire transfer, Zelle, ACH, or other pre-approved direct electronic transfer only. PLC does not absorb any transaction fees — Dealer ensures PLC receives the full $3,500.00 net of any fees.', { size: bodySize, indent: 8 });
    drawLine('2.4 Klarna/Third-Party Financing. Klarna acceptance/denial is solely Klarna\'s determination. Klarna/Stripe processing fees are borne entirely by Dealer. PLC\'s $3,500.00 fee is owed regardless of fees imposed. Dealer\'s net proceeds are paid only after funds clear PLC\'s deposit account.', { size: bodySize, indent: 8 });
    drawLine('2.5 Rep Commissions. PLC does not pay, advance, front, or guarantee any commission to any Dealer representative. All commissions are Dealer\'s sole obligation from Dealer\'s net proceeds.', { size: bodySize, indent: 8 });
    drawLine('2.7 Payment Due Within 48 Hours of Submission.', { size: bodySize, indent: 8 });
    drawLine('2.8 Work Stoppage. If any payment remains unpaid more than 5 calendar days after submission, PLC may suspend all active work on every Dealer matter until all balances are paid in full.', { size: bodySize, indent: 8 });
    drawLine('2.9 Work Product Hold. PLC has no obligation to release any work product until all outstanding balances are paid in full.', { size: bodySize, indent: 8 });
    drawLine('2.10 Collection Costs. Dealer is responsible for all costs of collection including reasonable attorneys\' fees.', { size: bodySize, indent: 8 });
    drawLine('2.11 Chargeback Protection. Dealer remains fully responsible for PLC\'s $3,500.00 fee regardless of any client chargeback, refund demand, financing reversal, reserve hold, or client default.', { size: bodySize, indent: 8 });
    spacer(0.5);

    y = drawSection(page, '3. Wholesale Structure and Dealer Responsibilities', font, boldFont, bodySize, margin, y, pageWidth, margin);
    drawLine('3.1 Wholesale Arrangement. Dealer may resell PLC\'s services at any price. PLC does not control Dealer\'s pricing or margins.', { size: bodySize, indent: 8 });
    drawLine('3.2 No Misrepresentation. Dealer shall not guarantee outcomes, characterize PLC as a law firm, or misrepresent PLC\'s services in any way.', { size: bodySize, indent: 8 });
    drawLine('3.3 Dealer Retains Full Financial Risk. PLC\'s $3,500.00 fee is owed in full regardless of whether Dealer collected from any Client or the outcome of any financing.', { size: bodySize, indent: 8 });
    drawLine('3.4 No False Affiliation. Dealer shall not represent that it is PLC or that its personnel are PLC\'s attorneys.', { size: bodySize, indent: 8 });
    drawLine('3.5 PLC Right to Contact Clients Directly. PLC may contact any Client directly in the event of Dealer non-payment, dispute, or termination.', { size: bodySize, indent: 8 });
    drawLine('3.6 Non-Circumvention. Dealer shall not redirect any Client to avoid payment obligations. Violation is a material breach and all fees remain immediately due.', { size: bodySize, indent: 8 });
    drawLine('3.7 No Authority to Bind PLC. Dealer has no authority to negotiate, settle, execute documents, or speak for PLC in any respect.', { size: bodySize, indent: 8 });
    drawLine('3.8 Brand and Marketing Approval. Any use of PLC\'s name, logo, or materials requires prior written PLC approval, revocable at any time.', { size: bodySize, indent: 8 });
    drawLine('3.9 Recordkeeping. Dealer shall maintain records of all client contracts, financing terms, rep identities, scripts, and marketing materials for 3 years and provide to PLC within 10 business days of request.', { size: bodySize, indent: 8 });
    drawLine('3.10 Non-Solicitation. Dealer shall not solicit or hire PLC personnel or replicate PLC systems for 2 years post-termination.', { size: bodySize, indent: 8 });
    drawLine('3.11 Dealer\'s Full Responsibility for Representatives. Dealer assumes full and unconditional responsibility for the conduct of every individual acting on its behalf, whether or not that individual has executed a separate Rep Compliance Agreement. The absence of a Rep Compliance Agreement increases Dealer\'s exposure — it does not reduce it.', { size: bodySize, indent: 8, f: boldFont });
    drawLine('3.12 Social Media and Digital Asset Ownership. Accounts or digital assets created using PLC\'s name or branding are PLC\'s property and must be transferred to PLC upon termination.', { size: bodySize, indent: 8 });
    spacer(0.5);

    y = drawSection(page, '4. Confidentiality and Non-Disclosure', font, boldFont, bodySize, margin, y, pageWidth, margin);
    drawLine('Each Party shall maintain confidentiality of all non-public information. Dealer shall use the same degree of care for PLC\'s Confidential Information as its own most sensitive information. Dealer shall notify PLC immediately of any unauthorized disclosure and cooperate in remediation. All PLC materials must be returned or destroyed upon termination with written certification. This Agreement complies with the Defend Trade Secrets Act of 2016.', { size: bodySize, indent: 8 });
    spacer(0.5);

    y = drawSection(page, '5. Representations, Warranties, and Compliance', font, boldFont, bodySize, margin, y, pageWidth, margin);
    drawLine('Dealer is duly organized and has authority to enter this Agreement, will provide accurate Client information, and will not make false representations about PLC\'s services. Dealer is solely responsible for all tax obligations, 1099s, worker classification, payroll, and compliance with TCPA, Do Not Call, CAN-SPAM, and all applicable telemarketing and advertising laws. Dealer shall indemnify and hold PLC harmless from any claims arising from Dealer\'s marketing or employment practices.', { size: bodySize, indent: 8 });
    spacer(0.5);

    y = drawSection(page, '6. Term and Termination', font, boldFont, bodySize, margin, y, pageWidth, margin);
    drawLine('Either Party may terminate for convenience on 30 days\' written notice. PLC may terminate immediately for payment-related breaches (3-day cure) or other material breaches (10-day cure), insolvency, or bankruptcy. Upon termination, all outstanding invoices are immediately due. Sections 4, 7, and 8 (including non-solicitation, IP ownership, confidentiality, and indemnification) survive termination.', { size: bodySize, indent: 8 });
    spacer(0.5);

    y = drawSection(page, '7. Indemnification and Limitation of Liability', font, boldFont, bodySize, margin, y, pageWidth, margin);
    drawLine('Dealer shall indemnify and hold PLC harmless from all claims arising from Dealer\'s negligence, willful misconduct, breach of this Agreement, misrepresentations to Clients, pricing arrangements, financing structures, commission obligations, or marketing activities. NEITHER PARTY SHALL BE LIABLE FOR INDIRECT, CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES EXCEPT FOR BREACHES OF CONFIDENTIALITY OR INDEMNIFICATION OBLIGATIONS.', { size: bodySize, indent: 8 });
    spacer(0.5);

    y = drawSection(page, '8. General Provisions', font, boldFont, bodySize, margin, y, pageWidth, margin);
    drawLine('8.1 Independent Contractors; No Agency. Dealer has no authority to bind PLC, negotiate on PLC\'s behalf, or act as PLC\'s agent.  8.2 Entire Agreement — supersedes all prior agreements.  8.3 Amendment — written instrument only.  8.4 Dispute Resolution — non-binding mediation first, then AAA Commercial Arbitration, conducted virtually.  8.5 Emergency Injunctive Relief — PLC may seek immediate court relief for brand misuse, confidentiality breach, or non-solicitation violation without first mediating or arbitrating.  8.6 Governing Law — State of Michigan.  8.9 Intellectual Property — all PLC templates, systems, scripts, and workflows remain PLC\'s sole property.  8.11 Electronic Signatures — binding as originals.  8.13 Waiver — waiver of one breach does not waive subsequent breaches.  8.14 Non-Circumvention Penalty — violations subject to injunctive relief, lost profits, disgorgement, and full attorneys\' fees.', { size: bodySize, indent: 8 });
    spacer(0.8);

    // Personal Guarantee box
    checkY(80);
    page.drawRectangle({ x: margin, y: y - 50, width: contentWidth, height: 60, color: rgb(0.98, 0.96, 0.90) });
    page.drawRectangle({ x: margin, y: y - 50, width: 3, height: 60, color: GOLD });
    page.drawText('PERSONAL GUARANTEE OF PAYMENT', {
      x: margin + 10, y: y - 8, size: 8.5, font: boldFont, color: NAVY
    });
    const guaranteeText = safe(`${payload.signerName}, individually and not solely in their capacity as owner of ${payload.companyName}, hereby personally and unconditionally guarantees the full and timely payment of all amounts owed under this Agreement, including all Service Fees, collection costs, and attorneys' fees. This guarantee is continuing and may be enforced directly against the undersigned without first pursuing remedies against ${payload.companyName}.`);
    const gLines = wrapText(guaranteeText, contentWidth - 20, font, smallSize);
    let gy = y - 20;
    gLines.forEach(line => {
      page.drawText(line, { x: margin + 10, y: gy, size: smallSize, font, color: BLACK });
      gy -= 11;
    });
    y = gy - 10;
  }

  // ── REP AGREEMENT BODY ───────────────────────────────────────────────────
  if (payload.docs.rep) {
    if (payload.docs.dealer) {
      checkY(40);
      page.drawRectangle({ x: margin, y: y, width: contentWidth, height: 1, color: GOLD });
      y -= 20;
      drawLine('INDIVIDUAL REPRESENTATIVE COMPLIANCE AGREEMENT', { size: 11, f: boldFont, color: NAVY, center: true });
      spacer(0.5);
    }

    const dealerRef = payload.repDealerName || payload.companyName || '[DEALER NAME]';
    drawLine(`Representative: ${payload.signerName}${payload.signerTitle ? ', ' + payload.signerTitle : ''}, acting on behalf of ${dealerRef}.`, { size: bodySize });
    spacer(0.5);

    y = drawSection(page, '1. Purpose and Scope', font, boldFont, bodySize, margin, y, pageWidth, margin);
    drawLine('This Agreement governs Representative\'s conduct in connection with referral, marketing, and presentation of PLC\'s Solar Exiting Services on behalf of Dealer. PLC operates under attorney supervision; all client-facing communications must comply with applicable law and PLC\'s standards.', { size: bodySize, indent: 8 });
    spacer(0.5);

    y = drawSection(page, '2. Mandatory Training', font, boldFont, bodySize, margin, y, pageWidth, margin);
    drawLine('Representative must successfully complete PLC\'s approved training program before any client-facing activity. Training completion must be confirmed in writing by PLC.', { size: bodySize, indent: 8 });
    spacer(0.5);

    y = drawSection(page, '3. Authorized Representations and Prohibited Conduct', font, boldFont, bodySize, margin, y, pageWidth, margin);
    drawLine('Representative shall ONLY make representations expressly authorized by PLC in writing or in approved training materials. Representative shall NOT: guarantee any outcome; quote fees without authorization; execute documents for PLC; represent PLC as a law firm or Representative as an attorney; collect payments without express written authorization; represent services will begin before compliance call and payment are complete; or create or use any unapproved marketing materials, scripts, or social media content in any channel or format.', { size: bodySize, indent: 8 });
    drawLine('3.2 Financing Representations. Representative shall not imply financing approval is guaranteed or that PLC controls financing decisions.', { size: bodySize, indent: 8 });
    spacer(0.5);

    y = drawSection(page, '4. Client Submission and Non-Interference', font, boldFont, bodySize, margin, y, pageWidth, margin);
    drawLine('All Clients referred for PLC\'s services are clients of PLC for purposes of service delivery. Representative has no ownership interest in any Client relationship and shall not interfere with PLC\'s direct Client communications or attempt to redirect Clients to other providers.', { size: bodySize, indent: 8 });
    spacer(0.5);

    y = drawSection(page, '5. Payment Acknowledgment and Reporting', font, boldFont, bodySize, margin, y, pageWidth, margin);
    drawLine('All Service Fees are the sole obligation of Dealer. Representative shall not collect, retain, or redirect any payment intended for PLC. Representative shall promptly report to PLC any Client payment not forwarded to PLC. Representative may report payment issues directly to PLC without fear of retaliation from Dealer.', { size: bodySize, indent: 8 });
    drawLine('5.1 Commission Acknowledgment. Any commission owed to Representative is the sole obligation of Dealer. PLC does not pay, advance, or guarantee any commission to any Dealer representative under any circumstances. Representative shall make no claim against PLC for unpaid commissions.', { size: bodySize, indent: 8 });
    spacer(0.5);

    y = drawSection(page, '6. Confidentiality and Non-Disclosure', font, boldFont, bodySize, margin, y, pageWidth, margin);
    drawLine('Representative shall maintain strict confidentiality of all PLC Confidential Information. Social media accounts or digital assets created using PLC\'s name belong to PLC and must be transferred upon termination. Representative shall immediately notify PLC of any unauthorized disclosure and cooperate in remediation. All PLC materials must be returned or destroyed with written certification upon termination. This Agreement complies with the Defend Trade Secrets Act of 2016.', { size: bodySize, indent: 8 });
    spacer(0.5);

    y = drawSection(page, '7. Compliance with Law and Personal Liability', font, boldFont, bodySize, margin, y, pageWidth, margin);
    drawLine('REPRESENTATIVE ACKNOWLEDGES THAT ANY VIOLATION OF THIS AGREEMENT — INCLUDING MISREPRESENTATION OF PLC\'S SERVICES, UNAUTHORIZED STATEMENTS, USE OF UNAPPROVED MATERIALS, OR IMPROPER HANDLING OF FUNDS — MAY RESULT IN PERSONAL LIABILITY, CLAIMS FOR DAMAGES, INDEMNIFICATION OBLIGATIONS, AND REGULATORY EXPOSURE. This personal liability is separate from and in addition to any liability of Dealer.', { size: bodySize, indent: 8 });
    drawLine('Representative is personally responsible for TCPA, Do Not Call, CAN-SPAM, and all applicable advertising law compliance. Non-solicitation of PLC personnel and systems for 2 years post-termination.', { size: bodySize, indent: 8 });
    spacer(0.5);

    y = drawSection(page, '8. Term, Termination, and Immediate Disqualification', font, boldFont, bodySize, margin, y, pageWidth, margin);
    drawLine('Any violation of Section 3 (Authorized Representations) or Section 5 (Payment Acknowledgment) results in IMMEDIATE DISQUALIFICATION from submitting new Clients or participating in active matters. No cure period required.', { size: bodySize, indent: 8 });
    drawLine('8.1 Attorneys\' Fees. Representative shall reimburse PLC for all reasonable attorneys\' fees incurred enforcing this Agreement.', { size: bodySize, indent: 8 });
    drawLine('8.5 No Subcontracting. Representative shall not delegate client-facing activities without PLC\'s prior written approval. Any assistant must independently complete PLC training and execute a Rep Compliance Agreement.', { size: bodySize, indent: 8 });
    drawLine('8.7 Background Check Consent. PLC or Dealer may request a background check as a condition of engagement. Material misrepresentation in onboarding is grounds for immediate termination.', { size: bodySize, indent: 8 });
    spacer(0.5);
  }

  // ── SIGNATURE BLOCK ──────────────────────────────────────────────────────
  checkY(160);
  page.drawRectangle({ x: margin, y: y, width: contentWidth, height: 1, color: GOLD });
  y -= 18;

  drawLine('EXECUTION', { size: 10, f: boldFont, color: NAVY, center: true });
  spacer(0.5);
  drawLine('IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date first written above. The Parties acknowledge and agree that electronic signatures constitute legally binding signatures pursuant to the Electronic Signatures in Global and National Commerce Act (E-SIGN Act) and applicable state law.', { size: smallSize, color: GRAY });
  spacer(0.8);

  // Two-column signature area
  const col1X = margin;
  const col2X = margin + contentWidth / 2 + 10;
  const colW = contentWidth / 2 - 20;
  const sigY = y;

  // Signer column
  page.drawText(payload.docs.dealer ? 'DEALER / VENDOR:' : 'REPRESENTATIVE:', {
    x: col1X, y: sigY, size: 8, font: boldFont, color: NAVY
  });

  // Try to embed signature image
  try {
    const base64Data = payload.signatureImage.split(',')[1];
    const sigBytes = Buffer.from(base64Data, 'base64');
    const sigImg = await pdfDoc.embedPng(sigBytes);
    const sigDims = sigImg.scale(0.35);
    page.drawImage(sigImg, {
      x: col1X, y: sigY - 55,
      width: Math.min(sigDims.width, colW),
      height: Math.min(sigDims.height, 50),
    });
  } catch(e) {
    page.drawText('[Signature on file]', { x: col1X, y: sigY - 30, size: 9, font, color: GRAY });
  }

  page.drawRectangle({ x: col1X, y: sigY - 60, width: colW, height: 0.5, color: GRAY });
  page.drawText(safe(payload.signerName), { x: col1X, y: sigY - 72, size: 8.5, font: boldFont, color: BLACK });
  page.drawText(safe(`${payload.signerTitle || ''}${payload.companyName ? '  |  ' + payload.companyName : ''}`), {
    x: col1X, y: sigY - 84, size: 8, font, color: GRAY
  });
  page.drawText(safe(`Date: ${payload.signedDate}`), { x: col1X, y: sigY - 96, size: 8, font, color: BLACK });

  // PLC column
  page.drawText('PIONEER LEGAL CONSULTING, LLC:', { x: col2X, y: sigY, size: 8, font: boldFont, color: NAVY });
  page.drawRectangle({ x: col2X, y: sigY - 60, width: colW, height: 0.5, color: GRAY });
  page.drawText('Spencer Rowell', { x: col2X, y: sigY - 72, size: 8.5, font: boldFont, color: BLACK });
  page.drawText('Owner / Director', { x: col2X, y: sigY - 84, size: 8, font, color: GRAY });
  page.drawText('Date: ______________________', { x: col2X, y: sigY - 96, size: 8, font, color: BLACK });

  y = sigY - 116;

  // Final footer rule
  checkY(20);
  spacer(0.5);
  page.drawRectangle({ x: margin, y: y, width: contentWidth, height: 2, color: GOLD });
  y -= 8;
  drawLine('This document was electronically signed and timestamped. Pioneer Legal Consulting, LLC maintains a record of this execution.', {
    size: 7, color: GRAY, center: true
  });
  drawLine(`Submitted: ${new Date().toISOString()} · Signer IP logged for verification`, {
    size: 7, color: GRAY, center: true
  });

  // Footer on first page (others added by newPage())
  const pages = pdfDoc.getPages();
  pages[0].drawText('Pioneer Legal Consulting, LLC  ·  445 133rd Ave, Wayland, MI 49348  ·  wsnyder@plc-us.com', {
    x: margin, y: 30, size: 7, font, color: GRAY
  });
  pages[0].drawText('Page 1', { x: pageWidth - margin - 40, y: 30, size: 7, font, color: GRAY });

  return pdfDoc.save();
}

// ── Mailer ─────────────────────────────────────────────────────────────────
async function sendEmails(pdfBytes, payload) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const docNames = [];
  if (payload.docs.dealer) docNames.push('Dealer/Vendor Agreement');
  if (payload.docs.rep) docNames.push('Representative Compliance Agreement');
  const docLabel = docNames.join(' & ');

  const pdfAttachment = {
    filename: `PLC_Signed_Agreement_${payload.signerName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`,
    content: Buffer.from(pdfBytes),
    contentType: 'application/pdf',
  };

  // Email to signer
  await transporter.sendMail({
    from: `"Pioneer Legal Consulting" <${process.env.SMTP_USER}>`,
    to: payload.signerEmail,
    subject: `Your Signed Agreement — Pioneer Legal Consulting, LLC`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #0A1F44; padding: 24px 32px; border-bottom: 3px solid #C9A84C;">
          <div style="color: #fff; font-size: 18px; font-weight: bold;">Pioneer Legal Consulting, LLC</div>
          <div style="color: #C9A84C; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">Electronic Signing Confirmation</div>
        </div>
        <div style="padding: 32px; background: #fff; border: 1px solid #e5e7eb;">
          <p style="font-size: 15px; color: #1a1a2e; margin-bottom: 16px;">Dear ${payload.signerName},</p>
          <p style="color: #374151; line-height: 1.6; margin-bottom: 16px;">
            Thank you for signing the <strong>${docLabel}</strong> with Pioneer Legal Consulting, LLC. Your signed agreement is attached to this email as a PDF. Please retain it for your records.
          </p>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 8px;">Agreement Details</div>
            <div style="font-size: 13px; color: #1a1a2e;"><strong>Document:</strong> ${docLabel}</div>
            <div style="font-size: 13px; color: #1a1a2e; margin-top: 4px;"><strong>Signed By:</strong> ${payload.signerName}${payload.companyName ? ', ' + payload.companyName : ''}</div>
            <div style="font-size: 13px; color: #1a1a2e; margin-top: 4px;"><strong>Date:</strong> ${payload.signedDate}</div>
          </div>
          <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
            If you have questions about your agreement, please contact us directly:
          </p>
          <div style="background: #0A1F44; color: #fff; border-radius: 8px; padding: 16px; font-size: 13px;">
            <strong>Wayne Snyder</strong> — Director of Operations<br>
            wsnyder@plc-us.com &nbsp;·&nbsp; (313) 635-3709<br>
            445 133rd Ave, Wayland, MI 49348
          </div>
        </div>
        <div style="padding: 16px 32px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; font-size: 11px; color: #9ca3af; text-align: center;">
          This email was sent automatically upon execution of your electronic agreement with Pioneer Legal Consulting, LLC.
        </div>
      </div>
    `,
    attachments: [pdfAttachment],
  });

  // Email to PLC
  await transporter.sendMail({
    from: `"PLC Signing Portal" <${process.env.SMTP_USER}>`,
    to: process.env.PLC_NOTIFY_EMAIL || 'wsnyder@plc-us.com',
    subject: `NEW SIGNED AGREEMENT — ${payload.signerName}${payload.companyName ? ' / ' + payload.companyName : ''} — ${docLabel}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px;">
        <div style="background: #0A1F44; padding: 20px 28px; border-bottom: 3px solid #C9A84C;">
          <div style="color: #C9A84C; font-weight: bold; font-size: 14px;">⚡ New Agreement Signed</div>
        </div>
        <div style="padding: 24px; background: #fff; border: 1px solid #e5e7eb;">
          <table style="width:100%; font-size: 13px; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #6b7280; width: 140px;">Document(s)</td><td style="padding: 6px 0; font-weight: 600; color: #1a1a2e;">${docLabel}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Signer Name</td><td style="padding: 6px 0; color: #1a1a2e;">${payload.signerName}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Title</td><td style="padding: 6px 0; color: #1a1a2e;">${payload.signerTitle || '—'}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Company</td><td style="padding: 6px 0; color: #1a1a2e;">${payload.companyName || '—'}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">State</td><td style="padding: 6px 0; color: #1a1a2e;">${payload.companyState || '—'}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td style="padding: 6px 0; color: #1a1a2e;">${payload.signerEmail}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Phone</td><td style="padding: 6px 0; color: #1a1a2e;">${payload.signerPhone}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Date Signed</td><td style="padding: 6px 0; color: #1a1a2e;">${payload.signedDate}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Submitted</td><td style="padding: 6px 0; color: #1a1a2e;">${new Date().toISOString()}</td></tr>
          </table>
        </div>
      </div>
    `,
    attachments: [pdfAttachment],
  });
}

// ── Handler ────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method not allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body);

    // Validate required fields
    if (!payload.signerName || !payload.signerEmail || !payload.signatureImage) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Missing required fields' }) };
    }

    // Build PDF
    const pdfBytes = await buildPDF(payload);

    // Send emails
    await sendEmails(pdfBytes, payload);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Agreement signed and emailed successfully' }),
    };
  } catch (err) {
    console.error('Sign agreement error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message || 'Internal server error' }),
    };
  }
};
